"use client";

import clsx from "clsx";
import { Check, ExternalLink, Loader2, Search, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chip, StateBadge, TypeBadge } from "@/components/ui/primitives";
import { useTheme } from "@/components/ui/theme";
import type { WorkItem } from "@/lib/types";
import { typeMeta } from "@/lib/work-item-types";
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
  const { resolved } = useTheme();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]["key"]>("todos");
  const [browsing, setBrowsing] = useState(value === null);
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map((items ?? []).map((w) => [w.id, w])), [items]);
  const colorOf = (t: string) => (resolved === "dark" ? typeMeta(t).dark : typeMeta(t).light);

  const featureOf = (item: WorkItem) => {
    let current: WorkItem | undefined = item.parentId ? byId.get(item.parentId) : undefined;
    for (let i = 0; i < 6 && current; i++) {
      if (current.type === "Feature") return current.title;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return null;
  };

  const { results, suggestedCount, total } = useMemo(() => {
    const q = normalize(search.trim().replace(/^#/, ""));
    const list = (items ?? []).filter((w) => {
      if (type !== "todos" && w.type !== type) return false;
      if (!q) return true;
      return String(w.id).includes(q) || normalize(w.title).includes(q);
    });
    const mine = list.filter((w) => sameUser(w.assignedEmail, memberEmail)).slice(0, 20);
    const others = list.filter((w) => !sameUser(w.assignedEmail, memberEmail)).slice(0, MAX_RESULTS);
    return { results: [...mine, ...others], suggestedCount: mine.length, total: list.length };
  }, [items, search, type, memberEmail]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const select = (id: number) => {
    onChange(id);
    setBrowsing(false);
  };

  const selected = value !== null ? byId.get(value) : undefined;

  if (!browsing && selected) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl border-2 border-accent/40 bg-accent-soft p-3.5">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-10 w-1 shrink-0 rounded-full" style={{ background: colorOf(selected.type) }} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <TypeBadge type={selected.type} />
              <span className="font-mono text-xs text-subtle">#{selected.id}</span>
              <StateBadge state={selected.state} />
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">{selected.title}</p>
            {featureOf(selected) && <p className="mt-0.5 truncate text-xs text-muted">Feature: {featureOf(selected)}</p>}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setBrowsing(true)} className="rounded-xl bg-surface px-3 py-1.5 text-xs font-semibold text-accent-fg shadow-sm">
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
    <div className="rounded-2xl border border-line bg-surface-2 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && results[cursor]) {
              e.preventDefault();
              select(results[cursor].id);
            }
          }}
          placeholder="Buscar por # o título · ↑↓ y Enter"
          role="combobox"
          aria-expanded
          aria-controls="wi-results"
          aria-activedescendant={results[cursor] ? `wi-${results[cursor].id}` : undefined}
          className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm outline-none transition placeholder:text-subtle focus:border-accent focus:ring-4 focus:ring-accent/10"
        />
      </div>
      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {TYPE_FILTERS.map((f) => (
          <Chip
            key={f.key}
            active={type === f.key}
            onClick={() => {
              setType(f.key);
              setCursor(0);
            }}
          >
            {f.label}
          </Chip>
        ))}
      </div>

      <div ref={listRef} id="wi-results" role="listbox" className="scrollbar-thin mt-2 max-h-72 space-y-0.5 overflow-y-auto pr-1">
        {loading && !items ? (
          <p className="flex items-center gap-2 px-2 py-6 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Leyendo backlog de Azure DevOps…
          </p>
        ) : error ? (
          <p className="px-2 py-6 text-sm text-critical-fg">{error}</p>
        ) : total === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted">Sin resultados en las épicas del proyecto.</p>
        ) : (
          <>
            {suggestedCount > 0 && (
              <p className="flex items-center gap-1 px-2 pb-1 pt-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-accent-fg">
                <Sparkles className="size-3" /> Asignados a esta persona
              </p>
            )}
            {results.map((w, i) => (
              <button
                type="button"
                key={w.id}
                id={`wi-${w.id}`}
                data-index={i}
                role="option"
                aria-selected={w.id === value}
                onMouseEnter={() => setCursor(i)}
                onClick={() => select(w.id)}
                className={clsx(
                  "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                  i === cursor ? "bg-surface shadow-sm ring-1 ring-line" : "",
                  w.id === value && "bg-accent-soft",
                  i === suggestedCount && suggestedCount > 0 && "mt-2 border-t border-line pt-3",
                )}
              >
                <span className="mt-0.5 h-8 w-1 shrink-0 rounded-full" style={{ background: colorOf(w.type) }} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <TypeBadge type={w.type} />
                    <span className="font-mono text-[0.6875rem] text-subtle">#{w.id}</span>
                    <StateBadge state={w.state} />
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[0.8125rem] text-foreground">{w.title}</span>
                  {w.assignedTo && <span className="block truncate text-[0.6875rem] text-subtle">{w.assignedTo}</span>}
                </span>
                {w.id === value && <Check className="mt-1 size-4 shrink-0 text-accent-fg" />}
              </button>
            ))}
            {total > results.length && (
              <p className="px-2 py-2 text-center text-[0.6875rem] text-subtle">
                Mostrando {results.length} de {total}. Refina la búsqueda para ver más.
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
