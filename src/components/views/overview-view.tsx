"use client";

import clsx from "clsx";
import { AlertTriangle, BarChart3, CheckCircle2, Clock, Gauge, Hourglass, Layers, Minus, PieChart, Timer, TrendingDown, TrendingUp, Workflow } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { useChartTheme } from "@/components/charts/chart-theme";
import { BurnupChart, CumulativeFlowChart, CycleScatterChart, Sparkline, StateDonut, ThroughputChart, bucketLabel } from "@/components/charts/flow-charts";
import { useApp } from "@/components/shell/app-provider";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EmptyState, Segmented, TypeBadge, type StatusTone } from "@/components/ui/primitives";
import { CATEGORIES, CATEGORY_LABEL, agingWip, burnup, cumulativeFlow, cycleScatter, distribution, kpis, throughput } from "@/lib/analytics/metrics";
import type { Item } from "@/lib/analytics/model";
import { categoryColor } from "@/lib/analytics/state-colors";
import { formatShort } from "@/lib/dates";
import { DatasetGate } from "./dataset-gate";
import { ComplianceSummary } from "./compliance-summary";
import { GoalPanel } from "./goal-panel";
import { TeamHealthCard } from "./team-health";

export function OverviewView() {
  return (
    <DatasetGate>
      <Overview />
    </DatasetGate>
  );
}

function Overview() {
  const { scoped, range, prevRange, trend, chartUnit, setChartUnit, comparison, model, projectKey, openWorkItem, period } = useApp();
  const theme = useChartTheme(projectKey);
  const [metric, setMetric] = useState<"items" | "hours">("hours");
  const now = model!.now;

  const k = useMemo(() => kpis(scoped, range, now), [scoped, range, now]);
  const p = useMemo(() => kpis(scoped, prevRange, now), [scoped, prevRange, now]);
  // Periodos cortos (Hoy, Ayer, inicio de semana): las tendencias muestran 7 días y resaltan el periodo
  const extended = trend.from !== range.from;
  // Por semanas no se extiende: 7 días partirían la semana en dos barras
  const flowExtended = extended && chartUnit === "day";
  const flow = useMemo(() => throughput(scoped, flowExtended ? trend : range, chartUnit), [scoped, flowExtended, trend, range, chartUnit]);
  const spark = useMemo(() => throughput(scoped, trend, "day"), [scoped, trend]);
  const cfd = useMemo(() => cumulativeFlow(scoped, trend), [scoped, trend]);
  const burn = useMemo(() => burnup(scoped, trend), [scoped, trend]);
  const scatter = useMemo(() => cycleScatter(scoped, range), [scoped, range]);
  const dist = useMemo(() => distribution(scoped, range), [scoped, range]);
  const aging = useMemo(() => agingWip(scoped, now), [scoped, now]);
  const overdue = useMemo(() => scoped.filter((i) => i.overdue).sort((a, b) => b.delayDays - a.delayDays), [scoped]);
  // Umbral de "estancado": P85 del cycle time, nunca menor a 5 días
  const staleThreshold = Math.max(k.cycleP85 ?? 0, 5);
  const closedNoFlow = useMemo(() => scoped.filter((i) => i.completedAt !== null && i.completedAt >= range.from && i.completedAt <= range.to && (i.cycleTime ?? 0) < 0.01).length, [scoped, range]);
  const stale = aging.filter((a) => a.item.cat === "InProgress" && a.ageDays > staleThreshold);
  const periodLabel = `${formatShort(period.from)} – ${formatShort(period.to)}`;
  const trendNote = `Últimos 7 días · resaltado: ${period.label}`;

  if (!scoped.length) {
    return (
      <div className="space-y-5">
        <GoalPanel />
        <ComplianceSummary />
        <EmptyState variant="search" title="Sin ítems para estos filtros" description="Amplía el periodo, cambia la épica o el tag, o selecciona otros colaboradores." />
      </div>
    );
  }

  const tiles = [
    {
      label: "Entregados",
      icon: CheckCircle2,
      value: <AnimatedNumber value={k.delivered} />,
      hint: `${k.active.toLocaleString("es-CO")} ítems activos en el periodo`,
      delta: pct(k.delivered, p.delivered),
      spark: spark.map((d) => d.items),
    },
    {
      label: "Horas entregadas",
      icon: Clock,
      value: <AnimatedNumber value={k.hoursDelivered} decimals={1} suffix=" h" />,
      hint: `1 punto = 1 h · reportado: ${k.completedWork.toLocaleString("es-CO")} h`,
      delta: pct(k.hoursDelivered, p.hoursDelivered),
      spark: spark.map((d) => d.hours),
    },
    {
      label: "En curso (WIP)",
      icon: Workflow,
      value: <AnimatedNumber value={k.wip} />,
      hint: `${k.hoursWip.toLocaleString("es-CO")} h · ${k.resolvedPending} entregados sin cerrar`,
      delta: null,
    },
    {
      label: "Vencidos",
      icon: AlertTriangle,
      value: <AnimatedNumber value={k.overdue} />,
      hint: "sin entregar y con objetivo pasado",
      delta: null,
      tone: k.overdue > 0 ? ("critical" as const) : undefined,
    },
    {
      label: "Entregas a tiempo",
      icon: Gauge,
      value: k.onTimeRate === null ? "—" : <AnimatedNumber value={Math.round(k.onTimeRate * 100)} suffix=" %" />,
      hint: k.onTimeBase ? `${k.onTimeBase} entregas con fecha objetivo` : "sin entregas con fecha objetivo",
      delta: k.onTimeRate !== null && p.onTimeRate !== null ? { value: (k.onTimeRate - p.onTimeRate) * 100, suffix: " pp" } : null,
    },
    {
      label: "Cycle time (mediana)",
      icon: Timer,
      value: k.cycleP50 === null ? "—" : <AnimatedNumber value={k.cycleP50} decimals={1} suffix=" d" />,
      hint:
        closedNoFlow > 0
          ? `${closedNoFlow} cerrados sin pasar por "en curso" · P85 ${k.cycleP85?.toLocaleString("es-CO", { maximumFractionDigits: 1 }) ?? "—"} d`
          : k.cycleP85 !== null
            ? `85 % cierra en ≤ ${k.cycleP85.toLocaleString("es-CO", { maximumFractionDigits: 1 })} d`
            : "en curso → cerrado",
      delta: k.cycleP50 !== null && p.cycleP50 ? { value: ((k.cycleP50 - p.cycleP50) / p.cycleP50) * 100, suffix: " %", invert: true } : null,
    },
  ];

  return (
    <div className="space-y-5">
      <GoalPanel />
      <ComplianceSummary />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        {tiles.map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -3 }}
            className={clsx("card group relative overflow-hidden p-4", t.tone === "critical" && "border-critical/40")}
          >
            <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-accent-soft opacity-70 blur-2xl transition-transform duration-500 group-hover:scale-125" />
            <div className="relative flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-muted">{t.label}</p>
              <span
                className={clsx(
                  "grid size-8 shrink-0 place-items-center rounded-xl text-white shadow-md",
                  t.tone === "critical" ? "bg-critical shadow-critical/25" : "bg-gradient-to-br from-accent to-brand-sky shadow-accent/25",
                )}
              >
                <t.icon className="size-4" />
              </span>
            </div>
            <p className="relative mt-2 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">{t.value}</p>
            <p className="relative mt-0.5 line-clamp-2 text-[0.6875rem] text-muted">{t.hint}</p>
            <div className="relative mt-2 flex min-h-5 items-center gap-2">
              {t.delta && <Delta {...t.delta} />}
              {t.delta && <span className="truncate text-[0.6875rem] text-subtle" title={comparison}>{comparison}</span>}
            </div>
            {t.spark && t.spark.length > 1 && (
              <div className="relative -mx-1 mt-1 h-8">
                <Sparkline values={t.spark} color={theme.accent} theme={theme} />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <TeamHealthCard />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title={chartUnit === "day" ? "Entregas por día" : "Entregas por semana"}
          subtitle={`Throughput · ${flowExtended ? trendNote : periodLabel}`}
          icon={BarChart3}
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              <Segmented
                size="sm"
                value={chartUnit}
                onChange={setChartUnit}
                options={[
                  { value: "day", label: "Días", title: "Ver por día" },
                  { value: "week", label: "Semanas", title: "Ver por semana" },
                ]}
              />
              <Segmented
                size="sm"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: "hours", label: "Horas" },
                  { value: "items", label: "Ítems" },
                ]}
              />
            </div>
          }
          summary={`Ítems u horas entregadas por ${chartUnit === "day" ? "día" : "semana"}.`}
          table={{ columns: [chartUnit === "day" ? "Día" : "Semana", "Ítems", "Horas"], rows: flow.map((b) => [bucketLabel(b.start, chartUnit), b.items, b.hours]) }}
          empty={flow.every((b) => b.items === 0) ? { title: flowExtended ? "Sin entregas en los últimos 7 días" : "Sin entregas en el periodo" } : false}
          height={280}
        >
          <ThroughputChart buckets={flow} unit={chartUnit} metric={metric} highlight={flowExtended ? range : undefined} theme={theme} />
        </ChartCard>

        <ChartCard
          title="Estado del trabajo"
          subtitle="Ítems activos por categoría de estado"
          icon={PieChart}
          legend={CATEGORIES.filter((c) => dist[c] > 0).map((c) => ({ label: CATEGORY_LABEL[c], color: categoryColor(c, theme.dark), value: String(dist[c]) }))}
          summary="Distribución de los ítems activos por categoría de estado."
          table={{ columns: ["Estado", "Ítems"], rows: CATEGORIES.map((c) => [CATEGORY_LABEL[c], dist[c]]) }}
          height={240}
        >
          <StateDonut counts={dist} theme={theme} />
        </ChartCard>

        <ChartCard
          className="xl:col-span-2"
          title="Flujo acumulado (CFD)"
          subtitle={extended ? "Día a día · últimos 7 días" : "Cómo se mueve el trabajo entre estados día a día"}
          icon={Layers}
          legend={(["Proposed", "InProgress", "Resolved", "Completed"] as const).map((c) => ({ label: CATEGORY_LABEL[c], color: categoryColor(c, theme.dark) }))}
          summary="Diagrama de flujo acumulado de los ítems por categoría de estado."
          table={{
            columns: ["Día", ...CATEGORIES.map((c) => CATEGORY_LABEL[c])],
            rows: cfd.map((d) => [bucketLabel(d.t, "day"), ...CATEGORIES.map((c) => d[c])]),
          }}
          height={300}
        >
          <CumulativeFlowChart series={cfd} theme={theme} />
        </ChartCard>

        <AlertsCard overdue={overdue} stale={stale} threshold={staleThreshold} onOpen={openWorkItem} />

        <ChartCard
          className="xl:col-span-2"
          title="Burnup de horas"
          subtitle={extended ? "Horas completadas frente al alcance · últimos 7 días" : "Horas completadas frente al alcance del periodo"}
          icon={TrendingUp}
          legend={[
            { label: "Horas completadas", color: categoryColor("Completed", theme.dark) },
            { label: "Alcance", color: theme.reference, dashed: true },
          ]}
          summary="Burnup de horas completadas frente al alcance total."
          table={{ columns: ["Día", "Alcance (h)", "Completado (h)"], rows: burn.map((b) => [bucketLabel(b.t, "day"), b.scope, b.done]) }}
          empty={burn.every((b) => b.scope === 0) ? { title: "Sin horas estimadas en el alcance", description: "Los ítems no tienen puntos ni estimación." } : false}
          height={280}
        >
          <BurnupChart series={burn} theme={theme} />
        </ChartCard>

        <ChartCard
          title="Cycle time por ítem"
          subtitle="Días de en curso a cerrado · clic en un punto"
          icon={Hourglass}
          legend={[
            { label: "Ítem cerrado", color: theme.accent },
            { label: `P50 ${scatter.p50?.toLocaleString("es-CO", { maximumFractionDigits: 1 }) ?? "—"} d`, color: theme.reference, dashed: true },
            { label: `P85 ${scatter.p85?.toLocaleString("es-CO", { maximumFractionDigits: 1 }) ?? "—"} d`, color: theme.muted, dashed: true },
          ]}
          summary="Dispersión del cycle time de los ítems cerrados en el periodo, con percentiles 50 y 85."
          table={{
            columns: ["Ítem", "Cerrado", "Cycle time (d)"],
            rows: scatter.points.map((pt) => [`#${pt.item.id} ${pt.item.title ?? ""}`, bucketLabel(pt.x, "day"), pt.y]),
          }}
          empty={scatter.points.length === 0 ? { title: "Sin ítems cerrados en el periodo" } : false}
          height={280}
        >
          <CycleScatterChart points={scatter.points} p50={scatter.p50} p85={scatter.p85} range={range} theme={theme} onSelect={openWorkItem} />
        </ChartCard>
      </div>
    </div>
  );
}

function pct(current: number, previous: number) {
  if (!previous) return null;
  return { value: ((current - previous) / previous) * 100, suffix: " %" };
}

function Delta({ value, suffix, invert = false }: { value: number; suffix: string; invert?: boolean }) {
  const rounded = Math.round(value);
  const tone: StatusTone = rounded === 0 ? "neutral" : rounded > 0 !== invert ? "good" : "critical";
  const Icon = rounded === 0 ? Minus : rounded > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums",
        tone === "good" && "bg-good-soft text-good-fg",
        tone === "critical" && "bg-critical-soft text-critical-fg",
        tone === "neutral" && "bg-surface-3 text-muted",
      )}
    >
      <Icon className="size-3" />
      {rounded > 0 ? "+" : ""}
      {rounded}
      {suffix}
    </span>
  );
}

function AlertsCard({
  overdue: od,
  stale,
  threshold,
  onOpen,
}: {
  overdue: Item[];
  stale: { item: Item; ageDays: number }[];
  threshold: number;
  onOpen: (id: number) => void;
}) {
  const { model } = useApp();
  const person = (key: string | null) => (key ? model?.people.get(key)?.name.split(" ").slice(0, 2).join(" ") : "");
  return (
    <section className="card flex min-w-0 flex-col p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-critical-soft text-critical-fg">
          <AlertTriangle className="size-[1.125rem]" />
        </span>
        <div>
          <h3 className="font-display text-[0.9375rem] font-semibold leading-tight">Alertas</h3>
          <p className="mt-0.5 text-xs text-muted">Vencidos y trabajo estancado (&gt; {threshold.toLocaleString("es-CO", { maximumFractionDigits: 1 })} d en curso)</p>
        </div>
      </header>
      <div className="scrollbar-thin mt-3 max-h-[20rem] flex-1 space-y-1 overflow-y-auto">
        {od.length === 0 && stale.length === 0 && (
          <EmptyState variant="done" title="Sin alertas" description="No hay ítems vencidos ni estancados." className="border-none bg-transparent py-6" />
        )}
        {od.slice(0, 12).map((i) => (
          <button key={`o${i.id}`} onClick={() => onOpen(i.id)} className="flex w-full items-start gap-2.5 rounded-xl p-2 text-left transition hover:bg-surface-2">
            <span className="mt-0.5 rounded-md bg-critical-soft px-1.5 py-0.5 text-[0.6875rem] font-bold tabular-nums text-critical-fg">+{Math.ceil(i.delayDays)} d</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem]">{i.title}</span>
              <span className="flex items-center gap-1.5 text-[0.6875rem] text-subtle">
                <TypeBadge type={i.type} /> #{i.id} · {person(i.personKey)} · {i.state}
              </span>
            </span>
          </button>
        ))}
        {stale.slice(0, 8).map(({ item: i, ageDays }) => (
          <button key={`s${i.id}`} onClick={() => onOpen(i.id)} className="flex w-full items-start gap-2.5 rounded-xl p-2 text-left transition hover:bg-surface-2">
            <span className="mt-0.5 rounded-md bg-warning-soft px-1.5 py-0.5 text-[0.6875rem] font-bold tabular-nums text-warning-fg">{Math.round(ageDays)} d</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem]">{i.title}</span>
              <span className="flex items-center gap-1.5 text-[0.6875rem] text-subtle">
                <TypeBadge type={i.type} /> #{i.id} · {person(i.personKey)} · estancado en {i.state}
              </span>
            </span>
          </button>
        ))}
      </div>
      {(od.length > 12 || stale.length > 8) && (
        <p className="mt-2 border-t border-line pt-2 text-[0.6875rem] text-subtle">
          {od.length} vencidos y {stale.length} estancados en total · ver en Cronograma
        </p>
      )}
    </section>
  );
}

