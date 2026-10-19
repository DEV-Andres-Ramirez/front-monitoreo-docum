import type { NextRequest } from "next/server";
import { ACTIVITY_SELECT, toActivity, workItemSnapshot } from "@/lib/activities";
import { errorResponse, isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { isProjectKey } from "@/lib/config";
import { db } from "@/lib/supabase";
import { activityUpdateSchema, firstIssue } from "@/lib/validators";

async function findActive(id: string) {
  const { data, error } = await db()
    .from("activity_logs")
    .select("id, project_key")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/activities/[id]">) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const { id } = await ctx.params;

  const parsed = activityUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(new Error(firstIssue(parsed.error)), 400);
  const input = parsed.data;

  try {
    const current = await findActive(id);
    if (!current || !isProjectKey(current.project_key)) {
      return errorResponse(new Error("La actividad no existe"), 404);
    }
    const snapshot = await workItemSnapshot(current.project_key, input.workItemId);
    const { data, error } = await db()
      .from("activity_logs")
      .update({
        work_date: input.workDate,
        hours: input.hours,
        description: input.description,
        evidence_url: input.evidenceUrl,
        ...snapshot,
      })
      .eq("id", id)
      .select(ACTIVITY_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ activity: toActivity(data) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Borrado lógico: la fila se conserva (deleted_at) y el trigger deja la traza en audit_log. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/activities/[id]">) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const { id } = await ctx.params;

  try {
    const current = await findActive(id);
    if (!current) return errorResponse(new Error("La actividad no existe"), 404);
    const { error } = await db()
      .from("activity_logs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
