-- =====================================================================
-- 0006 · azure_dataset() limitado a las ÉPICAS MONITOREADAS
-- El tablero solo analiza lo que cuelga de las épicas configuradas por proyecto
-- (AZURE_<p>_EPIC_IDS): 348 → 539200, 539569 · 005 → 578.
-- La sincronización sigue copiando todo el proyecto (así se detecta lo que entra
-- o sale de las épicas); el recorte se hace aquí.
-- La versión de 3 argumentos (0005) queda como legado: no se borra porque la base
-- es compartida con despliegues anteriores.
-- =====================================================================
create or replace function public.azure_dataset(p_project text, p_from date, p_to date, p_epics int[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  with recursive tree(id) as (
    -- Las épicas monitoreadas y todo lo que cuelga de ellas (union evita ciclos)
    select w.id from public.azure_work_items w where w.project_key = p_project and w.id = any(p_epics)
    union
    select c.id
    from public.azure_work_items c
    join tree t on c.project_key = p_project and c.parent_id = t.id
  ),
  alive as (
    select w.*
    from public.azure_work_items w
    where w.project_key = p_project
      and w.id in (select id from tree)
      and w.type not in ('Epic', 'Feature')
      and w.assigned_email is not null
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
    -- Ancestros solo hasta la épica, y las épicas siempre (para mostrar sus nombres)
    select w.* from public.azure_work_items w
    where w.project_key = p_project
      and w.id in (select id from tree)
      and (w.id in (select id from anc) or w.id = any(p_epics))
  ),
  revs as (
    select r.work_item_id, r.state, r.state_category, r.changed_at,
           lag(r.state) over (partition by r.work_item_id order by r.revision) as prev_state
    from public.azure_revisions r
    where r.project_key = p_project and r.work_item_id in (select id from alive)
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', i.id, 'type', i.type, 'title', i.title, 'state', i.state, 'cat', coalesce(i.state_category, 'Removed'),
        'priority', i.priority, 'parentId', i.parent_id, 'email', i.assigned_email, 'name', i.assigned_name,
        'iteration', i.iteration_name, 'iterStart', i.iteration_start, 'iterEnd', i.iteration_end,
        'created', i.created_at, 'changed', i.changed_at, 'inProgress', i.in_progress_at,
        'resolved', i.resolved_at, 'completed', i.completed_at,
        'start', i.start_date, 'target', i.target_date, 'delivery', i.delivery_date,
        'sp', i.story_points, 'effort', i.effort, 'estimate', i.original_estimate,
        'completedWork', i.completed_work, 'remaining', i.remaining_work,
        'leadDays', round(i.lead_time_days, 2), 'cycleDays', round(i.cycle_time_days, 2)
      )))
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

revoke execute on function public.azure_dataset(text, date, date, int[]) from public, anon, authenticated;
grant execute on function public.azure_dataset(text, date, date, int[]) to service_role;
