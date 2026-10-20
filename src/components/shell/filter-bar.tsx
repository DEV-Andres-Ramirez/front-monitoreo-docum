"use client";

import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarRange, Check, ChevronDown, Layers, RefreshCw, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Segmented } from "@/components/ui/primitives";
import { Popover } from "@/components/ui/popover";
import { normalizeText } from "@/lib/analytics/model";
import { PRESET_LABEL, type PeriodPreset } from "@/lib/analytics/period";
import { formatShort, formatTime } from "@/lib/dates";
import { useApp } from "./app-provider";

const PRESETS: PeriodPreset[] = ["sprint", "14d", "30d", "90d", "month", "quarter"];

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
  return (
    <div className="space-y-3">
      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-subtle">Periodo de análisis</p>
      <div className="grid grid-cols-2 gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => {
              setPreset(p);
              onDone?.();
            }}
            className={clsx(
              "rounded-xl px-3 py-2 text-left text-sm transition",
              period.preset === p ? "bg-accent text-white" : "bg-surface-2 text-foreground hover:bg-surface-3",
            )}
          >
            {PRESET_LABEL[p]}
          </button>
        ))}
      </div>
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
                  <span className="block truncate text-sm">{p.name}</span>
                  <span className="block truncate text-[0.6875rem] text-subtle">{p.inRoster ? p.role : "Fuera de la planeación"}</span>
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
          <span className="block font-semibold text-foreground">Incluir fuera de la planeación</span>
          <span className="text-subtle">Asignados en Azure que no están en el Excel</span>
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

// ------------------------------------------------------------------ Ámbito
export function ScopeToggle({ className }: { className?: string }) {
  const { filters, setScope } = useApp();
  return (
    <Segmented
      className={className}
      size="sm"
      value={filters.scope}
      onChange={setScope}
      options={[
        { value: "project", label: "Todo el proyecto", title: "HU, tareas y bugs de todo el proyecto" },
        { value: "epics", label: "Épicas monitoreadas", icon: Layers, title: "Solo lo que cuelga de las épicas configuradas" },
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

/** Barra completa de filtros (escritorio). */
export function FilterBar() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PeriodPicker />
      <PeopleFilter />
      <ScopeToggle />
    </div>
  );
}

/** Botón que resume los filtros y abre el panel en móvil. */
export function MobileFiltersButton() {
  const { period, filters, setFiltersOpen } = useApp();
  return (
    <button onClick={() => setFiltersOpen(true)} className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm shadow-sm">
      <SlidersHorizontal className="size-4 shrink-0 text-accent-fg" />
      <span className="truncate">
        {period.label}
        {filters.people.length > 0 && ` · ${filters.people.length} pers.`}
        {filters.scope === "epics" && " · épicas"}
      </span>
    </button>
  );
}
