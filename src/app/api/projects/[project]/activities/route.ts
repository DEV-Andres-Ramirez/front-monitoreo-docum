import type { NextRequest } from "next/server";
import { ACTIVITY_SELECT, toActivity, workItemSnapshot } from "@/lib/activities";
import { errorResponse, isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { isProjectKey } from "@/lib/config";
import { ISO_DATE, todayISO, weekRange } from "@/lib/dates";
import { db } from "@/lib/supabase";
import { activityCreateSchema, firstIssue } from "@/lib/validators";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/projects/[project]/activities">) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const { project } = await ctx.params;
  if (!isProjectKey(project)) return errorResponse(new Error("Proyecto no válido"), 404);

  const params = request.nextUrl.searchParams;
  const fallback = weekRange(todayISO());
  const from = ISO_DATE.test(params.get("from") ?? "") ? params.get("from")! : fallback.start;
  const to = ISO_DATE.test(params.get("to") ?? "") ? params.get("to")! : fallback.end;
  const employeeId = params.get("employeeId");

  try {
    let query = db()
      .from("activity_logs")
      .select(ACTIVITY_SELECT)
      .eq("project_key", project)
      .is("deleted_at", null)
      .gte("work_date", from)
      .lte("work_date", to)
      .order("work_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2000);
    if (employeeId) query = query.eq("employee_id", employeeId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return Response.json({ from, to, activities: data.map(toActivity) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/projects/[project]/activities">) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const { project } = await ctx.params;
  if (!isProjectKey(project)) return errorResponse(new Error("Proyecto no válido"), 404);

  const parsed = activityCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(new Error(firstIssue(parsed.error)), 400);
  const input = parsed.data;

  try {
    const member = await db()
      .from("project_members")
      .select("id")
      .eq("project_key", project)
      .eq("employee_id", input.employeeId)
      .maybeSingle();
    if (member.error) throw new Error(member.error.message);
    if (!member.data) return errorResponse(new Error("El colaborador no pertenece a este proyecto"), 400);

    const snapshot = await workItemSnapshot(project, input.workItemId).catch((e) => {
      throw Object.assign(e, { status: 400 });
    });

    const { data, error } = await db()
      .from("activity_logs")
      .insert({
        project_key: project,
        employee_id: input.employeeId,
        work_date: input.workDate,
        hours: input.hours,
        description: input.description,
        evidence_url: input.evidenceUrl,
        ...snapshot,
      })
      .select(ACTIVITY_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ activity: toActivity(data) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, (error as { status?: number }).status ?? 500);
  }
}
