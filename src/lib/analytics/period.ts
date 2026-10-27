// Presets de periodo para el análisis.
import { ANALYSIS_START } from "@/lib/config";
import { addDaysISO, formatDayMonth, previousBusinessDay } from "@/lib/dates";

export type PeriodPreset = "sinceStart" | "today" | "yesterday" | "thisWeek" | "lastWeek" | "custom";
export type Period = { preset: PeriodPreset; from: string; to: string };

/** Periodo por defecto: todo lo transcurrido desde el inicio del análisis (19-oct) hasta hoy. */
export const DEFAULT_PRESET: PeriodPreset = "sinceStart";
/** Atajos de seguimiento diario (los únicos predeterminados, además del inicio). */
export const QUICK_PRESETS: PeriodPreset[] = ["today", "yesterday", "thisWeek", "lastWeek"];

export const PRESET_LABEL: Record<PeriodPreset, string> = {
  sinceStart: "Desde el 19 oct",
  today: "Hoy",
  yesterday: "Ayer",
  thisWeek: "Esta semana",
  lastWeek: "Semana pasada",
  custom: "Personalizado",
};

/** Contra qué se comparan los indicadores (ver previousRange en metrics.ts); null = sin comparación. */
export function comparisonLabel(preset: PeriodPreset): string | null {
  if (preset === "sinceStart") return null;
  if (preset === "today" || preset === "yesterday") return "frente al día hábil anterior";
  if (preset === "thisWeek") return "frente a los mismos días de la semana pasada";
  if (preset === "lastWeek") return "frente a la semana anterior";
  return "frente al periodo anterior";
}

/** Lunes (ISO) de la semana de una fecha; la semana va de lunes a domingo. */
const mondayOf = (iso: string) => addDaysISO(iso, -((new Date(`${iso}T12:00:00`).getDay() + 6) % 7));

/** Resuelve un preset a fechas. "Ayer" es el día hábil anterior (un lunes, el viernes). */
export function resolvePreset(preset: PeriodPreset, today: string): Period & { label: string } {
  switch (preset) {
    case "sinceStart":
      return { preset, from: today < ANALYSIS_START ? today : ANALYSIS_START, to: today, label: PRESET_LABEL[preset] };
    case "today":
      return { preset, from: today, to: today, label: PRESET_LABEL[preset] };
    case "yesterday": {
      const day = previousBusinessDay(today);
      // Si el día hábil anterior no es literalmente ayer (lunes, después de festivo), se nombra
      const label = day === addDaysISO(today, -1) ? PRESET_LABEL[preset] : `Último día hábil (${formatDayMonth(day)})`;
      return { preset, from: day, to: day, label };
    }
    case "thisWeek":
      return { preset, from: mondayOf(today), to: today, label: PRESET_LABEL[preset] };
    case "lastWeek": {
      const monday = addDaysISO(mondayOf(today), -7);
      return { preset, from: monday, to: addDaysISO(monday, 6), label: PRESET_LABEL[preset] };
    }
    default:
      return resolvePreset(DEFAULT_PRESET, today);
  }
}

/** ¿Es un preset vigente? (los guardados de versiones anteriores, como "Sprint actual", ya no existen) */
export const isPreset = (value: unknown): value is PeriodPreset => typeof value === "string" && value in PRESET_LABEL;
