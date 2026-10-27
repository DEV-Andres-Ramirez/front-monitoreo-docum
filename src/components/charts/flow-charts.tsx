"use client";

import "./setup";
import type { ChartData, ChartOptions } from "chart.js";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { CATEGORIES, CATEGORY_LABEL, type PersonRow, type Range, type TimeUnit } from "@/lib/analytics/metrics";
import { isNoGlobal, type Person } from "@/lib/analytics/model";
import { categoryColor } from "@/lib/analytics/state-colors";
import type { StateCategory } from "@/lib/analytics/types";
import { axes, baseOptions, tooltipStyle, verticalGradient, withAlpha, type ChartTheme } from "./chart-theme";

const fmtDay = (t: number) => format(t, "d MMM", { locale: es });
const fmtHours = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString("es-CO")} h`;

/** Etiqueta de una cubeta de tiempo: "lun 19 oct" (día hábil) o "Sem. 19 oct" (semana). */
export const bucketLabel = (t: number, unit: TimeUnit) => (unit === "day" ? format(t, "EEE d MMM", { locale: es }) : `Sem. ${fmtDay(t)}`);

// ------------------------------------------------------------------ Throughput (por día o por semana)
export function ThroughputChart({
  buckets,
  unit,
  metric,
  highlight,
  noun = "ítems",
  theme,
}: {
  buckets: { start: number; items: number; hours: number }[];
  unit: TimeUnit;
  metric: "items" | "hours";
  /** Qué se entrega ("tareas", "HU"…), para el texto de la gráfica */
  noun?: string;
  /** Periodo seleccionado: las barras fuera de él (contexto de 7 días) se atenúan */
  highlight?: Range;
  theme: ChartTheme;
}) {
  const data = useMemo<ChartData<"bar", number[], string>>(
    () => ({
      labels: buckets.map((b) => bucketLabel(b.start, unit)),
      datasets: [
        {
          label: metric === "items" ? `${noun.charAt(0).toUpperCase()}${noun.slice(1)} entregadas` : "Horas estimadas entregadas",
          data: buckets.map((b) => (metric === "items" ? b.items : b.hours)),
          // Atenuadas: fuera del periodo seleccionado (contexto de 7 días hábiles)
          backgroundColor: buckets.map((b) => withAlpha(theme.accent, highlight && (b.start < highlight.from || b.start > highlight.to) ? 0.35 : 0.8)),
          hoverBackgroundColor: theme.accent,
          borderRadius: { topLeft: theme.px(4), topRight: theme.px(4) },
          borderSkipped: "start",
          maxBarThickness: theme.px(36),
        },
      ],
    }),
    [buckets, unit, metric, highlight, theme, noun],
  );
  const options = useMemo<ChartOptions<"bar">>(() => {
    const base = baseOptions<"bar">(theme);
    return {
      ...base,
      scales: axes(theme, { suffix: metric === "hours" ? " h" : "" }),
      plugins: {
        ...base.plugins,
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            label: (i) => ` ${i.dataset.label}: ${metric === "hours" ? fmtHours(Number(i.raw)) : i.raw}`,
            footer: (items) => {
              const b = buckets[items[0].dataIndex];
              return metric === "items" ? `${fmtHours(b.hours)} estimadas` : `${b.items} ${noun} entregadas`;
            },
          },
        },
      },
    };
  }, [theme, metric, buckets, noun]);
  return <Bar data={data} options={options} />;
}

// ------------------------------------------------------------------ Flujo acumulado (CFD)
export function CumulativeFlowChart({
  series,
  labels = CATEGORY_LABEL,
  theme,
}: {
  series: ({ t: number } & Record<StateCategory, number>)[];
  /** Nombre de cada etapa (p. ej. las de HU: En desarrollo, En QA…) */
  labels?: Record<StateCategory, string>;
  theme: ChartTheme;
}) {
  // De abajo hacia arriba: Cerrado → Entregado → En curso → Por iniciar
  const order: StateCategory[] = ["Completed", "Resolved", "InProgress", "Proposed"];
  const data = useMemo<ChartData<"line", number[], string>>(
    () => ({
      labels: series.map((p) => format(p.t, "EEE d MMM", { locale: es })),
      datasets: order.map((cat, idx) => ({
        label: labels[cat],
        data: series.map((p) => p[cat]),
        borderColor: categoryColor(cat, theme.dark),
        backgroundColor: withAlpha(categoryColor(cat, theme.dark), theme.dark ? 0.55 : 0.45),
        fill: idx === 0 ? "origin" : "-1",
        borderWidth: theme.px(1.5),
        pointRadius: 0,
        pointHoverRadius: theme.px(4),
        tension: 0.25,
      })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, theme, labels],
  );
  const options = useMemo<ChartOptions<"line">>(() => {
    const base = baseOptions<"line">(theme);
    const a = axes(theme);
    return {
      ...base,
      scales: { x: { ...a.x, ticks: { ...a.x.ticks, maxTicksLimit: 10, autoSkip: true } }, y: { ...a.y, stacked: true } },
      plugins: {
        ...base.plugins,
        tooltip: {
          ...base.plugins?.tooltip,
          itemSort: (x, y) => y.datasetIndex - x.datasetIndex,
          callbacks: { title: (items) => `Al cierre del ${format(series[items[0].dataIndex].t, "EEEE d 'de' MMMM", { locale: es })}`, label: (i) => ` ${i.dataset.label}: ${i.raw}` },
        },
      },
    };
  }, [theme, series]);
  return <Line data={data} options={options} />;
}

// ------------------------------------------------------------------ Dona por categoría
export function StateDonut({
  counts,
  labels = CATEGORY_LABEL,
  noun = "ítems",
  theme,
}: {
  counts: Record<StateCategory, number>;
  labels?: Record<StateCategory, string>;
  /** Qué se cuenta ("tareas", "HU"…), para el centro y el tooltip */
  noun?: string;
  theme: ChartTheme;
}) {
  const cats = CATEGORIES.filter((c) => counts[c] > 0);
  const total = cats.reduce((s, c) => s + counts[c], 0);
  const data = useMemo<ChartData<"doughnut", number[], string>>(
    () => ({
      labels: cats.map((c) => labels[c]),
      datasets: [
        {
          data: cats.map((c) => counts[c]),
          backgroundColor: cats.map((c) => categoryColor(c, theme.dark)),
          hoverBackgroundColor: cats.map((c) => categoryColor(c, theme.dark)),
          borderColor: theme.surface,
          hoverBorderColor: theme.surface,
          borderWidth: theme.px(2),
          borderRadius: theme.px(4),
          spacing: theme.px(1),
          hoverOffset: theme.px(6),
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [counts, theme, labels],
  );
  const options = useMemo<ChartOptions<"doughnut">>(
    () => ({
      cutout: "72%",
      layout: { padding: theme.px(6) },
      plugins: {
        crosshair: { enabled: false },
        tooltip: { ...(tooltipStyle(theme) as object), callbacks: { label: (i) => ` ${i.raw} ${noun} · ${Math.round((Number(i.raw) / total) * 100)} %` } },
      },
    }),
    [theme, total, noun],
  );
  return (
    <div className="relative h-full">
      <Doughnut data={data} options={options} />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="font-display text-2xl font-semibold tabular-nums text-foreground">{total.toLocaleString("es-CO")}</p>
          <p className="text-[0.6875rem] uppercase tracking-wider text-muted">{noun} en el periodo</p>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Estados por persona (barras apiladas)
const short = (name: string) => {
  const p = name.split(/\s+/);
  return p.length >= 3 ? `${p[0]} ${p[p.length - 2]}` : name;
};
/** Etiqueta del eje: nombre corto, marcado si no tiene asignación en Global para el proyecto */
const personLabel = (p: Person) => (isNoGlobal(p) ? `${short(p.name)} (sin asignación)` : short(p.name));

export function PersonStatesChart({ rows, theme, onSelect }: { rows: PersonRow[]; theme: ChartTheme; onSelect?: (key: string) => void }) {
  const data = useMemo<ChartData<"bar", number[], string>>(
    () => ({
      labels: rows.map((r) => personLabel(r.person)),
      datasets: CATEGORIES.map((cat) => ({
        label: CATEGORY_LABEL[cat],
        data: rows.map((r) => r.byCat[cat]),
        backgroundColor: categoryColor(cat, theme.dark),
        hoverBackgroundColor: categoryColor(cat, theme.dark),
        borderColor: theme.surface,
        borderWidth: { right: theme.px(2) } as never,
        borderSkipped: false,
        barThickness: theme.px(16),
      })),
    }),
    [rows, theme],
  );
  const options = useMemo<ChartOptions<"bar">>(() => {
    const base = baseOptions<"bar">(theme);
    const a = axes(theme, { horizontal: true });
    return {
      ...base,
      indexAxis: "y",
      interaction: { mode: "index", axis: "y", intersect: false },
      scales: { x: { ...a.x, stacked: true }, y: { ...a.y, stacked: true } },
      onHover: (e, el) => {
        const target = e.native?.target as HTMLElement | undefined;
        if (target) target.style.cursor = el.length && onSelect ? "pointer" : "default";
      },
      onClick: (_e, el) => {
        if (el.length && onSelect) onSelect(rows[el[0].index].person.key);
      },
      plugins: {
        ...base.plugins,
        crosshair: { enabled: false },
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            title: (items) => `${rows[items[0].dataIndex].person.name}${isNoGlobal(rows[items[0].dataIndex].person) ? " · Sin asignación al proyecto" : ""}`,
            label: (i) => ` ${i.dataset.label}: ${i.raw}`,
            footer: (items) => `${rows[items[0].dataIndex].active} ítems activos`,
          },
        },
      },
    };
  }, [theme, rows, onSelect]);
  return <Bar data={data} options={options} />;
}

// ------------------------------------------------------------------ Estimado vs. reportado (bullet)
export function EstimateChart({ rows, theme }: { rows: PersonRow[]; theme: ChartTheme }) {
  const data = useMemo<ChartData<"bar", number[], string>>(
    () => ({
      labels: rows.map((r) => personLabel(r.person)),
      datasets: [
        {
          label: "Trabajo completado reportado",
          data: rows.map((r) => r.completedWork),
          backgroundColor: theme.accent,
          hoverBackgroundColor: theme.accent,
          borderRadius: theme.px(4),
          borderSkipped: false,
          barThickness: theme.px(10),
          order: 0,
        },
        {
          label: "Horas estimadas",
          data: rows.map((r) => r.estimated),
          backgroundColor: theme.track,
          hoverBackgroundColor: theme.track,
          borderRadius: theme.px(4),
          borderSkipped: false,
          barThickness: theme.px(18),
          order: 1,
        },
      ],
    }),
    [rows, theme],
  );
  const options = useMemo<ChartOptions<"bar">>(() => {
    const base = baseOptions<"bar">(theme);
    return {
      ...base,
      indexAxis: "y",
      datasets: { bar: { grouped: false } },
      interaction: { mode: "index", axis: "y", intersect: false },
      scales: axes(theme, { horizontal: true, suffix: " h" }),
      plugins: {
        ...base.plugins,
        crosshair: { enabled: false },
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            title: (items) => `${rows[items[0].dataIndex].person.name}${isNoGlobal(rows[items[0].dataIndex].person) ? " · Sin asignación al proyecto" : ""}`,
            label: (i) => ` ${i.dataset.label}: ${fmtHours(Number(i.raw))}`,
            footer: (items) => {
              const r = rows[items[0].dataIndex];
              return r.estimated ? `Desviación: ${Math.round(((r.completedWork - r.estimated) / r.estimated) * 100)} %` : "";
            },
          },
        },
      },
    };
  }, [theme, rows]);
  return <Bar data={data} options={options} />;
}

// ------------------------------------------------------------------ Sparkline
export function Sparkline({ values, color, theme }: { values: number[]; color: string; theme: ChartTheme }) {
  const data = useMemo<ChartData<"line", number[], string>>(
    () => ({
      labels: values.map((_, i) => String(i)),
      datasets: [{ data: values, borderColor: color, backgroundColor: verticalGradient(color, theme.dark ? 0.35 : 0.25), fill: "origin", borderWidth: theme.px(2), tension: 0.4, pointRadius: 0 }],
    }),
    [values, color, theme],
  );
  const options = useMemo<ChartOptions<"line">>(
    () => ({
      animation: { duration: 900 },
      events: [],
      plugins: { tooltip: { enabled: false }, crosshair: { enabled: false } },
      scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
      layout: { padding: 2 },
    }),
    [],
  );
  return <Line data={data} options={options} aria-hidden />;
}
