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

/** Lunes a viernes. (Festivos de Colombia: pendiente en el roadmap.) */
export function isBusinessDay(iso: string) {
  const dow = dayOfWeek(iso);
  return dow !== 0 && dow !== 6;
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
