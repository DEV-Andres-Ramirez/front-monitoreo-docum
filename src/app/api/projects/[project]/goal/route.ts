import type { NextRequest } from "next/server";
import { errorResponse, isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { azureConfig } from "@/lib/azure";
import { PROJECTS, isProjectKey } from "@/lib/config";
import type { GoalResponse, GoalTask } from "@/lib/analytics/goal";
import { db } from "@/lib/supabase";

/**
 * Meta de cierre del proyecto (si tiene): todas las tareas de las épicas monitoreadas con los tags
 * de la meta, sin filtrar por periodo, persona ni planeación. Solo lee de Supabase.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/projects/[project]/goal">) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const { project } = await ctx.params;
  if (!isProjectKey(project)) return errorResponse(new Error("Proyecto no válido"), 404);

  const goal = PROJECTS[project].goal;
  if (!goal) return Response.json({ projectKey: project, goal: null, tasks: [], generatedAt: new Date().toISOString() } satisfies GoalResponse);

  try {
    const cfg = azureConfig(project);
    const { data, error } = await db().rpc("azure_goal_tasks", {
      p_project: project,
      p_epics: cfg.epicIds,
      p_type: goal.workItemType,
      p_tags: goal.tags.map((t) => t.tag),
    });
    if (error) throw new Error(error.message);
    return Response.json({ projectKey: project, goal, tasks: (data ?? []) as GoalTask[], generatedAt: new Date().toISOString() } satisfies GoalResponse);
  } catch (error) {
    return errorResponse(error);
  }
}
