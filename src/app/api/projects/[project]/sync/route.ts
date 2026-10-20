import type { NextRequest } from "next/server";
import { errorResponse, isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { syncProject, syncStatus } from "@/lib/azure-sync";
import { isProjectKey } from "@/lib/config";

export const maxDuration = 300;

/** Estado de la sincronización. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/projects/[project]/sync">) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const { project } = await ctx.params;
  if (!isProjectKey(project)) return errorResponse(new Error("Proyecto no válido"), 404);
  try {
    return Response.json(await syncStatus(project));
  } catch (error) {
    return errorResponse(error);
  }
}

/** "Sincronizar ahora" (incremental) o "Resincronizar todo" (?full=1). Azure solo se lee. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/projects/[project]/sync">) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const { project } = await ctx.params;
  if (!isProjectKey(project)) return errorResponse(new Error("Proyecto no válido"), 404);
  try {
    const result = await syncProject(project, { full: request.nextUrl.searchParams.get("full") === "1" });
    if (result.status === "error") return errorResponse(new Error(result.error ?? "Falló la sincronización"), 502);
    return Response.json({ ...result, sync: await syncStatus(project) });
  } catch (error) {
    return errorResponse(error);
  }
}
