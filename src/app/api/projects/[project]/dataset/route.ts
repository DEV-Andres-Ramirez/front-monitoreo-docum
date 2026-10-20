import { after, type NextRequest } from "next/server";
import { errorResponse, isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { azureConfig } from "@/lib/azure";
import { syncProject, syncStatus } from "@/lib/azure-sync";
import { isProjectKey } from "@/lib/config";
import { ISO_DATE, addDaysISO, diffDays, todayISO } from "@/lib/dates";
import type { DatasetResponse } from "@/lib/analytics/types";
import { loadMembers } from "@/lib/members";
import { db } from "@/lib/supabase";

// La primera sincronización completa puede tardar; las siguientes son incrementales.
export const maxDuration = 300;

const STALE_MINUTES = 15;
const MAX_RANGE_DAYS = 400;

/**
 * Dataset de análisis del periodo [from, to]: ítems vivos + ancestros + transiciones de estado,
 * personal de la planeación, colaboradores y alias. Si los datos tienen más de 15 minutos,
 * responde de inmediato y sincroniza con Azure (solo lectura) en segundo plano.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/projects/[project]/dataset">) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const { project } = await ctx.params;
  if (!isProjectKey(project)) return errorResponse(new Error("Proyecto no válido"), 404);

  const params = request.nextUrl.searchParams;
  const to = ISO_DATE.test(params.get("to") ?? "") ? params.get("to")! : todayISO();
  const from = ISO_DATE.test(params.get("from") ?? "") ? params.get("from")! : addDaysISO(to, -59);
  const span = diffDays(from, to);
  if (span < 0 || span > MAX_RANGE_DAYS) return errorResponse(new Error("Rango de fechas inválido"), 400);

  try {
    const cfg = azureConfig(project);
    let status = await syncStatus(project);
    const stale = !status.lastAt || Date.now() - new Date(status.lastAt).getTime() > STALE_MINUTES * 60_000;

    if (!status.lastAt && !status.running) {
      // Primera vez: se espera la sincronización completa para no mostrar un tablero vacío.
      await syncProject(project, { full: true });
      status = await syncStatus(project);
    } else if (stale && !status.running) {
      after(() => syncProject(project).catch((e) => console.error("[sync]", e)));
      status = { ...status, running: true };
    }

    const [rpc, members, employees, aliases] = await Promise.all([
      db().rpc("azure_dataset", { p_project: project, p_from: from, p_to: to }),
      loadMembers(project),
      db().from("employees").select("id, full_name, email"),
      db().from("employee_aliases").select("alias_email, employee_id").eq("project_key", project),
    ]);
    if (rpc.error) throw new Error(rpc.error.message);
    if (employees.error) throw new Error(employees.error.message);
    if (aliases.error) throw new Error(aliases.error.message);
    const dataset = rpc.data as Pick<DatasetResponse, "items" | "transitions">;

    const body: DatasetResponse = {
      projectKey: project,
      from,
      to,
      org: cfg.org,
      project: cfg.project,
      epicIds: cfg.epicIds,
      generatedAt: new Date().toISOString(),
      sync: { running: status.running, lastAt: status.lastAt, lastStatus: status.lastStatus, lastError: status.lastError },
      roster: members.map((m) => ({
        employeeId: m.employeeId,
        name: m.name,
        email: m.email,
        role: m.role,
        allocation: m.allocation,
        assignmentType: m.assignmentType,
        startDate: m.startDate,
        endDate: m.endDate,
      })),
      employees: (employees.data ?? []).map((e) => ({ id: e.id, name: e.full_name, email: e.email })),
      aliases: (aliases.data ?? []).map((a) => ({ alias: a.alias_email, employeeId: a.employee_id })),
      items: dataset.items.map((i) => ({
        ...i,
        sp: num(i.sp),
        effort: num(i.effort),
        estimate: num(i.estimate),
        completedWork: num(i.completedWork),
        remaining: num(i.remaining),
        leadDays: num(i.leadDays),
        cycleDays: num(i.cycleDays),
      })),
      transitions: dataset.transitions,
    };
    return Response.json(body);
  } catch (error) {
    return errorResponse(error);
  }
}

function num(v: unknown) {
  return v === null || v === undefined ? null : Number(v);
}
