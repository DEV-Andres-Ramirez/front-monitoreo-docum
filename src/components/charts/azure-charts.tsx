"use client";

import "./setup";
import type { ChartData, ChartOptions } from "chart.js";
import { useMemo } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { TYPE_ORDER, typeMeta, typeRank } from "@/lib/work-item-types";
import { axes, baseOptions, hoursLabel, tooltipStyle, type ChartTheme } from "./chart-theme";

export type TypeSlice = { type: string; hours: number; activities: number };

/** Ordena por el orden FIJO de tipos (validado para CVD), nunca por magnitud. */
export function orderTypes(slices: TypeSlice[]) {
  return [...slices].sort((a, b) => typeRank(a.type) - typeRank(b.type));
}

export function typeColor(type: string, theme: ChartTheme) {
  const meta = typeMeta(type);
  return theme.dark ? meta.dark : meta.light;
}

// ------------------------------------------------------------------ Dona por tipo
export function TypeDonut({ slices, theme }: { slices: TypeSlice[]; theme: ChartTheme }) {
  const ordered = useMemo(() => orderTypes(slices).filter((s) => s.hours > 0), [slices]);
  const total = ordered.reduce((s, x) => s + x.hours, 0);

  const data = useMemo<ChartData<"doughnut", number[], string>>(
    () => ({
      labels: ordered.map((s) => typeMeta(s.type).plural),
      datasets: [
        {
          data: ordered.map((s) => s.hours),
          backgroundColor: ordered.map((s) => typeColor(s.type, theme)),
          hoverBackgroundColor: ordered.map((s) => typeColor(s.type, theme)),
          borderColor: theme.surface,
          hoverBorderColor: theme.surface,
          borderWidth: theme.px(2),
          borderRadius: theme.px(4),
          spacing: theme.px(1),
          hoverOffset: theme.px(6),
        },
      ],
    }),
    [ordered, theme],
  );

  const options = useMemo<ChartOptions<"doughnut">>(
    () => ({
      cutout: "72%",
      layout: { padding: theme.px(6) },
      plugins: {
        crosshair: { enabled: false },
        tooltip: {
          ...(tooltipStyle(theme) as object),
          callbacks: {
            label: (item) => {
              const v = Number(item.raw);
              return ` ${hoursLabel(v)} · ${Math.round((v / total) * 100)} %`;
            },
          },
        },
      },
    }),
    [theme, total],
  );

  return (
    <div className="relative h-full">
      <Doughnut data={data} options={options} />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="font-display text-2xl font-semibold tabular-nums text-foreground">{hoursLabel(total)}</p>
          <p className="text-[0.6875rem] uppercase tracking-wider text-muted">registradas</p>
        </div>
      </div>
    </div>
  );
}

export { TYPE_ORDER };

// ------------------------------------------------------------------ Horas por Feature
export type FeatureRow = { id: number | null; title: string; hours: number };

export function topFeatures(rows: FeatureRow[], max = 8): FeatureRow[] {
  if (rows.length <= max) return rows;
  const rest = rows.slice(max - 1).reduce((s, r) => s + r.hours, 0);
  return [...rows.slice(0, max - 1), { id: null, title: "Otros", hours: Math.round(rest * 100) / 100 }];
}

export function FeatureBars({ rows, theme }: { rows: FeatureRow[]; theme: ChartTheme }) {
  const truncate = (s: string) => (s.length > 26 ? `${s.slice(0, 25)}…` : s);
  const data = useMemo<ChartData<"bar", number[], string>>(
    () => ({
      labels: rows.map((r) => truncate(r.title)),
      datasets: [
        {
          label: "Horas",
          data: rows.map((r) => r.hours),
          backgroundColor: theme.accent,
          hoverBackgroundColor: theme.accent,
          borderRadius: theme.px(4),
          borderSkipped: "start",
          barThickness: theme.px(14),
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
      interaction: { mode: "index", axis: "y", intersect: false },
      scales: axes(theme, { horizontal: true, suffix: " h" }),
      plugins: {
        ...base.plugins,
        crosshair: { enabled: false },
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            title: (items) => rows[items[0].dataIndex].title,
            label: (item) => ` ${hoursLabel(Number(item.raw))}`,
          },
        },
      },
    };
  }, [theme, rows]);
  return <Bar data={data} options={options} />;
}
