<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Guía para agentes · Monitoreo Docum (LinkTic)

Lee también `README.md`: tiene el negocio, la sincronización, las variables y el despliegue.

## Objetivo de negocio

Tablero interno del **Scrum Master** (único usuario, común a ambos proyectos) para monitorear **automáticamente** el trabajo de cada colaborador. **No hay registro manual.** Todo se calcula desde Azure DevOps, cruzando **por correo** al personal de cada proyecto (Global + No Global) con los ítems asignados **que cuelgan de las épicas monitoreadas**. Las demás épicas del proyecto **no se analizan**:

- **348 · SGDEA Acueducto (EAAB)**: org `LinkTic`, proyecto `348 - SGDEA ACUEDUCTO`. Épicas: `539200` Certificación CORE y `539569` Certificación Temáticos.
- **005 · Positiva SGDEA**: org `3tcapitalco`, proyecto `005 - POSITIVA SGDEA NEW`. Épica: `578` Deuda Técnica y Contractual.

Reglas de negocio (decididas con el usuario):
- **1 punto de esfuerzo = 1 hora.**
  - Horas = `StoryPoints ?? Effort ?? OriginalEstimate`.
  - **Sin doble conteo:** si un padre tiene hijos con horas, suman los hijos.
  - Se compara contra `CompletedWork`.
- **Personas:** **Global** es la base de personal de LinkTic. En la UI **siempre se dice "Global", nunca "Excel" ni "planeación"**. Hoy se carga desde `context/…xlsx` → `0002_seed.sql` (55 personas, `in_global = true`).
  - El **personal del proyecto** es Global **+ miembros No Global**: `project_members.in_global = false`, sin cargo ni % (sin capacidad), con la etiqueta `NoGlobalBadge` junto al nombre. Cuentan en el análisis como cualquier miembro (`Person.inRoster = true`, `inGlobal = false`, `isNoGlobal()` / `personRoleLabel()` en `model.ts`).
  - Hoy, en 348: David Felipe Vergara Bogota y Jhostin Alexander Ladino Gonzalez (0009). Para agregar otro: insertar en `employees` (la cédula es opcional) y en `project_members` con `in_global = false`, `role` y `allocation` en null y `assignment_type = 'No Global'`.
  - Quien tenga ítems en las épicas sin ser personal del proyecto aparece en "Fuera de Global" (no cuenta en los indicadores salvo `includeOthers`) y se puede **vincular** (alias).
- **Alcance:** **solo** HU, Tareas y Bugs que cuelgan de las épicas monitoreadas (`AZURE_<p>_EPIC_IDS`). Hay un filtro por épica (en 348: Todas / CORE / Temáticos), pero nunca se sale de ellas.
- **Gantt plan vs. real:**
  - plan = `StartDate`/`TargetDate` del ítem; si no existen, las fechas del **sprint**;
  - real = `InProgressDate` → entrega (`Custom.FechadeEntregaReal` ?? `ResolvedDate` ?? `CompletedDate`);
  - a tiempo si la entrega ≤ fin del día objetivo.
- **Capacidad** = 8 h × % asignado × días hábiles vigentes; **utilización** = horas entregadas ÷ capacidad.
- **Días hábiles** = lunes a viernes **sin festivos de Colombia** (`colombianHolidays()` / `isBusinessDay()` en `src/lib/dates.ts`).
- **Meta de cierre (solo 348, `PROJECTS["348"].goal` en `config.ts`):**
  - 24 tareas `Video` y 24 `Informe` por día hábil desde el 19-oct; cierre el 13-nov;
  - cuenta **todas** las tareas con esos tags de ambas épicas, **sin** filtrar por persona ni por Global (decisión del usuario: las de Informe son de David Vergara, No Global);
  - completada = Entregado o Cerrado, en el día de su fecha de entrega real;
  - la meta acumulada es diaria × días hábiles desde `start`, con tope en el total;
  - lo cerrado antes de `start` cuenta como avance.

## 🚫 REGLA DE ORO: Azure DevOps es SOLO LECTURA

- **Nunca** crear, actualizar ni borrar nada en Azure DevOps: work items, comentarios, links, tags, etc.
- Toda llamada pasa por `azureRequest()` en `src/lib/azure.ts`, que valida host, método y ruta:
  - **GET** a `dev.azure.com`;
  - **GET** a `analytics.dev.azure.com/{org}/{project}/_odata/…`;
  - **POST** solo a `/_apis/wit/wiql` (consulta).
  - No agregues otros métodos o endpoints, ni hagas `fetch` directo a Azure.
- Los PAT tienen *Work Items (Read)*, *Project and Team (Read)* y *Analytics (Read)*.
- Lo único que se escribe va a **Supabase**: la copia sincronizada, los alias y la bitácora.

## Arquitectura

- **Next.js 16.4.2** con `cacheComponents` y `partialPrefetching`:
  - El middleware es `src/proxy.ts`.
  - `cookies()` y `new Date()` van en Route Handlers o detrás de `<Suspense>` (el shell vive en `src/app/(app)/layout.tsx`).
  - `after()` (de `next/server`) ejecuta trabajo tras responder.
  - `RouteContext<'/api/...'>` es global; si cambian las rutas, ejecuta `npx next typegen`.
- **Autenticación:**
  - `POST /api/auth/login` (`timingSafeEqual`) emite un JWT HS256 en la cookie `docum_session` (12 h).
  - `proxy.ts` hace la verificación optimista.
  - **Cada Route Handler** valida con `isAuthenticated()`.
- **Sincronización** (`src/lib/azure-sync.ts`):
  - Lee Azure Analytics OData (`WorkItems` + `WorkItemRevisions`, con paginación por `@odata.nextLink`) y hace upsert en `azure_work_items` / `azure_revisions` por lotes de 500.
  - Completa = 12 meses + abiertos. Incremental = `ChangedDate ≥ marca de agua − 10 min`.
  - Candado de 5 min con `azure_sync_runs.status = running`.
  - El campo `Custom_FechadeEntregaReal` solo existe en 348; si OData responde 400, se reintenta sin él.
  - `normalizeEmail()` limpia el prefijo `oidconflict_upnreuse_…_` y pasa a minúsculas.
- **Disparo:**
  - **Automática cada hora:**
    - `syncStatus()` calcula `nextAutoAt` = última sincronización exitosa + 60 min. Si la última corrida falló, la fecha pasa a ese intento + 10 min.
    - La última corrida exitosa se consulta aparte, para que una racha de errores no la "olvide".
    - `AppProvider` programa un `setTimeout` a esa hora y llama a `POST /api/sync/auto`. Ese endpoint ejecuta `syncDueProjects()`, que sincroniza solo los proyectos vencidos (ambos), y devuelve el siguiente `nextAutoAt`.
    - Funciona mientras el tablero esté abierto.
  - **Manual:** `POST /api/projects/[p]/sync[?full=1]`.
  - **Primera carga:** `GET /api/projects/[p]/dataset` solo sincroniza (completa, esperando) si nunca hubo una exitosa y `isSyncDue`. Fuera de eso **solo lee**; nunca dispares sincronizaciones desde el dataset, porque así se causó un bucle de reintentos.
  - `maxDuration = 300` en las tres rutas.
  - El `trigger` (`auto|manual|initial`) queda en `audit_log.new_data`.
  - **No hay cron ni variables nuevas.** Un cron de Vercel requeriría `CRON_SECRET` y, para correr cada hora, el plan Pro.
- **Errores de Azure:** no uses `instanceof AzureHttpError` fuera de `azure.ts`; revisa `error.status`. En `next dev`, un módulo viejo en memoria (tras reescribir `azure.ts`) dejó la clase `undefined` y ocultó el error real. Si pasa, reinicia `pnpm dev`.
- **Dataset:**
  - el RPC `azure_dataset(p, from, to, p_epics)` (0006) recorre el árbol de las épicas monitoreadas y devuelve los ítems **asignados** vivos en el periodo que cuelgan de ellas (`created ≤ to` y abiertos o `completed ≥ from`), sus **ancestros hasta la épica**, las **épicas** (siempre, para el filtro) y las **transiciones de estado** (filas donde cambia el estado);
  - la sincronización copia todo el proyecto a propósito (detecta lo que entra o sale de las épicas); **el recorte se hace en el RPC**. La versión de 3 argumentos (0005) es legado: no la uses ni la borres sin coordinar los despliegues;
  - un ítem está "vivo" en el periodo si se creó antes de su fin **o se entregó dentro de él** (fecha de entrega real registrada a posteriori; 0007), y no se cerró antes de su inicio. `isAlive()` en `metrics.ts` aplica la misma regla;
  - la UI pide desde lo más antiguo entre el **periodo anterior** (deltas) y la **ventana de tendencia** (`trendRange`: 7 días mínimo para CFD, burnup, sparklines y entregas por día).
- **Motor de análisis (cliente, TS puro)** en `src/lib/analytics/`:
  - `model.ts`: `buildModel()` resuelve identidad (alias → correo exacto → parte local → tokens del nombre), horas sin doble conteo, fechas plan/real, puntualidad, vencidos, segmentos de estado, ancestros (feature, `epicId` = épica monitoreada de la que cuelga, `inMonitoredEpics`), `model.epics` (id + título) e iteraciones;
  - `scopedWork()` / `inEpics()` en `metrics.ts` exigen `inMonitoredEpics` (defensa además del RPC) y aplican el filtro por épica;
  - `metrics.ts`: KPIs, throughput semanal, CFD, burnup, cycle time (P50/P85), antigüedad del WIP, `perPerson` y `workloadMatrix`. Recibe `now` explícito: no llames `Date.now()` en render;
  - `period.ts`: presets. Los rápidos son `today`, `yesterday`, `thisWeek` (`DEFAULT_PRESET`) y `lastWeek`, con semana de lunes a domingo. El resto (`MORE_PRESETS`) incluye "Sprint actual", deducido de las iteraciones conocidas guardadas en localStorage. `comparisonLabel()` describe el periodo con que se compara (`previousRange(range, preset)` en `metrics.ts`: Hoy y Ayer contra el día hábil anterior; semanas, desplazadas 7 días);
  - `goal.ts`: `goalProgress(goal, tasks, today, tag)` calcula, por tag y en total, el avance, la serie diaria de `start` a `deadline`, el acumulado frente a la meta, el ritmo necesario y el actual (últimos 5 días hábiles cerrados) y la proyección. Los datos vienen de `GET /api/projects/[p]/goal` → RPC `azure_goal_tasks` (0008), no del dataset del periodo. Colores de tag fijos (violeta y magenta), validados con dataviz;
  - filtro de tag: `Filters.tag` + `inTag()`. Las opciones salen de `goal.tags` del proyecto (348); `Item.tagList` son los tags separados por ";";
  - cubetas de tiempo: `throughput()` y `workloadMatrix()` aceptan `TimeUnit` (`"day" | "week"`). La preferencia es global (`docum:chart-unit`, por defecto `"day"`; `chartUnit` en `useApp()`);
  - `state-colors.ts`: colores por `StateCategory`, validados con dataviz (no cambiar el orden).
  - Usa siempre `StateCategory` (Proposed / InProgress / Resolved / Completed / Removed), **nunca el nombre del estado**: cada proceso tiene estados propios.
- **Estado global** en `AppProvider` (`src/components/shell/app-provider.tsx`):
  - proyecto, periodo, filtros (`people`, `includeOthers`, `epics`: épicas seleccionadas, vacío = todas), dataset (SWR, con polling mientras `sync.running`), `model`, `scoped` (ítems en el alcance), `people`, sincronización y paneles globales (`WorkItemSheet`, `MemberSheet`, `CommandPalette`, `ShortcutsDialog`).
  - Las vistas usan `useApp()` y se envuelven en `<DatasetGate>`.
  - Los filtros se guardan por proyecto (`docum:filters:<p>`) con `useStored()` (`client-api.ts`). `v: 2` marca los guardados con los periodos nuevos; sin esa marca se conservan personas y épicas, pero el periodo vuelve a "Esta semana".
  - **Fechas en tablas y etiquetas:** usa `bucketLabel()` o `format()` en hora local. Nunca `new Date(t).toISOString().slice(0, 10)` sobre marcas locales: el fin de día de Bogotá cae al día siguiente en UTC.
- **Acento por proyecto:** `<div data-project className="contents">` en el provider; los paneles nuevos van dentro.
- **Supabase:** `db()` es server-only con la llave secreta. **Nunca** crear un cliente en el navegador.

## Modelo de datos (`supabase/migrations/`)

- `projects`, `employees` (cédula única y opcional), `project_members` (cargo, % asignado, vigencia, `in_global`): el personal de Global y los miembros No Global.
- `azure_work_items(project_key, id, type, title, state, state_category, parent_id, assigned_email, assigned_name, iteration_*, created/changed/activated/in_progress/resolved/completed/closed_at, start/target/delivery_date, story_points, effort, original_estimate, completed_work, remaining_work, lead/cycle_time_days, …)`.
- `azure_revisions(project_key, work_item_id, revision, state, state_category, assigned_email, changed_at)`.
- `azure_sync_runs` (traza de sincronizaciones) y `employee_aliases(project_key, alias_email, employee_id)`.
- `audit_log`, con las acciones:
  - `login_success|failed`, `logout`;
  - `azure_sync`, `azure_sync_failed`;
  - `alias_linked|unlinked`;
  - y las `activity_*` del legado.
- **Legado (sin uso, no borrar):** `activity_logs`, el trigger `audit_activity_changes` y las funciones `activity_stats` / `activity_totals` (0003).
- **Seguridad de las tablas nuevas:**
  - RLS activo **sin políticas** y `revoke all … from anon, authenticated`;
  - RPC con `revoke execute … from public, anon, authenticated` + `grant … to service_role`;
  - tras cualquier DDL, revisar `get_advisors`.
- **Migraciones aplicadas:** `init_schema`, `seed_personal_oct2026`, `stats_and_restore`, `azure_sync` (0004), `azure_dataset_assigned` (0005), `dataset_monitored_epics` (0006), `dataset_backfilled_delivery` (0007), `goal_tags` (0008) y `no_global_members` (0009).
  - Se aplican con el MCP del proyecto (`.mcp.json`, ref `klrierizueihrenhcema`) o con `scripts/apply-migrations.mjs`.
  - **No** usar el conector `claude.ai Supabase` (es otra cuenta).
- **Nueva carga de Global:** reemplazar el archivo de `context/` → `python3 scripts/generate-seed.py` → aplicar `0002_seed.sql`. Es un upsert con `in_global = true`, no borra a los No Global; si Global incluye a uno de ellos, deja de ser No Global.

## Convenciones

- UI, comentarios y errores en **español**; números en formato `es-CO`.
- **Tokens semánticos:**
  - usa `bg-surface`, `text-muted`, `border-line`, `bg-accent`, `text-accent-fg`, `good|warning|critical|info(-soft|-fg)`… y nunca `bg-white` ni `slate-*`;
  - clases utilitarias: `.card`, `.glass`, `.shimmer`, `.btn-glow`;
  - tema en `<html data-theme>` (`THEME_INIT_SCRIPT` en `src/lib/boot-scripts.ts`).
- **Escala TV y breakpoints (IMPORTANTE):**
  - Todo en `rem` (prohibido `-[Npx]`).
  - Los valores en px que pasan por JS se multiplican por `useUiScale()` o `theme.px()`.
  - `sm…2xl` están **redefinidos** sobre `<html data-bp>` (ancho efectivo = ventana ÷ escala). En JS usa `useBreakpoint()`, no `matchMedia` ni media queries propias.
- **Foco:** el outline global aplica a botones, enlaces y roles. Los `input`/`textarea`/`select` no tienen outline: usan su propio anillo (`focus:ring`, `focus-within:ring`). Así se evita el borde doble que hubo en el login.
- **Popovers:** usa `Popover` (`src/components/ui/popover.tsx`). **Nunca** pongas `<input type=date>` invisibles superpuestos sobre otros controles; esa fue la causa del bug del calendario sobre el botón "−".
- **Gráficas (Chart.js):**
  - importa `./setup`, que registra Bar, Line, Scatter y Doughnut (sin Legend);
  - colores desde `useChartTheme` y `categoryColor()`;
  - cada gráfica va en `ChartCard`, con leyenda HTML y vista de tabla;
  - un solo eje Y, y el texto nunca va en el color de la serie.
- **Gantt** (`src/components/gantt/gantt.tsx`):
  - HTML/CSS en rem, con la línea de tiempo estirada al ancho disponible (ResizeObserver);
  - columna de nombres fija (21 rem, o 12 rem en angosto);
  - 25 ítems por grupo con "mostrar más".
- **UI propia** en `src/components/ui/` (`Button`, `Segmented`, `Chip`, `Avatar`, `TypeBadge`, `Kbd`, `EmptyState`, `ProgressRing`, `Sheet`, `Popover`…). Un `layoutId` de motion debe ser único con `useId()` si el componente se monta dos veces.
- **Verificación antes de entregar:**
  - `pnpm lint`, `npx tsc --noEmit`, `pnpm build`;
  - 390 px sin scroll horizontal;
  - 200 % de escala;
  - claro y oscuro.

## Roadmap sugerido

- Festivos de Colombia en los días hábiles (capacidad).
- Cron diario opcional en Vercel (requeriría `CRON_SECRET`), además de la sincronización bajo demanda.
- Alertas automáticas (vencidos o estancados) por correo o Teams.
- Exportación del Resumen y del Gantt a PDF o Excel.
- Gestión del personal y de los alias desde la UI, con historial.
- Multiusuario con roles.
