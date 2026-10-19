-- =====================================================================
-- Monitoreo Docum · LinkTic — Esquema base
-- Tablero interno del Scrum Master para registrar la actividad diaria
-- de cada colaborador en los proyectos 348 (Acueducto) y 005 (Positiva).
--
-- Seguridad: RLS activo en TODAS las tablas y SIN políticas.
-- => los roles anon/authenticated no pueden leer ni escribir.
-- => solo el backend de Next.js (llave secreta / service_role) accede.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Proyectos monitoreados
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  key         text primary key,                 -- '348' | '005'
  name        text not null,
  client      text not null,
  color       text not null default '#0090FF',  -- color de acento en la UI
  created_at  timestamptz not null default now()
);

insert into public.projects (key, name, client, color) values
  ('348', '348 · SGDEA Acueducto', 'Empresa de Acueducto y Alcantarillado de Bogotá (EAAB)', '#0090FF'),
  ('005', '005 · Positiva SGDEA',  'Positiva Compañía de Seguros · 3T Capital', '#16A34A')
on conflict (key) do update
  set name = excluded.name, client = excluded.client, color = excluded.color;

-- ---------------------------------------------------------------------
-- Colaboradores (únicos entre proyectos, identificados por cédula)
-- ---------------------------------------------------------------------
create table if not exists public.employees (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  document_id  text not null unique,             -- cédula
  email        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Asignación de colaboradores a proyectos (planeación de personal)
-- ---------------------------------------------------------------------
create table if not exists public.project_members (
  id               uuid primary key default gen_random_uuid(),
  project_key      text not null references public.projects(key) on delete cascade,
  employee_id      uuid not null references public.employees(id) on delete cascade,
  role             text not null,                          -- cargo
  allocation       numeric(4,2) not null default 1         -- 1 = 100 %
                   check (allocation > 0 and allocation <= 1),
  start_date       date,
  end_date         date,
  assignment_type  text not null default 'Fijo',           -- 'Fijo' | 'Multiproyecto'
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (project_key, employee_id)
);
create index if not exists project_members_employee_idx on public.project_members (employee_id);

-- ---------------------------------------------------------------------
-- Registro diario de actividades (núcleo del tablero)
-- ---------------------------------------------------------------------
create table if not exists public.activity_logs (
  id               uuid primary key default gen_random_uuid(),
  project_key      text not null references public.projects(key),
  employee_id      uuid not null references public.employees(id),
  work_date        date not null,
  hours            numeric(4,2) not null check (hours > 0 and hours <= 24),
  description      text not null check (length(btrim(description)) > 0),
  evidence_url     text check (evidence_url is null or evidence_url ~* '^https?://'),
  -- Work item de Azure DevOps (snapshot al momento del registro: Azure es solo lectura)
  work_item_id     integer not null,
  work_item_type   text,
  work_item_title  text,
  work_item_state  text,
  work_item_url    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz                              -- borrado lógico (conserva la traza)
);
create index if not exists activity_logs_project_date_idx
  on public.activity_logs (project_key, work_date) where deleted_at is null;
create index if not exists activity_logs_employee_date_idx
  on public.activity_logs (employee_id, work_date) where deleted_at is null;
create index if not exists activity_logs_work_item_idx
  on public.activity_logs (project_key, work_item_id) where deleted_at is null;

-- ---------------------------------------------------------------------
-- Bitácora de auditoría (traza de todo lo que pasa en el tablero)
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  action       text not null,      -- login_success | login_failed | logout | activity_created | activity_updated | activity_deleted | azure_refresh
  entity       text,               -- 'activity_logs' | 'session' | 'azure'
  entity_id    text,
  project_key  text,
  old_data     jsonb,
  new_data     jsonb,
  ip           text,
  user_agent   text
);
create index if not exists audit_log_occurred_idx on public.audit_log (occurred_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id);

-- ---------------------------------------------------------------------
-- Triggers: updated_at + auditoría automática de activity_logs
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists employees_updated_at on public.employees;
create trigger employees_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

drop trigger if exists project_members_updated_at on public.project_members;
create trigger project_members_updated_at before update on public.project_members
  for each row execute function public.set_updated_at();

drop trigger if exists activity_logs_updated_at on public.activity_logs;
create trigger activity_logs_updated_at before update on public.activity_logs
  for each row execute function public.set_updated_at();

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

drop trigger if exists activity_logs_audit on public.activity_logs;
create trigger activity_logs_audit after insert or update on public.activity_logs
  for each row execute function public.audit_activity_changes();

-- ---------------------------------------------------------------------
-- RLS: activo y sin políticas => acceso exclusivo del backend
-- ---------------------------------------------------------------------
alter table public.projects        enable row level security;
alter table public.employees       enable row level security;
alter table public.project_members enable row level security;
alter table public.activity_logs   enable row level security;
alter table public.audit_log       enable row level security;

revoke all on public.projects, public.employees, public.project_members,
              public.activity_logs, public.audit_log from anon, authenticated;
