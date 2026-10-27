import "server-only";
import type { MemberFlag, MemberFlagKind } from "./analytics/types";
import type { ProjectKey } from "./config";
import { db } from "./supabase";

export type ProjectMemberRow = {
  id: string;
  employeeId: string;
  name: string;
  email: string | null;
  /** null para los miembros No Global (sin cargo ni % en Global) */
  role: string | null;
  allocation: number | null;
  assignmentType: string;
  /** false = miembro No Global: trabaja en el proyecto sin estar en Global, pero cuenta en el análisis */
  inGlobal: boolean;
  startDate: string | null;
  endDate: string | null;
  /** Marca vigente (vacaciones, otro proyecto…) o null */
  flag: MemberFlag | null;
};

type Raw = {
  id: string;
  role: string | null;
  allocation: number | string | null;
  in_global: boolean;
  start_date: string | null;
  end_date: string | null;
  assignment_type: string;
  employee: { id: string; full_name: string; email: string | null };
};

type RawFlag = { employee_id: string; kind: MemberFlagKind; label: string; until: string | null };

/**
 * Asignaciones activas del proyecto (Global y No Global) con los datos del colaborador y su marca
 * vigente (`until` vacío o desde `today`).
 */
export async function loadMembers(project: ProjectKey, today: string): Promise<ProjectMemberRow[]> {
  const [members, flags] = await Promise.all([
    db()
      .from("project_members")
      .select("id, role, allocation, start_date, end_date, assignment_type, in_global, employee:employees!inner(id, full_name, email)")
      .eq("project_key", project)
      .eq("active", true),
    db().from("member_flags").select("employee_id, kind, label, until").eq("project_key", project),
  ]);
  if (members.error) throw new Error(members.error.message);
  if (flags.error) throw new Error(flags.error.message);
  const active = new Map(
    (flags.data as RawFlag[]).filter((f) => !f.until || f.until >= today).map((f) => [f.employee_id, { kind: f.kind, label: f.label, until: f.until }]),
  );
  return (members.data as unknown as Raw[]).map((m) => ({
    id: m.id,
    employeeId: m.employee.id,
    name: m.employee.full_name,
    email: m.employee.email,
    role: m.role,
    allocation: m.allocation === null ? null : Number(m.allocation),
    assignmentType: m.assignment_type,
    inGlobal: m.in_global,
    startDate: m.start_date,
    endDate: m.end_date,
    flag: active.get(m.employee.id) ?? null,
  }));
}

/** La asignación está vigente en la fecha dada. */
export function inRange(member: Pick<ProjectMemberRow, "startDate" | "endDate">, date: string) {
  return (!member.startDate || member.startDate <= date) && (!member.endDate || member.endDate >= date);
}
