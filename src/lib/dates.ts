// Fechas de negocio en formato ISO (YYYY-MM-DD) y zona America/Bogota.
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { TIMEZONE } from "./config";

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}

function toUTC(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDaysISO(iso: string, days: number) {
  const date = toUTC(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Días entre dos fechas ISO (to - from). */
export function diffDays(from: string, to: string) {
  return Math.round((toUTC(to).getTime() - toUTC(from).getTime()) / 86_400_000);
}

/** Lista de fechas ISO desde `from` hasta `to`, ambas incluidas. */
export function eachDay(from: string, to: string) {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) days.push(d);
  return days;
}

/** 0 = domingo … 6 = sábado */
export function dayOfWeek(iso: string) {
  return toUTC(iso).getUTCDay();
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Fecha ISO local (del navegador o del servidor) de una marca de tiempo. */
export const isoLocalDate = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** Domingo de Pascua (algoritmo gregoriano anónimo). */
function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Ley Emiliani: el festivo se corre al lunes siguiente (si ya es lunes, se queda). */
const nextMonday = (iso: string) => addDaysISO(iso, (8 - dayOfWeek(iso)) % 7);

const holidayCache = new Map<number, Set<string>>();

/** Festivos de Colombia de un año (fijos, trasladables por Ley Emiliani y los que dependen de la Pascua). */
export function colombianHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const y = (md: string) => `${year}-${md}`;
  const easter = easterSunday(year);
  const days = [
    // Fijos
    ...["01-01", "05-01", "07-20", "08-07", "12-08", "12-25"].map(y),
    // Trasladables al lunes: Reyes, San José, San Pedro y San Pablo, Asunción, Día de la Raza, Todos los Santos, Independencia de Cartagena
    ...["01-06", "03-19", "06-29", "08-15", "10-12", "11-01", "11-11"].map((md) => nextMonday(y(md))),
    // Semana Santa
    addDaysISO(easter, -3),
    addDaysISO(easter, -2),
    // Ascensión, Corpus Christi y Sagrado Corazón (trasladados al lunes)
    nextMonday(addDaysISO(easter, 39)),
    nextMonday(addDaysISO(easter, 60)),
    nextMonday(addDaysISO(easter, 68)),
  ];
  const set = new Set(days);
  holidayCache.set(year, set);
  return set;
}

/** Lunes a viernes que no son festivo en Colombia. */
export function isBusinessDay(iso: string) {
  const dow = dayOfWeek(iso);
  return dow !== 0 && dow !== 6 && !colombianHolidays(Number(iso.slice(0, 4))).has(iso);
}

/** La misma fecha si es hábil; si no, el siguiente día hábil (lo hecho en fin de semana o festivo cuenta ahí). */
export function businessDayOnOrAfter(iso: string) {
  let d = iso;
  for (let guard = 0; guard < 31 && !isBusinessDay(d); guard++) d = addDaysISO(d, 1);
  return d;
}

/** Día hábil anterior a la fecha (sin incluirla). */
export function previousBusinessDay(iso: string) {
  let d = addDaysISO(iso, -1);
  for (let guard = 0; guard < 31 && !isBusinessDay(d); guard++) d = addDaysISO(d, -1);
  return d;
}

/** Días hábiles entre dos fechas ISO, ambas incluidas. */
export function businessDaysBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) if (isBusinessDay(d)) out.push(d);
  return out;
}

/** Semana laboral lunes → domingo que contiene la fecha. */
export function weekRange(iso: string) {
  const dow = dayOfWeek(iso);
  const start = addDaysISO(iso, dow === 0 ? -6 : 1 - dow);
  return { start, end: addDaysISO(start, 6) };
}

export function formatLong(iso: string) {
  return format(parseISO(iso), "EEEE d 'de' MMMM", { locale: es });
}

export function formatShort(iso: string) {
  return format(parseISO(iso), "d MMM yyyy", { locale: es });
}

export function formatDayMonth(iso: string) {
  return format(parseISO(iso), "EEE d MMM", { locale: es });
}

export function formatAxisDay(iso: string) {
  return format(parseISO(iso), "EEE d", { locale: es });
}

export function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("es-CO", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

/** Fecha ISO (Bogotá) de un timestamp. */
export function isoOfTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(timestamp));
}

export function capitalizeFirst(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatHours(hours: number) {
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded.toLocaleString("es-CO", { maximumFractionDigits: 2 })} h`;
}

export function formatPercent(ratio: number) {
  return `${Math.round(ratio * 100).toLocaleString("es-CO")} %`;
}
