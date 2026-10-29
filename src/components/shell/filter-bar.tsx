"use client";

import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Bug, CalendarRange, Check, ChevronDown, ClipboardList, Layers, ListChecks, RefreshCw, Search, SlidersHorizontal, Tag, Users, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar, PersonBadges, Segmented } from "@/components/ui/primitives";
import { Popover } from "@/components/ui/popover";
import { inEpics, isAlive } from "@/lib/analytics/metrics";
import { normalizeText, personRoleLabel, type EpicRef } from "@/lib/analytics/model";
import { DEFAULT_PRESET, PRESET_LABEL, QUICK_PRESETS, resolvePreset, type PeriodPreset } from "@/lib/analytics/period";
import type { WorkView } from "@/lib/config";
import { formatDayMonth, formatShort, formatTime } from "@/lib/dates";
import { useApp } from "./app-provider";

const triggerClass = (active: boolean) =>
  clsx(
    "flex h-10 min-w-0 items-center gap-2 rounded-xl border px-3 text-sm font-medium shadow-sm transition",
    active ? "border-accent/50 bg-accent-soft text-accent-fg" : "border-line bg-surface text-foreground hover:border-line-strong",
  );

// ------------------------------------------------------------------ Periodo
export function PeriodPanel({ onDone }: { onDone?: () => void }) {
  const { period, setPreset, setCustomPeriod, today } = useApp();
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  // Cada atajo muestra las fechas que cubre ("Ayer" es el día hábil anterior)
  const presetButton = (p: PeriodPreset, className?: string) => {
    const r = resolvePreset(p, today);
    const dates = r.from === r.to ? formatDayMonth(r.from) : `${formatDayMonth(r.from)} – ${formatDayMonth(r.to)}`;
    return (
      <button
        key={p}
        onClick={() => {
          setPreset(p);
          onDone?.();
        }}
        aria-pressed={period.preset === p}
        className={clsx(
          "rounded-xl px-3 py-2 text-left transition",
          period.preset === p ? "bg-accent text-white" : "bg-surface-2 text-foreground hover:bg-surface-3",
          className,
        )}
      >
        <span className="block text-sm font-semibold">{p === "yesterday" && r.label !== PRESET_LABEL.yesterday ? "Ayer (día hábil)" : PRESET_LABEL[p]}</span>
        <span className={clsx("block text-[0.6875rem]", period.preset === p ? "text-white/80" : "text-subtle")}>{dates}</span>
      </button>
    );
  };
  return (
    <div className="space-y-3">
      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-subtle">Periodo de análisis</p>
      {presetButton(DEFAULT_PRESET, "w-full")}
      <div className="grid grid-cols-2 gap-1.5">{QUICK_PRESETS.map((p) => presetButton(p))}</div>
      <div className="border-t border-line pt-3">
        <p className="mb-2 text-xs font-medium text-muted">Rango personalizado</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[0.6875rem] text-subtle">
            Desde
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9 w-full min-w-0 rounded-lg border border-line bg-surface px-2 text-sm text-foreground" />
          </label>
          <label className="text-[0.6875rem] text-subtle">
            Hasta
            <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9 w-full min-w-0 rounded-lg border border-line bg-surface px-2 text-sm text-foreground" />
          </label>
        </div>
        <button
          disabled={!from || !to || from > to}
          onClick={() => {
            setCustomPeriod(from, to);
            onDone?.();
          }}
          className="mt-2 w-full rounded-xl bg-accent py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Aplicar rango
        </button>
      </div>
    </div>
  );
}

export function PeriodPicker({ className }: { className?: string }) {
  const { period } = useApp();
  return (
    <Popover
      className={className}
      panelClassName="w-[20rem]"
      trigger={({ open, toggle }) => (
        <button onClick={toggle} aria-expanded={open} className={triggerClass(false)} title="Periodo de análisis">
          <CalendarRange className="size-4 shrink-0 text-accent-fg" />
          <span className="truncate">{period.label}</span>
          <span className="hidden whitespace-nowrap text-xs text-subtle xl:inline">
            {formatShort(period.from)} – {formatShort(period.to)}
          </span>
          <ChevronDown className={clsx("size-4 shrink-0 text-subtle transition-transform", open && "rotate-180")} />
        </button>
      )}
    >
      {({ close }) => <PeriodPanel onDone={close} />}
    </Popover>
  );
}

// ------------------------------------------------------------------ Colaboradores
export function PeoplePanel({ autoFocus = false }: { autoFocus?: boolean }) {
  const { people, filters, setPeople, togglePerson, setIncludeOthers, scoped, model } = useApp();
  const [query, setQuery] = useState("");
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const i of model?.work ?? []) if (i.personKey && i.cat !== "Completed") c.set(i.personKey, (c.get(i.personKey) ?? 0) + 1);
    return c;
  }, [model]);
  const selected = new Set(filters.people);
  const visible = people.filter((p) => !query || normalizeText(`${p.name} ${p.email ?? ""} ${p.role ?? ""}`).includes(normalizeText(query)));
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar colaborador…"
          className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm outline-none focus:border-accent focus-visible:outline-none"
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <button onClick={() => setPeople([])} className="font-semibold text-accent-fg hover:underline">
          Todo el equipo
        </button>
        <span className="text-subtle">{scoped.length.toLocaleString("es-CO")} ítems en el alcance</span>
      </div>
      <ul className="scrollbar-thin -mx-1 max-h-[18rem] overflow-y-auto px-1" role="listbox" aria-multiselectable>
        {visible.map((p) => {
          const on = selected.has(p.key);
          return (
            <li key={p.key}>
              <button
                role="option"
                aria-selected={on}
                onClick={() => togglePerson(p.key)}
                className={clsx("flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition", on ? "bg-accent-soft" : "hover:bg-surface-2")}
              >
                <span className={clsx("grid size-4 shrink-0 place-items-center rounded border", on ? "border-accent bg-accent text-white" : "border-line-strong")}>
                  {on && <Check className="size-3" />}
                </span>
                <Avatar name={p.name} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm">
                    <span className="truncate">{p.name}</span>
                    <PersonBadges person={p} />
                  </span>
                  <span className="block truncate text-[0.6875rem] text-subtle">{personRoleLabel(p)}</span>
                </span>
                <span className="rounded-md bg-surface-3 px-1.5 text-[0.6875rem] tabular-nums text-muted" title="Ítems abiertos">
                  {counts.get(p.key) ?? 0}
                </span>
              </button>
            </li>
          );
        })}
        {visible.length === 0 && <li className="px-2 py-4 text-center text-sm text-muted">Sin coincidencias</li>}
      </ul>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-xs">
        <span>
          <span className="block font-semibold text-foreground">Incluir fuera de Global</span>
          <span className="text-subtle">Asignados en Azure que no están en Global</span>
        </span>
        <input type="checkbox" checked={filters.includeOthers} onChange={(e) => setIncludeOthers(e.target.checked)} className="size-4 accent-[var(--accent)]" />
      </label>
    </div>
  );
}

export function PeopleFilter({ className }: { className?: string }) {
  const { people, filters, setPeople } = useApp();
  const selected = new Set(filters.people);
  const label =
    selected.size === 0
      ? "Todo el equipo"
      : selected.size === 1
        ? (people.find((p) => selected.has(p.key))?.name.split(" ").slice(0, 2).join(" ") ?? "1 colaborador")
        : `${selected.size} colaboradores`;
  return (
    <Popover
      className={className}
      panelClassName="w-[22rem]"
      trigger={({ open, toggle }) => (
        <div className={triggerClass(selected.size > 0)}>
          <button onClick={toggle} aria-expanded={open} className="flex min-w-0 items-center gap-2" title="Filtrar por colaborador">
            <Users className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
            <ChevronDown className={clsx("size-4 shrink-0 text-subtle transition-transform", open && "rotate-180")} />
          </button>
          {selected.size > 0 && (
            <button onClick={() => setPeople([])} aria-label="Quitar filtro de colaboradores" className="grid size-5 place-items-center rounded-md hover:bg-accent/15">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}
    >
      {() => <PeoplePanel autoFocus />}
    </Popover>
  );
}

// ------------------------------------------------------------------ Épica
/** Nombre corto de cada épica: quita las palabras iniciales comunes ("Certificación CORE" → "CORE"). */
export function epicShortLabels(epics: EpicRef[]) {
  const words = epics.map((e) => e.title.split(/\s+/));
  let common = 0;
  while (epics.length > 1 && words.every((w) => w.length > common + 1 && w[common] === words[0][common])) common++;
  return new Map(epics.map((e, i) => [e.id, words[i].slice(common).join(" ") || e.title]));
}

/** Lista de épicas con casillas (selección múltiple; ninguna = todas). Para proyectos con más de 2 épicas. */
export function EpicPanel() {
  const { epics, filters, setEpics, model, range } = useApp();
  const counts = useMemo(() => {
    const out = new Map<number, number>();
    for (const i of model?.work ?? []) if (i.epicId !== null && inEpics(i, []) && isAlive(i, range)) out.set(i.epicId, (out.get(i.epicId) ?? 0) + 1);
    return out;
  }, [model, range]);
  const selected = new Set(filters.epics);
  const toggle = (id: number) => {
    const next = selected.has(id) ? filters.epics.filter((e) => e !== id) : [...filters.epics, id];
    setEpics(next.length === epics.length ? [] : next);
  };
  const box = (on: boolean) => (
    <span className={clsx("grid size-4 shrink-0 place-items-center rounded border", on ? "border-accent bg-accent text-white" : "border-line-strong")}>{on && <Check className="size-3" />}</span>
  );
  return (
    <ul className="space-y-0.5">
      <li>
        <button onClick={() => setEpics([])} aria-pressed={selected.size === 0} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm font-semibold hover:bg-surface-2">
          {box(selected.size === 0)}
          <Layers className="size-4 shrink-0 text-accent-fg" />
          <span className="min-w-0 flex-1 truncate">Todas las épicas</span>
        </button>
      </li>
      {epics.map((e) => (
        <li key={e.id}>
          <button onClick={() => toggle(e.id)} aria-pressed={selected.has(e.id)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-surface-2" title={`${e.title} (#${e.id})`}>
            {box(selected.has(e.id))}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{e.title}</span>
              <span className="block text-[0.6875rem] text-subtle">#{e.id}</span>
            </span>
            <span className="rounded-md bg-surface-3 px-1.5 text-[0.6875rem] tabular-nums text-muted" title="Ítems asignados en el periodo">
              {counts.get(e.id) ?? 0}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Resumen corto de la selección de épicas ("CORE", "3 épicas"); undefined = todas. */
export function epicSelectionLabel(epics: EpicRef[], selected: number[]) {
  if (!selected.length) return undefined;
  if (selected.length === 1) return epicShortLabels(epics).get(selected[0]);
  return `${selected.length} épicas`;
}

/**
 * Filtro por épica monitoreada. Con una sola épica, solo la nombra (el tablero siempre se limita a ella);
 * con 2, botones; con más, un panel con casillas (en el panel de filtros móvil, `inline`).
 */
export function EpicFilter({ className, inline = false }: { className?: string; inline?: boolean }) {
  const { epics, filters, setEpics } = useApp();
  if (!epics.length) return null;
  if (epics.length === 1) {
    return (
      <span className={clsx("inline-flex h-10 min-w-0 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 text-xs font-medium text-muted", className)} title="Épica monitoreada">
        <Layers className="size-4 shrink-0 text-accent-fg" />
        <span className="truncate">Épica: {epics[0].title}</span>
      </span>
    );
  }
  if (epics.length > 2) {
    if (inline) return <EpicPanel />;
    const label = epicSelectionLabel(epics, filters.epics);
    return (
      <Popover
        className={className}
        panelClassName="w-[20rem] max-w-[calc(100vw-2rem)]"
        trigger={({ open, toggle }) => (
          <div className={triggerClass(filters.epics.length > 0)}>
            <button onClick={toggle} aria-expanded={open} className="flex min-w-0 items-center gap-2" title="Filtrar por épica">
              <Layers className="size-4 shrink-0" />
              <span className="max-w-[14rem] truncate">{label ? `Épica: ${label}` : "Todas las épicas"}</span>
              <ChevronDown className={clsx("size-4 shrink-0 text-subtle transition-transform", open && "rotate-180")} />
            </button>
            {filters.epics.length > 0 && (
              <button onClick={() => setEpics([])} aria-label="Quitar filtro de épica" className="grid size-5 place-items-center rounded-md hover:bg-accent/15">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}
      >
        {() => <EpicPanel />}
      </Popover>
    );
  }
  const short = epicShortLabels(epics);
  return (
    <Segmented
      className={className}
      size="sm"
      value={filters.epics.length === 1 ? String(filters.epics[0]) : "all"}
      onChange={(v) => setEpics(v === "all" ? [] : [Number(v)])}
      options={[
        { value: "all", label: "Todas las épicas", icon: Layers, title: epics.map((e) => e.title).join(" · ") },
        ...epics.map((e) => ({ value: String(e.id), label: short.get(e.id)!, title: `${e.title} (#${e.id})` })),
      ]}
    />
  );
}

// ------------------------------------------------------------------ Tag
/** Filtro por tag de Azure (solo en proyectos con meta por tags, p. ej. 348: Video / Informe). */
export function TagFilter({ className }: { className?: string }) {
  const { tags, filters, setTag } = useApp();
  if (!tags.length) return null;
  return (
    <Segmented
      className={className}
      size="sm"
      value={filters.tag ?? "all"}
      onChange={(v) => setTag(v === "all" ? null : v)}
      options={[
        { value: "all", label: "Todos los tags", icon: Tag, title: `Sin filtro de tag (${tags.join(" · ")})` },
        ...tags.map((t) => ({ value: t, label: t, title: `Solo ítems con el tag ${t}` })),
      ]}
    />
  );
}

// ------------------------------------------------------------------ Estado de sincronización
export function SyncChip({ compact = false }: { compact?: boolean }) {
  const { sync, syncNow, syncing, dataset, nextAutoSync } = useApp();
  const running = syncing || sync?.running;
  const error = sync?.lastStatus === "error";
  const label = running
    ? "Sincronizando…"
    : sync?.lastAt
      ? `Azure · ${formatDistanceToNow(new Date(sync.lastAt), { locale: es, addSuffix: true })}`
      : dataset.isLoading
        ? "Cargando…"
        : "Sin sincronizar";
  return (
    <button
      onClick={() => void syncNow()}
      disabled={!!running}
      title={
        error
          ? `Última sincronización con error: ${sync?.lastError ?? ""}`
          : `Sincronizar ahora (solo lectura) · automática cada hora${nextAutoSync ? `, próxima a las ${formatTime(new Date(nextAutoSync).toISOString())}` : ""}`
      }
      className={clsx(
        "flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-medium shadow-sm transition disabled:cursor-progress",
        error ? "border-critical/40 bg-critical-soft text-critical-fg" : "border-line bg-surface text-muted hover:text-foreground",
      )}
    >
      <span className={clsx("size-2 shrink-0 rounded-full", running ? "animate-pulse bg-warning" : error ? "bg-critical" : "bg-good")} />
      {!compact && <span className="whitespace-nowrap">{label}</span>}
      <RefreshCw className={clsx("size-3.5 shrink-0", running && "animate-spin")} />
    </button>
  );
}

// ------------------------------------------------------------------ Mundo de análisis (Tareas / HU / Bugs)
const VIEW_ICON: Record<WorkView["key"], typeof ListChecks> = { tasks: ListChecks, hu: ClipboardList, bugs: Bug };
/** Vistas donde aplica el mundo de análisis (Cumplimiento muestra los tres a la vez). */
const VIEW_ROUTES = ["/", "/colaboradores", "/cronograma"];

/** ¿Se muestra el selector de mundo en esta ruta? (solo proyectos con más de un mundo) */
export function useViewFilterVisible() {
  const { views } = useApp();
  const pathname = usePathname();
  return views.length > 1 && VIEW_ROUTES.includes(pathname);
}

/** Selector "Tareas | Historias de usuario | Bugs": separa los tres mundos en Resumen, Colaboradores y Cronograma. */
export function ViewFilter({ className, full = false }: { className?: string; full?: boolean }) {
  const { views, view, setView } = useApp();
  if (views.length < 2) return null;
  return (
    <Segmented
      className={className}
      size="sm"
      value={view.key}
      onChange={setView}
      options={views.map((v) => ({
        value: v.key,
        label: full ? v.label : v.short,
        icon: VIEW_ICON[v.key],
        title: v.dated ? `Analizar solo ${v.label.toLowerCase()} (con métricas de tiempo)` : `${v.label}: quién las tiene, cuántas y en qué estado van (sin fechas)`,
      }))}
    />
  );
}

/** Barra completa de filtros (escritorio). */
export function FilterBar() {
  const showView = useViewFilterVisible();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showView && <ViewFilter />}
      <PeriodPicker />
      <PeopleFilter />
      <EpicFilter />
      <TagFilter />
    </div>
  );
}

/** Botón que resume los filtros y abre el panel en móvil. */
export function MobileFiltersButton() {
  const { period, filters, epics, setFiltersOpen, view } = useApp();
  const epic = epicSelectionLabel(epics, filters.epics);
  const showView = useViewFilterVisible();
  return (
    <button onClick={() => setFiltersOpen(true)} className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm shadow-sm">
      <SlidersHorizontal className="size-4 shrink-0 text-accent-fg" />
      <span className="truncate">
        {showView && `${view.short} · `}
        {period.label}
        {filters.people.length > 0 && ` · ${filters.people.length} pers.`}
        {epic && ` · ${epic}`}
        {filters.tag && ` · ${filters.tag}`}
      </span>
    </button>
  );
}
