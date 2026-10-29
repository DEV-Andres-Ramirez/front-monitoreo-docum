// Semáforo de colaboradores (ambos proyectos): Va mal / En riesgo / Va bien / Sin carga en el periodo,
// y "No evaluado" para quien tiene una marca (vacaciones, asignado a otro proyecto…).
// TypeScript puro; lo usa perPerson() en metrics.ts. Reglas decididas con el usuario.
import { formatDayMonth, isBusinessDay, isoLocalDate } from "@/lib/dates";
import { DAY } from "./model";
import type { MemberFlag } from "./types";

export type HealthLevel = "bad" | "risk" | "good" | "excused" | "idle";
export type Health = { level: HealthLevel; reasons: string[] };

export const HEALTH_LABEL: Record<HealthLevel, string> = {
  bad: "Va mal",
  risk: "En riesgo",
  good: "Va bien",
  excused: "No evaluado",
  idle: "Sin carga",
};
/** Orden de lectura y de los listados: primero lo que requiere acción. */
export const HEALTH_LEVELS: HealthLevel[] = ["bad", "risk", "good", "excused", "idle"];
export const HEALTH_ORDER: Record<HealthLevel, number> = { bad: 0, risk: 1, good: 2, excused: 3, idle: 4 };

/**
 * Umbrales. Con menos de `minDays` días hábiles transcurridos en el periodo (Hoy, Ayer) solo cuentan
 * atrasos y puntualidad: entregas y "nada en curso" necesitan días para ser justas.
 */
export const HEALTH_RULES = {
  minDays: 3,
  overdueBad: 3,
  onTimeBad: 0.6,
  onTimeRisk: 0.8,
  onTimeMinBase: 3,
};
// Sin criterio de capacidad: el tiempo se mide solo con el Completed Work reportado (decisión del usuario).

/** Lo que el semáforo necesita de una fila de perPerson(). */
export type HealthInput = {
  active: number;
  delivered: number;
  wip: number;
  overdue: number;
  onTimeRate: number | null;
  onTimeBase: number;
  /** Ítems activos por iniciar */
  proposed: number;
};

/** Días hábiles (lunes a viernes sin festivos) del periodo transcurridos hasta `now`, hoy incluido. */
export function businessDaysElapsed(r: { from: number; to: number }, now: number) {
  const end = Math.min(r.to, now);
  let days = 0;
  for (let t = r.from; t <= end; t += DAY) if (isBusinessDay(isoLocalDate(t))) days += 1;
  return days;
}

const pct = (r: number) => `${Math.round(r * 100)} %`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Texto de una marca: "En vacaciones (hasta el vie 30 oct)". */
export const flagText = (f: MemberFlag) => (f.until ? `${f.label} (hasta el ${formatDayMonth(f.until)})` : f.label);

export function personHealth(r: HealthInput, elapsedDays: number, flag: MemberFlag | null = null): Health {
  // Con marca no se evalúa: lo que entrega cuenta, pero no recibe alertas
  if (flag) return { level: "excused", reasons: [`${flagText(flag)}: no se evalúa en el semáforo`] };
  if (r.active === 0) return { level: "idle", reasons: ["Sin ítems en las épicas en el periodo"] };
  const R = HEALTH_RULES;
  const long = elapsedDays >= R.minDays;
  const bad: string[] = [];
  const risk: string[] = [];

  const late = plural(r.overdue, "pendiente atrasado", "pendientes atrasados");
  if (r.overdue >= R.overdueBad) bad.push(late);
  else if (r.overdue > 0) risk.push(late);

  if (long && r.delivered === 0) bad.push(`Sin entregas en ${plural(elapsedDays, "día hábil", "días hábiles")}`);

  if (r.onTimeRate !== null && r.onTimeBase >= R.onTimeMinBase) {
    const text = `Entregó a tiempo ${pct(r.onTimeRate)} (de ${r.onTimeBase})`;
    if (r.onTimeRate < R.onTimeBad) bad.push(text);
    else if (r.onTimeRate < R.onTimeRisk) risk.push(text);
  }

  if (long && r.wip === 0 && r.proposed > 0) risk.push(`Nada en curso y ${r.proposed} por iniciar`);

  if (bad.length) return { level: "bad", reasons: [...bad, ...risk] };
  if (risk.length) return { level: "risk", reasons: risk };
  const good = r.delivered > 0 ? [plural(r.delivered, "entrega", "entregas")] : ["Sin vencidos"];
  // La puntualidad solo se menciona cuando cuenta (base suficiente), para no mostrar un "0 % a tiempo" que no pesa
  if (r.onTimeRate !== null && r.onTimeBase >= R.onTimeMinBase) good.push(`${pct(r.onTimeRate)} a tiempo (de ${r.onTimeBase})`);
  return { level: "good", reasons: [good.join(" · ")] };
}
