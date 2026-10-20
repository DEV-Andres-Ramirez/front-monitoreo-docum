-- =====================================================================
-- 0004 · Monitoreo automático desde Azure DevOps (sin registro manual)
--  - azure_work_items / azure_revisions: copia de SOLO LECTURA de Azure Analytics
--    (HU, Tareas, Bugs, Features y Épicas del proyecto) y su historial de revisiones.
--  - azure_sync_runs: traza de cada sincronización (completa o incremental).
--  - employee_aliases: vínculo manual correo de Azure → colaborador.
--  - azure_dataset(): ítems "vivos" en un periodo + ancestros + transiciones de estado,
--    en un solo JSON (evita el tope de 1000 filas de PostgREST).
-- Las tablas legadas del registro manual (activity_logs y funciones de 0003) se conservan.
-- =====================================================================

create table if not exists public.azure_work_items (
  project_key        text not null references public.projects(key) on delete cascade,
  id                 integer not null,
  type               text not null,
  title              text,
  state              text,
  state_category     text,          -- Proposed | InProgress | Resolved | Completed | Removed
  priority           integer,
  parent_id          integer,
  assigned_email     text,          -- normalizado (minúsculas, sin prefijo oidconflict_…)
  assigned_name      text,
  iteration_name     text,
  iteration_path     text,
  iteration_start    timestamptz,
  iteration_end      timestamptz,
  created_at         timestamptz,
  changed_at         timestamptz,
  activated_at       timestamptz,
  in_progress_at     timestamptz,
  resolved_at        timestamptz,
  completed_at       timestamptz,
  closed_at          timestamptz,
  start_date         timestamptz,
  target_date        timestamptz,
  delivery_date      timestamptz,   -- Custom.FechadeEntregaReal (si el proceso lo tiene)
  story_points       numeric,
  effort             numeric,
  original_estimate  numeric,
  completed_work     numeric,
  remaining_work     numeric,
  lead_time_days     numeric,
  cycle_time_days    numeric,
  tags               text,
  synced_at          timestamptz not null default now(),
  primary key (project_key, id)
);
create index if not exists azure_work_items_assigned_idx on public.azure_work_items (project_key, assigned_email);
create index if not exists azure_work_items_category_idx on public.azure_work_items (project_key, state_category);
create index if not exists azure_work_items_changed_idx  on public.azure_work_items (project_key, changed_at);
create index if not exists azure_work_items_parent_idx   on public.azure_work_items (project_key, parent_id);

create table if not exists public.azure_revisions (
  project_key     text not null references public.projects(key) on delete cascade,
  work_item_id    integer not null,
  revision        integer not null,
  state           text,
  state_category  text,
  assigned_email  text,
  changed_at      timestamptz not null,
  primary key (project_key, work_item_id, revision)
);
create index if not exists azure_revisions_changed_idx on public.azure_revisions (project_key, changed_at);

create table if not exists public.azure_sync_runs (
  id           bigint generated always as identity primary key,
  project_key  text not null references public.projects(key) on delete cascade,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running' check (status in ('running', 'ok', 'error')),
  mode         text not null check (mode in ('full', 'incremental')),
  items        integer not null default 0,
  revisions    integer not null default 0,
  watermark    timestamptz,
  error        text
);
create index if not exists azure_sync_runs_project_idx on public.azure_sync_runs (project_key, started_at desc);

create table if not exists public.employee_aliases (
  id           uuid primary key default gen_random_uuid(),
  project_key  text not null references public.projects(key) on delete cascade,
  alias_email  text not null,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (project_key, alias_email)
);

-- ---------------------------------------------------------------------
-- Dataset de análisis: ítems vivos en [p_from, p_to] + ancestros + transiciones
-- ---------------------------------------------------------------------
create or replace function public.azure_dataset(p_project text, p_from date, p_to date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with recursive alive as (
    select w.*
    from public.azure_work_items w
    where w.project_key = p_project
      and w.type not in ('Epic', 'Feature')
      and coalesce(w.state_category, '') <> 'Removed'
      and w.created_at < (p_to + 1)
      and (w.completed_at is null or w.completed_at >= p_from)
  ),
  anc(id) as (
    select distinct parent_id from alive where parent_id is not null
    union
    select w.parent_id
    from public.azure_work_items w
    join anc on w.project_key = p_project and w.id = anc.id
    where w.parent_id is not null
  ),
  items as (
    select * from alive
    union
    select w.* from public.azure_work_items w where w.project_key = p_project and w.id in (select id from anc)
  ),
  revs as (
    select r.work_item_id, r.state, r.state_category, r.changed_at,
           lag(r.state) over (partition by r.work_item_id order by r.revision) as prev_state
    from public.azure_revisions r
    where r.project_key = p_project and r.work_item_id in (select id from alive)
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'type', i.type, 'title', i.title, 'state', i.state, 'cat', coalesce(i.state_category, 'Removed'),
        'priority', i.priority, 'parentId', i.parent_id, 'email', i.assigned_email, 'name', i.assigned_name,
        'iteration', i.iteration_name, 'iterStart', i.iteration_start, 'iterEnd', i.iteration_end,
        'created', i.created_at, 'changed', i.changed_at, 'activated', i.activated_at, 'inProgress', i.in_progress_at,
        'resolved', i.resolved_at, 'completed', i.completed_at, 'closed', i.closed_at,
        'start', i.start_date, 'target', i.target_date, 'delivery', i.delivery_date,
        'sp', i.story_points, 'effort', i.effort, 'estimate', i.original_estimate,
        'completedWork', i.completed_work, 'remaining', i.remaining_work,
        'leadDays', i.lead_time_days, 'cycleDays', i.cycle_time_days, 'tags', i.tags
      ))
      from items i
    ), '[]'::jsonb),
    'transitions', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.work_item_id, 'state', r.state, 'cat', coalesce(r.state_category, 'Removed'), 'at', r.changed_at)
                       order by r.work_item_id, r.changed_at)
      from revs r
      where r.prev_state is distinct from r.state
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------
-- Seguridad: RLS sin políticas (solo el backend) y RPC solo para service_role
-- ---------------------------------------------------------------------
alter table public.azure_work_items enable row level security;
alter table public.azure_revisions  enable row level security;
alter table public.azure_sync_runs  enable row level security;
alter table public.employee_aliases enable row level security;

revoke all on public.azure_work_items, public.azure_revisions, public.azure_sync_runs, public.employee_aliases
  from anon, authenticated;

revoke execute on function public.azure_dataset(text, date, date) from public, anon, authenticated;
grant execute on function public.azure_dataset(text, date, date) to service_role;
