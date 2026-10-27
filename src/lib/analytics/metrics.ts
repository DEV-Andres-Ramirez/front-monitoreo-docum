// Métricas de flujo y desempeño sobre el modelo filtrado (TypeScript puro, cliente).
import type { WorkView } from "@/lib/config";
import { addDaysISO, businessDaysBetween, isBusinessDay, isoLocalDate } from "@/lib/dates";
import { businessDaysElapsed, personHealth, type Health } from "./health";
import type { PeriodPreset } from "./period";
import type { StateCategory } from "./types";
import { DAY, capacityHours, categoryAt, endOfDay, type Item, type Model, type Person } from "./model";

/**
 * `epics`: épicas monitoreadas seleccionadas (vacío = todas). `tag`: tag de Azure (null = todos).
 * `view`/`types`: mundo de análisis (Tareas, HU o Bugs) y los tipos de ítem que cuentan.
 */
export type Filters = {
  from: string;
  to: string;
  people: string[];
  includeOthers: boolean;
  epics: number[];
  tag: string | null;
  view: WorkView["key"];
  types: string[];
};
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
 * "Desde el 19 oct" → ninguno (rango vacío: antes del inicio no hay con qué comparar) ·
 * personalizado → periodo de igual duración inmediatamente antes.
 */
export function previousRange(r: Range, preset?: PeriodPreset): Range {
  if (preset === "sinceStart") return { from: r.from, to: r.from - 1 };
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

/** Ventana de las gráficas de tendencia: el periodo, o los últimos 7 días hábiles si es más corto (p. ej. "Hoy"). */
export function trendRange(r: Range): Range {
  const to = isoLocalDate(r.to);
  if (businessDaysBetween(isoLocalDate(r.from), to).length >= MIN_TREND_DAYS) return r;
  let d = to;
  let count = isBusinessDay(d) ? 1 : 0;
  for (let guard = 0; count < MIN_TREND_DAYS && guard < 60; guard++) {
    d = addDaysISO(d, -1);
    if (isBusinessDay(d)) count += 1;
  }
  return { from: Math.min(r.from, startOfDay(d)), to: r.to };
}

/** Personas visibles según el filtro (personal del proyecto ± fuera de Global). */
export function visiblePeople(model: Model, f: Filters): Person[] {
  return [...model.people.values()]
    .filter((p) => p.inRoster || f.includeOthers)
    .sort((a, b) => Number(b.inRoster) - Number(a.inRoster) || a.name.localeCompare(b.name, "es"));
}

/** ¿El ítem cuelga de las épicas monitoreadas (y de la épica seleccionada, si hay filtro)? */
export const inEpics = (i: Item, epics: number[]) => i.inMonitoredEpics && (!epics.length || (i.epicId !== null && epics.includes(i.epicId)));

/** ¿El ítem tiene el tag? (sin distinguir mayúsculas; null = sin filtro) */
export const inTag = (i: Item, tag: string | null) => !tag || i.tagList.some((t) => t.toLowerCase() === tag.toLowerCase());

/** ¿El ítem es de un tipo del mundo elegido? (vacío = todos) */
export const inTypes = (i: Item, types: string[]) => !types.length || types.includes(i.type);

/** Ítems de trabajo dentro del alcance: épicas monitoreadas + mundo (tipos) + tag + personas seleccionadas. */
export function scopedWork(model: Model, f: Filters): Item[] {
  const selected = new Set(f.people);
  return model.work.filter((i) => {
    const p = model.people.get(i.personKey!);
    if (!p || (!p.inRoster && !f.includeOthers)) return false;
    if (selected.size && !selected.has(p.key)) return false;
    return inTypes(i, f.types) && inEpics(i, f.epics) && inTag(i, f.tag);
  });
}

/** Vivo en el periodo: creado antes de su fin (o entregado dentro de él aunque se registrara después) y no cerrado antes de su inicio. */
export const isAlive = (i: Item, r: Range) =>
  i.cat !== "Removed" && (i.createdAt <= r.to || deliveredIn(i, r)) && (i.completedAt === null || i.completedAt >= r.from);
export const deliveredIn = (i: Item, r: Range) => i.deliveredAt !== null && i.deliveredAt >= r.from && i.deliveredAt <= r.to;
/** Atrasado y genera alerta: sin entregar con objetivo pasado, salvo que la persona tenga una marca (vacaciones u otro proyecto). */
export const alertable = (i: Item) => i.overdue && !i.excused;

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
  /** Atrasados que generan alerta (excluye a personas con marca) */
  overdue: number;
  onTimeRate: number | null;
  onTimeBase: number;
  completedWork: number;
};

export function kpis(items: Item[], r: Range, now: number): KpiSet {
  const alive = items.filter((i) => isAlive(i, r));
  const delivered = items.filter((i) => deliveredIn(i, r));
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
    overdue: alive.filter(alertable).length,
    onTimeRate: withTarget.length ? withTarget.filter((i) => i.onTime).length / withTarget.length : null,
    onTimeBase: withTarget.length,
    completedWork: round(sum(delivered.map((i) => i.completedWork ?? 0))),
  };
}

// ------------------------------------------------------------------ Series temporales (solo días hábiles)
/**
 * Cubeta de tiempo. `start` = inicio del día (o de la semana) que la nombra; `from`/`end` = lo que cuenta.
 * En las cubetas por día, lo hecho en fin de semana o festivo cae en el siguiente día hábil (o en el último
 * del periodo, si el periodo termina en un día no hábil): así no aparecen días no laborables.
 */
export type Bucket = { start: number; from: number; end: number };

/** Días hábiles del periodo; cada uno cuenta desde el día siguiente al hábil anterior hasta su fin. */
export function dayBuckets(r: Range): Bucket[] {
  const days = businessDaysBetween(isoLocalDate(r.from), isoLocalDate(r.to));
  return days.map((iso, i) => {
    const start = startOfDay(iso);
    return {
      start,
      from: i === 0 ? r.from : endOfDay(startOfDay(days[i - 1])) + 1,
      end: i === days.length - 1 ? r.to : endOfDay(start),
    };
  });
}

/** Semanas lunes → domingo que tocan el periodo. */
export function weeks(r: Range): Bucket[] {
  const out: Bucket[] = [];
  const d = new Date(r.from);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lunes
  d.setHours(0, 0, 0, 0);
  for (let t = d.getTime(); t <= r.to; t += 7 * DAY) out.push({ start: t, from: t, end: t + 7 * DAY - 1 });
  return out;
}

export type TimeUnit = "day" | "week";

/** Cubetas del periodo por día hábil o por semana (los extremos se recortan al contar). */
export const buckets = (r: Range, unit: TimeUnit) => (unit === "day" ? dayBuckets(r) : weeks(r));

/** Cierres de los días hábiles del periodo (para series acumuladas como el flujo de estados). */
export function businessCloses(r: Range) {
  return dayBuckets(r).map((b) => Math.min(endOfDay(b.start), r.to));
}

/** Ítems y horas entregadas por día hábil o por semana. */
export function throughput(items: Item[], r: Range, unit: TimeUnit) {
  const delivered = items.filter((i) => deliveredIn(i, r));
  return buckets(r, unit).map((b) => {
    const done = delivered.filter((i) => i.deliveredAt! >= Math.max(b.from, r.from) && i.deliveredAt! <= Math.min(b.end, r.to));
    return { start: b.start, items: done.length, hours: round(sum(done.map((i) => i.countedHours))) };
  });
}

/** Ítems por categoría de estado al cierre de cada día hábil. */
export function cumulativeFlow(items: Item[], r: Range) {
  const relevant = items.filter((i) => isAlive(i, r));
  return businessCloses(r).map((t) => {
    const counts: Record<StateCategory, number> = { Proposed: 0, InProgress: 0, Resolved: 0, Completed: 0, Removed: 0 };
    for (const i of relevant) {
      const cat = categoryAt(i, t);
      if (cat) counts[cat] += 1;
    }
    return { t, ...counts };
  });
}

/** Días hábiles completos transcurridos desde `since` hasta `now` (sin contar el día de inicio). */
export function businessAge(since: number, now: number) {
  const from = addDaysISO(isoLocalDate(since), 1);
  const to = isoLocalDate(now);
  return from > to ? 0 : businessDaysBetween(from, to).length;
}

/** Trabajo en curso con los días hábiles que lleva en su estado actual. */
export function agingWip(items: Item[], now: number) {
  return items
    .filter((i) => i.cat === "InProgress" || i.cat === "Resolved")
    .map((i) => {
      const seg = [...i.segments].reverse().find((s) => s.cat === i.cat);
      const since = seg?.from ?? i.actualStart ?? i.createdAt;
      return { item: i, since, ageDays: businessAge(since, now) };
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
  /** Entregas con fecha objetivo (base de onTimeRate) */
  onTimeBase: number;
  /** Capacidad a la fecha: días hábiles del periodo transcurridos hasta hoy (sin días futuros) */
  capacity: number | null;
  utilization: number | null;
  byCat: Record<StateCategory, number>;
  /** Días hábiles del periodo transcurridos hasta hoy */
  elapsedDays: number;
  /** Semáforo: Va mal / En riesgo / Va bien / Sin carga / No evaluado (health.ts) */
  health: Health;
};

export function perPerson(people: Person[], items: Item[], r: Range, now = Date.now()): PersonRow[] {
  const byPerson = new Map<string, Item[]>();
  for (const i of items) byPerson.set(i.personKey!, [...(byPerson.get(i.personKey!) ?? []), i]);
  const elapsedDays = businessDaysElapsed(r, now);
  return people.map((person) => {
    const mine = byPerson.get(person.key) ?? [];
    const k = kpis(mine, r, now);
    const alive = mine.filter((i) => isAlive(i, r));
    const delivered = mine.filter((i) => deliveredIn(i, r));
    const byCat: Record<StateCategory, number> = { Proposed: 0, InProgress: 0, Resolved: 0, Completed: 0, Removed: 0 };
    for (const i of alive) byCat[i.cat] += 1;
    const capacity = capacityHours(person, r.from, Math.min(r.to, now));
    const utilization = capacity ? k.hoursDelivered / capacity : null;
    // Por iniciar al cierre del periodo (o hoy, si el periodo llega hasta hoy), igual que el WIP de kpis()
    const proposed = r.to >= now - DAY ? byCat.Proposed : alive.filter((i) => categoryAt(i, r.to) === "Proposed").length;
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
      onTimeBase: k.onTimeBase,
      capacity,
      utilization,
      byCat,
      elapsedDays,
      health: personHealth({ ...k, active: alive.length, utilization, proposed }, elapsedDays, person.flag),
    };
  });
}

/** Horas entregadas por persona y día hábil o semana (heatmap). */
export function workloadMatrix(people: Person[], items: Item[], r: Range, unit: TimeUnit = "week") {
  const bs = buckets(r, unit);
  return {
    buckets: bs,
    rows: people.map((p) => {
      const mine = items.filter((i) => i.personKey === p.key && i.deliveredAt !== null);
      return {
        person: p,
        cells: bs.map((w) => {
          const done = mine.filter((i) => i.deliveredAt! >= Math.max(w.from, r.from) && i.deliveredAt! <= Math.min(w.end, r.to));
          return { hours: round(sum(done.map((i) => i.countedHours))), items: done.length };
        }),
      };
    }),
  };
}
