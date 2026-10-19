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

/** Semana laboral lunes → domingo que contiene la fecha. */
export function weekRange(iso: string) {
  const dow = toUTC(iso).getUTCDay(); // 0 = domingo
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

export function formatHours(hours: number) {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/0$/, "")} h`;
}
