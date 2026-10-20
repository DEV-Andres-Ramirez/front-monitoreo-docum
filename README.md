# Monitoreo Docum · LinkTic

Tablero interno de **control y traza diaria de actividades** por colaborador para los proyectos de la línea Docum de LinkTic:

| Proyecto | Cliente | Azure DevOps (org / proyecto) | Épicas monitoreadas |
|---|---|---|---|
| **348 · SGDEA Acueducto** | EAAB – Acueducto de Bogotá | `LinkTic` / `348 - SGDEA ACUEDUCTO` | `539200` Certificación CORE · `539569` Certificación Temáticos |
| **005 · Positiva SGDEA** | Positiva · 3T Capital | `3tcapitalco` / `005 - POSITIVA SGDEA NEW` | `578` Deuda Docum |

## ¿Para qué sirve?

El cliente solicitó monitoreo de lo que hace cada persona asignada. El **Scrum Master** (único usuario, el mismo para ambos proyectos) usa el tablero a diario para registrar, por cada colaborador:

- **Qué hizo** (descripción de la actividad).
- **Cuántas horas** invirtió (en pasos de 0,25 h).
- **A qué HU, tarea o recurso de Azure DevOps** corresponde. Debe pertenecer a las épicas configuradas del proyecto.
- **Evidencia** opcional: un enlace http(s).

Todo queda guardado en Supabase con **traza completa**: bitácora de auditoría con el antes y el después de cada cambio, borrado lógico, y registro de ingresos y salidas.

### Funcionalidades (v2 · rediseño UI/UX)

- **Acceso:** login con token único (`ACCESS_TOKEN`) y sesión firmada de 12 h. La pantalla de ingreso tiene panel de marca, aviso de Bloq Mayús y selector de tema.
- **App shell profesional:**
  - **barra lateral** colapsable (escritorio) con selector de proyecto, navegación, estado de Azure, selector de tema y sesión;
  - **barra inferior tipo app** en móvil, con botón central "+" para registrar;
  - **tira semanal** (Lun→Dom) con un anillo de cobertura por día.
- **Tema claro / oscuro / sistema:** sin parpadeo al cargar (script inline) y con transición circular al cambiar (View Transitions API).
- **Modo TV / pantallas grandes:** botones **− / % / +** para ajustar el tamaño de toda la interfaz, de 75 % a 300 % (clic en el % = 100 %), y botón de **pantalla completa**.
  - Están en la barra superior, en la barra compacta, en "Más" (móvil), en el login y en ⌘K.
  - Atajos: `+`, `−`, `0` y `F`.
  - El tamaño elegido se recuerda en ese navegador y se aplica antes del primer pintado.
  - Al agrandar, el diseño se reacomoda como con el zoom del navegador. Las gráficas se redibujan nítidas (no se estiran).
- **Vistas (rutas reales):**
  - **Resumen** (`/`):
    - 4 KPIs con delta frente al periodo anterior y *sparkline*;
    - 4 gráficas con **Chart.js**: horas diarias frente a capacidad, cobertura de reporte, horas por colaborador (*bullet*), distribución por tipo de ítem (dona) y horas por Feature;
    - tarjeta de **pendientes del día**.
    - Cada gráfica tiene leyenda HTML y **vista de tabla** accesible.
  - **Equipo** (`/equipo`): vistas **Tarjetas / Lista / Matriz**. La matriz es un *heatmap* persona × día de la semana con el valor escrito en cada celda; un clic abre el detalle o el registro de esa fecha.
  - **Actividades** (`/actividades`): agrupadas por día con subtotales y filtros por rango, persona, tipo de ítem y texto. Incluye edición, borrado con **Deshacer** y exportación **CSV**.
  - **Backlog Azure** (`/backlog`): árbol Épica → Feature → HU → Tarea con horas **propias y acumuladas**, personas que registraron y detalle por ítem. Es solo lectura.
  - **Bitácora** (`/bitacora`): línea de tiempo de la auditoría (ingresos, registros, ediciones con comparación antes→después, borrados, restauraciones y sincronizaciones), con filtros y carga incremental.
- **Productividad:**
  - **paleta ⌘K** (`cmdk`) para buscar personas, HU, vistas y acciones;
  - **atajos de teclado**: `N` nueva actividad, `T` hoy, `←/→` día, `1–5` vistas, `F` pantalla completa, `+`/`−`/`0` tamaño, `?` ayuda y `⌘↵` guardar;
  - "Repetir última actividad" y resumen en vivo en el formulario.
- **Formulario:** buscador de work items con teclado (↑↓ Enter). Primero aparecen los ítems **asignados a esa persona**; el servidor valida que pertenezcan a las épicas.
- **Fines de semana:** no se exige reporte (esperado 0 h y estado "Fin de semana"), pero se puede registrar.
- **Accesibilidad:**
  - foco visible;
  - estados siempre con ícono + texto;
  - colores de gráficas validados para daltonismo;
  - `prefers-reduced-motion` respetado.

## ⚠️ Regla de oro: Azure DevOps es SOLO LECTURA

Está **prohibido** crear, modificar o borrar cualquier cosa en Azure DevOps.

- Los PAT solo tienen permisos de lectura: *Work Items (Read)*, *Project and Team (Read)* y *Analytics (Read)*.
- Todo acceso pasa por `azureRead()` en `src/lib/azure.ts`, que solo permite `GET` y el `POST` de consulta WIQL (`/_apis/wit/wiql`).
- La traza se guarda en Supabase. Del work item solo se copia un *snapshot* (tipo, título, estado, URL) al registrar.

## Stack

- **Next.js 16.4** (App Router, `src/`, Turbopack, `cacheComponents`, `proxy.ts`), **React 19.3**, **TypeScript**.
- **Tailwind CSS v4** (tokens semánticos claro/oscuro en `src/app/globals.css`), **motion** (animaciones), **Chart.js 4 + react-chartjs-2** (gráficas), **cmdk** (paleta ⌘K), **lucide-react** (íconos), **sonner** (toasts), **SWR** (datos en el cliente), **zod** (validación), **jose** (JWT), **date-fns**.
- **Supabase (Postgres)**, accedido solo desde el servidor con la llave secreta.
- **Azure DevOps REST API 7.1** (WIQL + Work Items), solo lectura.

## Puesta en marcha local

```bash
pnpm install
# variables: copiar la plantilla y completar
cp .env.example .env
pnpm dev            # http://localhost:3000
```

### Variables de entorno

| Variable | Uso | ¿Vercel? |
|---|---|---|
| `ACCESS_TOKEN` | Token único de ingreso del Scrum Master | ✅ |
| `SESSION_SECRET` | Firma de la cookie de sesión (`openssl rand -hex 32`) | ✅ |
| `SUPABASE_URL` | `https://klrierizueihrenhcema.supabase.co` | ✅ |
| `SUPABASE_SECRET_KEY` | Llave secreta `sb_secret_…` (Dashboard → Settings → API Keys). **Solo servidor** | ✅ |
| `AZURE_348_ORG` / `AZURE_348_PROJECT` / `AZURE_348_EPIC_IDS` / `AZURE_348_PAT` | Conexión de solo lectura al proyecto 348 | ✅ |
| `AZURE_005_ORG` / `AZURE_005_PROJECT` / `AZURE_005_EPIC_IDS` / `AZURE_005_PAT` | Conexión de solo lectura al proyecto 005 | ✅ |
| `SUPABASE_ACCESS_TOKEN` | Token personal `sbp_…`, solo para tooling local (migraciones) | ❌ |

> `.env*` está en `.gitignore`. Solo se versiona `.env.example` (sin secretos).
> Para cambiar las épicas monitoreadas basta con editar `AZURE_<proyecto>_EPIC_IDS` (IDs separados por coma).

## Base de datos (Supabase · proyecto `baas-monitoreo-docum`)

Las migraciones viven en `supabase/migrations/`:

- `0001_schema.sql`: tablas, índices, triggers, RLS.
- `0003_stats_and_restore.sql`: funciones `activity_stats()` / `activity_totals()` (agregados en Postgres, solo ejecutables por `service_role`) y auditoría de `activity_restored`.
- `0002_seed.sql`: colaboradores y asignaciones. Se **genera** desde el Excel de planeación:
  ```bash
  python3 scripts/generate-seed.py [ruta_excel]   # por defecto context/Planeacion_oct2026_Docum_Acueducto.xlsx
  ```
  Es idempotente (`on conflict … do update`), así que sirve para cargar las planeaciones de nuevos meses.

Para aplicarlas: con el MCP de Supabase del proyecto (`.mcp.json`), con `scripts/apply-migrations.mjs` o pegándolas en el **SQL Editor** del dashboard, en orden.

**Estado actual (20-oct-2026):** `0001`, `0002` y `0003` ya están aplicadas en `klrierizueihrenhcema`, con 55 colaboradores y 58 asignaciones (005: 49, 348: 9).

| Tabla | Contenido |
|---|---|
| `projects` | `348`, `005` (nombre, cliente, color) |
| `employees` | Colaboradores únicos (cédula única, nombre, correo) |
| `project_members` | Asignación persona ↔ proyecto: cargo, % asignado, vigencia, Fijo/Multiproyecto |
| `activity_logs` | Registro diario: fecha, horas, descripción, evidencia, work item (snapshot), `deleted_at` |
| `audit_log` | Traza: `login_success`, `login_failed`, `logout`, `activity_created`, `activity_updated`, `activity_deleted`, `activity_restored`, `azure_refresh` (con `old_data`/`new_data`, IP y user-agent) |

**Seguridad:** RLS está activo en todas las tablas y sin políticas, así que `anon`/`authenticated` no tienen acceso. Solo el backend (llave secreta) lee y escribe. Los cambios en `activity_logs` se auditan con el trigger `audit_activity_changes()`.

## Despliegue en Vercel

1. Importar el repositorio en Vercel (framework Next.js; pnpm se detecta solo).
2. En **Settings → Environment Variables**, cargar todas las variables marcadas con ✅. Los valores van **sin comillas**.
3. Desplegar. La sesión usa una cookie `secure` en producción, así que se necesita HTTPS (Vercel lo da por defecto).

## Scripts

| Comando | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` / `pnpm start` | Build y servidor de producción |
| `pnpm lint` | ESLint |
| `python3 scripts/generate-seed.py` | Regenera la semilla desde el Excel |
| `node --env-file=.env scripts/apply-migrations.mjs [archivo.sql]` | Aplica migraciones vía Management API (requiere `SUPABASE_ACCESS_TOKEN`); alternativa al MCP |

## Estructura

```
src/
  proxy.ts                           # verificación optimista de sesión (→ /login o 401)
  app/
    layout.tsx                       # fuentes, script de tema sin parpadeo, toaster
    globals.css                      # tokens claro/oscuro, acento por proyecto ([data-project])
    login/                           # ingreso por token (panel de marca + formulario)
    (app)/                           # grupo con el app shell (Suspense + AppProvider)
      layout.tsx, template.tsx       # shell y transición de entrada por vista
      page.tsx                       # /            Resumen
      equipo/ actividades/ backlog/ bitacora/
    api/
      auth/login, auth/logout        # sesión + auditoría
      projects/[project]/team        # equipo + horas del día/semana
      projects/[project]/stats       # analítica del rango (RPC activity_stats)
      projects/[project]/activities  # GET rango (paginado, filtros) · POST crear
      projects/[project]/work-items  # GET backlog Azure (cache) · POST sincronizar
      activities/[id]                # PATCH editar · DELETE borrado lógico
      activities/[id]/restore        # POST deshacer borrado
      audit                          # GET bitácora paginada por cursor
  lib/
    config.ts, dates.ts, types.ts, work-item-types.ts   # compartidos cliente/servidor
    boot-scripts.ts                  # scripts de <head>: tema y escala/breakpoints antes del primer pintado
    session.ts, auth.ts              # JWT de sesión y DAL
    supabase.ts, members.ts, stats.ts, activities.ts, audit.ts, validators.ts  # servidor
    azure.ts                         # cliente Azure SOLO LECTURA + getWorkItems() con 'use cache'
  components/
    shell/      # app-provider (estado, atajos, paneles globales), sidebar, topbar, mobile-nav, week-strip, command-palette, shortcuts-dialog
    views/      # overview, team (+ compliance-matrix), activities, backlog, audit
    charts/     # setup (registro Chart.js + crosshair), chart-theme, chart-card, hours-charts, azure-charts
    dashboard/  # activity-form, work-item-picker, member-drawer, work-item-sheet, activity-item, team-grid, client-api
    ui/         # primitives (Button, Segmented, Chip, Avatar, badges, Kbd, EmptyState, ProgressRing), sheet, theme, theme-toggle, display (escala + pantalla completa), display-controls…
supabase/migrations/   # SQL versionado (0001 esquema · 0002 semilla · 0003 analítica/restauración)
scripts/               # generate-seed.py, apply-migrations.mjs
context/               # Excel de planeación de personal (insumo; contiene datos personales)
```
