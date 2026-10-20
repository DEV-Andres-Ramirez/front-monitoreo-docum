"use client";

import "./setup";
import type { ChartData, ChartOptions } from "chart.js";
import { useMemo } from "react";
import { Bar, Chart, Line } from "react-chartjs-2";
import { formatAxisDay, formatDayMonth } from "@/lib/dates";
import type { StatsDay } from "@/lib/types";
import { axes, baseOptions, hoursLabel, verticalGradient, withAlpha, type ChartTheme } from "./chart-theme";

/** Días que se grafican: hábiles + fines de semana con registros. */
export function plottedDays(daily: StatsDay[]) {
  return daily.filter((d) => d.businessDay || d.hours > 0);
}

// ------------------------------------------------------------------ Horas diarias vs. esperadas
export function DailyHoursChart({
  daily,
  theme,
  selected,
  onSelect,
}: {
  daily: StatsDay[];
  theme: ChartTheme;
  selected?: string;
  onSelect?: (date: string) => void;
}) {
  const days = useMemo(() => plottedDays(daily), [daily]);

  const data = useMemo<ChartData<"bar" | "line", number[], string>>(
    () => ({
      labels: days.map((d) => formatAxisDay(d.date)),
      datasets: [
        {
          type: "line" as const,
          label: "Capacidad esperada",
          data: days.map((d) => d.expected),
          borderColor: theme.reference,
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: theme.reference,
          tension: 0,
          order: 0,
        },
        {
          type: "bar" as const,
          label: "Horas registradas",
          data: days.map((d) => d.hours),
          backgroundColor: days.map((d) => (d.date === selected ? theme.accent : withAlpha(theme.accent, 0.72))),
          hoverBackgroundColor: theme.accent,
          borderRadius: { topLeft: 4, topRight: 4 },
          borderSkipped: "start",
          maxBarThickness: 28,
          categoryPercentage: 0.72,
          order: 1,
        },
      ],
    }),
    [days, theme, selected],
  );

  const options = useMemo<ChartOptions<"bar" | "line">>(() => {
    const base = baseOptions<"bar">(theme);
    return {
      ...base,
      scales: axes(theme, { suffix: " h" }),
      onHover: (e, el) => {
        const target = e.native?.target as HTMLElement | undefined;
        if (target) target.style.cursor = el.length && onSelect ? "pointer" : "default";
      },
      onClick: (_e, el) => {
        if (el.length && onSelect) onSelect(days[el[0].index].date);
      },
      plugins: {
        ...base.plugins,
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            title: (items) => formatDayMonth(days[items[0].dataIndex].date),
            label: (item) => ` ${item.dataset.label}: ${hoursLabel(Number(item.raw))}`,
            footer: (items) => {
              const d = days[items[0].dataIndex];
              return d.expected ? `Cumplimiento: ${Math.round((d.hours / d.expected) * 100)} %` : "Día no hábil";
            },
          },
        },
      },
    } as ChartOptions<"bar" | "line">;
  }, [theme, days, onSelect]);

  return <Chart type="bar" data={data} options={options} />;
}

// ------------------------------------------------------------------ Cobertura de reporte
export function CoverageChart({ daily, theme }: { daily: StatsDay[]; theme: ChartTheme }) {
  const days = useMemo(() => daily.filter((d) => d.businessDay && d.due > 0), [daily]);

  const data = useMemo<ChartData<"line", (number | null)[], string>>(
    () => ({
      labels: days.map((d) => formatAxisDay(d.date)),
      datasets: [
        {
          label: "Cobertura",
          data: days.map((d) => Math.round((Math.min(d.reported, d.due) / d.due) * 1000) / 10),
          borderColor: theme.accent,
          backgroundColor: verticalGradient(theme.accent, theme.dark ? 0.38 : 0.28),
          fill: "origin",
          borderWidth: 2,
          tension: 0.35,
          pointRadius: days.length > 20 ? 0 : 3,
          pointHoverRadius: 6,
          pointBackgroundColor: theme.surface,
          pointBorderColor: theme.accent,
          pointBorderWidth: 2,
        },
        {
          label: "Meta 100 %",
          data: days.map(() => 100),
          borderColor: theme.reference,
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
        },
      ],
    }),
    [days, theme],
  );

  const options = useMemo<ChartOptions<"line">>(() => {
    const base = baseOptions<"line">(theme);
    return {
      ...base,
      scales: axes(theme, { suffix: " %", max: 100 }),
      plugins: {
        ...base.plugins,
        tooltip: {
          ...base.plugins?.tooltip,
          filter: (item) => item.datasetIndex === 0,
          callbacks: {
            title: (items) => formatDayMonth(days[items[0].dataIndex].date),
            label: (item) => {
              const d = days[item.dataIndex];
              return ` ${d.reported} de ${d.due} reportaron (${String(item.raw).replace(".", ",")} %)`;
            },
          },
        },
      },
    };
  }, [theme, days]);

  return <Line data={data} options={options} />;
}

// ------------------------------------------------------------------ Horas por colaborador (bullet)
export type MemberBar = { employeeId: string; name: string; hours: number; expected: number };

export function shortName(name: string) {
  const p = name.split(/\s+/);
  return p.length >= 3 ? `${p[0]} ${p[p.length - 2]}` : name;
}

export function MemberHoursChart({ rows, theme, onSelect }: { rows: MemberBar[]; theme: ChartTheme; onSelect?: (employeeId: string) => void }) {
  const data = useMemo<ChartData<"bar", number[], string>>(
    () => ({
      labels: rows.map((r) => shortName(r.name)),
      datasets: [
        {
          label: "Horas registradas",
          data: rows.map((r) => r.hours),
          backgroundColor: theme.accent,
          hoverBackgroundColor: theme.accent,
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 10,
          order: 0,
        },
        {
          label: "Capacidad",
          data: rows.map((r) => r.expected),
          backgroundColor: theme.track,
          hoverBackgroundColor: theme.track,
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 18,
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
      onHover: (e, el) => {
        const target = e.native?.target as HTMLElement | undefined;
        if (target) target.style.cursor = el.length && onSelect ? "pointer" : "default";
      },
      onClick: (_e, el) => {
        if (el.length && onSelect) onSelect(rows[el[0].index].employeeId);
      },
      plugins: {
        ...base.plugins,
        crosshair: { enabled: false },
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            title: (items) => rows[items[0].dataIndex].name,
            label: (item) => ` ${item.dataset.label}: ${hoursLabel(Number(item.raw))}`,
            footer: (items) => {
              const r = rows[items[0].dataIndex];
              return r.expected ? `Cumplimiento: ${Math.round((r.hours / r.expected) * 100)} %` : "";
            },
          },
        },
      },
    };
  }, [theme, rows, onSelect]);

  return <Bar data={data} options={options} />;
}

// ------------------------------------------------------------------ Sparkline
export function Sparkline({ values, color, theme }: { values: number[]; color: string; theme: ChartTheme }) {
  const data = useMemo<ChartData<"line", number[], string>>(
    () => ({
      labels: values.map((_, i) => String(i)),
      datasets: [
        {
          data: values,
          borderColor: color,
          backgroundColor: verticalGradient(color, theme.dark ? 0.35 : 0.25),
          fill: "origin",
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
        },
      ],
    }),
    [values, color, theme.dark],
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
