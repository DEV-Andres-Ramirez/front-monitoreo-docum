"use client";

import "./setup";
import type { ChartData, ChartOptions } from "chart.js";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo } from "react";
import { Bar, Chart, Doughnut, Line } from "react-chartjs-2";
import { CATEGORIES, CATEGORY_LABEL, type PersonRow } from "@/lib/analytics/metrics";
import type { Item } from "@/lib/analytics/model";
import { categoryColor } from "@/lib/analytics/state-colors";
import type { StateCategory } from "@/lib/analytics/types";
import { axes, baseOptions, tooltipStyle, verticalGradient, withAlpha, type ChartTheme } from "./chart-theme";

const fmtDay = (t: number) => format(t, "d MMM", { locale: es });
const fmtHours = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString("es-CO")} h`;
const fmtDays = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString("es-CO")} d`;

// ------------------------------------------------------------------ Throughput semanal
export function ThroughputChart({
  weeks,
  metric,
  theme,
}: {
  weeks: { start: number; items: number; hours: number }[];
  metric: "items" | "hours";
  theme: ChartTheme;
}) {
  const data = useMemo<ChartData<"bar", number[], string>>(
    () => ({
      labels: weeks.map((w) => `Sem. ${fmtDay(w.start)}`),
      datasets: [
        {
          label: metric === "items" ? "Ítems entregados" : "Horas entregadas",
          data: weeks.map((w) => (metric === "items" ? w.items : w.hours)),
          backgroundColor: withAlpha(theme.accent, 0.8),
          hoverBackgroundColor: theme.accent,
          borderRadius: { topLeft: theme.px(4), topRight: theme.px(4) },
          borderSkipped: "start",
          maxBarThickness: theme.px(36),
        },
      ],
    }),
    [weeks, metric, theme],
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
              const w = weeks[items[0].dataIndex];
              return metric === "items" ? `${fmtHours(w.hours)} entregadas` : `${w.items} ítems entregados`;
            },
          },
        },
      },
    };
  }, [theme, metric, weeks]);
  return <Bar data={data} options={options} />;
}

// ------------------------------------------------------------------ Flujo acumulado (CFD)
export function CumulativeFlowChart({ series, theme }: { series: ({ t: number } & Record<StateCategory, number>)[]; theme: ChartTheme }) {
  // De abajo hacia arriba: Cerrado → Entregado → En curso → Por iniciar
  const order: StateCategory[] = ["Completed", "Resolved", "InProgress", "Proposed"];
  const data = useMemo<ChartData<"line", number[], string>>(
    () => ({
      labels: series.map((p) => fmtDay(p.t)),
      datasets: order.map((cat, idx) => ({
        label: CATEGORY_LABEL[cat],
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
    [series, theme],
  );
  const options = useMemo<ChartOptions<"line">>(() => {
    const base = baseOptions<"line">(theme);
    const a = axes(theme);
    return {
      ...base,
      scales: { x: { ...a.x, ticks: { ...a.x.ticks, maxTicksLimit: 10, autoSkip: true } }, y: { ...a.y, stacked: true } },
      plugins: {
        ...base.plugins,
        tooltip: { ...base.plugins?.tooltip, itemSort: (x, y) => y.datasetIndex - x.datasetIndex, callbacks: { label: (i) => ` ${i.dataset.label}: ${i.raw} ítems` } },
      },
    };
  }, [theme]);
  return <Line data={data} options={options} />;
}

// ------------------------------------------------------------------ Burnup
export function BurnupChart({ series, theme }: { series: { t: number; scope: number; done: number }[]; theme: ChartTheme }) {
  const done = categoryColor("Completed", theme.dark);
  const data = useMemo<ChartData<"line", number[], string>>(
    () => ({
      labels: series.map((p) => fmtDay(p.t)),
      datasets: [
        {
          label: "Horas completadas",
          data: series.map((p) => p.done),
          borderColor: done,
          backgroundColor: verticalGradient(done, theme.dark ? 0.4 : 0.3),
          fill: "origin",
          borderWidth: theme.px(2),
          pointRadius: 0,
          pointHoverRadius: theme.px(5),
          tension: 0.3,
        },
        {
          label: "Alcance (horas)",
          data: series.map((p) => p.scope),
          borderColor: theme.reference,
          borderDash: [theme.px(6), theme.px(4)],
          borderWidth: theme.px(2),
          pointRadius: 0,
          pointHoverRadius: theme.px(4),
          fill: false,
          tension: 0,
        },
      ],
    }),
    [series, theme, done],
  );
  const options = useMemo<ChartOptions<"line">>(() => {
    const base = baseOptions<"line">(theme);
    const a = axes(theme, { suffix: " h" });
    return {
      ...base,
      scales: { x: { ...a.x, ticks: { ...a.x.ticks, maxTicksLimit: 10, autoSkip: true } }, y: a.y },
      plugins: {
        ...base.plugins,
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            label: (i) => ` ${i.dataset.label}: ${fmtHours(Number(i.raw))}`,
            footer: (items) => {
              const p = series[items[0].dataIndex];
              return p.scope ? `Avance: ${Math.round((p.done / p.scope) * 100)} %` : "";
            },
          },
        },
      },
    };
  }, [theme, series]);
  return <Line data={data} options={options} />;
}

// ------------------------------------------------------------------ Dispersión de cycle time
export function CycleScatterChart({
  points,
  p50,
  p85,
  range,
  theme,
  onSelect,
}: {
  points: { item: Item; x: number; y: number }[];
  p50: number | null;
  p85: number | null;
  range: { from: number; to: number };
  theme: ChartTheme;
  onSelect?: (id: number) => void;
}) {
  const data = useMemo(
    () => ({
      datasets: [
        {
          type: "scatter" as const,
          label: "Ítems cerrados",
          data: points.map((p) => ({ x: p.x, y: p.y })),
          backgroundColor: withAlpha(theme.accent, 0.65),
          borderColor: theme.surface,
          borderWidth: theme.px(1),
          pointRadius: theme.px(4.5),
          pointHoverRadius: theme.px(7),
        },
        ...(p50 !== null
          ? [{ type: "line" as const, label: "P50", data: [{ x: range.from, y: p50 }, { x: range.to, y: p50 }], borderColor: theme.reference, borderDash: [theme.px(6), theme.px(4)], borderWidth: theme.px(1.5), pointRadius: 0 }]
          : []),
        ...(p85 !== null
          ? [{ type: "line" as const, label: "P85", data: [{ x: range.from, y: p85 }, { x: range.to, y: p85 }], borderColor: theme.muted, borderDash: [theme.px(2), theme.px(3)], borderWidth: theme.px(1.5), pointRadius: 0 }]
          : []),
      ],
    }),
    [points, p50, p85, range, theme],
  );
  const options = useMemo<ChartOptions<"scatter">>(() => {
    const a = axes(theme, { suffix: " d" });
    return {
      interaction: { mode: "nearest", intersect: true },
      layout: { padding: { top: theme.px(8), right: theme.px(8) } },
      onHover: (e, el) => {
        const target = e.native?.target as HTMLElement | undefined;
        if (target) target.style.cursor = el.length && el[0].datasetIndex === 0 ? "pointer" : "default";
      },
      onClick: (_e, el) => {
        if (el.length && el[0].datasetIndex === 0 && onSelect) onSelect(points[el[0].index].item.id);
      },
      scales: {
        x: {
          type: "linear",
          min: range.from,
          max: range.to,
          border: { display: false },
          grid: { display: false },
          ticks: { color: theme.muted, font: { family: theme.font, size: theme.px(11) }, maxTicksLimit: 8, callback: (v) => fmtDay(Number(v)) },
        },
        y: a.y,
      },
      plugins: {
        crosshair: { enabled: false },
        tooltip: {
          ...(tooltipStyle(theme) as object),
          filter: (i) => i.datasetIndex === 0,
          callbacks: {
            title: (items) => {
              const p = points[items[0].dataIndex];
              return `#${p.item.id} · ${(p.item.title ?? "").slice(0, 60)}`;
            },
            label: (i) => {
              const p = points[i.dataIndex];
              return [` Cycle time: ${fmtDays(p.y)}`, ` Cerrado: ${fmtDay(p.x)}`, ` ${p.item.type} · ${p.item.name ?? ""}`];
            },
          },
        },
      },
    } as ChartOptions<"scatter">;
  }, [theme, range, points, onSelect]);
  return <Chart type="scatter" data={data as ChartData<"scatter">} options={options} />;
}

// ------------------------------------------------------------------ Dona por categoría
export function StateDonut({ counts, theme }: { counts: Record<StateCategory, number>; theme: ChartTheme }) {
  const cats = CATEGORIES.filter((c) => counts[c] > 0);
  const total = cats.reduce((s, c) => s + counts[c], 0);
  const data = useMemo<ChartData<"doughnut", number[], string>>(
    () => ({
      labels: cats.map((c) => CATEGORY_LABEL[c]),
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
    [counts, theme],
  );
  const options = useMemo<ChartOptions<"doughnut">>(
    () => ({
      cutout: "72%",
      layout: { padding: theme.px(6) },
      plugins: {
        crosshair: { enabled: false },
        tooltip: { ...(tooltipStyle(theme) as object), callbacks: { label: (i) => ` ${i.raw} ítems · ${Math.round((Number(i.raw) / total) * 100)} %` } },
      },
    }),
    [theme, total],
  );
  return (
    <div className="relative h-full">
      <Doughnut data={data} options={options} />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="font-display text-2xl font-semibold tabular-nums text-foreground">{total.toLocaleString("es-CO")}</p>
          <p className="text-[0.6875rem] uppercase tracking-wider text-muted">ítems activos</p>
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

export function PersonStatesChart({ rows, theme, onSelect }: { rows: PersonRow[]; theme: ChartTheme; onSelect?: (key: string) => void }) {
  const data = useMemo<ChartData<"bar", number[], string>>(
    () => ({
      labels: rows.map((r) => short(r.person.name)),
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
            title: (items) => rows[items[0].dataIndex].person.name,
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
      labels: rows.map((r) => short(r.person.name)),
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
            title: (items) => rows[items[0].dataIndex].person.name,
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
