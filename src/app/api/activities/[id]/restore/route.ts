import type { NextRequest } from "next/server";
import { ACTIVITY_SELECT, toActivity } from "@/lib/activities";
import { errorResponse, isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/supabase";

/** Deshace un borrado lógico. El trigger registra 'activity_restored' en la bitácora. */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/activities/[id]/restore">) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const { id } = await ctx.params;

  try {
    const { data, error } = await db()
      .from("activity_logs")
      .update({ deleted_at: null })
      .eq("id", id)
      .not("deleted_at", "is", null)
      .select(ACTIVITY_SELECT)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return errorResponse(new Error("La actividad no existe o no está eliminada"), 404);
    return Response.json({ activity: toActivity(data) });
  } catch (error) {
    return errorResponse(error);
  }
}
