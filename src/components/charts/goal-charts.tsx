"use client";

import "./setup";
import type { ChartData, ChartOptions, ChartType, Plugin, Scale } from "chart.js";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo } from "react";
import { Chart, Line } from "react-chartjs-2";
import { tagColor, type GoalProgress } from "@/lib/analytics/goal";
import { axes, baseOptions, withAlpha, type ChartTheme } from "./chart-theme";

const noon = (iso: string) => new Date(`${iso}T12:00:00`);
/** "mar 20 oct" (o "Hoy" para la fecha actual) */
export const goalDayLabel = (iso: string, today: string) => (iso === today ? "Hoy" : format(noon(iso), "EEE d MMM", { locale: es }));
export const goalDayTitle = (iso: string) => format(noon(iso), "EEEE d 'de' MMMM", { locale: es });
const fmt = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 1 });

declare module "chart.js" {
  interface PluginOptionsByType<TType extends ChartType> {
    /** Rótulo al final de la línea real del acumulado ("200 · +32 adelante") */
    goalEndLabel?: { text: string; _type?: TType };
  }
}

/** Colores de estado (adelanto / atraso): reservados, siempre acompañados de texto. */
const STATUS = { good: { light: "#0ca30c", dark: "#3fbf3f" }, bad: { light: "#d03b3b", dark: "#f07070" } };

/** ¿Todos los tags tienen el mismo valor? (entonces basta una sola línea de referencia) */
const same = (values: number[]) => values.every((v) => v === values[0]);

type Mixed = ChartData<"bar" | "line", (number | null)[], string>;

/**
 * Etiquetas del eje X repartidas según el ancho (una cada `minGap` px) y siempre el día marcado
 * (hoy o el del snapshot) y el último (cierre), sin amontonarse. Para ticks con autoSkip desactivado.
 */
function sparseTicks(labels: string[], pinnedIndex: number, minGap: number) {
  const last = labels.length - 1;
  const pinned = [pinnedIndex, last].filter((i) => i >= 0);
  return function (this: Scale, _value: string | number, index: number) {
    const step = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(this.width / minGap))));
    const clear = pinned.every((p) => Math.abs(index - p) >= Math.max(2, step));
    return pinned.includes(index) || (index % step === 0 && clear) ? labels[index] : "";
  };
}

/** Etiqueta del día de corte en el eje: "Hoy" en vivo; en snapshot, su fecha resaltada. */
const cutLabel = (iso: string, p: GoalProgress, today: string) => (p.live && iso === today ? "Hoy" : format(noon(iso), "EEE d MMM", { locale: es }));

// ------------------------------------------------------------------ Avance diario vs. meta
/** Barras por tag y día hábil (inicio → cierre) con la meta diaria punteada; los días futuros quedan vacíos. */
export function GoalDailyChart({ progress, theme, today }: { progress: GoalProgress; theme: ChartTheme; today: string }) {
  const { days, tags, asOf } = progress;
  const goalColor = withAlpha(theme.text, theme.dark ? 0.7 : 0.6);
  const labels = useMemo(() => days.map((d) => cutLabel(d.date, progress, today)), [days, progress, today]);
  const data = useMemo<Mixed>(() => {
    const goalLine = (label: string, daily: number, color: string) => ({
      type: "line" as const,
      label,
      data: days.map(() => daily),
      borderColor: color,
      borderDash: [theme.px(6), theme.px(4)],
      borderWidth: theme.px(2),
      pointRadius: 0,
      pointHoverRadius: 0,
      order: 0,
    });
    const goals = same(tags.map((t) => t.daily))
      ? tags.length
        ? [goalLine(`Meta diaria (${tags[0].daily} por tag)`, tags[0].daily, goalColor)]
        : []
      : tags.map((t) => goalLine(`Meta ${t.tag} (${t.daily})`, t.daily, tagColor(t.index, theme.dark)));
    return {
      labels,
      datasets: [
        ...tags.map((t) => ({
          type: "bar" as const,
          label: t.tag,
          data: days.map((d) => (d.date <= asOf ? (d.done[t.tag] ?? 0) : null)),
          // El día de corte (hoy o el del snapshot) va con color pleno; el resto, un poco atenuado
          backgroundColor: days.map((d) => withAlpha(tagColor(t.index, theme.dark), d.date === asOf ? 1 : 0.72)),
          hoverBackgroundColor: tagColor(t.index, theme.dark),
          borderRadius: { topLeft: theme.px(4), topRight: theme.px(4) },
          borderSkipped: "start" as const,
          maxBarThickness: theme.px(22),
          order: 1,
        })),
        ...goals,
      ],
    } as Mixed;
  }, [days, tags, asOf, theme, goalColor, labels]);

  const options = useMemo<ChartOptions<"bar">>(() => {
    const base = baseOptions<"bar">(theme);
    const a = axes(theme);
    const peak = Math.max(0, ...tags.map((t) => t.daily), ...days.flatMap((d) => tags.map((t) => d.done[t.tag] ?? 0)));
    const cutIndex = days.findIndex((d) => d.date === asOf);
    return {
      ...base,
      scales: {
        x: {
          ...a.x,
          ticks: {
            ...a.x.ticks,
            autoSkip: false,
            maxRotation: 0,
            callback: sparseTicks(labels, cutIndex, theme.px(72)),
            color: (ctx) => (ctx.index === cutIndex ? theme.text : theme.muted),
            font: (ctx) => ({ family: theme.font, size: theme.px(11), weight: ctx.index === cutIndex ? "bold" : "normal" }),
          },
        },
        y: { ...a.y, suggestedMax: Math.ceil(peak * 1.15), title: { display: true, text: "Tareas completadas", color: theme.muted, font: { family: theme.font, size: theme.px(11) } } },
      },
      plugins: {
        ...base.plugins,
        tooltip: {
          ...base.plugins?.tooltip,
          // Solo las barras: la meta ya se ve en la línea y en el texto
          filter: (item) => tags.some((t) => t.tag === item.dataset.label),
          callbacks: {
            title: (items) => goalDayTitle(days[items[0].dataIndex].date),
            label: (item) => {
              const t = tags.find((x) => x.tag === item.dataset.label);
              const value = Number(item.raw ?? 0);
              if (!t) return ` ${item.dataset.label}: ${value}`;
              return ` ${t.tag}: ${value} de ${t.daily} · ${value >= t.daily ? "✓ cumplió" : `✗ faltaron ${t.daily - value}`}`;
            },
          },
        },
      },
    };
  }, [theme, days, tags, asOf, labels]);

  return <Chart type="bar" data={data as ChartData<"bar">} options={options} />;
}

// ------------------------------------------------------------------ Avance acumulado vs. meta
export type CumulativeSeries = "total" | string;

/**
 * Rótulo al final de la línea real: "200 · +32 adelante". El texto llega por las opciones del plugin
 * (`plugins.goalEndLabel.text`), que sí se actualizan en cada render (el plugin se registra una sola vez).
 */
function endLabelPlugin(color: string, theme: ChartTheme): Plugin<"line"> {
  return {
    id: "goalEndLabel",
    afterDatasetsDraw(chart, _args, options: { text?: string }) {
      const text = options?.text;
      if (!text) return;
      const meta = chart.getDatasetMeta(0);
      const points = meta.data.filter((_, i) => (chart.data.datasets[0].data[i] ?? null) !== null);
      const last = points[points.length - 1];
      if (!last) return;
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.font = `600 ${theme.px(11)}px ${theme.font}`;
      const w = ctx.measureText(text).width;
      const x = Math.min(Math.max(last.x - w / 2, chartArea.left), chartArea.right - w);
      const y = Math.max(last.y - theme.px(12), chartArea.top + theme.px(10));
      ctx.fillStyle = theme.surface;
      ctx.fillRect(x - theme.px(4), y - theme.px(11), w + theme.px(8), theme.px(15));
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      ctx.restore();
    },
  };
}

/**
 * Una sola serie a la vez (Total o un tag): lo completado (línea sólida) frente a lo esperado (punteada) y
 * la meta final como techo. El espacio entre ambas se sombrea verde (adelanto) o rojo (atraso).
 */
export function GoalCumulativeChart({ progress, series, theme, today }: { progress: GoalProgress; series: CumulativeSeries; theme: ChartTheme; today: string }) {
  const { days } = progress;
  const s = useMemo(() => {
    const { tags, asOf } = progress;
    const picked = series === "total" ? null : (tags.find((t) => t.tag === series) ?? null);
    const actual = days.map((_, i) =>
      picked ? picked.cumulative[i].actual : tags.every((t) => t.cumulative[i].actual === null) ? null : tags.reduce((sum, t) => sum + (t.cumulative[i].actual ?? 0), 0),
    );
    const expected = days.map((_, i) => (picked ? picked.cumulative[i].goal : tags.reduce((sum, t) => sum + t.cumulative[i].goal, 0)));
    const lastIndex = actual.reduce<number>((acc, v, i) => (v === null ? acc : i), -1);
    const gap = lastIndex >= 0 ? (actual[lastIndex] ?? 0) - expected[lastIndex] : 0;
    return {
      picked,
      color: picked ? tagColor(picked.index, theme.dark) : theme.accent,
      total: picked ? picked.total : tags.reduce((sum, t) => sum + t.total, 0),
      actual,
      expected,
      labels: days.map((d, i) => (i === days.length - 1 ? `${cutLabel(d.date, progress, today)} · cierre` : cutLabel(d.date, progress, today))),
      cutIndex: days.findIndex((d) => d.date === asOf),
      endText: lastIndex >= 0 ? `${fmt(actual[lastIndex] ?? 0)} · ${gap >= 0 ? `+${fmt(gap)} adelante` : `${fmt(-gap)} atrás`}` : "",
    };
  }, [progress, series, theme, today, days]);
  const good = theme.dark ? STATUS.good.dark : STATUS.good.light;
  const bad = theme.dark ? STATUS.bad.dark : STATUS.bad.light;

  const data = useMemo<ChartData<"line", (number | null)[], string>>(
    () => ({
      labels: s.labels,
      datasets: [
        {
          label: s.picked ? `${s.picked.tag} completadas` : "Completadas (total)",
          data: s.actual,
          borderColor: s.color,
          backgroundColor: s.color,
          borderWidth: theme.px(3),
          pointRadius: 0,
          pointHoverRadius: theme.px(5),
          tension: 0.2,
          spanGaps: false,
          // Sombra entre lo real y lo esperado: verde si va adelante, rojo si va atrás
          fill: { target: 1, above: withAlpha(good, theme.dark ? 0.22 : 0.16), below: withAlpha(bad, theme.dark ? 0.22 : 0.14) },
        },
        {
          label: "Esperado a cada día",
          data: s.expected,
          borderColor: withAlpha(theme.text, theme.dark ? 0.7 : 0.6),
          borderDash: [theme.px(6), theme.px(4)],
          borderWidth: theme.px(2),
          pointRadius: 0,
          pointHoverRadius: theme.px(4),
          fill: false,
          tension: 0,
        },
        {
          label: `Meta final (${s.total.toLocaleString("es-CO")})`,
          data: days.map(() => s.total),
          borderColor: theme.reference,
          borderDash: [theme.px(2), theme.px(3)],
          borderWidth: theme.px(1.5),
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          tension: 0,
        },
      ],
    }),
    [s, days, theme, good, bad],
  );

  const options = useMemo<ChartOptions<"line">>(() => {
    const base = baseOptions<"line">(theme);
    const a = axes(theme);
    return {
      ...base,
      scales: {
        x: {
          ...a.x,
          ticks: {
            ...a.x.ticks,
            autoSkip: false,
            maxRotation: 0,
            callback: sparseTicks(s.labels, s.cutIndex, theme.px(84)),
            color: (ctx) => (ctx.index === s.cutIndex ? theme.text : theme.muted),
            font: (ctx) => ({ family: theme.font, size: theme.px(11), weight: ctx.index === s.cutIndex || ctx.index === days.length - 1 ? "bold" : "normal" }),
          },
        },
        y: { ...a.y, suggestedMax: Math.ceil(Math.max(1, s.total) * 1.05) },
      },
      plugins: {
        ...base.plugins,
        goalEndLabel: { text: s.endText },
        tooltip: {
          ...base.plugins?.tooltip,
          filter: (item) => item.datasetIndex < 2,
          callbacks: {
            title: (items) => goalDayTitle(days[items[0].dataIndex].date),
            label: (item) => (item.raw === null ? "" : ` ${item.dataset.label}: ${fmt(Number(item.raw))}`),
            footer: (items) => {
              const i = items[0].dataIndex;
              if (s.actual[i] === null) return "";
              const g = (s.actual[i] ?? 0) - s.expected[i];
              return g >= 0 ? `+${fmt(g)} adelante de lo esperado` : `${fmt(-g)} por debajo de lo esperado`;
            },
          },
        },
      },
    };
  }, [theme, s, days]);

  const plugins = useMemo(() => [endLabelPlugin(theme.text, theme)], [theme]);
  return <Line data={data} options={options} plugins={plugins} />;
}
