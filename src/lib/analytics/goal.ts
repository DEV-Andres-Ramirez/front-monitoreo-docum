// Meta de cierre por tags (348: Video / Informe). TypeScript puro, se calcula en el cliente.
// Cuenta TODAS las tareas de las épicas con esos tags (sin filtrar por persona ni planeación).
import type { ProjectGoal } from "@/lib/config";
import { addDaysISO, isBusinessDay } from "@/lib/dates";

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

/** Ritmo actual = promedio de los últimos N días hábiles cerrados (sin contar hoy). */
const PACE_DAYS = 5;

export type GoalDay = {
  date: string;
  business: boolean;
  /** Tareas entregadas ese día por tag */
  done: Record<string, number>;
};

export type TagProgress = {
  tag: string;
  /** Posición del tag en la configuración (define su color) */
  index: number;
  daily: number;
  total: number;
  done: number;
  pct: number;
  today: number;
  /** Meta acumulada a hoy: diaria × días hábiles desde el inicio (tope en el total) */
  expectedToDate: number;
  gap: number;
  remaining: number;
  /** Pendientes ÷ días hábiles restantes (incluye hoy); null si ya no quedan días */
  requiredPace: number | null;
  currentPace: number;
  /** Fecha estimada de cierre al ritmo actual (null si el ritmo es 0) */
  projectedEnd: string | null;
  /** Días hábiles cerrados desde el inicio en que se cumplió la meta diaria */
  daysMet: number;
  daysElapsed: number;
  /** Serie acumulada de inicio a cierre: real (null en el futuro) y meta */
  cumulative: { date: string; actual: number | null; goal: number }[];
};

export type GoalProgress = {
  goal: ProjectGoal;
  today: string;
  businessDaysLeft: number;
  businessDaysTotal: number;
  days: GoalDay[];
  tags: TagProgress[];
  total: { total: number; done: number; pct: number; today: number; expectedToDate: number; gap: number; remaining: number; requiredPace: number | null };
};

function eachDate(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

/** Fecha en que se completan `remaining` tareas a `pace` por día hábil, empezando hoy. */
function projectEnd(today: string, remaining: number, pace: number) {
  if (remaining <= 0) return today;
  if (pace <= 0) return null;
  let left = remaining;
  let d = today;
  for (let guard = 0; guard < 3660; guard++, d = addDaysISO(d, 1)) {
    if (!isBusinessDay(d)) continue;
    left -= pace;
    if (left <= 0) return d;
  }
  return null;
}

/**
 * Avance frente a la meta. `tagFilter` limita a un tag (el filtro global); null = todos.
 * `today` es la fecha de hoy en Bogotá (ISO).
 */
export function goalProgress(goal: ProjectGoal, tasks: GoalTask[], today: string, tagFilter: string | null): GoalProgress {
  const days = eachDate(goal.start, goal.deadline).map<GoalDay>((date) => ({ date, business: isBusinessDay(date), done: {} }));
  const dayIndex = new Map(days.map((d, i) => [d.date, i]));
  const businessDaysTotal = days.filter((d) => d.business).length;
  const businessDaysLeft = days.filter((d) => d.business && d.date >= today).length;

  // Días hábiles cerrados (antes de hoy) para el ritmo actual, sin importar si son previos al inicio
  const paceDates: string[] = [];
  for (let d = addDaysISO(today, -1); paceDates.length < PACE_DAYS; d = addDaysISO(d, -1)) if (isBusinessDay(d)) paceDates.push(d);

  const selected = goal.tags
    .map((t, index) => ({ ...t, index }))
    .filter((t) => !tagFilter || t.tag.toLowerCase() === tagFilter.toLowerCase());

  const tags = selected.map<TagProgress>(({ tag, daily, index }) => {
    const mine = tasks.filter((t) => t.tag === tag);
    const doneDates = mine.map((t) => t.done).filter((d): d is string => d !== null);
    const countOn = (date: string) => doneDates.filter((d) => d === date).length;
    for (const d of doneDates) {
      const i = dayIndex.get(d);
      if (i !== undefined) days[i].done[tag] = (days[i].done[tag] ?? 0) + 1;
    }

    const total = mine.length;
    const done = doneDates.filter((d) => d <= today).length;
    const remaining = total - done;
    let businessSoFar = 0;
    const cumulative = days.map((d) => {
      if (d.business) businessSoFar += 1;
      return {
        date: d.date,
        actual: d.date <= today ? doneDates.filter((x) => x <= d.date).length : null,
        goal: Math.min(total, daily * businessSoFar),
      };
    });
    const expectedToDate = today < goal.start ? 0 : today > goal.deadline ? total : (cumulative.find((c) => c.date === today)?.goal ?? 0);
    const closedDays = days.filter((d) => d.business && d.date < today);
    const currentPace = paceDates.reduce((s, d) => s + countOn(d), 0) / PACE_DAYS;

    return {
      tag,
      index,
      daily,
      total,
      done,
      pct: total ? done / total : 0,
      today: countOn(today),
      expectedToDate,
      gap: done - expectedToDate,
      remaining,
      requiredPace: businessDaysLeft > 0 ? remaining / businessDaysLeft : null,
      currentPace,
      projectedEnd: projectEnd(today, remaining, currentPace),
      daysMet: closedDays.filter((d) => (d.done[tag] ?? 0) >= daily).length,
      daysElapsed: closedDays.length,
      cumulative,
    };
  });

  const sum = (pick: (t: TagProgress) => number) => tags.reduce((s, t) => s + pick(t), 0);
  const total = sum((t) => t.total);
  const done = sum((t) => t.done);
  const remaining = total - done;
  return {
    goal,
    today,
    businessDaysLeft,
    businessDaysTotal,
    days,
    tags,
    total: {
      total,
      done,
      pct: total ? done / total : 0,
      today: sum((t) => t.today),
      expectedToDate: sum((t) => t.expectedToDate),
      gap: done - sum((t) => t.expectedToDate),
      remaining,
      requiredPace: businessDaysLeft > 0 ? remaining / businessDaysLeft : null,
    },
  };
}
