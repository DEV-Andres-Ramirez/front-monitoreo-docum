// Métricas de flujo y desempeño sobre el modelo filtrado (TypeScript puro, cliente).
import { isBusinessDay, isoLocalDate } from "@/lib/dates";
import type { PeriodPreset } from "./period";
import type { StateCategory } from "./types";
import { DAY, capacityHours, categoryAt, endOfDay, type Item, type Model, type Person } from "./model";

/** `epics`: épicas monitoreadas seleccionadas (vacío = todas las del proyecto). `tag`: tag de Azure (null = todos). */
export type Filters = { from: string; to: string; people: string[]; includeOthers: boolean; epics: number[]; tag: string | null };
export type Range = { from: number; to: number };

export const CATEGORIES: StateCategory[] = ["Proposed", "InProgress", "Resolved", "Completed"];
export const CATEGORY_LABEL: Record<StateCategory, string> = {
  Proposed: "Por iniciar",
  InProgress: "En curso",
  Resolved: "Entregado",
  Completed: "Cerrado",
  Removed: "Removido",
};

const startOfDay = (iso: string) => new Date(`${iso}T00:00:00`).getTime();

export function periodRange(f: Pick<Filters, "from" | "to">): Range {
  return { from: startOfDay(f.from), to: endOfDay(startOfDay(f.to)) };
}

/**
 * Periodo con el que se comparan los indicadores:
 * Hoy / Ayer → el día hábil anterior · semanas → los mismos días de la semana anterior ·
 * resto → periodo de igual duración inmediatamente antes.
 */
export function previousRange(r: Range, preset?: PeriodPreset): Range {
  if (preset === "today" || preset === "yesterday") {
    const d = new Date(r.from);
    do d.setDate(d.getDate() - 1);
    while (!isBusinessDay(isoLocalDate(d.getTime())));
    return { from: d.getTime(), to: endOfDay(d.getTime()) };
  }
  if (preset === "thisWeek" || preset === "lastWeek") return { from: r.from - 7 * DAY, to: r.to - 7 * DAY };
  const span = r.to - r.from;
  return { from: r.from - span - 1, to: r.from - 1 };
}

export const MIN_TREND_DAYS = 7;

/** Ventana de las gráficas de tendencia: el periodo, o los últimos 7 días si es más corto (p. ej. "Hoy"). */
export function trendRange(r: Range): Range {
  if (r.to - r.from >= (MIN_TREND_DAYS - 1) * DAY) return r;
  const d = new Date(r.to);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (MIN_TREND_DAYS - 1));
  return { from: d.getTime(), to: r.to };
}

/** Personas visibles según el filtro (planeación ± otros). */
export function visiblePeople(model: Model, f: Filters): Person[] {
  return [...model.people.values()]
    .filter((p) => p.inRoster || f.includeOthers)
    .sort((a, b) => Number(b.inRoster) - Number(a.inRoster) || a.name.localeCompare(b.name, "es"));
}

/** ¿El ítem cuelga de las épicas monitoreadas (y de la épica seleccionada, si hay filtro)? */
export const inEpics = (i: Item, epics: number[]) => i.inMonitoredEpics && (!epics.length || (i.epicId !== null && epics.includes(i.epicId)));

/** ¿El ítem tiene el tag? (sin distinguir mayúsculas; null = sin filtro) */
export const inTag = (i: Item, tag: string | null) => !tag || i.tagList.some((t) => t.toLowerCase() === tag.toLowerCase());

/** Ítems de trabajo dentro del alcance: épicas monitoreadas + tag + personas seleccionadas. */
export function scopedWork(model: Model, f: Filters): Item[] {
  const selected = new Set(f.people);
  return model.work.filter((i) => {
    const p = model.people.get(i.personKey!);
    if (!p || (!p.inRoster && !f.includeOthers)) return false;
    if (selected.size && !selected.has(p.key)) return false;
    return inEpics(i, f.epics) && inTag(i, f.tag);
  });
}

/** Vivo en el periodo: creado antes de su fin (o entregado dentro de él aunque se registrara después) y no cerrado antes de su inicio. */
export const isAlive = (i: Item, r: Range) =>
  i.cat !== "Removed" && (i.createdAt <= r.to || deliveredIn(i, r)) && (i.completedAt === null || i.completedAt >= r.from);
export const deliveredIn = (i: Item, r: Range) => i.deliveredAt !== null && i.deliveredAt >= r.from && i.deliveredAt <= r.to;
export const completedIn = (i: Item, r: Range) => i.completedAt !== null && i.completedAt >= r.from && i.completedAt <= r.to;

export function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

// ------------------------------------------------------------------ KPIs
export type KpiSet = {
  active: number;
  delivered: number;
  hoursDelivered: number;
  wip: number;
  hoursWip: number;
  resolvedPending: number;
  overdue: number;
  onTimeRate: number | null;
  onTimeBase: number;
  cycleP50: number | null;
  cycleP85: number | null;
  leadP50: number | null;
  completedWork: number;
};

export function kpis(items: Item[], r: Range, now: number): KpiSet {
  const alive = items.filter((i) => isAlive(i, r));
  const delivered = items.filter((i) => deliveredIn(i, r));
  const completed = items.filter((i) => completedIn(i, r));
  const withTarget = delivered.filter((i) => i.onTime !== null);
  const current = r.to >= now - DAY; // el periodo llega hasta hoy → el WIP es el actual
  const wipItems = current ? alive.filter((i) => i.cat === "InProgress") : alive.filter((i) => categoryAt(i, r.to) === "InProgress");
  return {
    active: alive.length,
    delivered: delivered.length,
    hoursDelivered: round(sum(delivered.map((i) => i.countedHours))),
    wip: wipItems.length,
    hoursWip: round(sum(wipItems.map((i) => i.countedHours))),
    resolvedPending: alive.filter((i) => (current ? i.cat : categoryAt(i, r.to)) === "Resolved").length,
    overdue: alive.filter((i) => i.overdue).length,
    onTimeRate: withTarget.length ? withTarget.filter((i) => i.onTime).length / withTarget.length : null,
    onTimeBase: withTarget.length,
    cycleP50: percentile(completed.map((i) => i.cycleTime).filter((v): v is number => v !== null), 0.5),
    cycleP85: percentile(completed.map((i) => i.cycleTime).filter((v): v is number => v !== null), 0.85),
    leadP50: percentile(completed.map((i) => i.leadTime).filter((v): v is number => v !== null), 0.5),
    completedWork: round(sum(delivered.map((i) => i.completedWork ?? 0))),
  };
}

// ------------------------------------------------------------------ Series temporales
export function days(r: Range, maxPoints = 120) {
  const out: number[] = [];
  const total = Math.ceil((r.to - r.from) / DAY);
  const step = Math.max(1, Math.ceil(total / maxPoints));
  for (let t = r.from; t <= r.to; t += step * DAY) out.push(endOfDay(t));
  if (out[out.length - 1] !== endOfDay(r.to)) out.push(endOfDay(r.to));
  return out;
}

export function weeks(r: Range) {
  const out: { start: number; end: number }[] = [];
  const d = new Date(r.from);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lunes
  d.setHours(0, 0, 0, 0);
  for (let t = d.getTime(); t <= r.to; t += 7 * DAY) out.push({ start: t, end: t + 7 * DAY - 1 });
  return out;
}

export type TimeUnit = "day" | "week";

/** Días calendario del periodo (00:00 → 23:59:59 locales). */
export function dayBuckets(r: Range) {
  const out: { start: number; end: number }[] = [];
  const d = new Date(r.from);
  d.setHours(0, 0, 0, 0);
  while (d.getTime() <= r.to) {
    const start = d.getTime();
    d.setDate(d.getDate() + 1);
    out.push({ start, end: d.getTime() - 1 });
  }
  return out;
}

/** Cubetas del periodo por día o por semana (lunes → domingo; los extremos se recortan al contar). */
export const buckets = (r: Range, unit: TimeUnit) => (unit === "day" ? dayBuckets(r) : weeks(r));

/** Ítems y horas entregadas por día o por semana. */
export function throughput(items: Item[], r: Range, unit: TimeUnit) {
  const delivered = items.filter((i) => i.deliveredAt !== null && i.deliveredAt >= r.from && i.deliveredAt <= r.to);
  return buckets(r, unit).map((b) => {
    const done = delivered.filter((i) => i.deliveredAt! >= b.start && i.deliveredAt! <= b.end);
    return { start: b.start, items: done.length, hours: round(sum(done.map((i) => i.countedHours))) };
  });
}

export function cumulativeFlow(items: Item[], r: Range) {
  const relevant = items.filter((i) => isAlive(i, r));
  return days(r).map((t) => {
    const counts: Record<StateCategory, number> = { Proposed: 0, InProgress: 0, Resolved: 0, Completed: 0, Removed: 0 };
    for (const i of relevant) {
      const cat = categoryAt(i, t);
      if (cat) counts[cat] += 1;
    }
    return { t, ...counts };
  });
}

export function burnup(items: Item[], r: Range) {
  const relevant = items.filter((i) => isAlive(i, r) && i.countedHours > 0);
  return days(r).map((t) => ({
    t,
    scope: round(sum(relevant.filter((i) => i.createdAt <= t).map((i) => i.countedHours))),
    done: round(sum(relevant.filter((i) => i.deliveredAt !== null && i.deliveredAt <= t).map((i) => i.countedHours))),
  }));
}

export function cycleScatter(items: Item[], r: Range) {
  const points = items
    .filter((i) => completedIn(i, r) && i.cycleTime !== null)
    .map((i) => ({ item: i, x: i.completedAt!, y: round(i.cycleTime!, 2) }));
  const values = points.map((p) => p.y);
  return { points, p50: percentile(values, 0.5), p85: percentile(values, 0.85) };
}

/** Trabajo en curso con su antigüedad en el estado actual. */
export function agingWip(items: Item[], now: number) {
  return items
    .filter((i) => i.cat === "InProgress" || i.cat === "Resolved")
    .map((i) => {
      const seg = [...i.segments].reverse().find((s) => s.cat === i.cat);
      const since = seg?.from ?? i.actualStart ?? i.createdAt;
      return { item: i, since, ageDays: round((now - since) / DAY, 1) };
    })
    .sort((a, b) => b.ageDays - a.ageDays);
}

export function distribution(items: Item[], r: Range) {
  const counts: Record<StateCategory, number> = { Proposed: 0, InProgress: 0, Resolved: 0, Completed: 0, Removed: 0 };
  for (const i of items.filter((x) => isAlive(x, r))) counts[i.cat] += 1;
  return counts;
}

// ------------------------------------------------------------------ Por persona
export type PersonRow = {
  person: Person;
  active: number;
  delivered: number;
  wip: number;
  overdue: number;
  hoursDelivered: number;
  hoursOpen: number;
  estimated: number;
  completedWork: number;
  onTimeRate: number | null;
  cycleP50: number | null;
  capacity: number | null;
  utilization: number | null;
  byCat: Record<StateCategory, number>;
};

export function perPerson(people: Person[], items: Item[], r: Range, now = Date.now()): PersonRow[] {
  const byPerson = new Map<string, Item[]>();
  for (const i of items) byPerson.set(i.personKey!, [...(byPerson.get(i.personKey!) ?? []), i]);
  return people.map((person) => {
    const mine = byPerson.get(person.key) ?? [];
    const k = kpis(mine, r, now);
    const alive = mine.filter((i) => isAlive(i, r));
    const delivered = mine.filter((i) => deliveredIn(i, r));
    const byCat: Record<StateCategory, number> = { Proposed: 0, InProgress: 0, Resolved: 0, Completed: 0, Removed: 0 };
    for (const i of alive) byCat[i.cat] += 1;
    const capacity = capacityHours(person, r.from, r.to);
    return {
      person,
      active: alive.length,
      delivered: k.delivered,
      wip: k.wip,
      overdue: k.overdue,
      hoursDelivered: k.hoursDelivered,
      hoursOpen: round(sum(alive.filter((i) => i.deliveredAt === null).map((i) => i.countedHours))),
      estimated: round(sum(delivered.filter((i) => i.estimate !== null).map((i) => i.estimate!))),
      completedWork: round(sum(delivered.map((i) => i.completedWork ?? 0))),
      onTimeRate: k.onTimeRate,
      cycleP50: k.cycleP50,
      capacity,
      utilization: capacity ? k.hoursDelivered / capacity : null,
      byCat,
    };
  });
}

/** Horas entregadas por persona y día o semana (heatmap). */
export function workloadMatrix(people: Person[], items: Item[], r: Range, unit: TimeUnit = "week") {
  const bs = buckets(r, unit);
  return {
    buckets: bs,
    rows: people.map((p) => {
      const mine = items.filter((i) => i.personKey === p.key && i.deliveredAt !== null);
      return {
        person: p,
        cells: bs.map((w) => {
          const done = mine.filter((i) => i.deliveredAt! >= Math.max(w.start, r.from) && i.deliveredAt! <= Math.min(w.end, r.to));
          return { hours: round(sum(done.map((i) => i.countedHours))), items: done.length };
        }),
      };
    }),
  };
}
