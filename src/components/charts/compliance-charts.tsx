"use client";

import "./setup";
import type { ChartData, ChartOptions } from "chart.js";
import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import type { TrendPoint } from "@/lib/analytics/compliance";
import type { TimeUnit } from "@/lib/analytics/metrics";
import { categoryColor } from "@/lib/analytics/state-colors";
import { axes, baseOptions, verticalGradient, type ChartTheme } from "./chart-theme";
import { bucketLabel } from "./flow-charts";

/**
 * Avance acumulado de un tipo (HU, Tareas o Bugs): alcance (ítems creados) frente a completados
 * y, en HU, también entregados a QA. Un solo eje Y.
 */
const SCOPE = { hu: (p: TrendPoint) => p.huScope, tasks: (p: TrendPoint) => p.taskScope, bugs: (p: TrendPoint) => p.bugScope };
const DONE = { hu: (p: TrendPoint) => p.huDone, tasks: (p: TrendPoint) => p.taskDone, bugs: (p: TrendPoint) => p.bugDone };
const LABELS = {
  hu: { done: "HU en producción", total: "Total de HU" },
  tasks: { done: "Tareas cerradas", total: "Total de tareas" },
  bugs: { done: "Bugs cerrados", total: "Total de bugs" },
};

export function ComplianceTrendChart({ trend, kind, unit, theme }: { trend: TrendPoint[]; kind: "hu" | "tasks" | "bugs"; unit: TimeUnit; theme: ChartTheme }) {
  const done = categoryColor("Completed", theme.dark);
  const qa = categoryColor("Resolved", theme.dark);
  const data = useMemo<ChartData<"line", number[], string>>(() => {
    const scope = trend.map(SCOPE[kind]);
    const series = [
      {
        label: LABELS[kind].done,
        data: trend.map(DONE[kind]),
        borderColor: done,
        backgroundColor: verticalGradient(done, theme.dark ? 0.4 : 0.3),
        fill: "origin" as const,
        borderWidth: theme.px(2.5),
        pointRadius: 0,
        pointHoverRadius: theme.px(5),
        tension: 0.25,
      },
      ...(kind === "hu"
        ? [
            {
              label: "HU en QA o más",
              data: trend.map((p) => p.huQa),
              borderColor: qa,
              backgroundColor: qa,
              fill: false as const,
              borderWidth: theme.px(2),
              pointRadius: 0,
              pointHoverRadius: theme.px(5),
              tension: 0.25,
            },
          ]
        : []),
      {
        label: LABELS[kind].total,
        data: scope,
        borderColor: theme.reference,
        borderDash: [theme.px(6), theme.px(4)],
        borderWidth: theme.px(2),
        pointRadius: 0,
        pointHoverRadius: theme.px(4),
        fill: false as const,
        tension: 0,
      },
    ];
    return { labels: trend.map((p) => bucketLabel(p.start, unit)), datasets: series };
  }, [trend, kind, unit, theme, done, qa]);

  const options = useMemo<ChartOptions<"line">>(() => {
    const base = baseOptions<"line">(theme);
    const a = axes(theme);
    return {
      ...base,
      scales: { x: { ...a.x, ticks: { ...a.x.ticks, autoSkip: true, maxRotation: 0, maxTicksLimit: 8 } }, y: a.y },
      plugins: {
        ...base.plugins,
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            label: (i) => ` ${i.dataset.label}: ${i.raw}`,
            footer: (items) => {
              const p = trend[items[0].dataIndex];
              const total = SCOPE[kind](p);
              const completed = DONE[kind](p);
              return total ? `Cumplimiento: ${Math.round((completed / total) * 1000) / 10} %`.replace(".", ",") : "";
            },
          },
        },
      },
    };
  }, [theme, trend, kind]);

  return <Line data={data} options={options} />;
}
