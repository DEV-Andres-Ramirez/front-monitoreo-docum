"use client";

import clsx from "clsx";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, ArrowRight, Bug, CheckCircle2, ChevronDown, ClipboardCheck, ClipboardList, FolderTree, Layers, ListChecks, Search, TrendingUp, UserX, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { useChartTheme } from "@/components/charts/chart-theme";
import { ComplianceTrendChart } from "@/components/charts/compliance-charts";
import { bucketLabel } from "@/components/charts/flow-charts";
import { useApp } from "@/components/shell/app-provider";
import { Avatar, Chip, EmptyState, HealthBadge, NoGlobalBadge, PersonBadges, Segmented, Skeleton } from "@/components/ui/primitives";
import { useTheme } from "@/components/ui/theme";
import {
  BUG_STAGE_LABEL,
  HU_STAGE_LABEL,
  STAGES,
  TASK_STAGE_LABEL,
  type ComplianceAnalysis,
  type ComplianceItem,
  type GroupRow,
  type HuRow,
  type Stage,
  type TypeSummary,
} from "@/lib/analytics/compliance";
import type { Health } from "@/lib/analytics/health";
import { perPerson, scopedWork } from "@/lib/analytics/metrics";
import { normalizeText, type Assignee } from "@/lib/analytics/model";
import { categoryColor } from "@/lib/analytics/state-colors";
import { DatasetGate } from "./dataset-gate";
import { useCompliance } from "./use-compliance";

export const pctText = (v: number) => `${(Math.round(v * 1000) / 10).toLocaleString("es-CO")} %`;
const shortDate = (iso: string) => format(new Date(`${iso}T12:00:00`), "d MMM", { locale: es });

/** Vista "Cumplimiento": HU, Tareas y Bugs de las épicas monitoreadas — total, completados y % (hoy, Positiva). */
export function ComplianceView() {
  const { project } = useApp();
  if (!project.compliance) {
    return (
      <EmptyState
        variant="chart"
        title="El análisis de cumplimiento está disponible para Positiva SGDEA"
        description={`${project.name} tiene su propia meta de cierre en el Resumen.`}
        action={
          <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2">
            Ir al Resumen <ArrowRight className="size-4" />
          </Link>
        }
      />
    );
  }
  return (
    <DatasetGate>
      <Compliance />
    </DatasetGate>
  );
}

function Compliance() {
  const { analysis, error, openItem } = useCompliance();
  if (error) return <p className="card p-4 text-sm text-critical-fg">No se pudo cargar el cumplimiento: {error.message}</p>;
  if (!analysis) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }
  const withBugs = analysis.bugs !== null;
  return (
    <div className="space-y-5">
      <Header />
      <div className={clsx("grid grid-cols-1 gap-4", withBugs ? "md:grid-cols-2 2xl:grid-cols-3" : "lg:grid-cols-2")}>
        <TypeCard kind="hu" s={analysis.hu} withoutTasks={analysis.findings.huWithoutTasks.length} />
        <TypeCard kind="tasks" s={analysis.tasks} />
        {analysis.bugs && <TypeCard kind="bugs" s={analysis.bugs} className="md:col-span-2 2xl:col-span-1" />}
      </div>
      <Findings a={analysis} onOpen={openItem} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <FlowCard a={analysis} />
        <TrendCard a={analysis} kind="hu" />
        <TrendCard a={analysis} kind="tasks" />
      </div>
      {analysis.epics.length > 1 && (
        <GroupTable
          rows={analysis.epics}
          withBugs={withBugs}
          icon={Layers}
          title="Cumplimiento por épica"
          subtitle="HU, tareas y bugs completados sobre el total de cada épica monitoreada"
          label="Épica"
        />
      )}
      <GroupTable
        rows={analysis.features}
        withBugs={withBugs}
        icon={FolderTree}
        title="Cumplimiento por Feature"
        subtitle={`HU en producción y en QA o producción, y tareas${withBugs ? " y bugs" : ""} cerrados, sobre el total de cada Feature`}
        label="Feature"
      />
      <HuTable rows={analysis.hus} onOpen={openItem} />
      <PeopleTable rows={analysis.people} withBugs={withBugs} />
    </div>
  );
}

// ------------------------------------------------------------------ Encabezado
function Header() {
  const { epics, sync, filters, project } = useApp();
  const shown = filters.epics.length ? epics.filter((e) => filters.epics.includes(e.id)) : epics;
  const what = project.compliance?.bug ? "HU, tareas y bugs" : "HU y tareas";
  return (
    <section className="card flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-fg">
          <ClipboardCheck className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-tight">Cumplimiento</h2>
          {shown.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Épicas incluidas">
              {shown.map((e) => (
                <li key={e.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-medium text-muted" title={`Épica #${e.id}`}>
                  <Layers className="size-3 text-accent-fg" />
                  {e.title}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 max-w-4xl text-xs text-muted">
            Cuenta <strong className="font-semibold text-foreground">todas</strong> las {what} de {shown.length === 1 ? "la épica" : "las épicas"}, de quien sean o sin asignar
            {filters.people.length > 0 && <> (filtrado por {filters.people.length} colaborador{filters.people.length === 1 ? "" : "es"})</>}. Una HU se cumple al llegar a producción; también
            se muestra cuántas ya se entregaron a QA. Una tarea {project.compliance?.bug ? "o un bug se cumple al cerrarse" : "se cumple al cerrarse"}.
          </p>
        </div>
      </div>
      {sync?.lastAt && (
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted" title={new Date(sync.lastAt).toLocaleString("es-CO")}>
          Datos de Azure {formatDistanceToNow(new Date(sync.lastAt), { locale: es, addSuffix: true })}
        </span>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ Piezas comunes
export function StageBar({ s, labels }: { s: TypeSummary; labels: Record<Stage, string> }) {
  const { resolved } = useTheme();
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={STAGES.map((st) => `${labels[st]}: ${s.byStage[st]}`).join(", ")}>
        {STAGES.filter((st) => s.byStage[st] > 0).map((st) => (
          <span key={st} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.byStage[st] / s.total) * 100}%`, background: categoryColor(st, resolved === "dark") }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {STAGES.filter((st) => s.byStage[st] > 0 || st === "Completed").map((st) => (
          <li key={st} className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full" style={{ background: categoryColor(st, resolved === "dark") }} />
            {labels[st]} <span className="font-semibold tabular-nums text-foreground">{s.byStage[st]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProgressBar({ value, color, className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={clsx("h-1.5 overflow-hidden rounded-full bg-surface-3", className)} role="presentation">
      <div className={clsx("h-full rounded-full", !color && "bg-accent")} style={{ width: `${Math.min(100, value * 100)}%`, background: color }} />
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "critical" | "warning" }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-2 px-3 py-2">
      <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-subtle">{label}</p>
      <p className={clsx("font-display text-lg font-semibold tabular-nums", tone === "critical" && "text-critical-fg", tone === "warning" && "text-warning-fg")}>{value}</p>
      {hint && <p className="truncate text-[0.6875rem] text-muted">{hint}</p>}
    </div>
  );
}

function AssigneeName({ a }: { a: Assignee }) {
  const { model } = useApp();
  if (a.kind === "sinAsignar") return <span className="italic text-subtle">Sin asignar</span>;
  const person = model?.people.get(a.key);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate">{a.name}</span>
      {person ? <PersonBadges person={person} /> : a.kind === "noGlobal" && <NoGlobalBadge />}
      {a.kind === "fuera" && (
        <span className="shrink-0 whitespace-nowrap rounded-md bg-surface-3 px-1.5 py-px text-[0.625rem] font-semibold uppercase tracking-wide text-muted" title="No es personal de Global de este proyecto">
          Fuera de Global
        </span>
      )}
    </span>
  );
}

// ------------------------------------------------------------------ Tarjetas por tipo
type Kind = "hu" | "tasks" | "bugs";
const KIND: Record<Kind, { title: string; icon: LucideIcon; done: string; qa: string | null; labels: Record<Stage, string> }> = {
  hu: { title: "Historias de usuario", icon: ClipboardList, done: "en producción", qa: "Entregadas a QA (o ya en producción)", labels: HU_STAGE_LABEL },
  tasks: { title: "Tareas", icon: ListChecks, done: "cerradas", qa: null, labels: TASK_STAGE_LABEL },
  bugs: { title: "Bugs", icon: Bug, done: "cerrados", qa: "En revisión QA (o ya cerrados)", labels: BUG_STAGE_LABEL },
};
const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function TypeCard({ kind, s, withoutTasks, className }: { kind: Kind; s: TypeSummary; withoutTasks?: number; className?: string }) {
  const { comparison } = useApp();
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const k = KIND[kind];
  const Icon = k.icon;
  return (
    <section className={clsx("card p-4 sm:p-5", className)}>
      <header className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent-fg">
            <Icon className="size-[1.125rem]" />
          </span>
          <span>
            <span className="block font-display text-[0.9375rem] font-semibold">{k.title}</span>
            <span className="block text-xs text-muted">{s.total.toLocaleString("es-CO")} en total</span>
          </span>
        </span>
        <span className="text-right">
          <span className="block font-display text-3xl font-semibold tabular-nums tracking-tight">{pctText(s.pctDone)}</span>
          <span className="block text-xs text-muted">{k.done} · cumplimiento</span>
        </span>
      </header>

      <div className="mt-4 space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">{capitalize(k.done)}</span>
          <span className="font-semibold tabular-nums">
            {s.done} de {s.total}
          </span>
        </div>
        <ProgressBar value={s.pctDone} color={categoryColor("Completed", dark)} className="h-2" />
        {k.qa && (
          <>
            <div className="flex items-baseline justify-between pt-1 text-sm">
              <span className="text-muted">{k.qa}</span>
              <span className="font-semibold tabular-nums">
                {s.qa} de {s.total} · {pctText(s.pctQa)}
              </span>
            </div>
            <ProgressBar value={s.pctQa} color={categoryColor("Resolved", dark)} className="h-2" />
          </>
        )}
      </div>

      <div className="mt-4">
        <StageBar s={s} labels={k.labels} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {kind === "bugs" ? (
          // Bugs: sin fechas (no son confiables): solo cantidades por estado
          <>
            <Stat label="Abiertos" value={s.total - s.done} hint="sin cerrar" />
            <Stat label={k.labels.Proposed} value={s.byStage.Proposed} />
            <Stat label={k.labels.InProgress} value={s.byStage.InProgress} />
            <Stat label={k.labels.Resolved} value={s.byStage.Resolved} hint="incluye devueltos y bloqueados" />
            <Stat label="Abiertos sin asignar" value={s.unassignedOpen} hint="nadie los tiene asignados" tone={s.unassignedOpen > 0 ? "warning" : undefined} />
            <Stat label="Cerrados" value={s.done} hint={`${pctText(s.pctDone)} del total`} />
          </>
        ) : (
          <>
            {kind === "hu" ? (
              <Stat label="En el periodo" value={`+${s.qaInPeriod} a QA · +${s.doneInPeriod} a prod.`} hint={comparison ? `${comparison}: +${s.qaInPrev} · +${s.doneInPrev}` : "desde el 19 oct"} />
            ) : (
              <Stat label={`${capitalize(k.done)} en el periodo`} value={`+${s.doneInPeriod}`} hint={comparison ? `${comparison}: +${s.doneInPrev}` : "desde el 19 oct"} />
            )}
            <Stat label={k.labels.InProgress} value={s.byStage.InProgress} />
            <Stat label={kind === "hu" ? "Por iniciar" : k.labels.Proposed} value={s.byStage.Proposed} />
            <Stat
              label="Atrasadas"
              value={s.overdue}
              hint={kind === "hu" ? "sin llegar a QA y con la fecha objetivo pasada" : "sin cerrar y con la fecha objetivo pasada"}
              tone={s.overdue > 0 ? "critical" : undefined}
            />
            {kind === "hu" ? (
              <Stat label="Sin tareas" value={withoutTasks ?? 0} hint="HU sin tareas creadas" tone={withoutTasks ? "warning" : undefined} />
            ) : (
              <Stat label="Pendientes sin asignar" value={s.unassignedOpen} hint="sin cerrar y sin responsable" tone={s.unassignedOpen > 0 ? "warning" : undefined} />
            )}
            {kind === "tasks" ? <Stat label="Cumplimiento" value={pctText(s.pctDone)} /> : <Stat label={k.labels.Resolved} value={s.byStage.Resolved} />}
          </>
        )}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ Puntos de atención
function Findings({ a, onOpen }: { a: ComplianceAnalysis; onOpen: (id: number) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = [
    { key: "ready", tone: "good" as const, icon: CheckCircle2, label: "HU con todas sus tareas cerradas que aún no pasan a QA", items: a.findings.readyForQa.map((r) => ({ item: r.item, who: r.assignee })) },
    { key: "noTasks", tone: "warning" as const, icon: ClipboardList, label: "HU sin tareas creadas", items: a.findings.huWithoutTasks.map((r) => ({ item: r.item, who: r.assignee })) },
    { key: "overdueHu", tone: "critical" as const, icon: AlertTriangle, label: "HU atrasadas (sin llegar a QA y con la fecha objetivo pasada)", items: a.findings.overdueHu.map((r) => ({ item: r.item, who: r.assignee })) },
    { key: "overdueTasks", tone: "critical" as const, icon: AlertTriangle, label: "Tareas atrasadas (sin cerrar y con la fecha objetivo pasada)", items: a.findings.overdueTasks.map((item) => ({ item, who: null })) },
    { key: "unassigned", tone: "warning" as const, icon: UserX, label: "Tareas sin asignar (pendientes)", items: a.findings.unassignedTasks.map((item) => ({ item, who: null })) },
    { key: "unassignedBugs", tone: "warning" as const, icon: Bug, label: "Bugs abiertos sin asignar", items: a.findings.unassignedBugs.map((item) => ({ item, who: null })) },
  ].filter((f) => f.items.length > 0);

  const tone = {
    good: "bg-good-soft text-good-fg",
    warning: "bg-warning-soft text-warning-fg",
    critical: "bg-critical-soft text-critical-fg",
  };
  return (
    <section className="card p-4 sm:p-5">
      <h3 className="font-display text-[0.9375rem] font-semibold">Puntos de atención</h3>
      <p className="mt-0.5 text-xs text-muted">Lo que frena el cumplimiento o se puede mover ya. Clic para ver los ítems.</p>
      {list.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-good-fg">
          <CheckCircle2 className="size-4" /> Sin alertas: todo lo pendiente tiene tareas, responsable y fecha vigente.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
          {list.map((f) => (
            <li key={f.key}>
              <button onClick={() => setOpen(open === f.key ? null : f.key)} aria-expanded={open === f.key} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-surface-2">
                <span className={clsx("grid size-8 shrink-0 place-items-center rounded-lg", tone[f.tone])}>
                  <f.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1 text-sm">{f.label}</span>
                <span className={clsx("rounded-full px-2 py-0.5 text-xs font-bold tabular-nums", tone[f.tone])}>{f.items.length}</span>
                <ChevronDown className={clsx("size-4 shrink-0 text-subtle transition-transform", open === f.key && "rotate-180")} />
              </button>
              {open === f.key && (
                <ul className="scrollbar-thin max-h-72 space-y-0.5 overflow-y-auto bg-surface-2/60 px-3 py-2">
                  {f.items.map(({ item, who }) => (
                    <li key={item.id}>
                      <button onClick={() => onOpen(item.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-surface-3">
                        <span className="font-mono text-subtle">#{item.id}</span>
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        {who && <span className="hidden max-w-[14rem] text-muted sm:block">{who.kind === "sinAsignar" ? "Sin asignar" : who.name}</span>}
                        {item.target && <span className="shrink-0 tabular-nums text-subtle">obj. {shortDate(item.target)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ Flujo por etapa
function FlowCard({ a }: { a: ComplianceAnalysis }) {
  const { resolved } = useTheme();
  const [picked, setKind] = useState<Kind>("hu");
  const kind = picked === "bugs" && !a.bugs ? "hu" : picked;
  const s = kind === "hu" ? a.hu : kind === "tasks" ? a.tasks : a.bugs!;
  const labels = KIND[kind].labels;
  const stages = kind === "tasks" ? STAGES.filter((st) => st !== "Resolved" || s.byStage.Resolved > 0) : STAGES;
  const subtitle = {
    hu: "Dónde están las HU: levantamiento → desarrollo → QA → producción",
    tasks: "Dónde están las tareas",
    bugs: "Dónde están los bugs: nuevo → desarrollo → revisión QA → cerrado",
  };
  return (
    <ChartCard
      title="Flujo por etapa"
      subtitle={subtitle[kind]}
      icon={FolderTree}
      actions={
        <Segmented
          size="sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: "hu", label: "HU" },
            { value: "tasks", label: "Tareas" },
            ...(a.bugs ? [{ value: "bugs" as const, label: "Bugs" }] : []),
          ]}
        />
      }
      summary="Cantidad de ítems por etapa del flujo."
      table={{ columns: ["Estado en Azure", "Etapa", "Cantidad"], rows: s.states.map((st) => [st.state, labels[st.stage], st.count]) }}
      height={230}
    >
      <ul className="flex h-full flex-col justify-center gap-3">
        {stages.map((st) => {
          const n = s.byStage[st];
          return (
            <li key={st}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="font-medium text-foreground">{labels[st]}</span>
                <span className="tabular-nums text-muted">
                  <span className="font-semibold text-foreground">{n}</span> · {pctText(s.total ? n / s.total : 0)}
                </span>
              </div>
              <ProgressBar value={s.total ? n / s.total : 0} color={categoryColor(st, resolved === "dark")} className="h-2.5" />
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

// ------------------------------------------------------------------ Avance acumulado
function TrendCard({ a, kind }: { a: ComplianceAnalysis; kind: "hu" | "tasks" }) {
  const { projectKey, chartUnit, setChartUnit } = useApp();
  const theme = useChartTheme(projectKey);
  const hu = kind === "hu";
  const scopeOf = (p: ComplianceAnalysis["trend"][number]) => (hu ? p.huScope : p.taskScope);
  const doneOf = (p: ComplianceAnalysis["trend"][number]) => (hu ? p.huDone : p.taskDone);
  const noun = hu ? "HU" : "tareas";
  return (
    <ChartCard
      title={`Avance acumulado · ${hu ? "HU" : "Tareas"}`}
      subtitle={hu ? "Total frente a entregadas a QA y en producción" : `Total frente a ${KIND[kind].done}`}
      icon={TrendingUp}
      actions={
        <Segmented
          size="sm"
          value={chartUnit}
          onChange={setChartUnit}
          options={[
            { value: "day", label: "Días" },
            { value: "week", label: "Sem." },
          ]}
        />
      }
      legend={[
        { label: capitalize(KIND[kind].done), color: categoryColor("Completed", theme.dark) },
        ...(hu ? [{ label: "En QA o producción", color: categoryColor("Resolved", theme.dark) }] : []),
        { label: "Total", color: theme.reference, dashed: true },
      ]}
      summary={`Avance acumulado de ${noun} frente al total.`}
      table={{
        columns: [chartUnit === "day" ? "Día hábil" : "Semana", "Total", ...(hu ? ["En QA o producción", "En producción"] : [capitalize(KIND[kind].done)]), "Cumplimiento"],
        rows: a.trend.map((p) => {
          const total = scopeOf(p);
          const done = doneOf(p);
          return [bucketLabel(p.start, chartUnit), total, ...(hu ? [p.huQa, p.huDone] : [done]), pctText(total ? done / total : 0)];
        }),
      }}
      height={230}
    >
      <ComplianceTrendChart trend={a.trend} kind={kind} unit={chartUnit} theme={theme} />
    </ChartCard>
  );
}

// ------------------------------------------------------------------ Por épica / por Feature
function ClosedCell({ done, total, dark, empty = "—" }: { done: number; total: number; dark: boolean; empty?: string }) {
  if (!total) return <span className="text-xs text-subtle">{empty}</span>;
  return (
    <div className="flex items-center gap-3">
      <ProgressBar value={done / total} color={categoryColor("Completed", dark)} className="w-28 shrink-0 xl:w-36" />
      <span className="whitespace-nowrap text-xs tabular-nums text-muted">
        <span className="font-semibold text-foreground">{done}</span> de {total} · {pctText(done / total)}
      </span>
    </div>
  );
}

function GroupTable({ rows, withBugs, icon: Icon, title, subtitle, label }: { rows: GroupRow[]; withBugs: boolean; icon: LucideIcon; title: string; subtitle: string; label: string }) {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-fg">
          <Icon className="size-[1.125rem]" />
        </span>
        <div>
          <h3 className="font-display text-[0.9375rem] font-semibold">{title}</h3>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
      </header>
      <div className="scrollbar-thin overflow-x-auto">
        <table className={clsx("w-full text-sm", withBugs ? "min-w-[62rem]" : "min-w-[44rem]")}>
          <thead className="bg-surface-2 text-[0.6875rem] uppercase tracking-wider text-subtle">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">{label}</th>
              <th className="px-3 py-2.5 text-left font-semibold">HU (en producción · en QA o más)</th>
              <th className="px-3 py-2.5 text-left font-semibold">Tareas cerradas</th>
              {withBugs && <th className="px-3 py-2.5 text-left font-semibold">Bugs cerrados</th>}
              <th className="px-4 py-2.5 text-right font-semibold" title="Sin cumplir y con la fecha objetivo pasada (los bugs no cuentan: sus fechas no son confiables)">Atrasadas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{r.label}</td>
                <td className="px-3 py-3">
                  {r.hu.total === 0 ? (
                    <span className="text-xs text-subtle">—</span>
                  ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-28 shrink-0 space-y-1 xl:w-36">
                      <ProgressBar value={r.hu.total ? r.hu.done / r.hu.total : 0} color={categoryColor("Completed", dark)} />
                      <ProgressBar value={r.hu.total ? r.hu.qa / r.hu.total : 0} color={categoryColor("Resolved", dark)} />
                    </div>
                    <span className="whitespace-nowrap text-xs tabular-nums text-muted">
                      <span className="font-semibold text-foreground">{r.hu.done}</span> · {r.hu.qa} de {r.hu.total}
                    </span>
                  </div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <ClosedCell done={r.tasks.done} total={r.tasks.total} dark={dark} />
                </td>
                {withBugs && (
                  <td className="px-3 py-3">
                    <ClosedCell done={r.bugs.done} total={r.bugs.total} dark={dark} />
                  </td>
                )}
                <td className={clsx("px-4 py-3 text-right font-semibold tabular-nums", r.overdue > 0 && "text-critical-fg")}>{r.overdue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ Por HU
type HuFilter = "all" | "noTasks" | "pending" | "complete" | "overdue";
type HuSort = "pctAsc" | "pctDesc" | "stage" | "id";
const STAGE_ORDER: Record<Stage, number> = { Proposed: 0, InProgress: 1, Resolved: 2, Completed: 3 };

function StagePill({ item }: { item: ComplianceItem }) {
  const { resolved } = useTheme();
  const stage = (item.cat === "Removed" ? "Proposed" : item.cat) as Stage;
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 text-xs" title={`${HU_STAGE_LABEL[stage]} · estado en Azure: ${item.state ?? "—"}`}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: categoryColor(stage, resolved === "dark") }} />
      <span className="truncate">{item.state ?? HU_STAGE_LABEL[stage]}</span>
    </span>
  );
}

function TasksProgress({ r }: { r: HuRow }) {
  const { resolved } = useTheme();
  if (!r.tasksTotal) return <span className="text-xs italic text-subtle">Sin tareas</span>;
  return (
    <div className="flex items-center gap-2.5">
      <ProgressBar value={r.pct ?? 0} color={categoryColor("Completed", resolved === "dark")} className="w-24" />
      <span className="whitespace-nowrap text-xs tabular-nums text-muted">
        <span className="font-semibold text-foreground">{r.tasksDone}</span>/{r.tasksTotal} · {pctText(r.pct ?? 0)}
      </span>
    </div>
  );
}

function HuTable({ rows, onOpen }: { rows: HuRow[]; onOpen: (id: number) => void }) {
  const [filter, setFilter] = useState<HuFilter>("all");
  const [sort, setSort] = useState<HuSort>("pctAsc");
  const [query, setQuery] = useState("");
  const counts: Record<HuFilter, number> = {
    all: rows.length,
    noTasks: rows.filter((r) => r.tasksTotal === 0).length,
    pending: rows.filter((r) => r.tasksTotal > 0 && r.tasksDone < r.tasksTotal).length,
    complete: rows.filter((r) => r.tasksTotal > 0 && r.tasksDone === r.tasksTotal).length,
    overdue: rows.filter((r) => r.overdue).length,
  };
  const visible = useMemo(() => {
    const q = normalizeText(query.replace(/^#/, ""));
    const keep = rows.filter((r) => {
      if (filter === "noTasks" && r.tasksTotal !== 0) return false;
      if (filter === "pending" && !(r.tasksTotal > 0 && r.tasksDone < r.tasksTotal)) return false;
      if (filter === "complete" && !(r.tasksTotal > 0 && r.tasksDone === r.tasksTotal)) return false;
      if (filter === "overdue" && !r.overdue) return false;
      return !q || String(r.item.id).includes(q) || normalizeText(`${r.item.title ?? ""} ${r.assignee.name} ${r.feature?.title ?? ""}`).includes(q);
    });
    const stageOf = (r: HuRow) => STAGE_ORDER[(r.item.cat === "Removed" ? "Proposed" : r.item.cat) as Stage];
    return keep.sort((x, y) => {
      if (sort === "id") return x.item.id - y.item.id;
      if (sort === "stage") return stageOf(y) - stageOf(x) || (y.pct ?? -1) - (x.pct ?? -1);
      // Las HU sin tareas van al final (tienen su propio filtro)
      if (x.pct === null || y.pct === null) return Number(x.pct === null) - Number(y.pct === null) || x.item.id - y.item.id;
      return sort === "pctAsc" ? x.pct - y.pct || x.item.id - y.item.id : y.pct - x.pct || x.item.id - y.item.id;
    });
  }, [rows, filter, sort, query]);

  const FILTERS: { key: HuFilter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "pending", label: "Con tareas pendientes" },
    { key: "complete", label: "Tareas completas" },
    { key: "noTasks", label: "Sin tareas" },
    { key: "overdue", label: "Atrasadas" },
  ];

  return (
    <section className="card overflow-hidden">
      <header className="space-y-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent-fg">
              <ClipboardList className="size-[1.125rem]" />
            </span>
            <div>
              <h3 className="font-display text-[0.9375rem] font-semibold">Cumplimiento por HU</h3>
              <p className="text-xs text-muted">Avance de cada HU según sus tareas cerradas (todas las tareas de la HU, de quien sean)</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            Ordenar por
            <select value={sort} onChange={(e) => setSort(e.target.value as HuSort)} className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-foreground">
              <option value="pctAsc">menor avance</option>
              <option value="pctDesc">mayor avance</option>
              <option value="stage">etapa</option>
              <option value="id">número</option>
            </select>
          </label>
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por #, título, persona o feature"
              className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm outline-none transition placeholder:text-subtle focus:border-accent focus:ring-4 focus:ring-accent/10 focus-visible:outline-none"
            />
          </div>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {FILTERS.map((f) => (
              <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} count={counts[f.key]}>
                {f.label}
              </Chip>
            ))}
          </div>
        </div>
      </header>

      {visible.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">Sin HU para este filtro.</p>
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className="scrollbar-thin hidden max-h-[36rem] overflow-auto md:block">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface-2 text-[0.6875rem] uppercase tracking-wider text-subtle">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">HU</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Etapa</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Asignado</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Tareas cerradas</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Objetivo</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.item.id} onClick={() => onOpen(r.item.id)} className="cursor-pointer border-t border-line transition-colors hover:bg-surface-2">
                    <td className="max-w-[28rem] px-4 py-2.5">
                      <p className="flex min-w-0 items-center gap-2">
                        <span className="font-mono text-[0.6875rem] text-subtle">#{r.item.id}</span>
                        <span className="truncate font-medium">{r.item.title}</span>
                        {r.readyForQa && <span className="shrink-0 rounded-md bg-good-soft px-1.5 py-px text-[0.625rem] font-semibold text-good-fg">Lista para QA</span>}
                      </p>
                      {r.feature && <p className="truncate text-[0.6875rem] text-subtle">{r.feature.title}</p>}
                    </td>
                    <td className="max-w-[12rem] px-3 py-2.5">
                      <StagePill item={r.item} />
                    </td>
                    <td className="max-w-[16rem] px-3 py-2.5 text-xs">
                      <AssigneeName a={r.assignee} />
                    </td>
                    <td className="px-3 py-2.5">
                      <TasksProgress r={r} />
                    </td>
                    <td className={clsx("px-4 py-2.5 text-right text-xs tabular-nums", r.overdue ? "font-semibold text-critical-fg" : "text-muted")}>
                      {r.item.target ? shortDate(r.item.target) : "—"}
                      {r.overdue && <span className="block text-[0.625rem] font-semibold uppercase">atrasada</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Móvil: tarjetas */}
          <ul className="divide-y divide-line md:hidden">
            {visible.map((r) => (
              <li key={r.item.id}>
                <button onClick={() => onOpen(r.item.id)} className="w-full space-y-2 px-4 py-3 text-left">
                  <p className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="font-mono text-[0.6875rem] text-subtle">#{r.item.id}</span>
                    <span className="truncate font-medium">{r.item.title}</span>
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <StagePill item={r.item} />
                    <span className={clsx("tabular-nums", r.overdue ? "font-semibold text-critical-fg" : "text-muted")}>
                      {r.item.target ? `obj. ${shortDate(r.item.target)}` : "sin objetivo"}
                      {r.overdue && " · atrasada"}
                    </span>
                  </div>
                  <TasksProgress r={r} />
                  <div className="text-xs text-muted">
                    <AssigneeName a={r.assignee} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ Por persona
function PeopleTable({ rows, withBugs }: { rows: (GroupRow & { assignee: Assignee })[]; withBugs: boolean }) {
  const { model, openPerson } = useApp();
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  // Semáforo del periodo medido con tareas (los tres mundos se ven aquí juntos), por la misma clave de persona
  const { people, filters, range } = useApp();
  const health = useMemo(() => {
    if (!model) return new Map<string, Health>();
    const tasks = scopedWork(model, { ...filters, types: ["Task"] });
    return new Map<string, Health>(perPerson(people, tasks, range, model.now).map((r) => [r.person.key, r.health]));
  }, [model, people, filters, range]);
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent-fg">
          <Users className="size-[1.125rem]" />
        </span>
        <div>
          <h3 className="font-display text-[0.9375rem] font-semibold">Cumplimiento por persona</h3>
          <p className="text-xs text-muted">
            HU, tareas{withBugs ? " y bugs" : ""} asignados a cada persona y cuántos ha cumplido · el semáforo se mide con sus tareas en el periodo elegido
          </p>
        </div>
      </header>
      <div className="scrollbar-thin overflow-x-auto">
        <table className={clsx("w-full text-sm", withBugs ? "min-w-[66rem]" : "min-w-[56rem]")}>
          <thead className="bg-surface-2 text-[0.6875rem] uppercase tracking-wider text-subtle">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">Persona</th>
              <th className="px-3 py-2.5 text-left font-semibold">Semáforo (tareas)</th>
              <th className="px-3 py-2.5 text-right font-semibold">HU</th>
              <th className="px-3 py-2.5 text-right font-semibold">En QA o más</th>
              <th className="px-3 py-2.5 text-right font-semibold">Producción</th>
              <th className="px-3 py-2.5 text-left font-semibold">Tareas cerradas</th>
              {withBugs && <th className="px-3 py-2.5 text-left font-semibold">Bugs cerrados</th>}
              <th className="px-4 py-2.5 text-right font-semibold" title="Sin cumplir y con la fecha objetivo pasada (los bugs no cuentan: sus fechas no son confiables)">Atrasadas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const h = health.get(r.key);
              const canOpen = r.assignee.kind !== "sinAsignar" && !!model?.people.has(r.key);
              return (
                <tr key={r.key} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => canOpen && openPerson(r.key)}
                      disabled={!canOpen}
                      className={clsx("flex max-w-[22rem] items-center gap-2.5 text-left", canOpen && "hover:underline")}
                    >
                      {r.assignee.kind !== "sinAsignar" && <Avatar name={r.assignee.name} size="xs" />}
                      <AssigneeName a={r.assignee} />
                    </button>
                  </td>
                  <td className="px-3 py-2.5">{h ? <HealthBadge level={h.level} reasons={h.reasons} size="sm" /> : <span className="text-xs text-subtle">—</span>}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.hu.total || "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.hu.total ? r.hu.qa : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.hu.total ? r.hu.done : "—"}</td>
                  {[r.tasks, ...(withBugs ? [r.bugs] : [])].map((g, i) => (
                    <td key={i} className="px-3 py-2.5">
                      {g.total ? (
                        <div className="flex items-center gap-2.5">
                          <ProgressBar value={g.done / g.total} color={categoryColor("Completed", dark)} className="w-24 shrink-0" />
                          <span className="whitespace-nowrap text-xs tabular-nums text-muted">
                            <span className="font-semibold text-foreground">{g.done}</span>/{g.total} · {pctText(g.done / g.total)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-subtle">—</span>
                      )}
                    </td>
                  ))}
                  <td className={clsx("px-4 py-2.5 text-right font-semibold tabular-nums", r.overdue > 0 && "text-critical-fg")}>{r.overdue}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end border-t border-line px-4 py-2">
        <Link href="/colaboradores" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground">
          Ver desempeño por colaborador <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
