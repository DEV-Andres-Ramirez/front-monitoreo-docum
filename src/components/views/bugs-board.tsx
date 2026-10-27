"use client";

import clsx from "clsx";
import { Bug, CalendarOff, Layers, ListTree, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { useApp } from "@/components/shell/app-provider";
import { Avatar, Button, EmptyState, NoGlobalBadge, PersonBadges, Skeleton } from "@/components/ui/primitives";
import { useTheme } from "@/components/ui/theme";
import { BUG_STAGE_LABEL, STAGES, type BugRow, type Stage } from "@/lib/analytics/compliance";
import type { Assignee } from "@/lib/analytics/model";
import { categoryColor } from "@/lib/analytics/state-colors";
import { pctText } from "./compliance-view";
import { useCompliance } from "./use-compliance";

/**
 * Mundo "Bugs" (Positiva): solo cantidades y estado actual. Las fechas de los bugs no son confiables,
 * así que aquí no hay periodo, vencidos, entregas por día ni semáforo. Datos: /compliance (todos los
 * bugs de las épicas, asignados o no), con los filtros de personas y épicas.
 */
export function BugsBoard() {
  const { analysis, error, openItem } = useCompliance();
  if (error) return <p className="card p-4 text-sm text-critical-fg">No se pudieron cargar los bugs: {error.message}</p>;
  if (!analysis?.bugs) return <Skeleton className="h-72 w-full rounded-2xl" />;
  const rows = analysis.bugItems;
  return (
    <div className="space-y-5">
      <UndatedNote />
      {rows.length === 0 ? (
        <EmptyState variant="search" title="Sin bugs para estos filtros" description="Cambia la épica o los colaboradores elegidos." />
      ) : (
        <>
          <BugStageTiles rows={rows} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <BugStatesCard states={analysis.bugs.states} total={analysis.bugs.total} />
            <BugGroupsCard epics={analysis.epics} features={analysis.features} />
          </div>
          <BugsByPerson rows={rows} />
          <OpenBugsList rows={rows} onOpen={openItem} />
        </>
      )}
    </div>
  );
}

/** Aviso fijo: por qué aquí no hay fechas. */
export function UndatedNote() {
  return (
    <section className="card flex items-start gap-3 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-info-soft text-info-fg">
        <CalendarOff className="size-[1.125rem]" />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-[0.9375rem] font-semibold leading-tight">Bugs · estado actual</h2>
        <p className="mt-0.5 text-xs text-muted">
          Los bugs se muestran por su estado de hoy, sin fechas: las fechas que llegan de Azure para los bugs no son confiables y generaban alertas falsas. Por eso aquí no aplica el periodo ni
          hay atrasos ni semáforo. Sí aplican los filtros de épica y de colaboradores.
        </p>
      </div>
    </section>
  );
}

const STAGE_HINT: Record<Stage, string> = {
  Proposed: "1. Nuevo",
  InProgress: "2. En desarrollo",
  Resolved: "3. Revisión QA, devuelto, bloqueado o certificado",
  Completed: "4. Cerrado",
};

function BugStageTiles({ rows }: { rows: BugRow[] }) {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const total = rows.length;
  const byStage = Object.fromEntries(STAGES.map((st) => [st, rows.filter((r) => r.stage === st).length])) as Record<Stage, number>;
  const open = total - byStage.Completed;
  const unassignedOpen = rows.filter((r) => r.stage !== "Completed" && r.assignee.kind === "sinAsignar").length;
  return (
    <div className={clsx("grid grid-cols-2 gap-3 md:grid-cols-4", unassignedOpen > 0 ? "2xl:grid-cols-7" : "2xl:grid-cols-6")}>
      <Tile label="Bugs en total" value={total} hint="en las épicas elegidas" />
      <Tile label="Abiertos" value={open} hint={`${pctText(total ? open / total : 0)} del total · sin cerrar`} />
      {STAGES.map((st) => (
        <Tile key={st} label={BUG_STAGE_LABEL[st]} value={byStage[st]} hint={STAGE_HINT[st]} color={categoryColor(st, dark)} />
      ))}
      {unassignedOpen > 0 && <Tile label="Abiertos sin asignar" value={unassignedOpen} hint="nadie los tiene asignados" tone="warning" />}
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
function BugStatesCard({ states, total }: { states: { state: string; stage: Stage; count: number }[]; total: number }) {
  const { resolved } = useTheme();
  return (
    <ChartCard
      title="¿En qué estado están los bugs?"
      subtitle="Cantidad por estado de Azure (hoy)"
      icon={Bug}
      summary="Cantidad de bugs por estado de Azure."
      table={{ columns: ["Estado en Azure", "Etapa", "Bugs", "%"], rows: states.map((s) => [s.state, BUG_STAGE_LABEL[s.stage], s.count, pctText(total ? s.count / total : 0)]) }}
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

type Group = { key: string; label: string; bugs: { total: number; done: number } };

/** Abiertos y cerrados por épica y por Feature. */
function BugGroupsCard({ epics, features }: { epics: Group[]; features: Group[] }) {
  const { resolved } = useTheme();
  const [by, setBy] = useState<"epic" | "feature">("epic");
  const rows = (by === "epic" ? epics : features).filter((g) => g.bugs.total > 0).sort((a, b) => b.bugs.total - b.bugs.done - (a.bugs.total - a.bugs.done));
  return (
    <section className="card flex min-w-0 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-fg">
            <Layers className="size-[1.125rem]" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[0.9375rem] font-semibold">¿Dónde están los bugs abiertos?</h3>
            <p className="text-xs text-muted">Abiertos y cerrados por {by === "epic" ? "épica" : "Feature"}</p>
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
              <th className="px-3 py-2.5 text-right font-semibold">Abiertos</th>
              <th className="px-4 py-2.5 text-left font-semibold">Cerrados</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.key} className="border-t border-line">
                <td className="max-w-[16rem] px-4 py-2.5 font-medium">{g.label}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{g.bugs.total - g.bugs.done}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full" style={{ width: `${(g.bugs.done / g.bugs.total) * 100}%`, background: categoryColor("Completed", resolved === "dark") }} />
                    </div>
                    <span className="whitespace-nowrap text-xs tabular-nums text-muted">
                      {g.bugs.done} de {g.bugs.total} · {pctText(g.bugs.done / g.bugs.total)}
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

/** Bugs por persona y etapa (también es la vista de Colaboradores en el mundo Bugs). */
export function BugsByPerson({ rows: given }: { rows?: BugRow[] }) {
  const { analysis } = useCompliance();
  const rows = useMemo(() => given ?? analysis?.bugItems ?? [], [given, analysis]);
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
          <h3 className="font-display text-[0.9375rem] font-semibold">Bugs por persona</h3>
          <p className="text-xs text-muted">Cuántos bugs tiene cada persona y en qué estado están hoy (sin fechas ni semáforo)</p>
        </div>
      </header>
      {people.length === 0 ? (
        <EmptyState variant="search" title="Sin bugs para estos filtros" className="border-none" />
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-surface-2 text-[0.6875rem] uppercase tracking-wider text-subtle">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Persona</th>
                <th className="px-3 py-2.5 text-right font-semibold">Abiertos</th>
                {STAGES.map((st) => (
                  <th key={st} className="px-3 py-2.5 text-right font-semibold">
                    {BUG_STAGE_LABEL[st]}
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

const LIST_PAGE = 15;

/** Bugs abiertos (sin cerrar), por etapa. */
function OpenBugsList({ rows, onOpen }: { rows: BugRow[]; onOpen: (id: number) => void }) {
  const { resolved } = useTheme();
  const [limit, setLimit] = useState(LIST_PAGE);
  const open = rows.filter((r) => r.stage !== "Completed").sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || a.item.id - b.item.id);
  if (!open.length) return null;
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-fg">
          <ListTree className="size-[1.125rem]" />
        </span>
        <div>
          <h3 className="font-display text-[0.9375rem] font-semibold">Bugs abiertos ({open.length})</h3>
          <p className="text-xs text-muted">Ordenados por etapa · clic para ver el detalle</p>
        </div>
      </header>
      <ul className="divide-y divide-line">
        {open.slice(0, limit).map((r) => (
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
