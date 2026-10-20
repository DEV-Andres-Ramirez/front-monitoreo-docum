# Monitoreo Docum · LinkTic

Tablero interno de **monitoreo automático** del trabajo de cada colaborador en los proyectos de la línea Docum de LinkTic, calculado a partir de **Azure DevOps** (solo lectura):

| Proyecto | Cliente | Azure DevOps (org / proyecto) | Épicas monitoreadas (filtro opcional) |
|---|---|---|---|
| **348 · SGDEA Acueducto** | EAAB – Acueducto de Bogotá | `LinkTic` / `348 - SGDEA ACUEDUCTO` | `539200` Certificación CORE · `539569` Certificación Temáticos |
| **005 · Positiva SGDEA** | Positiva · 3T Capital | `3tcapitalco` / `005 - POSITIVA SGDEA NEW` | `578` Deuda Docum |

## ¿Para qué sirve?

El cliente pidió monitorear lo que hace cada persona asignada. El **Scrum Master** (único usuario, común a ambos proyectos) **no registra nada a mano**. El tablero cruza **por correo** al personal del Excel de planeación con los ítems asignados en Azure DevOps (HU, Tareas y Bugs de todo el proyecto) y calcula automáticamente:

- **Qué tiene asignado cada colaborador** y en qué estado está: por iniciar, en curso, entregado o cerrado.
- **Horas:** 1 punto de esfuerzo = 1 hora. Se toman Story Points o Effort; si no hay, la Estimación original. **No hay doble conteo**: si una HU y sus tareas tienen valor, suman las tareas. Se compara con el "Trabajo completado" que reportan en Azure.
- **Tiempos:** creación → cierre (*lead time*), en curso → cerrado (*cycle time*) y la **traza completa de cambios de estado**, con la duración en cada uno.
- **Plan vs. real:** fecha de inicio y fecha objetivo (del ítem o, si no las tiene, del sprint) frente al inicio real y la **entrega real** (campo "Fecha de entrega real" si existe, si no "Entregado" o el cierre). De ahí salen la puntualidad, los vencidos y los días de retraso.
- **Capacidad y utilización:** capacidad = 8 h × % asignado × días hábiles vigentes; utilización = horas entregadas ÷ capacidad.

## Funcionalidades (v3 · monitoreo automático)

- **Acceso:** login con token único (`ACCESS_TOKEN`) y sesión firmada de 12 h.
- **Filtros globales**, en el header y en el botón "Filtros" de móvil; se recuerdan por proyecto:
  - **Periodo:** sprint actual, 14/30/90 días, este mes, trimestre o rango personalizado.
  - **Colaboradores:** multiselección, más "Incluir fuera de la planeación".
  - **Ámbito:** todo el proyecto o solo las épicas monitoreadas.
- **Vistas:**
  - **Resumen** (`/`):
    - 6 KPIs con delta frente al periodo anterior: entregados, horas entregadas, en curso, vencidos, % a tiempo y cycle time;
    - **entregas por semana**, distribución por estado y **flujo acumulado (CFD)**;
    - **burnup** de horas y **dispersión de cycle time** con P50/P85;
    - tarjeta de **alertas**: vencidos y trabajo estancado.
  - **Cronograma** (`/cronograma`): **diagrama de Gantt**.
    - Agrupado por colaborador, feature o sprint.
    - Cada ítem muestra la barra **planeada** (inicio → objetivo), la barra **real** coloreada por estado, el ◆ de la fecha objetivo, el ● de la entrega real y el **tramo de retraso** en rojo.
    - Incluye línea de "hoy", bandas de sprint, zoom día/semana/mes, orden, filtros por tipo y "solo con retraso".
  - **Colaboradores** (`/colaboradores`):
    - **scorecards** (tarjetas o tabla) con utilización, puntualidad, cycle time y vencidos;
    - **carga semanal** (mapa de calor persona × semana);
    - gráficas de estado por persona y de estimado frente a reportado;
    - sección **"Fuera de la planeación"**, para vincular manualmente correos de Azure que no coinciden.
  - **Backlog Azure** (`/backlog`): árbol Épica → Feature → HU → Tarea con estado, asignado, objetivo, entrega y horas acumuladas.
  - **Bitácora** (`/bitacora`): ingresos, sincronizaciones (con conteos o errores) y vinculaciones.
- **Detalle de un ítem:** ruta Épica › Feature › HU, horas y su origen, plan frente a real, puntualidad, **línea de tiempo de estados** con duraciones e ítems hijos.
- **Detalle de un colaborador:** utilización, KPIs, **mini-Gantt** e ítems por estado.
- **Pantalla para TV:** tamaño de 75 % a 300 % (− / % / +) y pantalla completa. Atajos `+`, `−`, `0` y `F`.
- **Tema** claro, oscuro o del sistema, sin parpadeo.
- **⌘K** para buscar personas, ítems, periodos y acciones; `1–5` cambian de vista; `?` muestra la ayuda.
- **Accesibilidad:** colores de estado validados para daltonismo, estados siempre con texto, vista de tabla en cada gráfica y `prefers-reduced-motion`.

## ⚠️ Regla de oro: Azure DevOps es SOLO LECTURA

Está **prohibido** crear, modificar o borrar cualquier cosa en Azure DevOps.

- Los PAT solo tienen permisos de lectura: *Work Items (Read)*, *Project and Team (Read)* y *Analytics (Read)*.
- Todo acceso pasa por `azureRequest()` en `src/lib/azure.ts`. Solo admite:
  - **GET** a `dev.azure.com` (REST de lectura);
  - **GET** a `analytics.dev.azure.com/…/_odata/` (Azure Analytics);
  - el **POST de consulta WIQL**.
- La copia sincronizada vive en Supabase. Lo único que el tablero escribe son los **alias** de correo y la bitácora, ambos en su propia base.

## Cómo funciona la sincronización

1. **Lectura:** `src/lib/azure-sync.ts` consulta **Azure Analytics (OData)**, con paginación, en dos frentes:
   - `WorkItems`: tipos Epic, Feature, User Story, Task, Bug, PBI e Issue, con estado, *StateCategory*, fechas, esfuerzo, sprint y asignado;
   - `WorkItemRevisions`: el historial de estados.
   - La primera vez trae 12 meses más todo lo abierto. Después es **incremental** desde la última marca de agua.
2. **Escritura en la base propia:** se hace *upsert* en `azure_work_items` y `azure_revisions`, y la corrida queda en `azure_sync_runs` y en `audit_log`.
3. **Automática cada hora (sin cron, sin variables nuevas):**
   - Mientras el tablero esté abierto, el navegador llama a `POST /api/sync/auto` a la hora indicada por el servidor (`nextAutoAt`).
   - El servidor solo sincroniza los proyectos (348 y 005) que ya cumplieron una hora desde su última sincronización exitosa.
   - Si una corrida falla, el siguiente intento es a los **10 minutos**, sin bucles.
   - La primera vez que se abre el tablero, si no hay datos, `GET /api/projects/[p]/dataset` hace la sincronización completa y espera. Fuera de ese caso, el dataset solo lee de Supabase.
4. **Manual:** **"Sincronizar ahora"** (`POST /api/projects/[p]/sync`) y "Resincronizar todo" (`?full=1`).
   - En la Bitácora, cada corrida indica si fue automática, manual o inicial.
5. **Lectura de la UI:** el RPC `azure_dataset(proyecto, desde, hasta)` devuelve los ítems asignados "vivos" en el periodo (más sus ancestros y las transiciones de estado). El motor de análisis (`src/lib/analytics/*`) calcula todo **en el navegador**, así que los filtros responden al instante.

**Identidad (`src/lib/analytics/model.ts`):** un correo de Azure se vincula a un colaborador en este orden:
1. alias manual;
2. correo exacto;
3. misma parte local (`juan.perez@3tcapital.co` = `juan.perez@linktic.com`);
4. todos los tokens del nombre (p. ej. "Jhonatan Rocha" → "Jhonatan Rocha Rojas").

Los prefijos `oidconflict_upnreuse_…_` se limpian.

## Stack

- **Next.js 16.4** (App Router, `src/`, Turbopack, `cacheComponents`, `proxy.ts`, `after()`), **React 19.3**, **TypeScript**.
- **Tailwind CSS v4** (tokens claro/oscuro, breakpoints sobre el ancho efectivo), **motion**, **Chart.js 4 + react-chartjs-2**, **cmdk**, **lucide-react**, **sonner**, **SWR**, **zod**, **jose** y **date-fns**.
- **Supabase (Postgres)**, accedido solo desde el servidor con la llave secreta.
- **Azure DevOps**: Analytics OData v4.0-preview y REST 7.1, en solo lectura.

## Puesta en marcha local

```bash
pnpm install
cp .env.example .env   # completar valores
pnpm dev               # http://localhost:3000
```

### Variables de entorno (sin cambios desde la v1)

| Variable | Uso | ¿Vercel? |
|---|---|---|
| `ACCESS_TOKEN` | Token único de ingreso del Scrum Master | ✅ |
| `SESSION_SECRET` | Firma de la cookie de sesión (`openssl rand -hex 32`) | ✅ |
| `SUPABASE_URL` | `https://klrierizueihrenhcema.supabase.co` | ✅ |
| `SUPABASE_SECRET_KEY` | Llave secreta `sb_secret_…`. **Solo servidor** | ✅ |
| `AZURE_348_ORG` / `AZURE_348_PROJECT` / `AZURE_348_EPIC_IDS` / `AZURE_348_PAT` | Lectura del proyecto 348 (REST + Analytics) | ✅ |
| `AZURE_005_ORG` / `AZURE_005_PROJECT` / `AZURE_005_EPIC_IDS` / `AZURE_005_PAT` | Lectura del proyecto 005 (REST + Analytics) | ✅ |
| `SUPABASE_ACCESS_TOKEN` | Token personal `sbp_…`, solo para tooling local | ❌ |

> `AZURE_<p>_EPIC_IDS` solo alimenta el filtro "Épicas monitoreadas"; el análisis cubre todo el proyecto.

## Base de datos (Supabase · `baas-monitoreo-docum`)

| Migración | Contenido |
|---|---|
| `0001_schema.sql` | Proyectos, colaboradores, asignaciones, `audit_log`, RLS (y `activity_logs`, legado) |
| `0002_seed.sql` | Personal del Excel (lo genera `python3 scripts/generate-seed.py`; idempotente) |
| `0003_stats_and_restore.sql` | Funciones del registro manual (**legado**, sin uso) |
| `0004_azure_sync.sql` | `azure_work_items`, `azure_revisions`, `azure_sync_runs`, `employee_aliases`, RPC `azure_dataset` |
| `0005_azure_dataset_assigned.sql` | `azure_dataset` solo con ítems asignados (respuesta más liviana) |

**Estado (20-oct-2026):** las cinco migraciones están aplicadas. Primera sincronización: 348 con 6.838 ítems y 25.874 revisiones (≈ 45 s); 005 con 627 ítems y 1.942 revisiones (≈ 7 s). Las incrementales tardan segundos.

**Seguridad:**
- RLS está activo en todas las tablas sin políticas: `anon`/`authenticated` no tienen acceso.
- Las RPC son ejecutables solo por `service_role`.
- Las tablas del registro manual (`activity_logs`) se conservan por trazabilidad; ya no se usan.

## Despliegue en Vercel

1. Importar el repositorio (Next.js + pnpm).
2. Cargar las variables marcadas con ✅, **sin comillas**.
3. Desplegar. Las rutas `dataset`, `sync` y `sync/auto` declaran `maxDuration = 300` para la primera sincronización completa; las siguientes son incrementales (segundos).

## Scripts

| Comando | Descripción |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` / `pnpm lint` | Desarrollo, build, producción y lint |
| `python3 scripts/generate-seed.py [excel]` | Regenera la semilla del personal |
| `node --env-file=.env scripts/apply-migrations.mjs [archivo.sql]` | Aplica migraciones vía Management API (alternativa al MCP) |

## Estructura

```
src/
  proxy.ts                               # sesión (→ /login o 401)
  app/
    layout.tsx, globals.css               # scripts de arranque (tema, escala), tokens, breakpoints efectivos
    login/                                # ingreso por token
    (app)/                                # app shell (Suspense + AppProvider)
      page.tsx                            # /               Resumen
      cronograma/ colaboradores/ backlog/ bitacora/
    api/
      auth/login, auth/logout
      projects/[project]/dataset          # dataset de análisis (solo lee; sincroniza completo solo la primera vez)
      projects/[project]/sync             # estado / sincronizar ahora / resincronizar todo
      sync/auto                           # sincronización automática cada hora (ambos proyectos)
      aliases                             # vincular / desvincular correo de Azure ↔ colaborador
      audit                               # bitácora paginada
  lib/
    azure.ts                              # cliente Azure SOLO LECTURA (REST + Analytics OData)
    azure-sync.ts                         # sincronización Analytics → Supabase
    analytics/                            # types, model (identidad, horas, fechas, traza), metrics, period, state-colors
    config.ts, dates.ts, boot-scripts.ts, work-item-types.ts, session.ts, auth.ts, supabase.ts, members.ts, audit.ts, types.ts
  components/
    shell/      # app-provider (filtros globales, dataset, atajos), topbar, filter-bar, sidebar, mobile-nav, command-palette…
    views/      # overview, schedule (Gantt), people, backlog, audit, dataset-gate
    gantt/      # Gantt plan vs. real (HTML/CSS en rem)
    charts/     # Chart.js: flow-charts (throughput, CFD, burnup, cycle time, estados, estimado), chart-card, chart-theme
    dashboard/  # work-item-sheet (traza de estados), member-sheet, client-api (fetch + preferencias)
    ui/         # primitives, sheet, popover, theme, display (escala TV + pantalla completa)…
supabase/migrations/   # 0001 → 0005
scripts/               # generate-seed.py, apply-migrations.mjs
context/               # Excel de planeación (contiene datos personales)
```
