// Presets de periodo para el análisis.
import { addDaysISO } from "@/lib/dates";

export type PeriodPreset = "sprint" | "14d" | "30d" | "90d" | "month" | "quarter" | "custom";
export type Period = { preset: PeriodPreset; from: string; to: string };

export const PRESET_LABEL: Record<PeriodPreset, string> = {
  sprint: "Sprint actual",
  "14d": "Últimos 14 días",
  "30d": "Últimos 30 días",
  "90d": "Últimos 90 días",
  month: "Este mes",
  quarter: "Este trimestre",
  custom: "Personalizado",
};

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
      return { preset: "custom", from: addDaysISO(today, -29), to: today, label: PRESET_LABEL.custom };
  }
}
