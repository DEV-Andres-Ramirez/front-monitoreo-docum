"use client";

import clsx from "clsx";
import { AlertTriangle, BarChart3, CheckCircle2, Clock, Gauge, Info, Layers, Minus, PieChart, TrendingDown, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { useChartTheme } from "@/components/charts/chart-theme";
import { CumulativeFlowChart, Sparkline, StateDonut, ThroughputChart, bucketLabel } from "@/components/charts/flow-charts";
import { useApp } from "@/components/shell/app-provider";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EmptyState, Segmented, TypeBadge, type StatusTone } from "@/components/ui/primitives";
import { HU_STAGE_LABEL } from "@/lib/analytics/compliance";
import { CATEGORIES, CATEGORY_LABEL, agingWip, alertable, cumulativeFlow, distribution, kpis, throughput } from "@/lib/analytics/metrics";
import type { Item } from "@/lib/analytics/model";
import { categoryColor } from "@/lib/analytics/state-colors";
import type { StateCategory } from "@/lib/analytics/types";
import { formatShort } from "@/lib/dates";
import { UndatedBoard } from "./undated-board";
import { DatasetGate } from "./dataset-gate";
import { ComplianceSummary } from "./compliance-summary";
import { GoalPanel } from "./goal-panel";
import { TeamHealthCard } from "./team-health";

/** Días hábiles sin movimiento a partir de los cuales un ítem en curso se considera estancado. */
const STALE_DAYS = 5;

export function OverviewView() {
  return (
    <DatasetGate>
      <Overview />
    </DatasetGate>
  );
}

function Overview() {
  const { view } = useApp();
  // HU y Bugs (Positiva): sin fechas, solo cantidades y estado actual
  if (!view.dated) {
    return (
      <div className="space-y-5">
        <ComplianceSummary />
        <UndatedBoard kind={view.key === "hu" ? "hu" : "bugs"} />
      </div>
    );
  }
  return <DatedOverview />;
}

/** Nombre de lo que se analiza en el mundo activo ("tareas", "HU") y cómo se lee "entregada" en él. */
function useNoun() {
  const { view } = useApp();
  return view.key === "hu"
    ? { noun: "HU", Noun: "HU", delivered: "Llegaron a QA o a producción en el periodo", labels: HU_STAGE_LABEL_FULL }
    : { noun: "tareas", Noun: "Tareas", delivered: "Pasaron a Entregada o Cerrada en el periodo", labels: CATEGORY_LABEL };
}
const HU_STAGE_LABEL_FULL: Record<StateCategory, string> = { ...HU_STAGE_LABEL, Removed: "Removida" };

function DatedOverview() {
  const { scoped, range, prevRange, trend, chartUnit, setChartUnit, comparison, model, projectKey, openWorkItem, period } = useApp();
  const theme = useChartTheme(projectKey);
  const [metric, setMetric] = useState<"items" | "hours">("items");
  const { noun, Noun, delivered: deliveredHint, labels } = useNoun();
  const now = model!.now;

  const k = useMemo(() => kpis(scoped, range, now), [scoped, range, now]);
  const p = useMemo(() => kpis(scoped, prevRange, now), [scoped, prevRange, now]);
  // Periodos cortos (Hoy, Ayer, inicio de semana): las tendencias muestran 7 días hábiles y resaltan el periodo
  const extended = trend.from !== range.from;
  // Por semanas no se extiende: 7 días partirían la semana en dos barras
  const flowExtended = extended && chartUnit === "day";
  const flow = useMemo(() => throughput(scoped, flowExtended ? trend : range, chartUnit), [scoped, flowExtended, trend, range, chartUnit]);
  const spark = useMemo(() => throughput(scoped, trend, "day"), [scoped, trend]);
  const cfd = useMemo(() => cumulativeFlow(scoped, trend), [scoped, trend]);
  const dist = useMemo(() => distribution(scoped, range), [scoped, range]);
  const aging = useMemo(() => agingWip(scoped, now), [scoped, now]);
  // Solo alertas de personas evaluadas: quien tiene marca (vacaciones, otro proyecto) no genera alertas
  const overdue = useMemo(() => scoped.filter(alertable).sort((a, b) => b.delayDays - a.delayDays), [scoped]);
  const stale = aging.filter((a) => a.item.cat === "InProgress" && a.ageDays > STALE_DAYS && !a.item.excused);
  const periodLabel = `${formatShort(period.from)} – ${formatShort(period.to)}`;
  const trendNote = `últimos 7 días hábiles · resaltado: ${period.label}`;
  const compare = comparison !== null;

  if (!scoped.length) {
    return (
      <div className="space-y-5">
        <GoalPanel />
        <ComplianceSummary />
        <EmptyState variant="search" title={`Sin ${noun} para estos filtros`} description="Amplía el periodo, cambia la épica o el tag, o selecciona otros colaboradores." />
      </div>
    );
  }

  const tiles: Tile[] = [
    {
      label: `${Noun} entregadas`,
      icon: CheckCircle2,
      value: <AnimatedNumber value={k.delivered} />,
      hint: deliveredHint,
      info: `Cuenta las ${noun} cuya fecha de entrega (la real si existe; si no, la de Entregado o Cerrado) cae dentro del periodo.`,
      delta: compare ? change(k.delivered, p.delivered) : null,
      spark: spark.map((d) => d.items),
    },
    {
      label: "Horas trabajadas",
      icon: Clock,
      value: <AnimatedNumber value={k.hoursDelivered} decimals={1} suffix=" h" />,
      hint: `Completed Work reportado en Azure en las ${noun} entregadas`,
      info: `Suma el campo Completed Work (horas que cada persona reporta en Azure) de las ${noun} entregadas en el periodo. No se usan las horas estimadas.`,
      delta: compare ? change(k.hoursDelivered, p.hoursDelivered) : null,
      spark: spark.map((d) => d.hours),
    },
    {
      label: "Atrasadas",
      icon: AlertTriangle,
      value: <AnimatedNumber value={k.overdue} />,
      hint: "Sin entregar y con la fecha objetivo ya pasada",
      info: "Fecha objetivo = la del ítem o, si no tiene, el fin de su sprint. No cuenta a personas con marca (vacaciones u otro proyecto).",
      delta: null,
      tone: k.overdue > 0 ? "critical" : undefined,
    },
    {
      label: "Entregadas a tiempo",
      icon: Gauge,
      value: k.onTimeRate === null ? "—" : <AnimatedNumber value={Math.round(k.onTimeRate * 100)} suffix=" %" />,
      hint: k.onTimeBase ? `${Math.round((k.onTimeRate ?? 0) * k.onTimeBase)} de ${k.onTimeBase} entregas con fecha objetivo` : "Ninguna entrega del periodo tenía fecha objetivo",
      info: "De lo entregado que tenía fecha objetivo, qué porcentaje se entregó a más tardar ese día.",
      delta: compare && k.onTimeRate !== null && p.onTimeRate !== null ? { value: (k.onTimeRate - p.onTimeRate) * 100, suffix: " pp", unit: "puntos" } : null,
    },
  ];

  return (
    <div className="space-y-5">
      <GoalPanel />
      <ComplianceSummary />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((t, i) => (
          <KpiTile key={t.label} tile={t} index={i} comparison={comparison} theme={theme} />
        ))}
      </div>

      <TeamHealthCard />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title={chartUnit === "day" ? "¿Cuánto se entregó cada día hábil?" : "¿Cuánto se entregó cada semana?"}
          subtitle={`${Noun} entregadas ${flowExtended ? `· ${trendNote}` : `· ${periodLabel}`}. Lo hecho en fin de semana o festivo se suma al siguiente día hábil.`}
          icon={BarChart3}
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              <Segmented
                size="sm"
                value={chartUnit}
                onChange={setChartUnit}
                options={[
                  { value: "day", label: "Días", title: "Ver por día hábil" },
                  { value: "week", label: "Semanas", title: "Ver por semana" },
                ]}
              />
              <Segmented
                size="sm"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: "items", label: "Cantidad", title: `Cantidad de ${noun}` },
                  { value: "hours", label: "Horas", title: "Horas trabajadas (Completed Work)" },
                ]}
              />
            </div>
          }
          summary={`${Noun} entregadas u horas trabajadas (Completed Work) por ${chartUnit === "day" ? "día hábil" : "semana"}.`}
          table={{ columns: [chartUnit === "day" ? "Día hábil" : "Semana", Noun, "Horas trabajadas"], rows: flow.map((b) => [bucketLabel(b.start, chartUnit), b.items, b.hours]) }}
          empty={flow.every((b) => b.items === 0) ? { title: flowExtended ? "Sin entregas en los últimos 7 días hábiles" : "Sin entregas en el periodo" } : false}
          height={280}
        >
          <ThroughputChart buckets={flow} unit={chartUnit} metric={metric} noun={noun} highlight={flowExtended ? range : undefined} theme={theme} />
        </ChartCard>

        <ChartCard
          title="¿En qué estado está el trabajo?"
          subtitle={`${Noun} del periodo según su estado actual`}
          icon={PieChart}
          legend={CATEGORIES.filter((c) => dist[c] > 0).map((c) => ({ label: labels[c], color: categoryColor(c, theme.dark), value: String(dist[c]) }))}
          summary={`Distribución de las ${noun} del periodo por estado.`}
          table={{ columns: ["Estado", Noun], rows: CATEGORIES.map((c) => [labels[c], dist[c]]) }}
          height={240}
        >
          <StateDonut counts={dist} labels={labels} noun={noun} theme={theme} />
        </ChartCard>

        <ChartCard
          className="xl:col-span-2"
          title="Evolución del estado del trabajo"
          subtitle={`Cuántas ${noun} había en cada estado al cierre de cada día hábil${extended ? " (últimos 7 días hábiles)" : ""}. Si la franja de cerradas crece, se está terminando trabajo; si la de en curso se ensancha, se está acumulando.`}
          icon={Layers}
          legend={(["Proposed", "InProgress", "Resolved", "Completed"] as const).map((c) => ({ label: labels[c], color: categoryColor(c, theme.dark) }))}
          summary={`Cantidad de ${noun} por estado al cierre de cada día hábil.`}
          table={{
            columns: ["Día hábil", ...CATEGORIES.map((c) => labels[c])],
            rows: cfd.map((d) => [bucketLabel(d.t, "day"), ...CATEGORIES.map((c) => d[c])]),
          }}
          height={300}
        >
          <CumulativeFlowChart series={cfd} labels={labels} theme={theme} />
        </ChartCard>

        <AttentionCard overdue={overdue} stale={stale} noun={noun} onOpen={openWorkItem} />
      </div>
    </div>
  );
}

type Tile = {
  label: string;
  icon: typeof CheckCircle2;
  value: React.ReactNode;
  hint: string;
  info: string;
  delta: { value: number; suffix: string; unit?: string; invert?: boolean } | null;
  spark?: number[];
  tone?: "critical";
};

/** Cambio porcentual frente al periodo de comparación (null si no hay base). */
function change(current: number, previous: number) {
  if (!previous) return null;
  return { value: ((current - previous) / previous) * 100, suffix: " %" };
}

function KpiTile({ tile: t, index, comparison, theme }: { tile: Tile; index: number; comparison: string | null; theme: ReturnType<typeof useChartTheme> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={clsx("card group relative overflow-hidden p-4", t.tone === "critical" && "border-critical/40")}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-accent-soft opacity-70 blur-2xl transition-transform duration-500 group-hover:scale-125" />
      <div className="relative flex items-start justify-between gap-2">
        <p className="flex items-center gap-1 text-xs font-medium text-muted">
          {t.label}
          <span className="inline-grid size-4 cursor-help place-items-center text-subtle" title={t.info} aria-label={t.info} role="img">
            <Info className="size-3.5" />
          </span>
        </p>
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
      {t.delta && comparison && (
        <div className="relative mt-2 flex min-h-5 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <Delta {...t.delta} />
          <span className="text-[0.6875rem] text-subtle">{comparison}</span>
        </div>
      )}
      {t.spark && t.spark.length > 1 && (
        <div className="relative -mx-1 mt-1 h-8">
          <Sparkline values={t.spark} color={theme.accent} theme={theme} />
        </div>
      )}
    </motion.div>
  );
}

/** "12 % más" / "8 % menos" / "igual", con color de estado e ícono. */
function Delta({ value, suffix, unit, invert = false }: { value: number; suffix: string; unit?: string; invert?: boolean }) {
  const rounded = Math.round(value);
  const tone: StatusTone = rounded === 0 ? "neutral" : rounded > 0 !== invert ? "good" : "critical";
  const Icon = rounded === 0 ? Minus : rounded > 0 ? TrendingUp : TrendingDown;
  const amount = `${Math.abs(rounded)}${unit ? ` ${unit}` : suffix}`;
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
      {rounded === 0 ? "Igual" : `${amount} ${rounded > 0 ? "más" : "menos"}`}
    </span>
  );
}

/** "Requiere atención": atrasadas y trabajo sin movimiento, con su explicación. */
function AttentionCard({
  overdue: od,
  stale,
  noun,
  onOpen,
}: {
  overdue: Item[];
  stale: { item: Item; ageDays: number }[];
  noun: string;
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
          <h3 className="font-display text-[0.9375rem] font-semibold leading-tight">Requiere atención</h3>
          <p className="mt-0.5 text-xs text-muted">
            {noun.charAt(0).toUpperCase() + noun.slice(1)} atrasadas y en curso sin moverse hace más de {STALE_DAYS} días hábiles. Clic para ver el detalle.
          </p>
        </div>
      </header>
      <div className="scrollbar-thin mt-3 max-h-[22rem] flex-1 space-y-3 overflow-y-auto">
        {od.length === 0 && stale.length === 0 && (
          <EmptyState variant="done" title="Nada pendiente de atención" description={`No hay ${noun} atrasadas ni estancadas.`} className="border-none bg-transparent py-6" />
        )}
        {od.length > 0 && (
          <div>
            <p className="px-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-critical-fg">Atrasadas ({od.length})</p>
            {od.slice(0, 10).map((i) => (
              <button key={`o${i.id}`} onClick={() => onOpen(i.id)} className="flex w-full items-start gap-2.5 rounded-xl p-2 text-left transition hover:bg-surface-2">
                <span className="mt-0.5 whitespace-nowrap rounded-md bg-critical-soft px-1.5 py-0.5 text-[0.6875rem] font-bold tabular-nums text-critical-fg" title="Días desde la fecha objetivo">
                  {Math.ceil(i.delayDays)} d tarde
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem]">{i.title}</span>
                  <span className="flex items-center gap-1.5 text-[0.6875rem] text-subtle">
                    <TypeBadge type={i.type} /> #{i.id} · {person(i.personKey)} · {i.state}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
        {stale.length > 0 && (
          <div>
            <p className="px-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-warning-fg">Sin movimiento ({stale.length})</p>
            {stale.slice(0, 8).map(({ item: i, ageDays }) => (
              <button key={`s${i.id}`} onClick={() => onOpen(i.id)} className="flex w-full items-start gap-2.5 rounded-xl p-2 text-left transition hover:bg-surface-2">
                <span className="mt-0.5 whitespace-nowrap rounded-md bg-warning-soft px-1.5 py-0.5 text-[0.6875rem] font-bold tabular-nums text-warning-fg" title="Días hábiles en el mismo estado">
                  {ageDays} d hábiles
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem]">{i.title}</span>
                  <span className="flex items-center gap-1.5 text-[0.6875rem] text-subtle">
                    <TypeBadge type={i.type} /> #{i.id} · {person(i.personKey)} · sigue en {i.state}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {(od.length > 10 || stale.length > 8) && (
        <p className="mt-2 border-t border-line pt-2 text-[0.6875rem] text-subtle">Se muestran las primeras; la lista completa está en el Cronograma (filtro &quot;solo con retraso&quot;).</p>
      )}
    </section>
  );
}
