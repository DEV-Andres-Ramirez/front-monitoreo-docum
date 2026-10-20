"use client";

import clsx from "clsx";
import { Activity, BarChart3, CalendarRange, CheckCircle2, Clock, Gauge, Layers, Minus, PieChart, Plus, TrendingDown, TrendingUp, Users } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { orderTypes, topFeatures, typeColor, FeatureBars, TypeDonut } from "@/components/charts/azure-charts";
import { ChartCard } from "@/components/charts/chart-card";
import { hoursLabel, useChartTheme } from "@/components/charts/chart-theme";
import { CoverageChart, DailyHoursChart, MemberHoursChart, Sparkline, plottedDays } from "@/components/charts/hours-charts";
import { fetcher } from "@/components/dashboard/client-api";
import { useApp } from "@/components/shell/app-provider";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { useUiScale } from "@/components/ui/display";
import { Avatar, Button, EmptyState, ProgressRing, Segmented, Skeleton, type StatusTone } from "@/components/ui/primitives";
import { addDaysISO, formatDayMonth, formatHours, formatShort } from "@/lib/dates";
import type { StatsResponse } from "@/lib/types";
import { typeMeta } from "@/lib/work-item-types";

type Range = "14" | "28" | "90";
const RANGES: { value: Range; label: string }[] = [
  { value: "14", label: "2 sem" },
  { value: "28", label: "4 sem" },
  { value: "90", label: "3 meses" },
];

export function OverviewView() {
  const { projectKey, date, setDate, openMemberById } = useApp();
  const [range, setRange] = useState<Range>("14");
  const from = addDaysISO(date, -(Number(range) - 1));
  const { data: raw, isLoading } = useSWR<StatsResponse>(`/api/projects/${projectKey}/stats?from=${from}&to=${date}`, fetcher, { keepPreviousData: true });
  const stats = raw?.projectKey === projectKey ? raw : undefined;
  const theme = useChartTheme(projectKey);
  const scale = useUiScale();

  const days = useMemo(() => (stats ? plottedDays(stats.daily) : []), [stats]);
  const memberRows = useMemo(() => (stats?.byMember ?? []).filter((m) => m.expected > 0 || m.hours > 0), [stats]);
  const features = useMemo(() => topFeatures(stats?.byFeature ?? []), [stats]);
  const types = useMemo(() => orderTypes(stats?.byType ?? []), [stats]);
  const noData = stats && stats.totals.hours === 0;
  const rangeLabel = stats ? `${formatShort(stats.from)} – ${formatShort(stats.to)}` : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <CalendarRange className="size-4" />
          Periodo de análisis <b className="font-semibold text-foreground">{rangeLabel || "…"}</b>
        </div>
        <Segmented size="sm" value={range} onChange={setRange} options={RANGES} />
      </div>

      <KpiRow stats={stats} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Horas diarias vs. capacidad esperada"
          subtitle="Clic en una barra para ir a ese día"
          icon={BarChart3}
          loading={!stats && isLoading}
          empty={noData ? { title: "Aún no hay horas registradas", description: "Las barras aparecerán a medida que registres actividades." } : false}
          legend={[
            { label: "Horas registradas", color: theme.accent, value: stats ? formatHours(stats.totals.hours) : undefined },
            { label: "Capacidad esperada", color: theme.reference, dashed: true, value: stats ? formatHours(stats.totals.expected) : undefined },
          ]}
          summary={`Horas registradas por día frente a la capacidad esperada entre ${rangeLabel}.`}
          table={{
            columns: ["Día", "Registradas", "Esperadas", "Cumplimiento"],
            rows: days.map((d) => [formatDayMonth(d.date), formatHours(d.hours), formatHours(d.expected), d.expected ? `${Math.round((d.hours / d.expected) * 100)} %` : "—"]),
          }}
          height={280}
        >
          {stats && <DailyHoursChart daily={stats.daily} theme={theme} selected={date} onSelect={setDate} />}
        </ChartCard>

        <ChartCard
          title="Cobertura de reporte"
          subtitle="% del equipo que reportó cada día hábil"
          icon={Users}
          loading={!stats && isLoading}
          empty={noData ? { title: "Sin reportes en el periodo" } : false}
          legend={[
            { label: "Cobertura", color: theme.accent },
            { label: "Meta 100 %", color: theme.reference, dashed: true },
          ]}
          summary="Porcentaje de colaboradores que reportaron actividad por día hábil."
          table={{
            columns: ["Día", "Reportaron", "Debían", "Cobertura"],
            rows: (stats?.daily ?? []).filter((d) => d.businessDay && d.due).map((d) => [formatDayMonth(d.date), d.reported, d.due, `${Math.round((d.reported / d.due) * 100)} %`]),
          }}
          height={280}
        >
          {stats && <CoverageChart daily={stats.daily} theme={theme} />}
        </ChartCard>

        <ChartCard
          className="xl:col-span-2"
          title="Horas por colaborador"
          subtitle="Barra: registradas · pista gris: capacidad según % asignado. Clic para ver detalle."
          icon={Gauge}
          loading={!stats && isLoading}
          legend={[
            { label: "Horas registradas", color: theme.accent },
            { label: "Capacidad del periodo", color: theme.track },
          ]}
          summary="Horas registradas por cada colaborador frente a su capacidad en el periodo."
          table={{
            columns: ["Colaborador", "Registradas", "Capacidad", "Días reportados"],
            rows: memberRows.map((m) => [m.name, formatHours(m.hours), formatHours(m.expected), m.daysReported]),
          }}
          height={360}
        >
          {stats && (
            <div className="scrollbar-thin h-full overflow-y-auto pr-1">
              <div style={{ height: Math.max(memberRows.length * 28 + 40, 320) * scale }}>
                <MemberHoursChart rows={memberRows} theme={theme} onSelect={(id) => openMemberById(id)} />
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Horas por tipo de ítem"
          subtitle="Distribución en el backlog de Azure"
          icon={PieChart}
          loading={!stats && isLoading}
          empty={noData ? { title: "Sin horas por distribuir" } : false}
          legend={types
            .filter((t) => t.hours > 0)
            .map((t) => ({
              label: typeMeta(t.type).plural,
              color: typeColor(t.type, theme),
              value: `${formatHours(t.hours)} · ${stats?.totals.hours ? Math.round((t.hours / stats.totals.hours) * 100) : 0} %`,
            }))}
          summary="Distribución de horas por tipo de work item de Azure DevOps."
          table={{
            columns: ["Tipo", "Horas", "Actividades"],
            rows: types.map((t) => [typeMeta(t.type).plural, formatHours(t.hours), t.activities]),
          }}
          height={260}
        >
          {stats && <TypeDonut slices={stats.byType} theme={theme} />}
        </ChartCard>

        <ChartCard
          className="xl:col-span-2"
          title="Horas por Feature"
          subtitle={stats && !stats.azureOk ? "Azure no respondió: no se pudo agrupar por Feature" : "Épicas monitoreadas · top 8"}
          icon={Layers}
          loading={!stats && isLoading}
          empty={noData ? { title: "Sin horas por Feature" } : false}
          summary="Horas registradas agrupadas por Feature de Azure DevOps."
          table={{ columns: ["Feature", "Horas"], rows: features.map((f) => [f.title, formatHours(f.hours)]) }}
          height={Math.max(features.length * 34 + 30, 200)}
        >
          {stats && <FeatureBars rows={features} theme={theme} />}
        </ChartCard>

        <PendingCard />
      </div>

      {!stats && !isLoading && <Skeleton className="h-40" />}
    </div>
  );
}

// ------------------------------------------------------------------ KPIs
function Delta({ value, suffix = "%", invert = false }: { value: number | null; suffix?: string; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-[0.6875rem] text-subtle">sin referencia</span>;
  const rounded = Math.round(value);
  const tone: StatusTone = rounded === 0 ? "neutral" : rounded > 0 !== invert ? "good" : "critical";
  const Icon = rounded === 0 ? Minus : rounded > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums",
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

function KpiRow({ stats }: { stats?: StatsResponse }) {
  const { teamData, date, projectKey } = useApp();
  const theme = useChartTheme(projectKey);
  const day = stats?.daily.find((d) => d.date === date);
  const lastWeek = stats?.daily.find((d) => d.date === addDaysISO(date, -7));
  const businessDays = stats?.daily.filter((d) => d.businessDay && d.due > 0) ?? [];
  const prevBusiness = businessDays.filter((d) => d.date < date).at(-1);

  const dayHours = teamData?.totals.dayHours ?? 0;
  const dayExpected = teamData?.totals.dayExpected ?? 0;
  const due = teamData?.totals.due ?? 0;
  const reported = teamData ? teamData.members.filter((m) => m.inRange && m.dayHours > 0).length : 0;
  const coverage = due ? reported / due : 0;
  const prevCoverage = prevBusiness?.due ? prevBusiness.reported / prevBusiness.due : null;

  const totals = stats?.totals;
  const compliance = totals?.expected ? totals.hours / totals.expected : 0;
  const prevCompliance = totals?.prevExpected ? totals.prevHours / totals.prevExpected : null;

  const cards = [
    {
      label: "Horas del día",
      icon: Clock,
      value: <AnimatedNumber value={dayHours} decimals={2} suffix=" h" />,
      hint: teamData?.isBusinessDay ? `de ${formatHours(dayExpected)} esperadas` : "Fin de semana",
      delta: lastWeek && day ? <Delta value={lastWeek.hours ? ((day.hours - lastWeek.hours) / lastWeek.hours) * 100 : null} /> : null,
      deltaLabel: "vs. mismo día semana pasada",
      spark: stats?.daily.filter((d) => d.businessDay || d.hours > 0).map((d) => d.hours),
    },
    {
      label: "Cobertura del día",
      icon: Users,
      value: <AnimatedNumber value={Math.round(coverage * 100)} suffix=" %" />,
      hint: teamData?.isBusinessDay ? `${reported} de ${due} reportaron` : "No se exige reporte",
      delta: prevCoverage !== null && teamData?.isBusinessDay ? <Delta value={(coverage - prevCoverage) * 100} suffix=" pp" /> : null,
      deltaLabel: "vs. día hábil anterior",
      spark: businessDays.map((d) => (d.reported / d.due) * 100),
    },
    {
      label: "Horas del periodo",
      icon: Activity,
      value: <AnimatedNumber value={totals?.hours ?? 0} decimals={1} suffix=" h" />,
      hint: `${totals?.activities ?? 0} actividades registradas`,
      delta: totals ? <Delta value={totals.prevHours ? ((totals.hours - totals.prevHours) / totals.prevHours) * 100 : null} /> : null,
      deltaLabel: "vs. periodo anterior",
      spark: stats?.daily.filter((d) => d.businessDay || d.hours > 0).reduce<number[]>((acc, d) => [...acc, (acc.at(-1) ?? 0) + d.hours], []),
    },
    {
      label: "Cumplimiento del periodo",
      icon: CheckCircle2,
      value: <AnimatedNumber value={Math.round(compliance * 100)} suffix=" %" />,
      hint: totals ? `${formatHours(totals.hours)} de ${formatHours(totals.expected)}` : "",
      delta: totals ? <Delta value={prevCompliance !== null ? (compliance - prevCompliance) * 100 : null} suffix=" pp" /> : null,
      deltaLabel: "vs. periodo anterior",
      ring: compliance,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -3 }}
          className="card group relative overflow-hidden p-4 sm:p-5"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-accent-soft opacity-70 blur-2xl transition-transform duration-500 group-hover:scale-125" />
          <div className="relative flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-muted sm:text-[0.8125rem]">{c.label}</p>
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-brand-sky text-white shadow-md shadow-accent/25">
              <c.icon className="size-4" />
            </span>
          </div>
          <div className="relative mt-2 flex items-end justify-between gap-2">
            <p className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[1.875rem]">{teamData || stats ? c.value : "—"}</p>
            {c.ring !== undefined && <ProgressRing value={c.ring} size={40} />}
          </div>
          <p className="relative mt-0.5 truncate text-[0.6875rem] text-muted sm:text-xs">{c.hint}</p>
          <div className="relative mt-3 flex items-center gap-2">
            {c.delta}
            {c.delta && <span className="hidden truncate text-[0.6875rem] text-subtle sm:inline">{c.deltaLabel}</span>}
          </div>
          {c.spark && c.spark.length > 1 && (
            <div className="relative -mx-1 mt-2 h-9">
              <Sparkline values={c.spark} color={theme.accent} theme={theme} />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Pendientes
function PendingCard() {
  const { teamData, date, openRegister, openMember } = useApp();
  const pending = teamData ? teamData.members.filter((m) => m.inRange && m.dayHours === 0) : [];

  return (
    <section className="card flex flex-col p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[0.9375rem] font-semibold">Pendientes del día</h3>
          <p className="text-xs capitalize text-muted">{formatDayMonth(date)}</p>
        </div>
        {teamData?.isBusinessDay && pending.length > 0 && (
          <span className="rounded-full bg-warning-soft px-2 py-1 text-[0.6875rem] font-bold text-warning-fg">{pending.length} sin registro</span>
        )}
      </header>
      <div className="scrollbar-thin mt-3 max-h-[18.75rem] flex-1 space-y-1 overflow-y-auto">
        {!teamData ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)
        ) : !teamData.isBusinessDay ? (
          <EmptyState variant="done" title="Fin de semana" description="No se exige reporte; puedes registrar si hubo trabajo." className="border-none bg-transparent py-6" />
        ) : pending.length === 0 ? (
          <EmptyState variant="done" title="¡Todo el equipo reportó!" description="Cobertura completa para este día." className="border-none bg-transparent py-6" />
        ) : (
          pending.map((m, i) => (
            <motion.div
              key={m.employeeId}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.03 }}
              className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-surface-2"
            >
              <button onClick={() => openMember(m)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Avatar name={m.name} size="sm" status="warning" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{m.name}</span>
                  <span className="block truncate text-[0.6875rem] text-subtle">
                    {m.role} · {Math.round(m.allocation * 100)} %
                  </span>
                </span>
              </button>
              <Button
                size="sm"
                variant="ghost"
                icon={Plus}
                onClick={() => openRegister(m)}
                title={`Registrar actividad de ${m.name}`}
                aria-label={`Registrar actividad de ${m.name}`}
                className="w-8 px-0 text-accent-fg opacity-80 group-hover:opacity-100"
              />
            </motion.div>
          ))
        )}
      </div>
      <p className="mt-3 border-t border-line pt-3 text-[0.6875rem] text-subtle">
        Jornada esperada = 8 h × % asignado · {hoursLabel(teamData?.totals.dayExpected ?? 0)} hoy
      </p>
    </section>
  );
}
