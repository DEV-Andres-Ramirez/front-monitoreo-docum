-- =====================================================================
-- 0009 · Miembros "No Global"
-- Global = la base de personal (planeación) de cada proyecto. Algunas personas trabajan en las
-- épicas monitoreadas sin estar en Global; se incluyen en el análisis como "No Global":
-- project_members.in_global = false, sin cargo ni % de asignación (sin capacidad).
-- Hoy: 348 → David Felipe Vergara Bogota y Jhostin Alexander Ladino Gonzalez.
-- Idempotente.
-- =====================================================================

-- Personas sin cédula registrada en Global (el unique se mantiene; admite varios NULL)
alter table public.employees alter column document_id drop not null;

-- ¿La asignación viene de Global? (la semilla de Global la pone en true)
alter table public.project_members add column if not exists in_global boolean not null default true;

-- Los miembros No Global no tienen cargo ni % en Global (el check de allocation acepta NULL)
alter table public.project_members alter column role drop not null;
alter table public.project_members alter column allocation drop not null;

-- David Felipe Vergara Bogota (no existe en Global)
insert into public.employees (full_name, email)
select 'David Felipe Vergara Bogota', 'david.vergara@linktic.com'
where not exists (select 1 from public.employees where lower(email) = 'david.vergara@linktic.com');

-- Asignación No Global en 348 (Jhostin ya existe: está en Global de 005)
insert into public.project_members (project_key, employee_id, role, allocation, assignment_type, active, in_global)
select '348', e.id, null, null, 'No Global', true, false
from public.employees e
where lower(e.email) in ('david.vergara@linktic.com', 'jhostin.ladino@linktic.com')
on conflict (project_key, employee_id) do update set in_global = false, active = true;
