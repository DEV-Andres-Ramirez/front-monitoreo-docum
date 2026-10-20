// Presets de periodo para el análisis.
import { addDaysISO } from "@/lib/dates";

export type PeriodPreset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "sprint" | "14d" | "30d" | "90d" | "month" | "quarter" | "custom";
export type Period = { preset: PeriodPreset; from: string; to: string };

/** Periodo por defecto del tablero. */
export const DEFAULT_PRESET: PeriodPreset = "thisWeek";
/** Atajos principales (seguimiento diario) y el resto de periodos. */
export const QUICK_PRESETS: PeriodPreset[] = ["today", "yesterday", "thisWeek", "lastWeek"];
export const MORE_PRESETS: PeriodPreset[] = ["sprint", "14d", "30d", "month", "90d", "quarter"];

export const PRESET_LABEL: Record<PeriodPreset, string> = {
  today: "Hoy",
  yesterday: "Ayer",
  thisWeek: "Esta semana",
  lastWeek: "Semana pasada",
  sprint: "Sprint actual",
  "14d": "Últimos 14 días",
  "30d": "Últimos 30 días",
  "90d": "Últimos 90 días",
  month: "Este mes",
  quarter: "Este trimestre",
  custom: "Personalizado",
};

/** Contra qué se comparan los indicadores (ver previousRange en metrics.ts). */
export function comparisonLabel(preset: PeriodPreset) {
  if (preset === "today" || preset === "yesterday") return "vs. día hábil anterior";
  if (preset === "thisWeek") return "vs. mismos días de la semana pasada";
  if (preset === "lastWeek") return "vs. la semana anterior";
  return "vs. periodo anterior";
}

/** Lunes (ISO) de la semana de una fecha; la semana va de lunes a domingo. */
const mondayOf = (iso: string) => addDaysISO(iso, -((new Date(`${iso}T12:00:00`).getDay() + 6) % 7));

const isoLocal = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Resuelve un preset a fechas. "Sprint actual" usa la iteración (con fechas) que contiene hoy
 * y tiene más ítems; si no hay, la más reciente que ya terminó.
 */
export function resolvePreset(
  preset: PeriodPreset,
  today: string,
  iterations: { name: string; start: number; end: number; count: number }[] = [],
): Period & { label: string } {
  switch (preset) {
    case "today":
      return { preset, from: today, to: today, label: PRESET_LABEL[preset] };
    case "yesterday": {
      const day = addDaysISO(today, -1);
      return { preset, from: day, to: day, label: PRESET_LABEL[preset] };
    }
    case "thisWeek":
      return { preset, from: mondayOf(today), to: today, label: PRESET_LABEL[preset] };
    case "lastWeek": {
      const monday = addDaysISO(mondayOf(today), -7);
      return { preset, from: monday, to: addDaysISO(monday, 6), label: PRESET_LABEL[preset] };
    }
    case "14d":
      return { preset, from: addDaysISO(today, -13), to: today, label: PRESET_LABEL[preset] };
    case "30d":
      return { preset, from: addDaysISO(today, -29), to: today, label: PRESET_LABEL[preset] };
    case "90d":
      return { preset, from: addDaysISO(today, -89), to: today, label: PRESET_LABEL[preset] };
    case "month":
      return { preset, from: `${today.slice(0, 7)}-01`, to: today, label: PRESET_LABEL[preset] };
    case "quarter": {
      const m = Number(today.slice(5, 7));
      const q = Math.floor((m - 1) / 3) * 3 + 1;
      return { preset, from: `${today.slice(0, 4)}-${String(q).padStart(2, "0")}-01`, to: today, label: PRESET_LABEL[preset] };
    }
    case "sprint": {
      const now = new Date(`${today}T12:00:00`).getTime();
      const current = iterations.filter((i) => i.start <= now && i.end >= now).sort((a, b) => b.count - a.count)[0];
      const last = [...iterations].filter((i) => i.end < now).sort((a, b) => b.end - a.end)[0];
      const it = current ?? last;
      if (!it) return { preset, from: addDaysISO(today, -13), to: today, label: "Sprint actual (sin fechas: 14 días)" };
      const to = isoLocal(Math.min(it.end, now));
      return { preset, from: isoLocal(it.start), to, label: it.name };
    }
    default:
      return resolvePreset(DEFAULT_PRESET, today, iterations);
  }
}
