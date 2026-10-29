// Meta de cierre por tags (348: Video / Informe). TypeScript puro, se calcula en el cliente.
// Cuenta TODAS las tareas de las épicas con esos tags (sin filtrar por persona ni por Global).
// Solo días hábiles: lo entregado en fin de semana o festivo cuenta en el siguiente día hábil.
// Snapshots: `asOf` permite ver el panel como quedó al cierre de cualquier día hábil desde el inicio.
import type { ProjectGoal } from "@/lib/config";
import { addDaysISO, businessDayOnOrAfter, businessDaysBetween, isBusinessDay, previousBusinessDay } from "@/lib/dates";

/** Tarea de la meta: `done` = fecha de entrega (ISO, Bogotá) si está Entregada o Cerrada. */
export type GoalTask = { id: number; tag: string; done: string | null };
export type GoalResponse = { projectKey: string; goal: ProjectGoal | null; tasks: GoalTask[]; generatedAt: string };

/** Colores de los tags en orden fijo (violeta, magenta), validados con dataviz en claro (#fff) y oscuro (#0d1526). */
const TAG_COLORS = [
  { light: "#6250d6", dark: "#9085e9" },
  { light: "#e87ba4", dark: "#d55181" },
];
export const tagColor = (index: number, dark: boolean) => {
  const c = TAG_COLORS[index % TAG_COLORS.length];
  return dark ? c.dark : c.light;
};

/** Día hábil de la meta con lo completado ese día por tag. */
export type GoalDay = { date: string; done: Record<string, number> };

export type TagProgress = {
  tag: string;
  /** Posición del tag en la configuración (define su color) */
  index: number;
  daily: number;
  total: number;
  /** Completadas hasta el corte (en vivo, incluye lo de hoy) */
  done: number;
  pct: number;
  /** Completadas el día de corte (hoy en vivo, o el día del snapshot) */
  dayDone: number;
  /** Completadas hasta el último día cerrado (base de "frente a lo esperado") */
  doneClosed: number;
  /** Lo esperado al último día cerrado: diaria × días hábiles cerrados desde el inicio (tope en el total) */
  expected: number;
  /** doneClosed − expected (> 0 = adelanto) */
  gap: number;
  remaining: number;
  /** Promedio de completadas por día hábil cerrado desde el inicio (null si aún no hay días cerrados) */
  currentPace: number | null;
  /** Días hábiles cerrados en que se cumplió la meta diaria */
  daysMet: number;
  /** Serie acumulada por día hábil de inicio a cierre: real (hasta el último día cerrado; null después) y esperada */
  cumulative: { date: string; actual: number | null; goal: number }[];
};

export type GoalTotal = Omit<TagProgress, "tag" | "index" | "cumulative" | "daysMet">;

export type GoalProgress = {
  goal: ProjectGoal;
  /** Día de corte: hoy (en vivo) o el día hábil del snapshot */
  asOf: string;
  /** En vivo (hoy, aún en curso) o snapshot de un día ya cerrado */
  live: boolean;
  /** Último día hábil cerrado incluido en ritmo y "frente a lo esperado" (null si aún no hay) */
  closedThrough: string | null;
  /** Días hábiles cerrados desde el inicio hasta `closedThrough` */
  closedDays: number;
  /** Días hábiles que quedan hasta el cierre (en vivo incluye hoy) */
  businessDaysLeft: number;
  businessDaysTotal: number;
  /** Días hábiles de la meta (inicio → cierre) con lo completado cada día */
  days: GoalDay[];
  tags: TagProgress[];
  total: GoalTotal;
};

/** Día en que cuenta una entrega: lo previo al inicio se queda (avance anterior); lo no hábil pasa al siguiente hábil. */
const effectiveDay = (d: string, start: string) => (d < start ? d : businessDayOnOrAfter(d));

/** Días hábiles ya cerrados (desde el inicio) que se pueden ver como snapshot, del más reciente al más antiguo. */
export function snapshotDays(goal: ProjectGoal, today: string) {
  const last = [previousBusinessDay(today), goal.deadline].sort()[0];
  return last < goal.start ? [] : businessDaysBetween(goal.start, last).reverse();
}

/**
 * Avance frente a la meta al corte `asOf`. En vivo (`asOf` = hoy) el día de hoy sigue abierto: ritmo y
 * "frente a lo esperado" usan los días cerrados (hasta el hábil anterior) y "hoy" se muestra aparte.
 * En un snapshot, el día elegido ya está cerrado e incluido. `tagFilter` limita a un tag; null = todos.
 */
export function goalProgress(goal: ProjectGoal, tasks: GoalTask[], opts: { asOf: string; live: boolean; tag: string | null }): GoalProgress {
  const { asOf, live } = opts;
  const dates = businessDaysBetween(goal.start, goal.deadline);
  const days = dates.map<GoalDay>((date) => ({ date, done: {} }));
  const dayIndex = new Map(dates.map((d, i) => [d, i]));
  // Último día cerrado: en vivo, el hábil anterior a hoy; en snapshot, el día elegido (sin pasar del cierre)
  const lastClosed = [live ? previousBusinessDay(asOf) : asOf, goal.deadline].sort()[0];
  const closedThrough = lastClosed >= goal.start ? lastClosed : null;
  const closedDates = closedThrough ? businessDaysBetween(goal.start, closedThrough) : [];
  const leftFrom = live ? asOf : addDaysISO(asOf, 1);
  const businessDaysLeft = leftFrom > goal.deadline ? 0 : businessDaysBetween(leftFrom, goal.deadline).length;

  const selected = goal.tags.map((t, index) => ({ ...t, index })).filter((t) => !opts.tag || t.tag.toLowerCase() === opts.tag.toLowerCase());

  const tags = selected.map<TagProgress>(({ tag, daily, index }) => {
    const mine = tasks.filter((t) => t.tag === tag);
    const doneDates = mine.map((t) => (t.done ? effectiveDay(t.done, goal.start) : null)).filter((d): d is string => d !== null);
    for (const d of doneDates) {
      const i = dayIndex.get(d);
      if (i !== undefined) days[i].done[tag] = (days[i].done[tag] ?? 0) + 1;
    }
    const upTo = (date: string) => doneDates.filter((d) => d <= date).length;
    // La serie acumulada llega al último día cerrado: igual que "frente a lo esperado" (hoy sigue abierto)
    const lineEnd = live ? closedThrough : asOf;
    const total = mine.length;
    const done = upTo(asOf);
    const doneClosed = closedThrough ? upTo(closedThrough) : doneDates.filter((d) => d < goal.start).length;
    const expected = Math.min(total, daily * closedDates.length);
    const sinceStart = closedThrough ? doneDates.filter((d) => d >= goal.start && d <= closedThrough).length : 0;
    const currentPace = closedDates.length ? sinceStart / closedDates.length : null;
    const remaining = total - done;
    return {
      tag,
      index,
      daily,
      total,
      done,
      pct: total ? done / total : 0,
      dayDone: isBusinessDay(asOf) ? doneDates.filter((d) => d === asOf).length : 0,
      doneClosed,
      expected,
      gap: doneClosed - expected,
      remaining,
      currentPace,
      daysMet: closedDates.filter((d) => (days[dayIndex.get(d)!]?.done[tag] ?? 0) >= daily).length,
      cumulative: dates.map((date, i) => ({ date, actual: lineEnd && date <= lineEnd ? upTo(date) : null, goal: Math.min(total, daily * (i + 1)) })),
    };
  });

  const sum = (pick: (t: TagProgress) => number) => tags.reduce((s, t) => s + pick(t), 0);
  const total = sum((t) => t.total);
  const done = sum((t) => t.done);
  const doneClosed = sum((t) => t.doneClosed);
  const expected = sum((t) => t.expected);
  const currentPace = tags.some((t) => t.currentPace !== null) ? sum((t) => t.currentPace ?? 0) : null;
  return {
    goal,
    asOf,
    live,
    closedThrough,
    closedDays: closedDates.length,
    businessDaysLeft,
    businessDaysTotal: dates.length,
    days,
    tags,
    total: {
      daily: sum((t) => t.daily),
      total,
      done,
      pct: total ? done / total : 0,
      dayDone: sum((t) => t.dayDone),
      doneClosed,
      expected,
      gap: doneClosed - expected,
      remaining: total - done,
      currentPace,
    },
  };
}
