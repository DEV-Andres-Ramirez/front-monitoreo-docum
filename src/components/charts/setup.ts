"use client";

// Registro único de Chart.js (solo los módulos usados) + plugin de crosshair.
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartType,
  type Plugin,
} from "chart.js";

declare module "chart.js" {
  interface PluginOptionsByType<TType extends ChartType> {
    crosshair?: { color?: string; enabled?: boolean; _type?: TType };
  }
}

/** Línea vertical punteada en el índice activo (barras y líneas temporales). */
const crosshair: Plugin = {
  id: "crosshair",
  afterDatasetsDraw(chart) {
    const opts = chart.options.plugins?.crosshair;
    if (!opts?.enabled) return;
    const active = chart.tooltip?.getActiveElements();
    if (!active?.length) return;
    const { ctx, chartArea } = chart;
    const x = active[0].element.x;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = opts.color ?? "rgba(120,130,150,0.5)";
    ctx.stroke();
    ctx.restore();
  },
};

let registered = false;

export function ensureChartsRegistered() {
  if (registered) return;
  ChartJS.register(
    CategoryScale,
    LinearScale,
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    DoughnutController,
    ArcElement,
    Filler,
    Tooltip,
    crosshair,
  );
  // Las leyendas son HTML (accesibles y con tokens), por eso el plugin Legend no se registra.
  ChartJS.defaults.set("animation", { duration: 700, easing: "easeOutQuart" });
  ChartJS.defaults.maintainAspectRatio = false;
  ChartJS.defaults.responsive = true;
  registered = true;
}

ensureChartsRegistered();
