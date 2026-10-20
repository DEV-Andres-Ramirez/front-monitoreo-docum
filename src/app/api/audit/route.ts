import type { NextRequest } from "next/server";
import { errorResponse, isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { isProjectKey } from "@/lib/config";
import { ISO_DATE, addDaysISO, todayISO } from "@/lib/dates";
import { db } from "@/lib/supabase";
import type { AuditEntry, AuditResponse } from "@/lib/types";

const PAGE = 50;
const ACTIONS = new Set([
  "login_success",
  "login_failed",
  "logout",
  "activity_created",
  "activity_updated",
  "activity_deleted",
  "activity_restored",
  "azure_refresh",
  "azure_sync",
  "azure_sync_failed",
  "alias_linked",
  "alias_unlinked",
]);

type Row = {
  id: number;
  occurred_at: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  project_key: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
};

/** Bitácora paginada por cursor (id descendente). Incluye los eventos de sesión (sin proyecto). */
export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const project = params.get("project") ?? "";
  if (!isProjectKey(project)) return errorResponse(new Error("Proyecto no válido"), 400);
  const to = ISO_DATE.test(params.get("to") ?? "") ? params.get("to")! : todayISO();
  const from = ISO_DATE.test(params.get("from") ?? "") ? params.get("from")! : addDaysISO(to, -6);
  const actions = (params.get("actions") ?? "").split(",").filter((a) => ACTIONS.has(a));
  const cursor = Number(params.get("cursor")) || null;

  try {
    let query = db()
      .from("audit_log")
      .select("id, occurred_at, action, entity, entity_id, project_key, old_data, new_data, ip, user_agent")
      .or(`project_key.eq.${project},project_key.is.null`)
      // Límites del día en hora de Bogotá (UTC-5, sin horario de verano)
      .gte("occurred_at", `${from}T00:00:00-05:00`)
      .lt("occurred_at", `${addDaysISO(to, 1)}T00:00:00-05:00`)
      .order("id", { ascending: false })
      .limit(PAGE + 1);
    if (actions.length) query = query.in("action", actions);
    if (cursor) query = query.lt("id", cursor);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = data as Row[];
    const page = rows.slice(0, PAGE);
    const entries: AuditEntry[] = page.map((r) => ({
      id: r.id,
      occurredAt: r.occurred_at,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      projectKey: r.project_key,
      oldData: r.old_data,
      newData: r.new_data,
      ip: r.ip,
      userAgent: r.user_agent,
    }));
    const body: AuditResponse = { entries, nextCursor: rows.length > PAGE ? page[page.length - 1].id : null };
    return Response.json(body);
  } catch (error) {
    return errorResponse(error);
  }
}
