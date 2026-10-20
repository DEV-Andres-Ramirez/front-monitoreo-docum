"""
Genera supabase/migrations/0002_seed.sql a partir del Excel de planeación de personal.

Uso:
    python3 scripts/generate-seed.py [ruta_excel] [ruta_salida]

Por defecto lee context/Planeacion_oct2026_Docum_Acueducto.xlsx.
Cada hoja cuyo nombre empieza por el código del proyecto ('005 ...', '348 ...') se
interpreta como la planeación de ese proyecto (fila 4 = encabezados).
El SQL resultante es idempotente (on conflict ... do update), así que se puede
volver a ejecutar con nuevas planeaciones sin duplicar personas.
"""

import sys
from datetime import date, datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "context" / "Planeacion_oct2026_Docum_Acueducto.xlsx"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "supabase" / "migrations" / "0002_seed.sql"
PROJECT_KEYS = ("348", "005")


def q(value):
    if value is None or value == "":
        return "null"
    if isinstance(value, (datetime, date)):
        return f"'{value:%Y-%m-%d}'"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).strip().replace("'", "''") + "'"


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True)
    employees = {}
    members = []
    for ws in wb.worksheets:
        key = ws.title.split(" ")[0]
        if key not in PROJECT_KEYS:
            continue
        for row in ws.iter_rows(min_row=5, values_only=True):
            name, doc, email, role, alloc, start, end, kind = (list(row) + [None] * 8)[:8]
            if not name or not doc:
                continue
            doc = str(doc).strip()
            employees[doc] = (str(name).strip(), (email or "").strip().lower() or None)
            members.append((key, doc, role, alloc or 1, start, end, kind or "Fijo"))

    lines = [
        "-- Generado por scripts/generate-seed.py desde " + SRC.name,
        "-- Colaboradores: %d únicos · Asignaciones: %d" % (len(employees), len(members)),
        "",
        "insert into public.employees (full_name, document_id, email) values",
        ",\n".join(f"  ({q(n)}, {q(d)}, {q(e)})" for d, (n, e) in employees.items()),
        "on conflict (document_id) do update set full_name = excluded.full_name, email = excluded.email;",
        "",
        "-- in_global = true: la asignación viene de Global (los miembros No Global tienen false; ver 0009)",
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
    ]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"OK → {OUT} ({len(employees)} colaboradores, {len(members)} asignaciones)")


if __name__ == "__main__":
    main()
