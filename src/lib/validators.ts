import { z } from "zod";
import { ISO_DATE } from "./dates";

const evidence = z
  .union([z.literal(""), z.url({ protocol: /^https?$/, error: "La evidencia debe ser un enlace http(s) válido" })])
  .nullish()
  .transform((v) => (v ? v.trim() : null));

export const activityCreateSchema = z.object({
  employeeId: z.uuid({ error: "Selecciona un colaborador" }),
  workDate: z.string().regex(ISO_DATE, "Fecha inválida"),
  hours: z.number({ error: "Horas inválidas" }).gt(0, "Las horas deben ser mayores a 0").max(24, "Máximo 24 horas"),
  description: z.string().trim().min(3, "Describe la actividad").max(4000),
  evidenceUrl: evidence,
  workItemId: z.number({ error: "Selecciona una HU o tarea de Azure" }).int().positive(),
});

export const activityUpdateSchema = activityCreateSchema.omit({ employeeId: true });

export type ActivityCreateInput = z.infer<typeof activityCreateSchema>;

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Datos inválidos";
}
