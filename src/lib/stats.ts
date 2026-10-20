// Agregados calculados en Postgres (funciones de la migración 0003) para no depender
// del tope de filas de PostgREST.
import "server-only";
import type { ProjectKey } from "./config";
import { db } from "./supabase";

export type MemberDayAgg = { employeeId: string; date: string; hours: number; activities: number };
export type WorkItemAgg = { workItemId: number; type: string | null; hours: number; activities: number; employeeIds: string[] };

export async function activityStats(project: ProjectKey, from: string, to: string) {
  const { data, error } = await db().rpc("activity_stats", { p_project: project, p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  const raw = data as { memberDays: MemberDayAgg[]; workItems: WorkItemAgg[] };
  return {
    memberDays: raw.memberDays.map((d) => ({ ...d, hours: Number(d.hours), activities: Number(d.activities) })),
    workItems: raw.workItems.map((w) => ({ ...w, hours: Number(w.hours), activities: Number(w.activities) })),
  };
}

export async function activityTotals(project: ProjectKey, from: string, to: string) {
  const { data, error } = await db().rpc("activity_totals", { p_project: project, p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  const row = (data as { hours: number | string; activities: number | string }[])[0];
  return { hours: Number(row?.hours ?? 0), activities: Number(row?.activities ?? 0) };
}

/** Lee todas las filas de una consulta paginando en bloques (PostgREST limita a 1000 por request). */
export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  { pageSize = 1000, max = 20000 } = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < max; offset += pageSize) {
    const { data, error } = await page(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}
