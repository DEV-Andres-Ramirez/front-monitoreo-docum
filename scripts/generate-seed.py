"""
Genera supabase/migrations/0002_seed.sql (personal de Global) a partir de los CSV de cada proyecto.

Uso:
    python3 scripts/generate-seed.py [carpeta_csv] [ruta_salida]

Por defecto lee todos los context/Planeacion_*.csv (uno por proyecto: Planeacion_005_Positiva.csv,
Planeacion_348_Acueducto.csv…). El proyecto de cada fila sale de la columna CUENTA ANALITICA
("005 - …", "348 - …").

El SQL resultante es idempotente y deja Global igual al CSV:
- Quien ya existía sin cédula (miembro No Global) se empareja por correo exacto o por la parte local
  del correo (Azure de 005 usa @3tcapital.co y Global @linktic.com) y recibe la cédula: así la carga
  actualiza ese mismo registro y conserva sus marcas especiales, alias e historial.
- Upsert de colaboradores (por cédula) y de asignaciones (in_global = true, active = true). Si Global
  incluye a un miembro No Global, deja de ser No Global.
- Las asignaciones de Global de esos proyectos que ya no están en el CSV quedan inactivas
  (active = false). No se borra nada y los miembros No Global no se tocan.
"""

import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "context"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "supabase" / "migrations" / "0002_seed.sql"
PROJECT_KEYS = ("348", "005")


def q(value):
    if value is None or value == "":
        return "null"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).strip().replace("'", "''") + "'"


def allocation(text):
    """'0,41' → 0.41 (1 = 100 %)."""
    value = float((text or "1").replace(",", ".").strip() or 1)
    return int(value) if value == int(value) else value


def main():
    files = sorted(SRC.glob("Planeacion_*.csv")) if SRC.is_dir() else [SRC]
    employees = {}
    members = []
    for path in files:
        with path.open(encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                key = (row.get("CUENTA ANALITICA") or "").split(" ")[0]
                name = (row.get("COLABORADOR") or "").strip()
                doc = "".join(ch for ch in (row.get("IDENTIFICACION") or "") if ch.isdigit())
                if key not in PROJECT_KEYS or not name or not doc:
                    continue
                email = (row.get("CORREO CORPORATIVO") or "").strip().lower() or None
                employees[doc] = (name, email)
                members.append(
                    (
                        key,
                        doc,
                        (row.get("CARGO") or "").strip() or None,
                        allocation(row.get("OCUPACION PLANEACION")),
                        row.get("FECHA INICIO") or None,
                        row.get("FECHA FINALIZACION") or None,
                        (row.get("TIPO ASIGNACION") or "").strip() or "Fijo",
                    )
                )

    keys = sorted({k for k, *_ in members})
    by_project = ", ".join(f"{k}: {sum(1 for m in members if m[0] == k)}" for k in keys)
    pairs = ",\n".join(f"      ({q(k)}, {q(d)})" for k, d, *_ in members)
    lines = [
        "-- Generado por scripts/generate-seed.py desde " + ", ".join(p.name for p in files),
        f"-- Colaboradores: {len(employees)} únicos · Asignaciones: {len(members)} ({by_project})",
        "",
        "-- 1. Miembros No Global (sin cédula) que ahora están en Global: reciben la cédula para que el upsert",
        "--    actualice su mismo registro (conserva marcas, alias e historial). Correo exacto o misma parte local,",
        "--    solo si hay un único candidato.",
        "update public.employees e set document_id = v.document_id",
        "from (values",
        ",\n".join(f"  ({q(d)}, {q(em)})" for d, (_, em) in employees.items() if em),
        ") as v(document_id, email)",
        "where e.document_id is null",
        "  and not exists (select 1 from public.employees x where x.document_id = v.document_id)",
        "  and split_part(lower(e.email), '@', 1) = split_part(v.email, '@', 1)",
        "  and (select count(*) from public.employees y",
        "       where y.document_id is null and split_part(lower(y.email), '@', 1) = split_part(v.email, '@', 1)) = 1;",
        "",
        "-- 2. Colaboradores",
        "insert into public.employees (full_name, document_id, email) values",
        ",\n".join(f"  ({q(n)}, {q(d)}, {q(e)})" for d, (n, e) in employees.items()),
        "on conflict (document_id) do update set full_name = excluded.full_name, email = excluded.email;",
        "",
        "-- 3. Asignaciones de Global (in_global = true; los miembros No Global tienen false, ver 0009 y 0011)",
        "insert into public.project_members (project_key, employee_id, role, allocation, start_date, end_date, assignment_type, active, in_global)",
        "select v.project_key, e.id, v.role, v.allocation, v.start_date::date, v.end_date::date, v.assignment_type, true, true",
        "from (values",
        ",\n".join(
            f"  ({q(k)}, {q(d)}, {q(r)}, {q(a)}, {q(s)}, {q(en)}, {q(t)})" for k, d, r, a, s, en, t in members
        ),
        ") as v(project_key, document_id, role, allocation, start_date, end_date, assignment_type)",
        "join public.employees e on e.document_id = v.document_id",
        "on conflict (project_key, employee_id) do update set",
        "  role = excluded.role, allocation = excluded.allocation, start_date = excluded.start_date,",
        "  end_date = excluded.end_date, assignment_type = excluded.assignment_type, active = true, in_global = true;",
        "",
        "-- 4. Quien ya no está en Global de estos proyectos queda inactivo (no se borra; los No Global no se tocan)",
        "update public.project_members m set active = false",
        f"where m.in_global and m.active and m.project_key in ({', '.join(q(k) for k in keys)})",
        "  and not exists (",
        "    select 1",
        "    from (values",
        pairs,
        "    ) as v(project_key, document_id)",
        "    join public.employees e on e.document_id = v.document_id",
        "    where v.project_key = m.project_key and e.id = m.employee_id",
        "  );",
        "",
    ]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"OK → {OUT} ({len(employees)} colaboradores, {len(members)} asignaciones: {by_project})")


if __name__ == "__main__":
    main()
