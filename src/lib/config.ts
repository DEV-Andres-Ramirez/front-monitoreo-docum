// Configuración de negocio compartida entre cliente y servidor (sin secretos).

export const PROJECT_KEYS = ["348", "005"] as const;
export type ProjectKey = (typeof PROJECT_KEYS)[number];

export type ProjectMeta = {
  key: ProjectKey;
  name: string;
  client: string;
  epics: string;
  /** Color de acento de la UI para este proyecto */
  accent: string;
  accentSoft: string;
};

export const PROJECTS: Record<ProjectKey, ProjectMeta> = {
  "348": {
    key: "348",
    name: "SGDEA Acueducto",
    client: "EAAB · Acueducto de Bogotá",
    epics: "Certificación CORE · Certificación Temáticos",
    accent: "#0090FF",
    accentSoft: "#E0F2FF",
  },
  "005": {
    key: "005",
    name: "Positiva SGDEA",
    client: "Positiva · 3T Capital",
    epics: "Deuda Técnica y Contractual",
    accent: "#13A538",
    accentSoft: "#E3F8E8",
  },
};

/** Horas de una jornada completa (100 % de asignación). Esperado diario = JORNADA_HORAS × % asignado. */
export const JORNADA_HORAS = 8;

/** Zona horaria de operación: define qué es "hoy". */
export const TIMEZONE = "America/Bogota";

export function isProjectKey(value: string): value is ProjectKey {
  return (PROJECT_KEYS as readonly string[]).includes(value);
}
