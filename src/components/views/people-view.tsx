"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, BarChart3, Grid3x3, LayoutGrid, Link2, List, Scale, Search, UserPlus } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChartCard } from "@/components/charts/chart-card";
import { useChartTheme } from "@/components/charts/chart-theme";
import { EstimateChart, PersonStatesChart } from "@/components/charts/flow-charts";
import { api, useStored } from "@/components/dashboard/client-api";
import { useApp } from "@/components/shell/app-provider";
import { Avatar, Button, Chip, EmptyState, ProgressRing, Segmented } from "@/components/ui/primitives";
import { useUiScale } from "@/components/ui/display";
import { CATEGORIES, CATEGORY_LABEL, perPerson, workloadMatrix, type PersonRow } from "@/lib/analytics/metrics";
import { normalizeText, type Person } from "@/lib/analytics/model";
import { categoryColor } from "@/lib/analytics/state-colors";
import { DatasetGate } from "./dataset-gate";

type Layout = "cards" | "table" | "heatmap";
type SortKey = "delivered" | "utilization" | "overdue" | "wip" | "name";

export function PeopleView() {
  return (
    <DatasetGate>
      <People />
    </DatasetGate>
  );
}

const fmtH = (n: number) => `${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h`;
const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)} %`);

function People() {
  const { people, scoped, range, filters, model, projectKey, openPerson } = useApp();
  const theme = useChartTheme(projectKey);
  const scale = useUiScale();
  const [layout, setLayout] = useStored<Layout>("docum:people-layout", "cards");
  const [sort, setSort] = useState<SortKey>("delivered");
  const [query, setQuery] = useState("");
  const [showEmpty, setShowEmpty] = useStored<boolean>("docum:people-show-empty", false);

  const selected = new Set(filters.people);
  const visible = people.filter((p) => !selected.size || selected.has(p.key));
  const rows = useMemo(() => {
    const all = perPerson(visible, scoped, range, model?.now).filter((r) => (r.person.inRoster || r.active > 0) && (showEmpty || r.active > 0));
    const q = normalizeText(query);
    const filtered = all.filter((r) => !q || normalizeText(`${r.person.name} ${r.person.role ?? ""}`).includes(q));
    const by: Record<SortKey, (a: PersonRow, b: PersonRow) => number> = {
      delivered: (a, b) => b.hoursDelivered - a.hoursDelivered || b.delivered - a.delivered,
      utilization: (a, b) => (b.utilization ?? -1) - (a.utilization ?? -1),
      overdue: (a, b) => b.overdue - a.overdue,
      wip: (a, b) => b.wip - a.wip,
      name: (a, b) => a.person.name.localeCompare(b.person.name, "es"),
    };
    return filtered.sort(by[sort]);
  }, [visible, scoped, range, query, sort, model, showEmpty]);
  const emptyCount = useMemo(
    () => perPerson(visible.filter((p) => p.inRoster), scoped, range, model?.now).filter((r) => r.active === 0).length,
    [visible, scoped, range, model],
  );
  const chartRows = rows.filter((r) => r.active > 0);
  const estimateRows = rows.filter((r) => r.estimated > 0 || r.completedWork > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar colaborador o cargo"
              className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm outline-none transition placeholder:text-subtle focus:border-accent focus:ring-4 focus:ring-accent/10 focus-visible:outline-none"
            />
          </div>
          <Segmented
            value={layout}
            onChange={setLayout}
            options={[
              { value: "cards", label: "Tarjetas", icon: LayoutGrid },
              { value: "table", label: "Tabla", icon: List },
              { value: "heatmap", label: "Carga semanal", icon: Grid3x3 },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
        {emptyCount > 0 && (
          <Chip active={showEmpty} onClick={() => setShowEmpty(!showEmpty)} count={emptyCount}>
            {showEmpty ? "Ocultar sin ítems" : "Mostrar sin ítems en Azure"}
          </Chip>
        )}
        <label className="flex items-center gap-2 text-xs text-muted">
          Ordenar por
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-foreground">
            <option value="delivered">horas entregadas</option>
            <option value="utilization">utilización</option>
            <option value="overdue">vencidos</option>
            <option value="wip">trabajo en curso</option>
            <option value="name">nombre</option>
          </select>
        </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState variant="search" title="Sin colaboradores para este filtro" />
      ) : layout === "cards" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((r, i) => (
            <PersonCard key={r.person.key} row={r} index={i} dark={theme.dark} onOpen={() => openPerson(r.person.key)} />
          ))}
        </div>
      ) : layout === "table" ? (
        <PeopleTable rows={rows} onOpen={openPerson} />
      ) : (
        <Heatmap people={rows.map((r) => r.person)} />
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Estado del trabajo por colaborador"
          subtitle="Ítems activos en el periodo por categoría · clic para ver detalle"
          icon={BarChart3}
          legend={CATEGORIES.map((c) => ({ label: CATEGORY_LABEL[c], color: categoryColor(c, theme.dark) }))}
          summary="Barras apiladas de ítems por categoría de estado para cada colaborador."
          table={{ columns: ["Colaborador", ...CATEGORIES.map((c) => CATEGORY_LABEL[c])], rows: chartRows.map((r) => [r.person.name, ...CATEGORIES.map((c) => r.byCat[c])]) }}
          empty={chartRows.length === 0 ? { title: "Sin ítems activos" } : false}
          height={360}
        >
          <div className="scrollbar-thin h-full overflow-y-auto pr-1">
            <div style={{ height: Math.max(chartRows.length * 30 + 40, 320) * scale }}>
              <PersonStatesChart rows={chartRows} theme={theme} onSelect={openPerson} />
            </div>
          </div>
        </ChartCard>
        <ChartCard
          title="Estimado vs. trabajo reportado"
          subtitle="Ítems entregados: horas estimadas (pista) frente a 'trabajo completado' en Azure"
          icon={Scale}
          legend={[
            { label: "Trabajo completado reportado", color: theme.accent },
            { label: "Horas estimadas", color: theme.track },
          ]}
          summary="Comparación de horas estimadas y trabajo completado reportado por colaborador."
          table={{ columns: ["Colaborador", "Estimado", "Reportado"], rows: estimateRows.map((r) => [r.person.name, fmtH(r.estimated), fmtH(r.completedWork)]) }}
          empty={estimateRows.length === 0 ? { title: "Sin estimaciones ni trabajo reportado", description: "Aplica cuando las tareas tienen estimación original y trabajo completado." } : false}
          height={360}
        >
          <div className="scrollbar-thin h-full overflow-y-auto pr-1">
            <div style={{ height: Math.max(estimateRows.length * 30 + 40, 320) * scale }}>
              <EstimateChart rows={estimateRows} theme={theme} />
            </div>
          </div>
        </ChartCard>
      </div>

      <OutsidePlanning />
      {model && <p className="text-xs text-subtle">Capacidad = 8 h × % asignado × días hábiles de su vigencia en el periodo. Utilización = horas entregadas ÷ capacidad.</p>}
    </div>
  );
}

function StateBar({ row, dark }: { row: PersonRow; dark: boolean }) {
  const total = CATEGORIES.reduce((s, c) => s + row.byCat[c], 0);
  if (!total) return <div className="h-2 rounded-full bg-surface-3" />;
  return (
    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={CATEGORIES.map((c) => `${CATEGORY_LABEL[c]} ${row.byCat[c]}`).join(", ")}>
      {CATEGORIES.filter((c) => row.byCat[c] > 0).map((c) => (
        <motion.span key={c} initial={{ width: 0 }} animate={{ width: `${(row.byCat[c] / total) * 100}%` }} transition={{ duration: 0.8 }} style={{ background: categoryColor(c, dark) }} />
      ))}
    </div>
  );
}

function PersonCard({ row: r, index, dark, onOpen }: { row: PersonRow; index: number; dark: boolean; onOpen: () => void }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.03, duration: 0.35 }}
      whileHover={{ y: -3 }}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      role="button"
      tabIndex={0}
      className="card cursor-pointer p-4 transition-shadow hover:shadow-pop sm:p-5"
    >
      <div className="flex items-start gap-3">
        <Avatar name={r.person.name} status={r.overdue > 0 ? "critical" : r.wip > 0 ? "info" : "neutral"} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{r.person.name}</h3>
          <p className="truncate text-xs text-muted">{r.person.inRoster ? `${r.person.role} · ${Math.round(r.person.allocation * 100)} %` : "Fuera de la planeación"}</p>
        </div>
        {r.utilization !== null && (
          <div className="relative grid place-items-center" title="Utilización: horas entregadas ÷ capacidad">
            <ProgressRing value={Math.min(r.utilization, 1)} size={44} />
            <span className="absolute text-[0.625rem] font-bold tabular-nums">{Math.round(r.utilization * 100)}%</span>
          </div>
        )}
      </div>
      <div className="mt-3">
        <StateBar row={r} dark={dark} />
        <p className="mt-1.5 text-[0.6875rem] text-subtle">
          {r.active} activos · {r.byCat.InProgress} en curso · {r.byCat.Resolved} entregados sin cerrar
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
        <div>
          <dt className="text-[0.625rem] uppercase tracking-wider text-subtle">Entregado</dt>
          <dd className="font-display text-base font-semibold tabular-nums">{fmtH(r.hoursDelivered)}</dd>
          <dd className="text-[0.6875rem] text-subtle">{r.delivered} ítems</dd>
        </div>
        <div>
          <dt className="text-[0.625rem] uppercase tracking-wider text-subtle">A tiempo</dt>
          <dd className="font-display text-base font-semibold tabular-nums">{pct(r.onTimeRate)}</dd>
          <dd className="text-[0.6875rem] text-subtle">cycle {r.cycleP50 === null ? "—" : `${r.cycleP50.toLocaleString("es-CO", { maximumFractionDigits: 1 })} d`}</dd>
        </div>
        <div>
          <dt className="text-[0.625rem] uppercase tracking-wider text-subtle">Vencidos</dt>
          <dd className={clsx("font-display text-base font-semibold tabular-nums", r.overdue > 0 && "text-critical-fg")}>{r.overdue}</dd>
          <dd className="text-[0.6875rem] text-subtle">{fmtH(r.hoursOpen)} abiertas</dd>
        </div>
      </dl>
    </motion.article>
  );
}

function PeopleTable({ rows, onOpen }: { rows: PersonRow[]; onOpen: (key: string) => void }) {
  return (
    <div className="card overflow-hidden">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-surface-2 text-left text-[0.6875rem] uppercase tracking-wider text-subtle">
            <tr>
              <th className="px-4 py-3 font-semibold">Colaborador</th>
              <th className="px-3 py-3 text-right font-semibold">Activos</th>
              <th className="px-3 py-3 text-right font-semibold">En curso</th>
              <th className="px-3 py-3 text-right font-semibold">Entregados</th>
              <th className="px-3 py-3 text-right font-semibold">Horas entregadas</th>
              <th className="px-3 py-3 text-right font-semibold">Capacidad</th>
              <th className="px-3 py-3 text-right font-semibold">Utilización</th>
              <th className="px-3 py-3 text-right font-semibold">A tiempo</th>
              <th className="px-3 py-3 text-right font-semibold">Cycle P50</th>
              <th className="px-4 py-3 text-right font-semibold">Vencidos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.person.key} onClick={() => onOpen(r.person.key)} className="cursor-pointer border-t border-line transition-colors hover:bg-surface-2">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.person.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.person.name}</p>
                      <p className="truncate text-xs text-subtle">{r.person.inRoster ? r.person.role : "Fuera de la planeación"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 text-right tabular-nums">{r.active}</td>
                <td className="px-3 text-right tabular-nums">{r.wip}</td>
                <td className="px-3 text-right tabular-nums">{r.delivered}</td>
                <td className="px-3 text-right font-display font-semibold tabular-nums">{fmtH(r.hoursDelivered)}</td>
                <td className="px-3 text-right tabular-nums text-muted">{r.capacity === null ? "—" : fmtH(r.capacity)}</td>
                <td className="px-3 text-right tabular-nums">{pct(r.utilization)}</td>
                <td className="px-3 text-right tabular-nums">{pct(r.onTimeRate)}</td>
                <td className="px-3 text-right tabular-nums">{r.cycleP50 === null ? "—" : `${r.cycleP50.toLocaleString("es-CO", { maximumFractionDigits: 1 })} d`}</td>
                <td className={clsx("px-4 text-right font-semibold tabular-nums", r.overdue > 0 && "text-critical-fg")}>{r.overdue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Mapa de calor persona × semana con las horas entregadas (escala secuencial del acento). */
function Heatmap({ people }: { people: Person[] }) {
  const { scoped, range, openPerson } = useApp();
  const matrix = useMemo(() => workloadMatrix(people, scoped, range), [people, scoped, range]);
  const max = Math.max(1, ...matrix.rows.flatMap((r) => r.cells.map((c) => c.hours)));
  const mix = (h: number) => (h <= 0 ? 0 : Math.round(18 + (h / max) * 77));
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h3 className="font-display text-[0.9375rem] font-semibold">Carga entregada por semana</h3>
          <p className="text-xs text-muted">Horas (puntos) entregadas por colaborador y semana. Intensidad relativa al máximo ({fmtH(max)}).</p>
        </div>
      </div>
      <div className="scrollbar-thin max-h-[40rem] overflow-auto">
        <table className="w-full min-w-[45rem] border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 bg-surface-2 px-4 py-2.5 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">Colaborador</th>
              {matrix.weeks.map((w) => (
                <th key={w.start} className="bg-surface-2 px-1 py-2 text-center text-[0.6875rem] font-semibold text-subtle">
                  {format(w.start, "d MMM", { locale: es })}
                </th>
              ))}
              <th className="bg-surface-2 px-3 py-2 text-right text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">Total</th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((r) => (
              <tr key={r.person.key} className="group">
                <td className="sticky left-0 z-[5] border-t border-line bg-surface px-4 py-2 group-hover:bg-surface-2">
                  <button onClick={() => openPerson(r.person.key)} className="flex max-w-[15rem] items-center gap-2.5 text-left">
                    <Avatar name={r.person.name} size="xs" />
                    <span className="truncate text-[0.8125rem] font-medium">{r.person.name}</span>
                  </button>
                </td>
                {r.cells.map((c, i) => (
                  <td key={i} className="border-t border-line p-1">
                    <div
                      className={clsx("grid h-9 min-w-12 place-items-center rounded-lg text-xs font-semibold tabular-nums", c.hours <= 0 && "bg-surface-2 text-subtle/60")}
                      style={c.hours > 0 ? { background: `color-mix(in oklab, var(--accent) ${mix(c.hours)}%, var(--surface))`, color: "var(--fg)" } : undefined}
                      title={`${r.person.name}: ${fmtH(c.hours)} · ${c.items} ítems`}
                    >
                      {c.hours > 0 ? c.hours.toLocaleString("es-CO", { maximumFractionDigits: 1 }) : "·"}
                    </div>
                  </td>
                ))}
                <td className="border-t border-line px-3 text-right font-display text-sm font-semibold tabular-nums">{fmtH(r.cells.reduce((s, c) => s + c.hours, 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Asignados en Azure sin vínculo con la planeación del proyecto (con vinculación manual). */
function OutsidePlanning() {
  const { model, projectKey, dataset } = useApp();
  const [linking, setLinking] = useState<string | null>(null);
  const unmatched = useMemo(() => {
    if (!model) return [];
    const counts = new Map<string, number>();
    for (const i of model.work) if (i.personKey) counts.set(i.personKey, (counts.get(i.personKey) ?? 0) + 1);
    return [...model.people.values()]
      .filter((p) => !p.inRoster && counts.get(p.key))
      .map((p) => ({ person: p, items: counts.get(p.key)! }))
      .sort((a, b) => b.items - a.items);
  }, [model]);
  const roster = useMemo(() => (dataset.data?.roster ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "es")), [dataset.data]);

  async function link(email: string, employeeId: string) {
    setLinking(email);
    try {
      await api("/api/aliases", { method: "POST", body: JSON.stringify({ projectKey, alias: email, employeeId }) });
      await dataset.mutate();
      toast.success("Correo vinculado", { description: `${email} ahora cuenta para ${roster.find((r) => r.employeeId === employeeId)?.name}` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo vincular");
    } finally {
      setLinking(null);
    }
  }

  if (!unmatched.length) return null;
  return (
    <section className="card p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning-fg">
            <UserPlus className="size-[1.125rem]" />
          </span>
          <div>
            <h3 className="font-display text-[0.9375rem] font-semibold">Fuera de la planeación</h3>
            <p className="mt-0.5 text-xs text-muted">
              Tienen ítems en las épicas monitoreadas, pero no coinciden con el personal del Excel de este proyecto. Si es la misma persona con otro correo, vincúlala; si no, actívalos con
              &quot;Incluir fuera de la planeación&quot; en el filtro.
            </p>
          </div>
        </div>
      </header>
      <ul className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
        {unmatched.map(({ person, items }) => (
          <li key={person.key} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
            <Avatar name={person.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{person.name}</p>
              <p className="truncate text-[0.6875rem] text-subtle">
                {person.employeeId ? "Colaborador de otro proyecto" : person.email} · {items} ítems
              </p>
            </div>
            {!person.employeeId && person.email ? (
              <div className="flex items-center gap-1.5">
                <Link2 className="size-3.5 text-subtle" />
                <select
                  defaultValue=""
                  disabled={linking === person.email}
                  onChange={(e) => e.target.value && void link(person.email!, e.target.value)}
                  className="h-8 max-w-[13rem] rounded-lg border border-line bg-surface px-2 text-xs"
                  aria-label={`Vincular ${person.email} con un colaborador`}
                >
                  <option value="">Vincular con…</option>
                  {roster.map((r) => (
                    <option key={r.employeeId} value={r.employeeId}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-1 text-[0.6875rem] text-muted">
                <AlertTriangle className="size-3" /> No está en la planeación de este proyecto
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <Button size="sm" variant="ghost" onClick={() => void dataset.mutate()}>
          Recalcular vínculos
        </Button>
      </div>
    </section>
  );
}
