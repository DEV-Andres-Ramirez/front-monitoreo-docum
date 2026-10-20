// Colores por tipo de work item de Azure (validados con el validador de dataviz:
// claro sobre #ffffff y oscuro sobre #0d1526). El ORDEN es parte de la validación
// (orange Epic y red Bug nunca quedan adyacentes): no reordenar.
export const TYPE_ORDER = ["User Story", "Epic", "Feature", "Task", "Bug"] as const;

export const TYPE_META: Record<string, { label: string; plural: string; light: string; dark: string }> = {
  "User Story": { label: "HU", plural: "Historias de usuario", light: "#009CCC", dark: "#1496C8" },
  Epic: { label: "Épica", plural: "Épicas", light: "#FF7B00", dark: "#E0700C" },
  Feature: { label: "Feature", plural: "Features", light: "#773B93", dark: "#9A5FC4" },
  Task: { label: "Tarea", plural: "Tareas", light: "#C29400", dark: "#B88A00" },
  Bug: { label: "Bug", plural: "Bugs", light: "#CC293D", dark: "#E0444A" },
};

const FALLBACK = { label: "Ítem", plural: "Otros", light: "#64748B", dark: "#7C8BA1" };

export function typeMeta(type: string | null | undefined) {
  return TYPE_META[type ?? ""] ?? { ...FALLBACK, label: type ?? FALLBACK.label };
}

export function typeRank(type: string | null | undefined) {
  const i = TYPE_ORDER.indexOf((type ?? "") as (typeof TYPE_ORDER)[number]);
  return i === -1 ? TYPE_ORDER.length : i;
}
