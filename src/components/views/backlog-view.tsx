"use client";

import clsx from "clsx";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, ExternalLink, Search, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/components/dashboard/client-api";
import { normalize } from "@/components/dashboard/team-grid";
import { useApp } from "@/components/shell/app-provider";
import { AvatarStack, Chip, EmptyState, Segmented, Skeleton, StateBadge, TypeBadge } from "@/components/ui/primitives";
import { addDaysISO, formatHours, weekRange } from "@/lib/dates";
import type { StatsResponse, WorkItem } from "@/lib/types";
import { TYPE_ORDER, typeMeta } from "@/lib/work-item-types";

type Range = "semana" | "mes" | "anio";
type Node = {
  item: WorkItem;
  depth: number;
  children: Node[];
  hours: number;
  activities: number;
  employeeIds: string[];
  rollup: number;
  rollupActivities: number;
};

export function BacklogView() {
  const { projectKey, date, today, workItems, members, openWorkItem } = useApp();
  const [range, setRange] = useState<Range>("anio");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("todos");
  const [state, setState] = useState("todos");
  const [onlyWithHours, setOnlyWithHours] = useState(false);
  const [expanded, setExpanded] = useState<Set<number> | null>(null);

  const from = range === "semana" ? weekRange(date).start : range === "mes" ? addDaysISO(date, -29) : addDaysISO(today, -364);
  const to = range === "semana" ? weekRange(date).end : range === "mes" ? date : today;
  const { data: raw } = useSWR<StatsResponse>(`/api/projects/${projectKey}/stats?from=${from}&to=${to}`, fetcher, { keepPreviousData: true });
  const stats = raw?.projectKey === projectKey ? raw : undefined;
  const names = useMemo(() => new Map(members.map((m) => [m.employeeId, m.name])), [members]);
  const items = workItems.data?.items;

  // --- Árbol con horas propias y acumuladas ---
  const { roots, byId, states, maxRollup } = useMemo(() => {
    const agg = new Map((stats?.byWorkItem ?? []).map((w) => [w.workItemId, w]));
    const nodes = new Map<number, Node>();
    for (const item of items ?? []) {
      const a = agg.get(item.id);
      nodes.set(item.id, { item, depth: 0, children: [], hours: a?.hours ?? 0, activities: a?.activities ?? 0, employeeIds: a?.employeeIds ?? [], rollup: 0, rollupActivities: 0 });
    }
    const rootList: Node[] = [];
    for (const n of nodes.values()) {
      const parent = n.item.parentId ? nodes.get(n.item.parentId) : undefined;
      if (parent) parent.children.push(n);
      else rootList.push(n);
    }
    const walk = (n: Node, depth: number) => {
      n.depth = depth;
      n.children.sort((a, b) => a.item.id - b.item.id);
      n.rollup = n.hours;
      n.rollupActivities = n.activities;
      for (const c of n.children) {
        walk(c, depth + 1);
        n.rollup += c.rollup;
        n.rollupActivities += c.rollupActivities;
      }
    };
    rootList.forEach((r) => walk(r, 0));
    const allStates = [...new Set((items ?? []).map((i) => i.state))].sort();
    return { roots: rootList, byId: nodes, states: allStates, maxRollup: Math.max(1, ...rootList.map((r) => r.rollup)) };
  }, [items, stats]);

  // --- Filtro: coincidencias + sus ancestros ---
  const filtering = !!search.trim() || type !== "todos" || state !== "todos" || onlyWithHours;
  const visibleIds = useMemo(() => {
    if (!filtering) return null;
    const q = normalize(search.trim().replace(/^#/, ""));
    const keep = new Set<number>();
    for (const n of byId.values()) {
      const match =
        (!q || String(n.item.id).includes(q) || normalize(n.item.title).includes(q)) &&
        (type === "todos" || n.item.type === type) &&
        (state === "todos" || n.item.state === state) &&
        (!onlyWithHours || n.rollup > 0);
      if (!match) continue;
      let cur: Node | undefined = n;
      while (cur && !keep.has(cur.item.id)) {
        keep.add(cur.item.id);
        cur = cur.item.parentId ? byId.get(cur.item.parentId) : undefined;
      }
    }
    return keep;
  }, [filtering, search, type, state, onlyWithHours, byId]);

  const defaultExpanded = useMemo(() => new Set(roots.map((r) => r.item.id)), [roots]);
  const open = expanded ?? defaultExpanded;
  const toggle = (id: number) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const rows: Node[] = [];
  const pushRows = (n: Node) => {
    if (visibleIds && !visibleIds.has(n.item.id)) return;
    rows.push(n);
    if (filtering || open.has(n.item.id)) n.children.forEach(pushRows);
  };
  roots.forEach(pushRows);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const i of items ?? []) c.set(i.type, (c.get(i.type) ?? 0) + 1);
    return c;
  }, [items]);
  const withHours = [...byId.values()].filter((n) => n.hours > 0).length;

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {TYPE_ORDER.filter((t) => counts.has(t)).map((t, i) => (
          <motion.div key={t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card flex items-center justify-between p-4">
            <div>
              <p className="truncate text-xs text-muted">{typeMeta(t).plural}</p>
              <p className="font-display text-2xl font-semibold tabular-nums">{counts.get(t)}</p>
            </div>
            <TypeBadge type={t} />
          </motion.div>
        ))}
      </div>

      <div className="card flex flex-col gap-3 p-3 sm:p-4 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por # o título en las épicas monitoreadas"
            className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm outline-none transition placeholder:text-subtle focus:border-accent focus:ring-4 focus:ring-accent/10"
          />
        </div>
        <select value={state} onChange={(e) => setState(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm outline-none" aria-label="Estado">
          <option value="todos">Todos los estados</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Segmented
          size="sm"
          value={range}
          onChange={setRange}
          options={[
            { value: "semana", label: "Semana" },
            { value: "mes", label: "30 días" },
            { value: "anio", label: "12 meses" },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Chip active={type === "todos"} onClick={() => setType("todos")}>
            Todos
          </Chip>
          {TYPE_ORDER.filter((t) => counts.has(t)).map((t) => (
            <Chip key={t} active={type === t} onClick={() => setType(t)} count={counts.get(t)}>
              {typeMeta(t).plural}
            </Chip>
          ))}
          <Chip active={onlyWithHours} onClick={() => setOnlyWithHours((v) => !v)} count={withHours}>
            Con horas
          </Chip>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded(new Set(byId.keys()))} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface-3 hover:text-foreground">
            <ChevronsUpDown className="size-3.5" /> Expandir todo
          </button>
          <button onClick={() => setExpanded(new Set())} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface-3 hover:text-foreground">
            <ChevronsDownUp className="size-3.5" /> Contraer
          </button>
        </div>
      </div>

      {!items ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState variant="search" title="Sin ítems para este filtro" description="Ajusta la búsqueda o los filtros." />
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[1fr_140px_120px_110px] gap-4 border-b border-line bg-surface-2 px-4 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle md:grid">
            <span>Ítem</span>
            <span>Personas</span>
            <span className="text-right">Horas propias</span>
            <span className="text-right">Acumuladas</span>
          </div>
          <ul role="tree" aria-label="Backlog de Azure">
            {rows.map((n, i) => {
              const hasChildren = n.children.length > 0;
              const isOpen = filtering || open.has(n.item.id);
              return (
                <motion.li
                  key={n.item.id}
                  role="treeitem"
                  aria-expanded={hasChildren ? isOpen : undefined}
                  aria-level={n.depth + 1}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: Math.min(i, 25) * 0.008 }}
                  className={clsx(
                    "group grid grid-cols-[1fr_auto] items-center gap-4 border-t border-line px-4 py-2 first:border-t-0 transition-colors hover:bg-surface-2 md:grid-cols-[1fr_140px_120px_110px]",
                    n.depth === 0 && "bg-surface-2/60",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: `${n.depth * 1.25}rem` }}>
                    <button
                      onClick={() => hasChildren && toggle(n.item.id)}
                      className={clsx("grid size-6 shrink-0 place-items-center rounded-md text-subtle", hasChildren ? "hover:bg-surface-3 hover:text-foreground" : "invisible")}
                      aria-label={isOpen ? "Contraer" : "Expandir"}
                      tabIndex={hasChildren ? 0 : -1}
                    >
                      <ChevronRight className={clsx("size-4 transition-transform", isOpen && "rotate-90")} />
                    </button>
                    <TypeBadge type={n.item.type} />
                    <button onClick={() => openWorkItem(n.item.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className="font-mono text-[0.6875rem] text-subtle">#{n.item.id}</span>
                      <span className={clsx("truncate text-sm", n.depth === 0 ? "font-display font-semibold" : "text-foreground")}>{n.item.title}</span>
                    </button>
                    <span className="hidden lg:inline">
                      <StateBadge state={n.item.state} />
                    </span>
                    <a
                      href={n.item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hidden rounded-md p-1 text-subtle opacity-0 transition hover:text-accent-fg group-hover:opacity-100 md:block"
                      title="Abrir en Azure (solo lectura)"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                  <div className="hidden md:block">
                    {n.employeeIds.length > 0 ? <AvatarStack names={n.employeeIds.map((id) => names.get(id) ?? "—")} /> : <span className="text-xs text-subtle">—</span>}
                  </div>
                  <p className="hidden text-right text-sm tabular-nums md:block">{n.hours ? formatHours(n.hours) : <span className="text-subtle">—</span>}</p>
                  <div className="text-right">
                    <p className={clsx("font-display text-sm font-semibold tabular-nums", !n.rollup && "text-subtle")}>{n.rollup ? formatHours(n.rollup) : "0 h"}</p>
                    {n.depth === 0 && n.rollup > 0 && (
                      <div className="ml-auto mt-1 h-1 w-20 overflow-hidden rounded-full bg-surface-3">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(n.rollup / maxRollup) * 100}%` }} />
                      </div>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-subtle">
        <ShieldCheck className="size-3.5 text-good-fg" /> Lectura de Azure DevOps en modo solo consulta. Las horas provienen de los registros del tablero.
      </p>
    </div>
  );
}
