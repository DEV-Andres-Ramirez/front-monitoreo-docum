import { z } from "zod";
import { audit } from "@/lib/audit";
import { errorResponse, isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { normalizeEmail } from "@/lib/azure-sync";
import { PROJECT_KEYS } from "@/lib/config";
import { db } from "@/lib/supabase";

const linkSchema = z.object({
  projectKey: z.enum(PROJECT_KEYS),
  alias: z.string().trim().min(3).max(320),
  employeeId: z.uuid(),
});
const unlinkSchema = linkSchema.omit({ employeeId: true });

/** Vincula un correo de Azure (asignado sin coincidencia) con un colaborador. */
export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const parsed = linkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(new Error("Datos de vinculación inválidos"), 400);
  const alias = normalizeEmail(parsed.data.alias)!;
  try {
    const { error } = await db()
      .from("employee_aliases")
      .upsert({ project_key: parsed.data.projectKey, alias_email: alias, employee_id: parsed.data.employeeId }, { onConflict: "project_key,alias_email" });
    if (error) throw new Error(error.message);
    await audit(request, { action: "alias_linked", entity: "employee_aliases", projectKey: parsed.data.projectKey, newData: { alias, employeeId: parsed.data.employeeId } });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Deshace una vinculación manual. */
export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const parsed = unlinkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(new Error("Datos inválidos"), 400);
  const alias = normalizeEmail(parsed.data.alias)!;
  try {
    const { error } = await db().from("employee_aliases").delete().eq("project_key", parsed.data.projectKey).eq("alias_email", alias);
    if (error) throw new Error(error.message);
    await audit(request, { action: "alias_unlinked", entity: "employee_aliases", projectKey: parsed.data.projectKey, newData: { alias } });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
