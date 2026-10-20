-- =====================================================================
-- 0005 · azure_dataset() solo con ítems ASIGNADOS (+ sus ancestros)
-- El análisis es por colaborador: los ítems sin asignar no aportan y engordaban
-- la respuesta (348: ~3,8 MB). También se omiten campos que la UI no usa.
-- =====================================================================
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

revoke execute on function public.azure_dataset(text, date, date) from public, anon, authenticated;
grant execute on function public.azure_dataset(text, date, date) to service_role;
