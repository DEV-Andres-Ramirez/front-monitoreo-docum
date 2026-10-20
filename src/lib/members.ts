import "server-only";
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

/** Asignaciones activas del proyecto (Global y No Global) con los datos del colaborador. */
export async function loadMembers(project: ProjectKey): Promise<ProjectMemberRow[]> {
  const { data, error } = await db()
    .from("project_members")
    .select("id, role, allocation, start_date, end_date, assignment_type, in_global, employee:employees!inner(id, full_name, email)")
    .eq("project_key", project)
    .eq("active", true);
  if (error) throw new Error(error.message);
  return (data as unknown as Raw[]).map((m) => ({
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
  }));
}

/** La asignación está vigente en la fecha dada. */
export function inRange(member: Pick<ProjectMemberRow, "startDate" | "endDate">, date: string) {
  return (!member.startDate || member.startDate <= date) && (!member.endDate || member.endDate >= date);
}
