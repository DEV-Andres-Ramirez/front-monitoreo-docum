import { z } from "zod";
import { audit } from "@/lib/audit";
import { errorResponse, isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { PROJECT_KEYS } from "@/lib/config";
import { ISO_DATE } from "@/lib/dates";
import { db } from "@/lib/supabase";

const target = z.object({ projectKey: z.enum(PROJECT_KEYS), employeeId: z.uuid() });
const setSchema = target.extend({
  kind: z.enum(["vacaciones", "otro_proyecto", "otro"]),
  label: z.string().trim().min(1).max(80),
  until: z.string().regex(ISO_DATE).nullable().optional(),
});

/** Marca anterior de la persona en el proyecto (para la bitácora). */
async function current(projectKey: string, employeeId: string) {
  const { data, error } = await db().from("member_flags").select("kind, label, until").eq("project_key", projectKey).eq("employee_id", employeeId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Pone (o reemplaza) la marca especial de una persona en un proyecto: en vacaciones, asignada a otro
 * proyecto u otra. Con marca no se evalúa en el semáforo ni genera alertas. Solo escribe en Supabase.
 */
export async function PUT(request: Request) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const parsed = setSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(new Error("Datos de la marca inválidos"), 400);
  const { projectKey, employeeId, kind, label, until = null } = parsed.data;
  try {
    const previous = await current(projectKey, employeeId);
    const { error } = await db()
      .from("member_flags")
      .upsert({ project_key: projectKey, employee_id: employeeId, kind, label, until, updated_at: new Date().toISOString() }, { onConflict: "project_key,employee_id" });
    if (error) throw new Error(error.message);
    await audit(request, { action: "member_flag_set", entity: "member_flags", entityId: employeeId, projectKey, oldData: previous, newData: { kind, label, until } });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Quita la marca: la persona vuelve a evaluarse en el semáforo. */
export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const parsed = target.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(new Error("Datos inválidos"), 400);
  const { projectKey, employeeId } = parsed.data;
  try {
    const previous = await current(projectKey, employeeId);
    const { error } = await db().from("member_flags").delete().eq("project_key", projectKey).eq("employee_id", employeeId);
    if (error) throw new Error(error.message);
    if (previous) await audit(request, { action: "member_flag_cleared", entity: "member_flags", entityId: employeeId, projectKey, oldData: previous });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
