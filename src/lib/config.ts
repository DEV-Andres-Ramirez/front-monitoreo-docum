// Configuración de negocio compartida entre cliente y servidor (sin secretos).

export const PROJECT_KEYS = ["348", "005"] as const;
export type ProjectKey = (typeof PROJECT_KEYS)[number];

/**
 * Meta de cierre comprometida con el cliente: tareas por tag por día hábil (lunes a viernes sin
 * festivos) desde `start` hasta `deadline`. Cuenta TODAS las tareas de las épicas monitoreadas con
 * esos tags, sin importar el colaborador ni si está en Global.
 */
export type ProjectGoal = {
  start: string;
  deadline: string;
  workItemType: string;
  tags: { tag: string; daily: number }[];
};

/**
 * Análisis de cumplimiento (vista "Cumplimiento"): cuántas HU, Tareas y Bugs de las épicas monitoreadas
 * hay, cuántos se completaron y su %. Cuenta TODO lo de las épicas (de quien sea o sin asignar).
 * HU: dos niveles (Entregado/QA = categoría Resolved, Producción = Completed). Tarea y Bug: Completed.
 */
export type ProjectCompliance = { userStory: string; task: string; bug?: string };

/**
 * Mundo de análisis: qué tipos de ítem cuentan en Resumen, Colaboradores, semáforo y Cronograma.
 * `dated: false` = sus fechas no son confiables: solo se muestran cantidades y el estado actual.
 */
export type WorkView = { key: "tasks" | "hu" | "bugs"; label: string; short: string; types: string[]; dated: boolean };

export type ProjectMeta = {
  key: ProjectKey;
  name: string;
  client: string;
  epics: string;
  /** Color de acento de la UI para este proyecto */
  accent: string;
  accentSoft: string;
  goal?: ProjectGoal;
  compliance?: ProjectCompliance;
  /** Mundos de análisis (el primero es el predeterminado); con uno solo no se muestra selector */
  views: WorkView[];
};

const TASKS_VIEW: WorkView = { key: "tasks", label: "Tareas", short: "Tareas", types: ["Task"], dated: true };

export const PROJECTS: Record<ProjectKey, ProjectMeta> = {
  "348": {
    key: "348",
    name: "SGDEA Acueducto",
    client: "EAAB · Acueducto de Bogotá",
    epics: "Certificación CORE · Certificación Temáticos",
    accent: "#0090FF",
    accentSoft: "#E0F2FF",
    // Compromiso con EAAB: 24 tareas de Video y 24 de Informe por día hábil; cierre el 13-nov
    goal: {
      start: "2026-10-19",
      deadline: "2026-11-13",
      workItemType: "Task",
      tags: [
        { tag: "Video", daily: 24 },
        { tag: "Informe", daily: 24 },
      ],
    },
    // El rendimiento y el análisis de Acueducto se miden solo con tareas
    views: [TASKS_VIEW],
  },
  "005": {
    key: "005",
    name: "Positiva SGDEA",
    client: "Positiva · 3T Capital",
    epics: "Deuda Técnica y Contractual · Épica de gestión · Deuda · NP - Evolutivos",
    accent: "#13A538",
    accentSoft: "#E3F8E8",
    compliance: { userStory: "User Story", task: "Task", bug: "Bug" },
    // Tres mundos separados; los bugs no usan fechas (las de Azure no son confiables)
    views: [
      TASKS_VIEW,
      { key: "hu", label: "Historias de usuario", short: "HU", types: ["User Story"], dated: true },
      { key: "bugs", label: "Bugs", short: "Bugs", types: ["Bug"], dated: false },
    ],
  },
};

/** Inicio del análisis (ambos proyectos): el periodo por defecto va de esta fecha a hoy. */
export const ANALYSIS_START = "2026-10-19";

/** Horas de una jornada completa (100 % de asignación). Esperado diario = JORNADA_HORAS × % asignado. */
export const JORNADA_HORAS = 8;

/** Zona horaria de operación: define qué es "hoy". */
export const TIMEZONE = "America/Bogota";

export function isProjectKey(value: string): value is ProjectKey {
  return (PROJECT_KEYS as readonly string[]).includes(value);
}
