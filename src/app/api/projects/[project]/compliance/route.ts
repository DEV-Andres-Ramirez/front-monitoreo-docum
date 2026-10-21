import type { NextRequest } from "next/server";
import { errorResponse, isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { azureConfig } from "@/lib/azure";
import { PROJECTS, isProjectKey } from "@/lib/config";
import type { ComplianceItem, ComplianceResponse } from "@/lib/analytics/compliance";
import { db } from "@/lib/supabase";

/**
 * Cumplimiento de HU y Tareas (si el proyecto lo tiene configurado): todos los ítems de esos tipos
 * que cuelgan de las épicas monitoreadas, sin filtrar por periodo, persona ni Global. Solo lee de Supabase.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/projects/[project]/compliance">) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const { project } = await ctx.params;
  if (!isProjectKey(project)) return errorResponse(new Error("Proyecto no válido"), 404);

  const compliance = PROJECTS[project].compliance;
  if (!compliance) return Response.json({ projectKey: project, compliance: null, items: [], generatedAt: new Date().toISOString() } satisfies ComplianceResponse);

  try {
    const cfg = azureConfig(project);
    const { data, error } = await db().rpc("azure_compliance_items", {
      p_project: project,
      p_epics: cfg.epicIds,
      p_types: [compliance.userStory, compliance.task],
    });
    if (error) throw new Error(error.message);
    return Response.json({ projectKey: project, compliance, items: (data ?? []) as ComplianceItem[], generatedAt: new Date().toISOString() } satisfies ComplianceResponse);
  } catch (error) {
    return errorResponse(error);
  }
}
