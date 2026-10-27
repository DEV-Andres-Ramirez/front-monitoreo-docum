-- =====================================================================
-- 0012 · Marcas especiales por persona y proyecto (member_flags)
-- Una persona con marca (en vacaciones, asignada a otro proyecto…) NO se evalúa en el semáforo y sus
-- pendientes no generan alertas, pero lo que entrega sí cuenta en el proyecto. Se ponen y quitan
-- desde la ficha del colaborador (PUT/DELETE /api/members/flag) y quedan en la bitácora.
-- `until` = fecha opcional en que deja de aplicar (null = sin fecha: se quita a mano).
-- Idempotente.
-- =====================================================================
create table if not exists public.member_flags (
  id           uuid primary key default gen_random_uuid(),
  project_key  text not null references public.projects(key) on delete cascade,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  kind         text not null check (kind in ('vacaciones', 'otro_proyecto', 'otro')),
  label        text not null check (length(btrim(label)) between 1 and 80),
  until        date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (project_key, employee_id)
);

alter table public.member_flags enable row level security;
revoke all on public.member_flags from anon, authenticated;

-- Angie Tatiana Hernandez Santacruz: en vacaciones (ambos proyectos, sin fecha de regreso)
insert into public.member_flags (project_key, employee_id, kind, label)
select m.project_key, m.employee_id, 'vacaciones', 'En vacaciones'
from public.project_members m
join public.employees e on e.id = m.employee_id
where lower(e.email) = 'angie.hernandez@linktic.com' and m.project_key in ('348', '005')
on conflict (project_key, employee_id) do nothing;

-- Positiva: Jhostin Ladino y Jose Fernando Lozano trabajan para Acueducto
insert into public.member_flags (project_key, employee_id, kind, label)
select '005', m.employee_id, 'otro_proyecto', 'Asignado al proyecto de Acueducto'
from public.project_members m
join public.employees e on e.id = m.employee_id
where m.project_key = '005' and lower(e.email) in ('jhostin.ladino@linktic.com', 'jose.lozano@linktic.com')
on conflict (project_key, employee_id) do nothing;
