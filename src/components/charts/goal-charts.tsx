"use client";

import "./setup";
import type { ChartData, ChartOptions, Scale } from "chart.js";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo } from "react";
import { Chart } from "react-chartjs-2";
import { tagColor, type GoalProgress } from "@/lib/analytics/goal";
import { axes, baseOptions, withAlpha, type ChartTheme } from "./chart-theme";

const noon = (iso: string) => new Date(`${iso}T12:00:00`);
/** "mar 20 oct" (o "Hoy" para la fecha actual) */
export const goalDayLabel = (iso: string, today: string) => (iso === today ? "Hoy" : format(noon(iso), "EEE d MMM", { locale: es }));
export const goalDayTitle = (iso: string) => format(noon(iso), "EEEE d 'de' MMMM", { locale: es });
const fmt = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 1 });

/** ¿Todos los tags tienen el mismo valor? (entonces basta una sola línea de referencia) */
const same = (values: number[]) => values.every((v) => v === values[0]);

type Mixed = ChartData<"bar" | "line", (number | null)[], string>;

/**
 * Etiquetas del eje X repartidas según el ancho del eje (una cada `minGap` px) y siempre "Hoy" y el
 * último día (cierre), sin amontonarse. Callback de ticks para usar con autoSkip desactivado.
 */
function sparseTicks(labels: string[], todayIndex: number, minGap: number) {
  const last = labels.length - 1;
  const pinned = [todayIndex, last].filter((i) => i >= 0);
  return function (this: Scale, _value: string | number, index: number) {
    const step = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(this.width / minGap))));
    const clear = pinned.every((p) => Math.abs(index - p) >= Math.max(2, Math.ceil(step / 2)));
    return pinned.includes(index) || (index % step === 0 && clear) ? labels[index] : "";
  };
}

// ------------------------------------------------------------------ Avance diario vs. meta
/** Barras por tag y día (inicio → cierre) con la meta diaria punteada, cortada en fines de semana y festivos. */
export function GoalDailyChart({ progress, theme }: { progress: GoalProgress; theme: ChartTheme }) {
  const { days, tags, today } = progress;
  const goalColor = withAlpha(theme.text, theme.dark ? 0.7 : 0.6);
  const data = useMemo<Mixed>(() => {
    const goalLine = (label: string, daily: number, color: string) => ({
      type: "line" as const,
      label,
      data: days.map((d) => (d.business ? daily : null)),
      borderColor: color,
      borderDash: [theme.px(6), theme.px(4)],
      borderWidth: theme.px(2),
      pointRadius: 0,
      pointHoverRadius: 0,
      spanGaps: false,
      order: 0,
    });
    const goals = same(tags.map((t) => t.daily))
      ? tags.length
        ? [goalLine(`Meta diaria (${tags[0].daily} por tag)`, tags[0].daily, goalColor)]
        : []
      : tags.map((t) => goalLine(`Meta ${t.tag} (${t.daily})`, t.daily, tagColor(t.index, theme.dark)));
    return {
      labels: days.map((d) => goalDayLabel(d.date, today)),
      datasets: [
        ...tags.map((t) => ({
          type: "bar" as const,
          label: t.tag,
          data: days.map((d) => (d.date <= today ? (d.done[t.tag] ?? 0) : null)),
          // Días sin meta (fin de semana / festivo) atenuados
          backgroundColor: days.map((d) => withAlpha(tagColor(t.index, theme.dark), d.business ? 0.9 : 0.4)),
          hoverBackgroundColor: tagColor(t.index, theme.dark),
          borderRadius: { topLeft: theme.px(4), topRight: theme.px(4) },
          borderSkipped: "start" as const,
          maxBarThickness: theme.px(22),
          order: 1,
        })),
        ...goals,
      ],
    } as Mixed;
  }, [days, tags, today, theme, goalColor]);

  const options = useMemo<ChartOptions<"bar">>(() => {
    const base = baseOptions<"bar">(theme);
    const a = axes(theme);
    const peak = Math.max(0, ...tags.map((t) => t.daily), ...days.flatMap((d) => tags.map((t) => d.done[t.tag] ?? 0)));
    const todayIndex = days.findIndex((d) => d.date === today);
    return {
      ...base,
      scales: {
        x: {
          ...a.x,
          ticks: {
            ...a.x.ticks,
            autoSkip: false,
            maxRotation: 0,
            callback: sparseTicks(days.map((d) => goalDayLabel(d.date, today)), todayIndex, theme.px(72)),
            color: (ctx) => (ctx.index === todayIndex ? theme.text : theme.muted),
            font: (ctx) => ({ family: theme.font, size: theme.px(11), weight: ctx.index === todayIndex ? "bold" : "normal" }),
          },
        },
        y: { ...a.y, suggestedMax: Math.ceil(peak * 1.15) },
      },
      plugins: {
        ...base.plugins,
        tooltip: {
          ...base.plugins?.tooltip,
          // Solo las barras: la meta ya se ve en la línea y en el texto de cada tag
          filter: (item) => tags.some((t) => t.tag === item.dataset.label),
          callbacks: {
            title: (items) => {
              const d = days[items[0].dataIndex];
              return `${goalDayTitle(d.date)}${d.business ? "" : " · sin meta (fin de semana o festivo)"}`;
            },
            label: (item) => {
              const t = tags.find((x) => x.tag === item.dataset.label);
              const d = days[item.dataIndex];
              const value = Number(item.raw ?? 0);
              if (!t || !d.business) return ` ${item.dataset.label}: ${value}`;
              return ` ${t.tag}: ${value} de ${t.daily} ${value >= t.daily ? "✓ cumplió" : `· faltaron ${t.daily - value}`}`;
            },
          },
        },
      },
    };
  }, [theme, days, tags, today]);

  return <Chart type="bar" data={data as ChartData<"bar">} options={options} />;
}

// ------------------------------------------------------------------ Avance acumulado vs. meta
/** Completadas acumuladas por tag frente a la meta acumulada (diaria × días hábiles) y el total, hasta el cierre. */
export function GoalCumulativeChart({ progress, theme }: { progress: GoalProgress; theme: ChartTheme }) {
  const { days, tags, today } = progress;
  const data = useMemo<ChartData<"line", (number | null)[], string>>(() => {
    const goalColor = withAlpha(theme.text, theme.dark ? 0.7 : 0.6);
    const sharedGoal = same(tags.map((t) => t.daily)) && same(tags.map((t) => t.total));
    const reference = (label: string, values: number[], color: string, dash: number[]) => ({
      label,
      data: values,
      borderColor: color,
      borderDash: dash,
      borderWidth: theme.px(2),
      pointRadius: 0,
      pointHoverRadius: theme.px(4),
      fill: false,
      tension: 0,
    });
    const goals = sharedGoal
      ? tags.length
        ? [
            reference(`Meta acumulada${tags.length > 1 ? " (por tag)" : ""}`, tags[0].cumulative.map((c) => c.goal), goalColor, [theme.px(6), theme.px(4)]),
            reference(`Total de tareas (${tags[0].total}${tags.length > 1 ? " por tag" : ""})`, days.map(() => tags[0].total), theme.reference, [theme.px(2), theme.px(3)]),
          ]
        : []
      : tags.flatMap((t) => [
          reference(`Meta ${t.tag}`, t.cumulative.map((c) => c.goal), tagColor(t.index, theme.dark), [theme.px(6), theme.px(4)]),
          reference(`Total ${t.tag} (${t.total})`, days.map(() => t.total), theme.reference, [theme.px(2), theme.px(3)]),
        ]);
    return {
      labels: days.map((d, i) => (i === days.length - 1 ? `${goalDayLabel(d.date, today)} · cierre` : goalDayLabel(d.date, today))),
      datasets: [
        ...tags.map((t) => ({
          label: `${t.tag} completadas`,
          data: t.cumulative.map((c) => c.actual),
          borderColor: tagColor(t.index, theme.dark),
          backgroundColor: tagColor(t.index, theme.dark),
          borderWidth: theme.px(2.5),
          pointRadius: 0,
          pointHoverRadius: theme.px(5),
          fill: false,
          tension: 0.2,
          spanGaps: false,
        })),
        ...goals,
      ],
    };
  }, [days, tags, today, theme]);

  const options = useMemo<ChartOptions<"line">>(() => {
    const base = baseOptions<"line">(theme);
    const a = axes(theme);
    const todayIndex = days.findIndex((d) => d.date === today);
    return {
      ...base,
      scales: {
        x: {
          ...a.x,
          ticks: {
            ...a.x.ticks,
            autoSkip: false,
            maxRotation: 0,
            callback: sparseTicks(
              days.map((d, i) => (i === days.length - 1 ? `${goalDayLabel(d.date, today)} · cierre` : goalDayLabel(d.date, today))),
              todayIndex,
              theme.px(84),
            ),
            color: (ctx) => (ctx.index === todayIndex ? theme.text : theme.muted),
            font: (ctx) => ({ family: theme.font, size: theme.px(11), weight: ctx.index === todayIndex || ctx.index === days.length - 1 ? "bold" : "normal" }),
          },
        },
        y: { ...a.y, suggestedMax: Math.ceil(Math.max(1, ...tags.map((t) => t.total)) * 1.05) },
      },
      plugins: {
        ...base.plugins,
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            title: (items) => goalDayTitle(days[items[0].dataIndex].date),
            label: (item) => (item.raw === null ? "" : ` ${item.dataset.label}: ${fmt(Number(item.raw))}`),
          },
        },
      },
    };
  }, [theme, days, tags, today]);

  return <Chart type="line" data={data} options={options} />;
}
