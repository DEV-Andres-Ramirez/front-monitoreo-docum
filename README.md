# Monitoreo Docum · LinkTic

Tablero interno de **monitoreo automático** del trabajo de cada colaborador en los proyectos de la línea Docum de LinkTic, calculado a partir de **Azure DevOps** (solo lectura):

| Proyecto | Cliente | Azure DevOps (org / proyecto) | Épicas monitoreadas (único alcance del tablero) |
|---|---|---|---|
| **348 · SGDEA Acueducto** | EAAB – Acueducto de Bogotá | `LinkTic` / `348 - SGDEA ACUEDUCTO` | `539200` Certificación CORE · `539569` Certificación Temáticos |
| **005 · Positiva SGDEA** | Positiva · 3T Capital | `3tcapitalco` / `005 - POSITIVA SGDEA NEW` | `578` Deuda Técnica y Contractual · `568` Épica de gestión · `153` Deuda · `82` NP - Evolutivos |

## ¿Para qué sirve?

El cliente pidió monitorear lo que hace cada persona asignada. El **Scrum Master** (único usuario, común a ambos proyectos) **no registra nada a mano**. El tablero cruza **por correo** al personal de cada proyecto con los ítems asignados en Azure DevOps (HU, Tareas y Bugs) **que cuelgan de las épicas monitoreadas** de ese proyecto. Lo que está en otras épicas no se analiza.

> **Global** es la base de personal (planeación) de LinkTic. En la interfaz siempre se dice "Global", **nunca "Excel"**. Hoy Global se carga desde los CSV de cada proyecto en `context/` (`Planeacion_005_Positiva.csv` y `Planeacion_348_Acueducto.csv`) con `scripts/generate-seed.py`. Quien sale de Global queda inactivo (no se borra) y sus ítems pasan a "Fuera de Global".
>
> El **personal del proyecto** es el de Global **más los miembros "No Global"** (internamente): personas que trabajan en las épicas sin estar en Global para ese proyecto. Cuentan en el análisis, pero no tienen cargo ni %. En la interfaz llevan la etiqueta **"Sin asignación al proyecto"** junto al nombre. Desde la carga de Global del 29-oct solo queda uno:
>
> - **005:** Jose Fernando Lozano Murcia (Global de 348).
>
> Los que había antes (348: David Vergara y Jhostin Ladino, 0009; 005: Cristian Roa, Carlos Cansina, Josimar Bonilla y Dario Lopez, 0011) ahora están en Global. Conservan su registro y sus marcas. En Azure de 005 aparecen con `@3tcapital.co` y en Global con `@linktic.com`; se cruzan por la parte local del correo.
>
> **Marcas especiales** (`member_flags`, 0012): "En vacaciones", "Asignado al proyecto de Acueducto" u otra, con fecha de fin opcional. Quien tiene marca **no se evalúa** en el semáforo ("No evaluado") y **sus pendientes no generan alertas**, pero **lo que entrega sí cuenta**. Se ponen y quitan desde la ficha del colaborador y quedan en la Bitácora. Hoy: Angie Tatiana Hernandez (en vacaciones, en ambos proyectos) y, en 005, Jhostin Ladino y Jose Fernando Lozano (asignados a Acueducto). La marca se muestra en lugar de "Sin asignación al proyecto".

Calcula automáticamente:

- **Qué tiene asignado cada colaborador** y en qué estado está: por iniciar, en curso, entregado o cerrado.
- **Horas trabajadas:** solo el campo **Completed Work** ("Trabajo completado") que cada persona reporta en Azure. Se suma el de las tareas entregadas en el periodo. **No se usan las horas estimadas** (Story Points, Effort ni Estimación original). Sin doble conteo: si un padre y sus hijas reportan horas, suman las hijas.
- **Tiempos:** creación → cierre (*lead time*), en curso → cerrado (*cycle time*) y la **traza completa de cambios de estado**, con la duración en cada uno.
- **Plan vs. real:** fecha de inicio y fecha objetivo (del ítem o, si no las tiene, del sprint) frente al inicio real y la **entrega real** (campo "Fecha de entrega real" si existe, si no "Entregado" o el cierre). De ahí salen la puntualidad, los vencidos y los días de retraso.
- **Sin capacidad:** ya no se calcula capacidad, "horas posibles" ni "uso de capacidad".
- **Semáforo de cada colaborador** (ambos proyectos): **Va mal**, **En riesgo**, **Va bien**, **No evaluado** (con marca) o **Sin carga** en el periodo elegido, con las razones. Ver "Semáforo de colaboradores".
- **Solo días hábiles:** ninguna gráfica ni tabla muestra fines de semana ni festivos de Colombia (entregas por día, evolución del estado, carga, Cumplimiento, Meta y Gantt). Lo entregado un día no hábil cuenta en el **siguiente día hábil** (o en el último del periodo, si el periodo termina en un día no hábil); así los días ya cerrados no cambian.
- **Qué se mide en cada proyecto:**
  - **348:** solo **Tareas**, en Resumen, Colaboradores, semáforo y Cronograma (`PROJECTS["348"].views`).
  - **005:** **tres mundos separados**: Tareas, Historias de usuario y Bugs, con el selector de la barra de filtros (Resumen, Colaboradores y Cronograma; por defecto, Tareas). **Solo las Tareas tienen métricas de tiempo.** Las **HU y los Bugs no usan fechas**: solo quién los tiene, cuántos hay y en qué estado van, sin periodo, atrasos, Gantt ni semáforo. En los bugs es porque las fechas de Azure no son confiables y daban alertas falsas.

## Funcionalidades (v3 · monitoreo automático)

- **Acceso:** login con token único (`ACCESS_TOKEN`) y sesión firmada de 12 h.
- **Filtros globales**, en el header y en el botón "Filtros" de móvil; personas, épicas, tag y mundo se recuerdan por proyecto:
  - **Mundo** (solo 005): Tareas · Historias de usuario · Bugs (Resumen, Colaboradores y Cronograma).
  - **Periodo:** por defecto **Desde el 19 oct** (inicio del análisis, `ANALYSIS_START`) hasta hoy, y vuelve a ese valor en cada visita (se guarda en `sessionStorage`). Atajos: **Hoy, Ayer** (= día hábil anterior: un lunes es el viernes), **Esta semana** y **Semana pasada** (lunes a domingo), más un rango personalizado. Cada atajo muestra las fechas que cubre.
    - **Comparación de los indicadores:** Hoy y Ayer, frente al día hábil anterior; las semanas, frente a los mismos días de la semana anterior; el rango personalizado, frente al periodo anterior de igual duración. Con "Desde el 19 oct" no hay comparación (antes del inicio no hay con qué comparar).
  - **Colaboradores:** multiselección, más "Incluir fuera de Global".
  - **Épica:** en 348, botones "Todas las épicas · CORE · Temáticos"; en 005 (4 épicas), un panel con casillas de selección múltiple (ninguna = todas). Fuera de las épicas monitoreadas no se analiza nada.
  - **Tag** (solo 348): "Todos los tags · Video · Informe". Aplica a todas las vistas. Las HU no llevan tags, así que con un tag elegido solo quedan sus tareas.
- **Vistas:**
  - **Resumen** (`/`):
    - **4 tarjetas** con título claro, una línea de "qué significa" y un ícono (i) con la fórmula: **entregadas**, **horas trabajadas** (Completed Work), **atrasadas** (sin entregar y con la fecha objetivo pasada) y **entregadas a tiempo**. El cambio frente al periodo de comparación se lee "12 % más / menos";
    - **¿Cuánto se entregó cada día hábil?** (por día hábil o por semana), **¿En qué estado está el trabajo?** y **Evolución del estado del trabajo** (antes CFD), con una explicación de cómo leerla;
    - si el periodo dura menos de 7 días hábiles (Hoy, Ayer, inicio de semana), las tendencias muestran los últimos 7 días hábiles y resaltan el periodo elegido;
    - tarjeta **Semáforo del equipo**: cuántos van mal, en riesgo, bien, no evaluados o sin carga, con quién va mal y quién está en riesgo (y por qué);
    - **Requiere atención**: atrasadas y en curso sin moverse hace más de 5 días hábiles;
    - en 005 con el mundo Bugs: tablero de bugs por estado actual (ver "Cumplimiento de Positiva");
    - se quitaron el burnup de horas, la dispersión de cycle time y las tarjetas de WIP y cycle time: no aportaban a la decisión.
  - **Cronograma** (`/cronograma`): **diagrama de Gantt**.
    - Agrupado por colaborador, feature o sprint.
    - Cada ítem muestra la barra **planeada** (inicio → objetivo), la barra **real** coloreada por estado, el ◆ de la fecha objetivo, el ● de la entrega real y el **tramo de retraso** en rojo.
    - Incluye línea de "hoy", bandas de sprint, zoom día/semana/mes, orden, filtros por tipo y "solo con retraso".
    - El eje es de **tiempo hábil**: los fines de semana y festivos no ocupan espacio.
  - **Colaboradores** (`/colaboradores`):
    - **semáforo del equipo** arriba: contadores por nivel que filtran, barra apilada y "¿Cómo se calcula?". El orden por defecto es por estado;
    - **quienes no tienen carga quedan ocultos** hasta pulsar "Mostrar N sin carga", y vuelven a ocultarse en cada visita. Los que tienen una marca sí se ven;
    - **scorecards** (tarjetas o tabla) con entregas, horas trabajadas, puntualidad y atrasadas. Cada tarjeta lleva el color del nivel (borde, tinte y barra lateral; quien va mal, con un punto que late; sin carga, atenuada y punteada), la etiqueta y sus razones;
    - **horas trabajadas** (Completed Work) por día hábil o por semana (mapa de calor persona × día/semana);
    - en 005, con los mundos HU o Bugs: tabla de quién los tiene y en qué estado (sin semáforo);
    - gráfica de estado por persona;
    - sección **"Fuera de Global"**: personas con ítems en las épicas que no son personal del proyecto. No cuentan en los indicadores salvo que se active "Incluir fuera de Global", y se pueden vincular si son la misma persona con otro correo;
    - los miembros sin asignación al proyecto (No Global) y los que tienen marca aparecen con su etiqueta en tarjetas, tabla, carga, gráficas, Gantt, detalle, filtro de personas y ⌘K.
  - **Backlog Azure** (`/backlog`): árbol Épica → Feature → HU → Tarea con estado, asignado, objetivo, entrega y horas acumuladas.
  - **Bitácora** (`/bitacora`): ingresos, sincronizaciones (con conteos o errores), vinculaciones y marcas especiales.
  - **Cumplimiento** (`/cumplimiento`, solo 005): ver la sección "Cumplimiento de Positiva". El menú depende del proyecto (`navItems()` en `src/components/shell/nav.ts`), y los atajos 1…n siguen su orden.
- **Detalle de un ítem:** ruta Épica › Feature › HU, horas y su origen, plan frente a real, puntualidad, **línea de tiempo de estados** con duraciones e ítems hijos.
- **Detalle de un colaborador:** **marca especial** (poner o quitar), semáforo con sus razones, entregas, horas trabajadas, puntualidad, atrasadas, **mini-Gantt** e ítems por estado (en los mundos HU o Bugs: sus ítems por estado).
- **Pantalla para TV:** tamaño de 75 % a 300 % (− / % / +) y pantalla completa. Atajos `+`, `−`, `0` y `F`.
- **Tema** claro, oscuro o del sistema, sin parpadeo.
- **⌘K** para buscar personas, ítems, periodos y acciones; `1–5` cambian de vista; `?` muestra la ayuda.
- **Accesibilidad:** colores de estado validados para daltonismo, estados siempre con texto, vista de tabla en cada gráfica y `prefers-reduced-motion`.

## Semáforo de colaboradores (ambos proyectos)

Para decidir rápido con quién hablar. Se calcula por persona en el periodo elegido (`src/lib/analytics/health.ts`, desde `perPerson()`; umbrales en `HEALTH_RULES`):

| Nivel | Cuándo |
|---|---|
| **Sin carga** | No tiene ítems en las épicas monitoreadas en el periodo. |
| **Va mal** | 3 o más pendientes atrasados · sin entregas con 3+ días hábiles transcurridos · a tiempo < 60 % (con 3+ entregas con objetivo). |
| **En riesgo** | 1–2 atrasados · a tiempo 60–80 % · nada en curso teniendo ítems por iniciar. |
| **Va bien** | Entregó y nada de lo anterior. |
| **No evaluado** | Tiene una marca (vacaciones, otro proyecto…): lo que entrega cuenta, pero no recibe alertas. |

- Se mide solo con tareas (en HU y Bugs no hay semáforo). La columna de Cumplimiento también se mide con tareas.
- "Sin carga" se oculta en Colaboradores hasta pulsar "Mostrar N sin carga".
- Con menos de 3 días hábiles transcurridos (Hoy, Ayer, lunes de "Esta semana") solo cuentan atrasos y puntualidad, y "Va bien" no exige entregas.
- Se ve en Colaboradores (tarjetas, tabla y carga), en el detalle del colaborador, en la tarjeta del Resumen y en la tabla por persona de Cumplimiento. Siempre con ícono y texto, no solo color.

## Cumplimiento de Positiva (solo 005)

Vista **Cumplimiento** (2.ª en el menú de 005), más una tarjeta compacta arriba del Resumen con enlace. Mide, sobre las 4 épicas monitoreadas, cuántas **HU**, **Tareas** y **Bugs** hay, cuántos se completaron y el **% de cumplimiento**.

- **Qué cuenta:** **todos** los ítems de esos tipos de las épicas, de quien sean o sin asignar (incluye a quienes no están en Global). Con personas elegidas en el filtro, solo los de ellas; con épicas elegidas, solo los de ellas.
- **HU, en dos niveles:**
  - **cumplimiento = en producción** (categoría Completed, estado `10. En Producción`);
  - también **entregadas a QA o más** (categoría Resolved: `7. Backlog QA`, `7.1`, `7.2`).
- **Tarea:** cumplida al **cerrarse** (`Closed`).
- **Bug:** cumplido al **cerrarse** (`4. Cerrado`); también se muestra cuántos están en revisión QA o más (`3. Revisión QA`, `3.1 Devuelto`, `3.2 Bloqueado`, `3.4 Certificado Para Prod`). **Sin fechas:** los bugs no tienen "cerrados en el periodo", atrasos ni tendencia (sus fechas de Azure no son confiables), y no suman atrasadas en las tablas.
- **Atrasada** (solo tareas): objetivo (o fin del sprint) pasado sin cerrar.
- **Tableros de HU y de Bugs** (mundos HU y Bugs de Resumen y Colaboradores, `undated-board.tsx`): totales por etapa y por estado de Azure, pendientes y completados por épica o Feature, quién tiene cada uno y lista de pendientes. Siempre con el estado actual, sin periodo.
- **HU sin tiempo:** sus tarjetas no tienen "en el periodo" ni atrasadas, no hay avance acumulado de HU y la tabla por HU no muestra fecha objetivo. Solo las tareas conservan el tiempo.
- **En el Resumen**, la tarjeta de cumplimiento muestra solo el mundo elegido (Tareas, HU o Bugs).
- **Secciones:**
  1. tarjetas de HU, Tareas y Bugs: % de cumplimiento, barras, flujo por etapa, completadas en el periodo (HU y tareas), en curso, por iniciar, atrasadas (HU y tareas), sin tareas o pendientes sin asignar;
  2. **Puntos de atención**:
     - HU con todas sus tareas cerradas que no pasan a QA;
     - HU sin tareas;
     - atrasadas;
     - tareas sin asignar;
     - bugs abiertos sin asignar;
  3. **flujo por etapa** (HU, Tareas o Bugs, con tabla de estados de Azure);
  4. **avance acumulado** de tareas frente al total (por día hábil o semana);
  5. cumplimiento **por épica**, **por Feature**, **por HU** (avance por sus tareas, con búsqueda, filtros y orden) y **por persona** (etiquetas y semáforo del periodo medido con tareas).
- **Configuración:** `PROJECTS["005"].compliance` en `src/lib/config.ts`.
- **Datos:** `GET /api/projects/[p]/compliance` → RPC `azure_compliance_items` (0010). No se filtra por periodo; se calcula en `src/lib/analytics/compliance.ts`.

## Meta de cierre de Acueducto (solo 348)

Compromiso con EAAB para las dos épicas sumadas (Certificación CORE y Certificación Temáticos):

- **Cierre:** viernes 13 de noviembre de 2026.
- **Productividad:** **24 tareas de Video y 24 de Informe por día hábil**, de lunes a viernes sin festivos de Colombia, desde el lunes 19-oct.
- **Configuración:** `PROJECTS["348"].goal` en `src/lib/config.ts`. Si cambia la meta o la fecha, se edita ahí; no hay variables de entorno.
- **Qué cuenta:** **todas** las tareas (tipo `Task`) con tag `Video` o `Informe` de ambas épicas, sin importar el colaborador. Incluye a quienes no están en Global (las 398 de Informe son de David Vergara, que estuvo fuera de Global hasta el 29-oct).
- **Completada:** estado Entregado o Cerrado, en el día de su fecha de entrega real (o de resolución o cierre). Si cae en fin de semana o festivo, cuenta el siguiente día hábil; lo cerrado antes del 19-oct cuenta como avance previo.
- **Panel "Meta de cierre" (inicio del Resumen):** la pieza principal de Acueducto. Por tag y en el Total:
  - **% de avance** (completadas ÷ total) con la marca de lo esperado a la fecha;
  - **Completadas hoy** (en vivo, mientras el día sigue en curso, sin marcarlo como incumplido) o **completadas ese día** (snapshot);
  - **Frente a lo esperado:** "+56 adelante" o "15 atrás", con la cuenta explicada ("al cierre de ayer llevábamos 200; se esperaban 144 = 24 × 6 días hábiles"). Usa los días ya cerrados: en vivo, hasta ayer;
  - **Ritmo actual:** completadas por día hábil desde el 19-oct hasta el último día cerrado (en vivo, el hábil anterior), también en el Total;
  - **días con la meta cumplida** (en el Total, **pendientes**);
  - ya no hay proyección de cierre ("Si seguimos así, terminamos el…"): se quitó porque no era necesaria;
  - ya no hay "ritmo necesario".
- **Snapshots:** el selector "Ver al cierre de" muestra el panel y sus gráficas como quedaron al cierre de cualquier día hábil desde el 19-oct (se reconstruye con la fecha de entrega real de cada tarea; el total es el actual). Una franja avisa que se está viendo un día pasado, con "Volver a hoy".
- **Gráficas:**
  - **Avance diario vs. meta:** barras por tag y día hábil con la línea de la meta diaria, el día de corte resaltado y "días con la meta cumplida";
  - **Avance acumulado vs. meta:** Total, Video o Informe, con una sola línea real frente a lo esperado. La brecha va sombreada en verde (adelante) o rojo (atrás) y el rótulo final dice "N · +X adelante". En vivo llega hasta el cierre de ayer.
- Respeta el filtro de tag, pero no los de personas ni épica (la meta es del proyecto).
- **Días hábiles:** `isBusinessDay()` en `src/lib/dates.ts` excluye los festivos de Colombia (Ley Emiliani y Pascua). También se usan en el semáforo y en el "día hábil anterior".

## ⚠️ Regla de oro: Azure DevOps es SOLO LECTURA

Está **prohibido** crear, modificar o borrar cualquier cosa en Azure DevOps.

- Los PAT solo tienen permisos de lectura: *Work Items (Read)*, *Project and Team (Read)* y *Analytics (Read)*.
- Todo acceso pasa por `azureRequest()` en `src/lib/azure.ts`. Solo admite:
  - **GET** a `dev.azure.com` (REST de lectura);
  - **GET** a `analytics.dev.azure.com/…/_odata/` (Azure Analytics);
  - el **POST de consulta WIQL**.
- La copia sincronizada vive en Supabase. Lo único que el tablero escribe son los **alias** de correo, las **marcas especiales** y la bitácora, todos en su propia base.

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
5. **Lectura de la UI:** el RPC `azure_dataset(proyecto, desde, hasta, épicas)` recorre el árbol de las épicas monitoreadas (`AZURE_<p>_EPIC_IDS`) y devuelve solo los ítems asignados "vivos" en el periodo que cuelgan de ellas, sus ancestros hasta la épica, las épicas mismas y las transiciones de estado. La sincronización copia todo el proyecto, para detectar lo que entra o sale de las épicas; el recorte se hace en este RPC. El motor de análisis (`src/lib/analytics/*`) calcula todo **en el navegador**, así que los filtros responden al instante.

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

> `AZURE_<p>_EPIC_IDS` define el **alcance** del tablero: solo se analiza lo que cuelga de esas épicas (348: `539200,539569` · 005: `578,568,153,82`). Al cambiarla en Vercel hay que volver a desplegar; no hace falta sincronizar, porque la copia de Supabase ya tiene todo el proyecto.

## Base de datos (Supabase · `baas-monitoreo-docum`)

| Migración | Contenido |
|---|---|
| `0001_schema.sql` | Proyectos, colaboradores, asignaciones, `audit_log`, RLS (y `activity_logs`, legado) |
| `0002_seed.sql` | Personal de Global (lo genera `python3 scripts/generate-seed.py` desde los CSV de `context/`; idempotente; marca `in_global = true`, conserva el registro de quien era No Global y deja inactivo a quien sale de Global) |
| `0003_stats_and_restore.sql` | Funciones del registro manual (**legado**, sin uso) |
| `0004_azure_sync.sql` | `azure_work_items`, `azure_revisions`, `azure_sync_runs`, `employee_aliases`, RPC `azure_dataset` |
| `0005_azure_dataset_assigned.sql` | `azure_dataset(p, desde, hasta)` solo con ítems asignados (**legado**: se conserva para despliegues anteriores) |
| `0006_dataset_monitored_epics.sql` | `azure_dataset(p, desde, hasta, épicas)`: solo el árbol de las épicas monitoreadas |
| `0008_goal_tags.sql` | `azure_dataset` devuelve los tags; nuevo RPC `azure_goal_tasks` (tareas con tags de la meta, sin filtrar por periodo ni persona) |
| `0012_member_flags.sql` | Tabla `member_flags` (marcas especiales: vacaciones, otro proyecto u otra, con fecha de fin opcional; RLS sin políticas) y las marcas de Angie Hernandez (348 y 005), Jhostin Ladino y Jose Fernando Lozano (005) |
| `0011_no_global_005.sql` | Agrega a 005 como No Global a Cristian Roa, Carlos Cansina, Josimar Bonilla, Dario Lopez y Jose Fernando Lozano Murcia, y quita el alias de Dario Lopez (con traza en la bitácora) |
| `0010_compliance_items.sql` | RPC `azure_compliance_items`: todos los ítems de los tipos pedidos (HU, tareas y bugs), más Features y Épicas, de las épicas, para el cumplimiento |
| `0009_no_global_members.sql` | `project_members.in_global`; cargo, % y cédula opcionales; agrega a David Vergara y Jhostin Ladino a 348 como No Global |
| `0007_dataset_backfilled_delivery.sql` | Un ítem entregado en el periodo cuenta aunque se haya creado después (fecha de entrega real registrada a posteriori); bordes ±1 día |

**Estado (20-oct-2026):** las diez migraciones están aplicadas. Primera sincronización: 348 con 6.838 ítems y 25.874 revisiones (≈ 45 s); 005 con 627 ítems y 1.942 revisiones (≈ 7 s). Las incrementales tardan segundos.

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
| `python3 scripts/generate-seed.py [carpeta_csv]` | Regenera la semilla del personal desde los `Planeacion_*.csv` |
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
      projects/[project]/goal             # meta de cierre (348)
      projects/[project]/compliance       # cumplimiento de HU y tareas (005)
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
    charts/     # Chart.js: flow-charts (throughput, CFD, estados por persona), chart-card, chart-theme
    dashboard/  # work-item-sheet (traza de estados), member-sheet, client-api (fetch + preferencias)
    ui/         # primitives, sheet, popover, theme, display (escala TV + pantalla completa)…
supabase/migrations/   # 0001 → 0012
scripts/               # generate-seed.py, apply-migrations.mjs
context/               # CSV de Global por proyecto (contienen datos personales)
```
