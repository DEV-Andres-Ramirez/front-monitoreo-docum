import { errorResponse, isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { syncDueProjects, syncStatus } from "@/lib/azure-sync";
import { PROJECT_KEYS } from "@/lib/config";

// Una sincronización completa (si hiciera falta) puede tardar; las incrementales toman segundos.
export const maxDuration = 300;

/** Cuándo toca la próxima sincronización automática (la más cercana entre los proyectos). */
export async function GET() {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  try {
    const statuses = await Promise.all(PROJECT_KEYS.map((key) => syncStatus(key)));
    const pending = statuses.map((s) => s.nextAutoAt).filter((v): v is string => v !== null);
    return Response.json({ nextAutoAt: pending.length ? pending.reduce((a, b) => (a < b ? a : b)) : null });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Sincronización automática (cada hora): la invoca el tablero mientras está abierto.
 * Solo corre los proyectos a los que ya les toca; Azure solo se lee.
 */
export async function POST() {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  try {
    const { results, nextAutoAt } = await syncDueProjects();
    return Response.json({ results, nextAutoAt });
  } catch (error) {
    return errorResponse(error);
  }
}
