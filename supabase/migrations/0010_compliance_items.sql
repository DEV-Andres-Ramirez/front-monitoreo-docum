-- =====================================================================
-- 0010 · Cumplimiento de HU y Tareas (vista "Cumplimiento", hoy solo 005)
-- azure_compliance_items(): TODOS los ítems de los tipos pedidos que cuelgan de las épicas
-- monitoreadas (asignados o no, sin filtrar por periodo, persona ni Global), más las Features y
-- Épicas del árbol para agrupar. Excluye Removed. Fechas en hora de Bogotá (YYYY-MM-DD):
--   qa   = llegó a Entregado (Resolved) o Completado: coalesce(resolved_at, completed_at)
--   done = Completado: coalesce(delivery_date, completed_at)
-- =====================================================================
create or replace function public.azure_compliance_items(p_project text, p_epics int[], p_types text[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  with recursive tree(id) as (
    select w.id from public.azure_work_items w where w.project_key = p_project and w.id = any(p_epics)
    union
    select c.id
    from public.azure_work_items c
    join tree t on c.project_key = p_project and c.parent_id = t.id
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', w.id,
    'type', w.type,
    'title', w.title,
    'state', w.state,
    'cat', w.state_category,
    'parentId', w.parent_id,
    'email', w.assigned_email,
    'name', w.assigned_name,
    'created', to_char((w.created_at at time zone 'America/Bogota')::date, 'YYYY-MM-DD'),
    'target', to_char((coalesce(w.target_date, w.iteration_end) at time zone 'America/Bogota')::date, 'YYYY-MM-DD'),
    'qa', case when w.state_category in ('Resolved', 'Completed')
               then to_char((coalesce(w.resolved_at, w.completed_at, w.changed_at) at time zone 'America/Bogota')::date, 'YYYY-MM-DD') end,
    'done', case when w.state_category = 'Completed'
                 then to_char((coalesce(w.delivery_date, w.completed_at, w.changed_at) at time zone 'America/Bogota')::date, 'YYYY-MM-DD') end
  )) order by w.id), '[]'::jsonb)
  from public.azure_work_items w
  where w.project_key = p_project
    and w.id in (select id from tree)
    and (w.type = any(p_types) or w.type in ('Epic', 'Feature'))
    and coalesce(w.state_category, 'Removed') <> 'Removed';
$$;

revoke execute on function public.azure_compliance_items(text, int[], text[]) from public, anon, authenticated;
grant execute on function public.azure_compliance_items(text, int[], text[]) to service_role;
