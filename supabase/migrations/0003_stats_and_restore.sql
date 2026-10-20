-- =====================================================================
-- 0003 · Analítica agregada en Postgres + auditoría de restauraciones
--  - activity_stats(): agrega en la base (evita el tope de 1000 filas de PostgREST).
--  - activity_totals(): total de horas/actividades de un rango (comparación con periodo anterior).
--  - audit_activity_changes(): registra 'activity_restored' al deshacer un borrado.
-- Las funciones solo son ejecutables por service_role (backend).
-- =====================================================================

create or replace function public.activity_stats(p_project text, p_from date, p_to date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with logs as (
    select employee_id, work_date, hours, work_item_id, work_item_type
    from public.activity_logs
    where project_key = p_project
      and deleted_at is null
      and work_date between p_from and p_to
  )
  select jsonb_build_object(
    'memberDays', coalesce((
      select jsonb_agg(jsonb_build_object('employeeId', employee_id, 'date', work_date, 'hours', h, 'activities', c))
      from (select employee_id, work_date, sum(hours) as h, count(*) as c from logs group by employee_id, work_date) md
    ), '[]'::jsonb),
    'workItems', coalesce((
      select jsonb_agg(jsonb_build_object('workItemId', work_item_id, 'type', t, 'hours', h, 'activities', c, 'employeeIds', e))
      from (
        select work_item_id, max(work_item_type) as t, sum(hours) as h, count(*) as c, jsonb_agg(distinct employee_id) as e
        from logs group by work_item_id
      ) wi
    ), '[]'::jsonb)
  );
$$;

create or replace function public.activity_totals(p_project text, p_from date, p_to date)
returns table (hours numeric, activities bigint)
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(hours), 0), count(*)
  from public.activity_logs
  where project_key = p_project
    and deleted_at is null
    and work_date between p_from and p_to;
$$;

revoke execute on function public.activity_stats(text, date, date) from public, anon, authenticated;
revoke execute on function public.activity_totals(text, date, date) from public, anon, authenticated;
grant execute on function public.activity_stats(text, date, date) to service_role;
grant execute on function public.activity_totals(text, date, date) to service_role;

create or replace function public.audit_activity_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'activity_created';
  elsif new.deleted_at is not null and old.deleted_at is null then
    v_action := 'activity_deleted';
  elsif new.deleted_at is null and old.deleted_at is not null then
    v_action := 'activity_restored';
  else
    v_action := 'activity_updated';
  end if;

  insert into public.audit_log (action, entity, entity_id, project_key, old_data, new_data)
  values (
    v_action,
    'activity_logs',
    new.id::text,
    new.project_key,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new)
  );
  return new;
end;
$$;
