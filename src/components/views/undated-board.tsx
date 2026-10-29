"use client";

import clsx from "clsx";
import { Bug, CalendarOff, ClipboardList, Layers, ListTree, Users, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { useApp } from "@/components/shell/app-provider";
import { Avatar, Button, EmptyState, NoGlobalBadge, PersonBadges, Skeleton } from "@/components/ui/primitives";
import { useTheme } from "@/components/ui/theme";
import { BUG_STAGE_LABEL, HU_STAGE_LABEL, STAGES, type ComplianceAnalysis, type ItemRow, type Stage } from "@/lib/analytics/compliance";
import type { Assignee } from "@/lib/analytics/model";
import { categoryColor } from "@/lib/analytics/state-colors";
import { pctText } from "./compliance-view";
import { useCompliance } from "./use-compliance";

/**
 * Mundos sin fechas de Positiva (HU y Bugs): solo cantidades y estado actual, sin periodo, atrasos,
 * entregas por día ni semáforo (decisión del usuario: solo las tareas se miden con tiempo). Datos:
 * /compliance (todos los ítems de las épicas, asignados o no), con los filtros de personas y épicas.
 */
export type UndatedKind = "hu" | "bugs";

const META: Record<
  UndatedKind,
  {
    title: string;
    noun: string;
    /** Concordancia: "las HU" / "los bugs" */
    the: string;
    o: "a" | "o";
    icon: LucideIcon;
    labels: Record<Stage, string>;
    hints: Record<Stage, string>;
    open: string;
    done: string;
    why: string;
  }
> = {
  hu: {
    title: "Historias de usuario",
    noun: "HU",
    the: "las",
    o: "a",
    icon: ClipboardList,
    labels: HU_STAGE_LABEL,
    hints: {
      Proposed: "pendiente de levantamiento, levantamiento o nueva",
      InProgress: "en desarrollo o esperando despliegue",
      Resolved: "backlog QA, pruebas QA o aprobación del cliente",
      Completed: "10. En producción",
    },
    open: "Sin terminar",
    done: "en producción",
    why: "Las HU se siguen por su estado, no por fechas: aquí se ve quién las tiene y en qué etapa van.",
  },
  bugs: {
    title: "Bugs",
    noun: "bugs",
    the: "los",
    o: "o",
    icon: Bug,
    labels: BUG_STAGE_LABEL,
    hints: {
      Proposed: "1. Nuevo",
      InProgress: "2. En desarrollo",
      Resolved: "3. Revisión QA, devuelto, bloqueado o certificado",
      Completed: "4. Cerrado",
    },
    open: "Abiertos",
    done: "cerrados",
    why: "Las fechas que llegan de Azure para los bugs no son confiables y generaban alertas falsas.",
  },
};

const rowsOf = (a: ComplianceAnalysis, kind: UndatedKind) => (kind === "hu" ? a.huItems : a.bugItems);
const statesOf = (a: ComplianceAnalysis, kind: UndatedKind) => (kind === "hu" ? a.hu.states : (a.bugs?.states ?? []));

/** Tablero de HU o bugs (Resumen de Positiva en esos mundos). */
export function UndatedBoard({ kind }: { kind: UndatedKind }) {
  const { analysis, error, openItem } = useCompliance();
  const m = META[kind];
  if (error) return <p className="card p-4 text-sm text-critical-fg">No se pudieron cargar {m.the} {m.noun}: {error.message}</p>;
  if (!analysis) return <Skeleton className="h-72 w-full rounded-2xl" />;
  const rows = rowsOf(analysis, kind);
  const states = statesOf(analysis, kind);
  return (
    <div className="space-y-5">
      <UndatedNote kind={kind} />
      {rows.length === 0 ? (
        <EmptyState variant="search" title={`Sin ${m.noun} para estos filtros`} description="Cambia la épica o los colaboradores elegidos." />
      ) : (
        <>
          <StageTiles kind={kind} rows={rows} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <StatesCard kind={kind} states={states} total={rows.length} />
            <GroupsCard kind={kind} rows={rows} epicLabels={new Map(analysis.epics.map((g) => [g.key, g.label]))} />
          </div>
          <ItemsByPerson kind={kind} rows={rows} />
          <OpenList kind={kind} rows={rows} onOpen={openItem} />
        </>
      )}
    </div>
  );
}

/** Aviso fijo: por qué aquí no hay fechas. */
export function UndatedNote({ kind }: { kind: UndatedKind }) {
  const m = META[kind];
  return (
    <section className="card flex items-start gap-3 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-info-soft text-info-fg">
        <CalendarOff className="size-[1.125rem]" />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-[0.9375rem] font-semibold leading-tight">{m.title} · estado actual</h2>
        <p className="mt-0.5 text-xs text-muted">
          {m.why} Por eso aquí no aplica el periodo ni hay atrasos ni semáforo: solo cantidades y estados de hoy. Sí aplican los filtros de épica y de colaboradores. Las métricas de tiempo
          están en Tareas.
        </p>
      </div>
    </section>
  );
}

function StageTiles({ kind, rows }: { kind: UndatedKind; rows: ItemRow[] }) {
  const { resolved } = useTheme();
  const m = META[kind];
  const dark = resolved === "dark";
  const total = rows.length;
  const byStage = Object.fromEntries(STAGES.map((st) => [st, rows.filter((r) => r.stage === st).length])) as Record<Stage, number>;
  const open = total - byStage.Completed;
  const unassignedOpen = rows.filter((r) => r.stage !== "Completed" && r.assignee.kind === "sinAsignar").length;
  return (
    <div className={clsx("grid grid-cols-2 gap-3 md:grid-cols-4", unassignedOpen > 0 ? "2xl:grid-cols-7" : "2xl:grid-cols-6")}>
      <Tile label={`${m.title} en total`} value={total} hint="en las épicas elegidas" />
      <Tile label={m.open} value={open} hint={`${pctText(total ? open / total : 0)} del total · aún no ${m.done}`} />
      {STAGES.map((st) => (
        <Tile key={st} label={m.labels[st]} value={byStage[st]} hint={m.hints[st]} color={categoryColor(st, dark)} />
      ))}
      {unassignedOpen > 0 && <Tile label={`${m.open} sin asignar`} value={unassignedOpen} hint={`nadie ${m.the} tiene asignad${m.o}s`} tone="warning" />}
    </div>
  );
}

function Tile({ label, value, hint, color, tone }: { label: string; value: number; hint: string; color?: string; tone?: "warning" }) {
  return (
    <div className={clsx("card p-4", tone === "warning" && "border-warning/50")}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {color && <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />}
        {label}
      </p>
      <p className={clsx("mt-1 font-display text-2xl font-semibold tabular-nums", tone === "warning" && "text-warning-fg")}>{value.toLocaleString("es-CO")}</p>
      <p className="mt-0.5 line-clamp-2 text-[0.6875rem] text-muted">{hint}</p>
    </div>
  );
}

/** Cantidad por estado de Azure, con barras del color de su etapa. */
function StatesCard({ kind, states, total }: { kind: UndatedKind; states: { state: string; stage: Stage; count: number }[]; total: number }) {
  const { resolved } = useTheme();
  const m = META[kind];
  return (
    <ChartCard
      title={`¿En qué estado están ${m.the} ${m.noun}?`}
      subtitle="Cantidad por estado de Azure (hoy)"
      icon={m.icon}
      summary={`Cantidad de ${m.noun} por estado de Azure.`}
      table={{ columns: ["Estado en Azure", "Etapa", m.title, "%"], rows: states.map((s) => [s.state, m.labels[s.stage], s.count, pctText(total ? s.count / total : 0)]) }}
      height={Math.max(220, states.length * 44)}
    >
      <ul className="flex h-full flex-col justify-center gap-3">
        {states.map((s) => (
          <li key={s.state}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate font-medium text-foreground">{s.state}</span>
              <span className="shrink-0 tabular-nums text-muted">
                <span className="font-semibold text-foreground">{s.count}</span> · {pctText(total ? s.count / total : 0)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full" style={{ width: `${total ? (s.count / total) * 100 : 0}%`, background: categoryColor(s.stage, resolved === "dark") }} />
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

/** Sin terminar y completadas por épica o por Feature. */
function GroupsCard({ kind, rows, epicLabels }: { kind: UndatedKind; rows: ItemRow[]; epicLabels: Map<string, string> }) {
  const { resolved } = useTheme();
  const m = META[kind];
  const [by, setBy] = useState<"epic" | "feature">("epic");
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; done: number }>();
    for (const r of rows) {
      const key = by === "epic" ? String(r.epicId ?? "none") : String(r.feature?.id ?? "none");
      const label = by === "epic" ? (epicLabels.get(key) ?? "Sin épica") : (r.feature?.title ?? "Sin feature");
      const g = map.get(key) ?? { key, label, total: 0, done: 0 };
      g.total += 1;
      if (r.stage === "Completed") g.done += 1;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => b.total - b.done - (a.total - a.done) || b.total - a.total);
  }, [rows, by, epicLabels]);
  return (
    <section className="card flex min-w-0 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-fg">
            <Layers className="size-[1.125rem]" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[0.9375rem] font-semibold">
              ¿Dónde están {m.the} {m.noun} pendientes?
            </h3>
            <p className="text-xs text-muted">
              {m.open} y {m.done} por {by === "epic" ? "épica" : "Feature"}
            </p>
          </div>
        </div>
        <div className="inline-flex rounded-xl border border-line bg-surface-2 p-0.5 text-xs">
          {(["epic", "feature"] as const).map((k) => (
            <button key={k} onClick={() => setBy(k)} aria-pressed={by === k} className={clsx("rounded-[0.625rem] px-2.5 py-1 font-medium", by === k ? "bg-surface text-foreground shadow-sm" : "text-muted")}>
              {k === "epic" ? "Por épica" : "Por Feature"}
            </button>
          ))}
        </div>
      </header>
      <div className="scrollbar-thin max-h-[24rem] overflow-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead className="sticky top-0 bg-surface-2 text-[0.6875rem] uppercase tracking-wider text-subtle">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">{by === "epic" ? "Épica" : "Feature"}</th>
              <th className="px-3 py-2.5 text-right font-semibold">{m.open}</th>
              <th className="px-4 py-2.5 text-left font-semibold">{m.done.charAt(0).toUpperCase() + m.done.slice(1)}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key} className="border-t border-line">
                <td className="max-w-[16rem] px-4 py-2.5 font-medium">{g.label}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{g.total - g.done}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full" style={{ width: `${(g.done / g.total) * 100}%`, background: categoryColor("Completed", resolved === "dark") }} />
                    </div>
                    <span className="whitespace-nowrap text-xs tabular-nums text-muted">
                      {g.done} de {g.total} · {pctText(g.done / g.total)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AssigneeCell({ a }: { a: Assignee }) {
  const { model, openPerson } = useApp();
  if (a.kind === "sinAsignar") return <span className="italic text-subtle">Sin asignar</span>;
  const person = model?.people.get(a.key);
  return (
    <button onClick={() => person && openPerson(a.key)} disabled={!person} className={clsx("flex max-w-[22rem] items-center gap-2.5 text-left", person && "hover:underline")}>
      <Avatar name={a.name} size="xs" />
      <span className="truncate">{a.name}</span>
      {person ? <PersonBadges person={person} /> : a.kind === "noGlobal" && <NoGlobalBadge />}
      {a.kind === "fuera" && <span className="shrink-0 rounded-md bg-surface-3 px-1.5 py-px text-[0.625rem] font-semibold text-muted">Fuera de Global</span>}
    </button>
  );
}

/** HU o bugs por persona y etapa (también es la vista de Colaboradores en esos mundos). */
export function ItemsByPerson({ kind, rows: given }: { kind: UndatedKind; rows?: ItemRow[] }) {
  const { analysis } = useCompliance();
  const m = META[kind];
  const rows = useMemo(() => given ?? (analysis ? rowsOf(analysis, kind) : []), [given, analysis, kind]);
  const people = useMemo(() => {
    const map = new Map<string, { assignee: Assignee; byStage: Record<Stage, number>; total: number }>();
    for (const r of rows) {
      const g = map.get(r.assignee.key) ?? { assignee: r.assignee, byStage: { Proposed: 0, InProgress: 0, Resolved: 0, Completed: 0 }, total: 0 };
      g.byStage[r.stage] += 1;
      g.total += 1;
      map.set(r.assignee.key, g);
    }
    const open = (g: { byStage: Record<Stage, number>; total: number }) => g.total - g.byStage.Completed;
    return [...map.values()].sort(
      (a, b) => Number(a.assignee.kind === "sinAsignar") - Number(b.assignee.kind === "sinAsignar") || open(b) - open(a) || b.total - a.total || a.assignee.name.localeCompare(b.assignee.name, "es"),
    );
  }, [rows]);
  if (!analysis) return <Skeleton className="h-64 w-full rounded-2xl" />;
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-fg">
          <Users className="size-[1.125rem]" />
        </span>
        <div>
          <h3 className="font-display text-[0.9375rem] font-semibold">{m.title} por persona</h3>
          <p className="text-xs text-muted">
            Quién tiene asignad{m.o}s {m.the} {m.noun}, cuánt{m.o}s y en qué estado van hoy (sin fechas ni semáforo)
          </p>
        </div>
      </header>
      {people.length === 0 ? (
        <EmptyState variant="search" title={`Sin ${m.noun} para estos filtros`} className="border-none" />
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-surface-2 text-[0.6875rem] uppercase tracking-wider text-subtle">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Persona</th>
                <th className="px-3 py-2.5 text-right font-semibold">{m.open}</th>
                {STAGES.map((st) => (
                  <th key={st} className="px-3 py-2.5 text-right font-semibold">
                    {m.labels[st]}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {people.map((g) => (
                <tr key={g.assignee.key} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    <AssigneeCell a={g.assignee} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-display font-semibold tabular-nums">{g.total - g.byStage.Completed}</td>
                  {STAGES.map((st) => (
                    <td key={st} className={clsx("px-3 py-2.5 text-right tabular-nums", g.byStage[st] === 0 && "text-subtle")}>
                      {g.byStage[st]}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{g.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Lista de los ítems de una persona por etapa (ficha del colaborador en los mundos sin fechas). */
export function PersonItems({ kind, personKey }: { kind: UndatedKind; personKey: string }) {
  const { analysis, openItem } = useCompliance();
  const { resolved } = useTheme();
  const m = META[kind];
  if (!analysis) return null;
  const mine = rowsOf(analysis, kind).filter((r) => r.assignee.key === personKey);
  if (!mine.length) return <EmptyState title={`Sin ${m.noun} asignad${m.o}s en las épicas elegidas`} />;
  return (
    <section>
      <h3 className="mb-1 font-display text-sm font-semibold">
        {m.title} ({mine.length}) · estado actual
      </h3>
      <p className="mb-3 text-xs text-muted">Sin fechas: aquí no hay periodo, atrasos ni semáforo. Las métricas de tiempo están en Tareas.</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {STAGES.map((st) => (
          <span key={st} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs">
            <span className="size-2 rounded-full" style={{ background: categoryColor(st, resolved === "dark") }} />
            {m.labels[st]} <strong className="tabular-nums">{mine.filter((r) => r.stage === st).length}</strong>
          </span>
        ))}
      </div>
      <ItemList rows={mine} onOpen={openItem} limit={80} />
    </section>
  );
}

function ItemList({ rows, onOpen, limit }: { rows: ItemRow[]; onOpen: (id: number) => void; limit: number }) {
  const { resolved } = useTheme();
  const sorted = [...rows].sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || a.item.id - b.item.id);
  return (
    <ul className="divide-y divide-line">
      {sorted.slice(0, limit).map((r) => (
        <li key={r.item.id}>
          <button onClick={() => onOpen(r.item.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-2 sm:px-5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: categoryColor(r.stage, resolved === "dark") }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">
                <span className="font-mono text-xs text-subtle">#{r.item.id}</span> {r.item.title}
              </span>
              <span className="block truncate text-[0.6875rem] text-subtle">
                {r.item.state} · {r.assignee.kind === "sinAsignar" ? "Sin asignar" : r.assignee.name}
                {r.feature ? ` · ${r.feature.title}` : ""}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const LIST_PAGE = 15;

/** Pendientes (sin completar), por etapa. */
function OpenList({ kind, rows, onOpen }: { kind: UndatedKind; rows: ItemRow[]; onOpen: (id: number) => void }) {
  const m = META[kind];
  const [limit, setLimit] = useState(LIST_PAGE);
  const open = rows.filter((r) => r.stage !== "Completed");
  if (!open.length) return null;
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-fg">
          <ListTree className="size-[1.125rem]" />
        </span>
        <div>
          <h3 className="font-display text-[0.9375rem] font-semibold">
            {m.title} {m.open.toLowerCase()} ({open.length})
          </h3>
          <p className="text-xs text-muted">Ordenad{m.o}s por etapa · clic para ver el detalle</p>
        </div>
      </header>
      <ItemList rows={open} onOpen={onOpen} limit={limit} />
      {open.length > limit && (
        <div className="border-t border-line px-4 py-2">
          <Button size="sm" variant="ghost" onClick={() => setLimit(limit + LIST_PAGE * 2)}>
            Mostrar más ({open.length - limit} restantes)
          </Button>
        </div>
      )}
    </section>
  );
}
