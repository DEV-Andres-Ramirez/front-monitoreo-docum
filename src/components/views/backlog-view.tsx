"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, ChevronRight, ChevronsDownUp, ChevronsUpDown, ExternalLink, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/shell/app-provider";
import { Avatar, Chip, EmptyState, NoGlobalBadge, TypeBadge } from "@/components/ui/primitives";
import { useTheme } from "@/components/ui/theme";
import { CATEGORIES, CATEGORY_LABEL, isAlive } from "@/lib/analytics/metrics";
import { isNoGlobal, normalizeText, type Item } from "@/lib/analytics/model";
import { categoryColor } from "@/lib/analytics/state-colors";
import type { StateCategory } from "@/lib/analytics/types";
import { TYPE_ORDER, typeMeta } from "@/lib/work-item-types";
import { DatasetGate } from "./dataset-gate";

type Node = { item: Item; depth: number; children: Node[]; rollup: number; count: number; overdue: number };

export function BacklogView() {
  return (
    <DatasetGate>
      <Backlog />
    </DatasetGate>
  );
}

const fmt = (t: number | null) => (t ? format(t, "d MMM yy", { locale: es }) : "—");

function Backlog() {
  const { scoped, range, model, openWorkItem } = useApp();
  const { resolved } = useTheme();
  const [search, setSearch] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [cats, setCats] = useState<StateCategory[]>([]);
  const [expanded, setExpanded] = useState<Set<number> | null>(null);

  // Ítems del alcance vivos en el periodo + sus ancestros (Feature / Épica / HU)
  const { roots, all } = useMemo(() => {
    const keep = new Map<number, Item>();
    for (const i of scoped) {
      if (!isAlive(i, range)) continue;
      let cur: Item | undefined = i;
      for (let d = 0; cur && d < 8 && !keep.has(cur.id); d++) {
        keep.set(cur.id, cur);
        cur = cur.parentId ? model!.byId.get(cur.parentId) : undefined;
      }
    }
    const nodes = new Map<number, Node>();
    for (const item of keep.values()) nodes.set(item.id, { item, depth: 0, children: [], rollup: 0, count: 0, overdue: 0 });
    const rootList: Node[] = [];
    for (const n of nodes.values()) {
      const parent = n.item.parentId ? nodes.get(n.item.parentId) : undefined;
      if (parent) parent.children.push(n);
      else rootList.push(n);
    }
    const walk = (n: Node, depth: number) => {
      n.depth = depth;
      n.children.sort((a, b) => a.item.id - b.item.id);
      n.rollup = n.item.countedHours;
      n.count = n.item.isWork ? 1 : 0;
      n.overdue = n.item.overdue ? 1 : 0;
      for (const c of n.children) {
        walk(c, depth + 1);
        n.rollup += c.rollup;
        n.count += c.count;
        n.overdue += c.overdue;
      }
    };
    rootList.forEach((r) => walk(r, 0));
    rootList.sort((a, b) => b.count - a.count);
    return { roots: rootList, all: nodes };
  }, [scoped, range, model]);

  const filtering = !!search.trim() || types.length > 0 || cats.length > 0;
  const visibleIds = useMemo(() => {
    if (!filtering) return null;
    const q = normalizeText(search.replace(/^#/, ""));
    const keep = new Set<number>();
    for (const n of all.values()) {
      const match =
        (!q || String(n.item.id).includes(q) || normalizeText(n.item.title ?? "").includes(q)) &&
        (!types.length || types.includes(n.item.type)) &&
        (!cats.length || cats.includes(n.item.cat));
      if (!match) continue;
      let cur: Node | undefined = n;
      while (cur && !keep.has(cur.item.id)) {
        keep.add(cur.item.id);
        cur = cur.item.parentId ? all.get(cur.item.parentId) : undefined;
      }
    }
    return keep;
  }, [filtering, search, types, cats, all]);

  const open = expanded ?? new Set(roots.map((r) => r.item.id));
  const toggle = (id: number) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const rows: Node[] = [];
  const push = (n: Node) => {
    if (visibleIds && !visibleIds.has(n.item.id)) return;
    rows.push(n);
    if (filtering || open.has(n.item.id)) n.children.forEach(push);
  };
  roots.forEach(push);
  const maxRollup = Math.max(1, ...roots.map((r) => r.rollup));
  const presentTypes = TYPE_ORDER.filter((t) => [...all.values()].some((n) => n.item.type === t));

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 p-3 sm:p-4 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por # o título"
            className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm outline-none transition placeholder:text-subtle focus:border-accent focus:ring-4 focus:ring-accent/10 focus-visible:outline-none"
          />
        </div>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {presentTypes.map((t) => (
            <Chip key={t} active={types.includes(t)} onClick={() => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])}>
              {typeMeta(t).plural}
            </Chip>
          ))}
          <span className="mx-1 w-px shrink-0 bg-line" />
          {CATEGORIES.map((c) => (
            <Chip key={c} active={cats.includes(c)} onClick={() => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c])}>
              <span className="size-2 rounded-full" style={{ background: categoryColor(c, resolved === "dark") }} /> {CATEGORY_LABEL[c]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1">
        <button onClick={() => setExpanded(new Set(all.keys()))} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface-3 hover:text-foreground">
          <ChevronsUpDown className="size-3.5" /> Expandir todo
        </button>
        <button onClick={() => setExpanded(new Set())} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface-3 hover:text-foreground">
          <ChevronsDownUp className="size-3.5" /> Contraer
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState variant="search" title="Sin ítems para este filtro" />
      ) : (
        <div className="card overflow-hidden">
          <div className="scrollbar-thin overflow-x-auto">
            <div className="min-w-[60rem]">
              <div className="grid grid-cols-[1fr_11rem_8rem_7rem_7rem_7rem] gap-3 border-b border-line bg-surface-2 px-4 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">
                <span>Ítem</span>
                <span>Asignado</span>
                <span>Estado</span>
                <span className="text-right">Objetivo</span>
                <span className="text-right">Entrega</span>
                <span className="text-right">Horas</span>
              </div>
              <ul role="tree" aria-label="Backlog de Azure">
                {rows.map((n) => {
                  const hasChildren = n.children.length > 0;
                  const isOpen = filtering || open.has(n.item.id);
                  const person = n.item.personKey ? model!.people.get(n.item.personKey) : undefined;
                  return (
                    <li
                      key={n.item.id}
                      role="treeitem"
                      aria-selected={false}
                      aria-expanded={hasChildren ? isOpen : undefined}
                      aria-level={n.depth + 1}
                      className={clsx(
                        "group grid grid-cols-[1fr_11rem_8rem_7rem_7rem_7rem] items-center gap-3 border-t border-line px-4 py-2 first:border-t-0 transition-colors hover:bg-surface-2",
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
                          <span className={clsx("truncate text-sm", n.depth === 0 && "font-display font-semibold")}>{n.item.title}</span>
                        </button>
                        {n.overdue > 0 && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-critical-soft px-1.5 py-0.5 text-[0.6875rem] font-semibold text-critical-fg" title="Ítems vencidos">
                            <AlertTriangle className="size-3" /> {n.overdue}
                          </span>
                        )}
                        <a href={n.item.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-md p-1 text-subtle opacity-0 transition hover:text-accent-fg group-hover:opacity-100" title="Abrir en Azure (solo lectura)">
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        {person ? (
                          <>
                            <Avatar name={person.name} size="xs" />
                            <span className="truncate text-xs">{person.name.split(" ").slice(0, 2).join(" ")}</span>
                            {isNoGlobal(person) && <NoGlobalBadge />}
                          </>
                        ) : (
                          <span className="text-xs text-subtle">{n.item.isWork ? "—" : `${n.count} ítems`}</span>
                        )}
                      </div>
                      <span className="flex min-w-0 items-center gap-1.5 text-xs">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: categoryColor(n.item.cat, resolved === "dark") }} />
                        <span className="truncate">{n.item.state}</span>
                      </span>
                      <span className="text-right text-xs tabular-nums text-muted">{fmt(n.item.plannedEnd)}</span>
                      <span className={clsx("text-right text-xs tabular-nums", n.item.onTime === false ? "font-semibold text-critical-fg" : "text-muted")}>{fmt(n.item.deliveredAt)}</span>
                      <div className="text-right">
                        <p className={clsx("font-display text-sm font-semibold tabular-nums", !n.rollup && "text-subtle")}>{n.rollup ? `${n.rollup.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h` : "—"}</p>
                        {n.depth === 0 && n.rollup > 0 && (
                          <div className="ml-auto mt-1 h-1 w-16 overflow-hidden rounded-full bg-surface-3">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${(n.rollup / maxRollup) * 100}%` }} />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
      <p className="flex items-center gap-1.5 text-xs text-subtle">
        <ShieldCheck className="size-3.5 text-good-fg" /> Copia de solo lectura de Azure DevOps. Horas = puntos de esfuerzo / estimación (1 punto = 1 h), sin doble conteo entre HU y tareas.
      </p>
    </div>
  );
}
