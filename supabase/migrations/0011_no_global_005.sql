-- =====================================================================
-- 0011 · Miembros "No Global" de 005 (Positiva)
-- Personas con ítems en las épicas monitoreadas de 005 (578, 568, 153 y 82) que no están en Global
-- de 005: cuentan en el análisis con in_global = false, sin cargo ni % (sin capacidad). Mismo patrón
-- que 0009. Además se quita el alias dario.lopez@3tcapital.co → Luis Gabriel Melendez Gongora
-- (creado desde el tablero el 26-oct): Dario Lopez es otra persona y pasa a No Global.
-- Idempotente.
-- =====================================================================

-- Personas que no existen en Global (sin cédula registrada)
insert into public.employees (full_name, email)
select v.full_name, v.email
from (values
  ('Cristian Roa', 'cristian.roa@3tcapital.co'),
  ('Carlos Cansina', 'carlos.cansina@3tcapital.co'),
  ('Josimar Bonilla', 'josimar.bonilla@3tcapital.co'),
  ('Dario Lopez', 'dario.lopez@3tcapital.co')
) as v(full_name, email)
where not exists (select 1 from public.employees e where lower(e.email) = v.email);

-- Asignación No Global en 005 (Jose Fernando Lozano Murcia ya existe: está en Global de 348)
insert into public.project_members (project_key, employee_id, role, allocation, assignment_type, active, in_global)
select '005', e.id, null, null, 'No Global', true, false
from public.employees e
where lower(e.email) in (
  'cristian.roa@3tcapital.co',
  'carlos.cansina@3tcapital.co',
  'josimar.bonilla@3tcapital.co',
  'dario.lopez@3tcapital.co',
  'jose.lozano@linktic.com'
)
on conflict (project_key, employee_id) do update set in_global = false, active = true;

-- Quitar el alias de Dario Lopez (con traza en la bitácora)
with removed as (
  delete from public.employee_aliases
  where project_key = '005' and lower(alias_email) = 'dario.lopez@3tcapital.co'
  returning alias_email, employee_id
)
insert into public.audit_log (action, entity, project_key, old_data, new_data)
select 'alias_unlinked', 'employee_aliases', '005',
       jsonb_build_object('alias', r.alias_email, 'employeeId', r.employee_id),
       jsonb_build_object('alias', r.alias_email, 'motivo', '0011: Dario Lopez pasa a No Global')
from removed r;
