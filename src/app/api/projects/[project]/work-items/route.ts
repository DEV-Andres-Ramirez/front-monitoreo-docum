import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { errorResponse, isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { getWorkItems } from "@/lib/azure";
import { isProjectKey } from "@/lib/config";

/** Árbol de work items de las épicas del proyecto (lectura de Azure DevOps, cacheada). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/projects/[project]/work-items">) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const { project } = await ctx.params;
  if (!isProjectKey(project)) return errorResponse(new Error("Proyecto no válido"), 404);

  try {
    return Response.json(await getWorkItems(project));
  } catch (error) {
    return errorResponse(error, 502);
  }
}

/** "Sincronizar Azure": invalida la caché para que la próxima lectura traiga datos frescos. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/projects/[project]/work-items">) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const { project } = await ctx.params;
  if (!isProjectKey(project)) return errorResponse(new Error("Proyecto no válido"), 404);

  revalidateTag(`azure-${project}`, { expire: 0 });
  await audit(request, { action: "azure_refresh", entity: "azure", projectKey: project });
  return Response.json({ ok: true });
}
