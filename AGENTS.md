<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Guía para agentes · Monitoreo Docum (LinkTic)

Lee también `README.md`: tiene el detalle de negocio, las variables de entorno y el despliegue.

## Objetivo de negocio

Tablero interno con el que el **Scrum Master** (único usuario, común a ambos proyectos) registra cada día lo que hizo cada colaborador en dos proyectos monitoreados por solicitud del cliente:

- **348 · SGDEA Acueducto (EAAB)**: Azure org `LinkTic`, proyecto `348 - SGDEA ACUEDUCTO`, épicas `539200` (Certificación CORE) y `539569` (Certificación Temáticos).
- **005 · Positiva SGDEA**: Azure org `3tcapitalco`, proyecto `005 - POSITIVA SGDEA NEW`, épica `578` (Deuda Docum).

Cada registro guarda colaborador, fecha, horas, descripción, evidencia opcional (un enlace) y el **work item de Azure** (HU, tarea, feature…) al que se asocia. Ese work item debe estar bajo las épicas configuradas. El fin es tener **traza y control** de todas las actividades por persona y proyecto.

El personal sale del Excel de planeación (`context/Planeacion_oct2026_Docum_Acueducto.xlsx`, hojas `005 Docum` y `348 Acueducto`). Corte de oct-2026: 49 personas en 005 y 9 en 348; 55 únicas, porque 3 están en ambos.

## 🚫 REGLA DE ORO: Azure DevOps es SOLO LECTURA

- **Nunca** crear, actualizar ni borrar nada en Azure DevOps: work items, comentarios, links, tags, etc.
- Todo acceso pasa por `azureRead()` en `src/lib/azure.ts`. Solo admite `GET` y el `POST` de consulta WIQL a `/_apis/wit/wiql`. No añadir otros métodos ni endpoints de escritura, y no saltarse esa función.
- Los PAT (`AZURE_<key>_PAT`) solo tienen *Work Items (Read)*, *Project and Team (Read)* y *Analytics (Read)*.
- Lo que haya que "guardar" vive en Supabase. Del work item solo se copia un *snapshot* (`work_item_type/title/state/url`) en el momento del registro.

## Arquitectura

- **Next.js 16.4.2** con `cacheComponents: true` y `partialPrefetching: true` (ver `next.config.ts`).
  - El middleware ahora es `src/proxy.ts`.
  - `cookies()` y `new Date()` no pueden ejecutarse durante el prerender: van en Route Handlers o detrás de `<Suspense>`. Por eso `page.tsx` envuelve `<Dashboard/>` en Suspense.
  - `'use cache'` solo funciona en funciones helper, no en el cuerpo de un Route Handler. Para invalidar desde un Route Handler se usa `revalidateTag(tag, { expire: 0 })`; `updateTag` solo vale en Server Actions.
  - Tipos de ruta: `RouteContext<'/api/...'>` es global. Si tsc se queja de rutas nuevas, ejecutar `npx next typegen`.
- **Autenticación:**
  1. `POST /api/auth/login` compara el token con `ACCESS_TOKEN` (`timingSafeEqual` sobre sha256).
  2. Si coincide, emite un JWT HS256 (`jose`, `SESSION_SECRET`) en la cookie httpOnly `docum_session` (12 h).
  3. `proxy.ts` redirige a `/login` (páginas) o responde 401 (API).
  4. **Cada Route Handler vuelve a validar** con `isAuthenticated()` (`src/lib/auth.ts`). Mantener ese patrón en endpoints nuevos.
- **Datos:**
  - La UI es un Client Component (`src/components/dashboard/dashboard.tsx`) que consume Route Handlers con **SWR** (`fetcher`/`api` en `client-api.ts`).
  - Tras mutar se llama `refreshProjectData(projectKey)`.
  - El proyecto activo se guarda en localStorage con `useSyncExternalStore`, sin desajustes de hidratación.
- **Supabase:** `db()` (`src/lib/supabase.ts`, `server-only`) usa `SUPABASE_SECRET_KEY`. **Nunca** exponer esa llave ni crear un cliente Supabase en el navegador.
- **Azure:**
  - `getWorkItems(key)` hace una WIQL recursiva (`WorkItemLinks … Hierarchy-Forward MODE (Recursive)`) y luego `GET wit/workitems?ids=` en lotes de 200.
  - Está cacheado con `'use cache'` + `cacheTag('azure-<key>')` + `cacheLife('minutes')`.
  - El botón "Sincronizar" invalida la etiqueta.
  - Al crear o editar una actividad, el servidor valida que el work item pertenezca al árbol (`workItemSnapshot`).
- **Fechas:**
  - Se manejan como `YYYY-MM-DD`, y "hoy" se calcula en `America/Bogota` (`src/lib/dates.ts`).
  - La semana va de lunes a domingo.
  - Jornada esperada: `JORNADA_HORAS (8) × allocation` (`src/lib/config.ts`).

## Modelo de datos (`supabase/migrations/`)

- `projects(key PK '348'|'005')`
- `employees(id, full_name, document_id UNIQUE, email)`
- `project_members(project_key, employee_id, role, allocation 0–1, start_date, end_date, assignment_type, active)`, con UNIQUE(project_key, employee_id).
- `activity_logs(id, project_key, employee_id, work_date, hours 0–24, description, evidence_url http(s), work_item_id, work_item_type/title/state/url, created_at, updated_at, deleted_at)`. **El borrado es lógico**: no usar `DELETE` físico.
- `audit_log(action, entity, entity_id, project_key, old_data, new_data, ip, user_agent)`:
  - el trigger `audit_activity_changes()` registra `activity_created/updated/deleted`;
  - la app registra `login_success/login_failed/logout/azure_refresh` (`src/lib/audit.ts`).
- RLS está activo en todas las tablas **sin políticas**: solo el backend accede. Si se agregan tablas, mantener RLS activo y `revoke all … from anon, authenticated`.

### Cambios de esquema o de personal

1. Crear `supabase/migrations/000N_descripcion.sql` (idempotente cuando sea posible) y aplicarlo con el MCP de Supabase del proyecto (`.mcp.json`, project_ref `klrierizueihrenhcema`). **No** usar el conector personal `claude.ai Supabase`, que es otra cuenta. Si el MCP no está disponible, usar `node --env-file=.env scripts/apply-migrations.mjs 000N_x.sql` con `SUPABASE_ACCESS_TOKEN`. Ya están aplicadas: `init_schema` (0001) y `seed_personal_oct2026` (0002).
2. Nueva planeación de personal: reemplazar el Excel en `context/`, ejecutar `python3 scripts/generate-seed.py` y aplicar `0002_seed.sql` (hace upsert por cédula y por proyecto+persona).
3. Revisar `get_advisors` (security) después de cualquier DDL.

## Convenciones

- Idioma de la UI, los comentarios y los mensajes de error: **español**. Formato numérico `es-CO`.
- **Identidad visual:**
  - azul `#0090FF` / `#00C2FF` y verde `#13A538` / `#22D400`, tomados del logo (`public/linktic_logo.png`, `public/linktic_icon.png`);
  - tokens en `globals.css` (`--accent` cambia por proyecto: 348 azul, 005 verde);
  - tipografías: `font-display` (Outfit) para títulos y Geist para el texto.
- **Componentes UI propios y livianos** en `src/components/ui/`. No hay librería de componentes: reutiliza `Sheet`, `Chip`, `Avatar`, `TypeBadge`, `StateBadge`, `Skeleton` y `AnimatedNumber`.
- **Animaciones con `motion/react`:** `layoutId` para píldoras, `AnimatePresence` para listas y paneles. Respetar `prefers-reduced-motion`; ya está cubierto en CSS.
- **Diseño mobile-first:** los paneles son bottom sheets en `< sm`, hay un FAB en móvil y en la pestaña Actividades la tabla pasa a tarjetas en `< md`.
- **No usar `alert`/`confirm`/`prompt`:** la confirmación de borrado es en línea (`DeleteButton`).
- **Validación de entrada** con zod (`src/lib/validators.ts`) en el servidor. El cliente solo hace validaciones de cortesía.
- **Verificación antes de entregar:** `pnpm lint`, `pnpm build`, y `npx tsc --noEmit` si cambiaste rutas.

## Roadmap sugerido (no implementado)

- Reportes por rango y por persona: horas frente a capacidad planeada, gráficas, y horas por work item, feature o épica.
- Alertas de colaboradores sin registro, como un resumen diario.
- Plantillas o duplicado de actividades recurrentes, y registro masivo para varias personas.
- Vista de bitácora (`audit_log`) dentro del tablero.
- Gestión de personal desde la UI: altas, bajas y cambios de % sin pasar por el Excel.
- Usuarios múltiples con roles, en lugar del token único.
