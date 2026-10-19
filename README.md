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

### Funcionalidades (v1)

- **Login con token único** (variable `ACCESS_TOKEN`) y sesión firmada de 12 h.
- **Selector de proyecto** 348 / 005. Cada uno tiene su personal, sus épicas y su color de acento.
- **Navegación por fecha**, con "hoy" calculado en America/Bogota.
- **KPIs del día:**
  - horas registradas frente a las esperadas;
  - colaboradores reportados y % de cobertura;
  - número de actividades;
  - horas de la semana.
- **Pestaña Equipo:**
  - una tarjeta por colaborador con su % de asignación, tipo (Fijo/Multiproyecto), barra de horas frente a la jornada esperada (8 h × % asignado) y estado *Sin registro / Parcial / Completo / Fuera de vigencia*;
  - buscador y filtros.
- **Detalle del colaborador:** línea de tiempo de sus actividades (semana, 30 o 90 días) y registro rápido.
- **Formulario de actividad** con buscador de work items de Azure (por # o título, filtro por tipo). Primero aparecen los ítems **asignados a esa persona**.
- **Pestaña Actividades:** listado por rango, filtrable por colaborador o texto, con edición, borrado (lógico) y **exportación CSV** (formato Excel en español).
- **Sincronizar Azure:** refresca la caché del backlog. Es **solo lectura**.
- Diseño responsivo: en móvil los paneles son bottom sheets y hay un botón flotante para registrar. Incluye animaciones con `motion` y respeta `prefers-reduced-motion`.

## ⚠️ Regla de oro: Azure DevOps es SOLO LECTURA

Está **prohibido** crear, modificar o borrar cualquier cosa en Azure DevOps.

- Los PAT solo tienen permisos de lectura: *Work Items (Read)*, *Project and Team (Read)* y *Analytics (Read)*.
- Todo acceso pasa por `azureRead()` en `src/lib/azure.ts`, que solo permite `GET` y el `POST` de consulta WIQL (`/_apis/wit/wiql`).
- La traza se guarda en Supabase. Del work item solo se copia un *snapshot* (tipo, título, estado, URL) al registrar.

## Stack

- **Next.js 16.4** (App Router, `src/`, Turbopack, `cacheComponents`, `proxy.ts`), **React 19.3**, **TypeScript**.
- **Tailwind CSS v4** (tokens en `src/app/globals.css`), **motion** (animaciones), **lucide-react** (íconos), **sonner** (toasts), **SWR** (datos en el cliente), **zod** (validación), **jose** (JWT), **date-fns**.
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
- `0002_seed.sql`: colaboradores y asignaciones. Se **genera** desde el Excel de planeación:
  ```bash
  python3 scripts/generate-seed.py [ruta_excel]   # por defecto context/Planeacion_oct2026_Docum_Acueducto.xlsx
  ```
  Es idempotente (`on conflict … do update`), así que sirve para cargar las planeaciones de nuevos meses.

Para aplicarlas: con el MCP de Supabase del proyecto (`.mcp.json`), con `scripts/apply-migrations.mjs` o pegándolas en el **SQL Editor** del dashboard, en orden.

**Estado actual (19-oct-2026):** `0001` y `0002` ya están aplicadas en `klrierizueihrenhcema`, con 55 colaboradores y 58 asignaciones (005: 49, 348: 9).

| Tabla | Contenido |
|---|---|
| `projects` | `348`, `005` (nombre, cliente, color) |
| `employees` | Colaboradores únicos (cédula única, nombre, correo) |
| `project_members` | Asignación persona ↔ proyecto: cargo, % asignado, vigencia, Fijo/Multiproyecto |
| `activity_logs` | Registro diario: fecha, horas, descripción, evidencia, work item (snapshot), `deleted_at` |
| `audit_log` | Traza: `login_success`, `login_failed`, `logout`, `activity_created`, `activity_updated`, `activity_deleted`, `azure_refresh` (con `old_data`/`new_data`, IP y user-agent) |

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
  proxy.ts                         # verificación optimista de sesión (→ /login o 401)
  app/
    layout.tsx, globals.css, icon.png
    page.tsx                       # shell + <Dashboard/> (client) dentro de <Suspense>
    login/                         # pantalla de ingreso por token
    api/
      auth/login, auth/logout      # sesión + auditoría
      projects/[project]/team      # equipo + horas del día/semana
      projects/[project]/activities# GET rango · POST crear
      projects/[project]/work-items# GET backlog Azure (cache) · POST sincronizar
      activities/[id]              # PATCH editar · DELETE borrado lógico
  lib/
    config.ts   # proyectos, jornada, zona horaria (compartido cliente/servidor)
    session.ts  # JWT de sesión (jose)
    auth.ts     # DAL: isAuthenticated() en Route Handlers
    supabase.ts # cliente server-only con llave secreta
    azure.ts    # cliente Azure SOLO LECTURA + getWorkItems() con 'use cache'
    activities.ts, validators.ts, audit.ts, dates.ts, types.ts
  components/
    dashboard/  # header, date-nav, kpi-cards, team-grid, member-drawer, activity-form, work-item-picker, activities-table…
    ui/         # sheet, primitives (avatar, badges, chips, skeleton), animated-number, fade-up
supabase/migrations/   # SQL versionado
scripts/generate-seed.py
context/               # Excel de planeación de personal (insumo; contiene datos personales)
```
