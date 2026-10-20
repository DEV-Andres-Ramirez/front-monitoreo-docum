"use client";

import type { ChartOptions, ScriptableContext, TooltipOptions } from "chart.js";
import { useMemo, useSyncExternalStore } from "react";
import { useUiScale } from "@/components/ui/display";
import { useTheme } from "@/components/ui/theme";
import type { ProjectKey } from "@/lib/config";

/**
 * Colores de gráficas por tema. Valores validados con el validador de dataviz
 * (acentos 348/005 en claro y oscuro). El texto usa tokens, nunca el color de la serie.
 */
const BASE = {
  light: {
    text: "#0c1828",
    muted: "#586a80",
    subtle: "#8796aa",
    grid: "rgba(12, 24, 40, 0.07)",
    surface: "#ffffff",
    elevated: "#ffffff",
    line: "#e2e9f2",
    reference: "#97a3b4",
    track: "rgba(135, 150, 170, 0.22)",
  },
  dark: {
    text: "#e7eef8",
    muted: "#98a6ba",
    subtle: "#66768e",
    grid: "rgba(231, 238, 248, 0.07)",
    surface: "#0d1526",
    elevated: "#16223a",
    line: "#283754",
    reference: "#5d6e87",
    track: "rgba(102, 118, 142, 0.28)",
  },
};

const ACCENTS: Record<ProjectKey, { light: string; dark: string }> = {
  "348": { light: "#0090FF", dark: "#2F95F0" },
  "005": { light: "#13A538", dark: "#22AE52" },
};

export type ChartTheme = (typeof BASE)["light"] & {
  dark: boolean;
  accent: string;
  font: string;
  /** Escala de la interfaz: multiplica fuentes, grosores y rellenos (TV / pantallas grandes) */
  scale: number;
  /** px de diseño → px escalados */
  px: (n: number) => number;
};

function readFont() {
  return getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
}

export function useChartTheme(projectKey: ProjectKey): ChartTheme {
  const { resolved } = useTheme();
  const scale = useUiScale();
  const font = useSyncExternalStore(
    () => () => {},
    readFont,
    () => "system-ui, sans-serif",
  );
  return useMemo(
    () => ({
      ...BASE[resolved],
      dark: resolved === "dark",
      accent: ACCENTS[projectKey][resolved],
      font,
      scale,
      px: (n: number) => Math.round(n * scale * 10) / 10,
    }),
    [resolved, projectKey, font, scale],
  );
}

export function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Degradado vertical para rellenos de línea/área. */
export function verticalGradient(color: string, from = 0.32, to = 0) {
  return (ctx: ScriptableContext<"line">) => {
    const { chart } = ctx;
    const area = chart.chartArea;
    if (!area) return withAlpha(color, from / 2);
    const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, withAlpha(color, from));
    g.addColorStop(1, withAlpha(color, to));
    return g;
  };
}

export function tooltipStyle(t: ChartTheme): Partial<TooltipOptions<"bar" | "line" | "doughnut">> {
  return {
    backgroundColor: t.elevated,
    titleColor: t.text,
    bodyColor: t.muted,
    footerColor: t.text,
    borderColor: t.line,
    borderWidth: 1,
    padding: t.px(12),
    cornerRadius: t.px(12),
    boxPadding: t.px(5),
    usePointStyle: true,
    caretSize: t.px(6),
    titleFont: { family: t.font, weight: 600, size: t.px(12) },
    bodyFont: { family: t.font, size: t.px(12) },
    footerFont: { family: t.font, weight: 600, size: t.px(12) },
  };
}

/** Ejes recesivos: grilla punteada solo en el eje de valores, sin bordes. */
export function axes(t: ChartTheme, opts: { horizontal?: boolean; suffix?: string; max?: number } = {}) {
  const tick = { color: t.muted, font: { family: t.font, size: t.px(11) } };
  const value = {
    beginAtZero: true,
    max: opts.max,
    border: { display: false },
    grid: { color: t.grid, drawTicks: false, tickBorderDash: [3, 3] },
    ticks: { ...tick, padding: t.px(8), maxTicksLimit: 6, callback: (v: string | number) => `${Number(v).toLocaleString("es-CO")}${opts.suffix ?? ""}` },
  };
  const category = { border: { display: false }, grid: { display: false }, ticks: { ...tick, padding: t.px(6) } };
  return opts.horizontal ? { x: value, y: category } : { x: category, y: value };
}

export function baseOptions<T extends "bar" | "line">(t: ChartTheme): ChartOptions<T> {
  return {
    interaction: { mode: "index", intersect: false },
    layout: { padding: { top: t.px(8), right: t.px(4) } },
    plugins: {
      tooltip: tooltipStyle(t) as never,
      crosshair: { enabled: true, color: withAlpha(t.text, 0.25) },
    },
  } as ChartOptions<T>;
}

export const hoursLabel = (v: number) => `${Math.round(v * 100) / 100} h`.replace(".", ",");
