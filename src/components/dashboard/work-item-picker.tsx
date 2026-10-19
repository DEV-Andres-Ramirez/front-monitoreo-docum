"use client";

import clsx from "clsx";
import { Check, ExternalLink, Loader2, Search, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Chip, StateBadge, TypeBadge, typeStyle } from "@/components/ui/primitives";
import type { WorkItem } from "@/lib/types";
import { normalize } from "./team-grid";

const TYPE_FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "User Story", label: "HU" },
  { key: "Task", label: "Tareas" },
  { key: "Feature", label: "Features" },
] as const;

const MAX_RESULTS = 80;

function sameUser(a: string | null, b: string | null | undefined) {
  if (!a || !b) return false;
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  return la === lb || la.split("@")[0] === lb.split("@")[0];
}

export function WorkItemPicker({
  items,
  loading,
  error,
  value,
  onChange,
  memberEmail,
}: {
  items: WorkItem[] | undefined;
  loading: boolean;
  error?: string;
  value: number | null;
  onChange: (id: number | null) => void;
  memberEmail?: string | null;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]["key"]>("todos");
  const [browsing, setBrowsing] = useState(value === null);

  const byId = useMemo(() => new Map((items ?? []).map((w) => [w.id, w])), [items]);

  const featureOf = (item: WorkItem) => {
    let current: WorkItem | undefined = item;
    for (let i = 0; i < 6 && current; i++) {
      if (current.type === "Feature" && current.id !== item.id) return current.title;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return null;
  };

  const { suggested, rest, total } = useMemo(() => {
    const q = normalize(search.trim());
    const list = (items ?? []).filter((w) => {
      if (type !== "todos" && w.type !== type) return false;
      if (!q) return true;
      return String(w.id).includes(q) || normalize(w.title).includes(q);
    });
    const mine = list.filter((w) => sameUser(w.assignedEmail, memberEmail));
    const others = list.filter((w) => !sameUser(w.assignedEmail, memberEmail));
    return { suggested: mine.slice(0, 20), rest: others.slice(0, MAX_RESULTS), total: list.length };
  }, [items, search, type, memberEmail]);

  const selected = value !== null ? byId.get(value) : undefined;

  if (!browsing && selected) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border-2 border-accent/40 bg-accent-soft/50 p-3.5"
      >
        <div className="flex items-start gap-3">
          <span className="mt-1 h-10 w-1 shrink-0 rounded-full" style={{ background: typeStyle(selected.type).color }} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <TypeBadge type={selected.type} />
              <span className="font-mono text-xs text-muted">#{selected.id}</span>
              <StateBadge state={selected.state} />
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">{selected.title}</p>
            {featureOf(selected) && <p className="mt-0.5 truncate text-xs text-muted">Feature: {featureOf(selected)}</p>}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setBrowsing(true)} className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-accent shadow-sm">
            Cambiar
          </button>
          <a href={selected.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground">
            Ver en Azure <ExternalLink className="size-3" />
          </a>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-slate-50/60 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por # o título de HU / tarea"
          className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
        />
      </div>
      <div className="scrollbar-thin mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {TYPE_FILTERS.map((f) => (
          <Chip key={f.key} active={type === f.key} onClick={() => setType(f.key)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <div className="scrollbar-thin mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
        {loading && !items ? (
          <p className="flex items-center gap-2 px-2 py-6 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Leyendo backlog de Azure DevOps…
          </p>
        ) : error ? (
          <p className="px-2 py-6 text-sm text-red-600">{error}</p>
        ) : total === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted">Sin resultados en las épicas del proyecto.</p>
        ) : (
          <>
            {suggested.length > 0 && (
              <p className="flex items-center gap-1 px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
                <Sparkles className="size-3" /> Asignados a esta persona
              </p>
            )}
            <AnimatePresence initial={false}>
              {[...suggested, ...rest].map((w, i) => (
                <motion.button
                  type="button"
                  key={w.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(i, 10) * 0.015 }}
                  onClick={() => {
                    onChange(w.id);
                    setBrowsing(false);
                  }}
                  className={clsx(
                    "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                    w.id === value ? "bg-accent-soft" : "hover:bg-white",
                    i === suggested.length && suggested.length > 0 && "mt-2 border-t border-line pt-3",
                  )}
                >
                  <span className="mt-0.5 h-8 w-1 shrink-0 rounded-full" style={{ background: typeStyle(w.type).color }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <TypeBadge type={w.type} />
                      <span className="font-mono text-[11px] text-muted">#{w.id}</span>
                      <StateBadge state={w.state} />
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[13px] text-foreground">{w.title}</span>
                    {w.assignedTo && <span className="block truncate text-[11px] text-muted">{w.assignedTo}</span>}
                  </span>
                  {w.id === value && <Check className="mt-1 size-4 shrink-0 text-accent" />}
                </motion.button>
              ))}
            </AnimatePresence>
            {total > suggested.length + rest.length && (
              <p className="px-2 py-2 text-center text-[11px] text-muted">
                Mostrando {suggested.length + rest.length} de {total}. Refina la búsqueda para ver más.
              </p>
            )}
          </>
        )}
      </div>
      {selected && (
        <button type="button" onClick={() => setBrowsing(false)} className="mt-2 text-xs font-medium text-muted hover:text-foreground">
          Mantener #{selected.id}
        </button>
      )}
    </div>
  );
}
