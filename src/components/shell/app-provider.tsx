"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig, type KeyedMutator } from "swr";
import { api, fetcher, readStored, useProjectKey, useStored, writeStored } from "@/components/dashboard/client-api";
import { MemberSheet } from "@/components/dashboard/member-sheet";
import { WorkItemSheet } from "@/components/dashboard/work-item-sheet";
import { toggleFullscreen } from "@/components/ui/display";
import { changeScale } from "@/components/ui/display-controls";
import { isSheetOpen } from "@/components/ui/sheet";
import { periodRange, previousRange, scopedWork, trendRange, visiblePeople, type Filters, type Range, type TimeUnit } from "@/lib/analytics/metrics";
import { buildModel, type EpicRef, type Item, type Model, type Person } from "@/lib/analytics/model";
import { DEFAULT_PRESET, comparisonLabel, resolvePreset, type PeriodPreset } from "@/lib/analytics/period";
import type { DatasetResponse, SyncInfo } from "@/lib/analytics/types";
import { PROJECT_KEYS, PROJECTS, type ProjectKey, type ProjectMeta } from "@/lib/config";
import { todayISO } from "@/lib/dates";
import { CommandPalette } from "./command-palette";
import { NAV } from "./nav";
import { ShortcutsDialog } from "./shortcuts-dialog";

// `epics` vacío = todas las épicas monitoreadas del proyecto (el antiguo `scope` guardado se ignora)
// `v: 2` marca los filtros guardados con los periodos nuevos (Hoy / Ayer / semanas): los anteriores
// conservan personas y épicas pero vuelven al periodo por defecto.
type StoredFilters = { v?: number; preset: PeriodPreset; from: string; to: string; people: string[]; includeOthers: boolean; epics?: number[]; tag?: string | null };
type StoredIteration = { name: string; start: number; end: number; count: number };
const DEFAULT_FILTERS: StoredFilters = { v: 2, preset: DEFAULT_PRESET, from: "", to: "", people: [], includeOthers: false, epics: [] };
const NO_EPICS: EpicRef[] = [];
const NO_ITERATIONS: StoredIteration[] = [];

type AutoSyncResponse = { results: Record<ProjectKey, { status: "ok" | "skipped" | "error" }>; nextAutoAt: string | null };
const MINUTE = 60_000;
/** Próxima revisión: lo que diga el servidor, nunca antes de 30 s (evita reprogramar en el mismo instante). */
const nextCheck = (iso: string | null) => Math.max(iso ? Date.parse(iso) : Date.now() + MINUTE, Date.now() + 30_000);

type AppContextValue = {
  projectKey: ProjectKey;
  project: ProjectMeta;
  setProjectKey: (key: ProjectKey) => void;
  today: string;
  /** Periodo resuelto + etiqueta */
  period: { preset: PeriodPreset; from: string; to: string; label: string };
  /** Texto de la comparación de los indicadores ("vs. día hábil anterior", …) */
  comparison: string;
  /** Ventana de las gráficas de tendencia (el periodo, o 7 días si es más corto) */
  trend: Range;
  /** Gráficas por día o por semana (preferencia compartida) */
  chartUnit: TimeUnit;
  setChartUnit: (unit: TimeUnit) => void;
  setPreset: (preset: PeriodPreset) => void;
  setCustomPeriod: (from: string, to: string) => void;
  filters: Filters;
  setPeople: (keys: string[]) => void;
  togglePerson: (key: string) => void;
  setIncludeOthers: (value: boolean) => void;
  /** Épicas monitoreadas del proyecto (las que se pueden filtrar) */
  epics: EpicRef[];
  setEpics: (ids: number[]) => void;
  /** Tags filtrables del proyecto (los de su meta; vacío si no tiene) */
  tags: string[];
  setTag: (tag: string | null) => void;
  range: Range;
  prevRange: Range;
  dataset: { data?: DatasetResponse; error?: Error; isLoading: boolean; mutate: KeyedMutator<DatasetResponse> };
  model?: Model;
  /** Ítems de trabajo dentro del alcance (personas + ámbito), sin recortar por periodo */
  scoped: Item[];
  /** Personas visibles (planeación ± fuera de la planeación) */
  people: Person[];
  sync?: SyncInfo;
  syncNow: (full?: boolean) => Promise<void>;
  syncing: boolean;
  /** Próxima sincronización automática (cada hora, ambos proyectos) */
  nextAutoSync: number | null;
  openWorkItem: (id: number) => void;
  openPerson: (key: string) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  filtersOpen: boolean;
  setFiltersOpen: (open: boolean) => void;
  logout: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = use(AppContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de <AppProvider>");
  return ctx;
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

const isoLocal = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [projectKey, setProjectKeyRaw] = useProjectKey();
  const [today] = useState(todayISO);
  const [stored, setStored] = useStored<StoredFilters>(`docum:filters:${projectKey}`, DEFAULT_FILTERS);
  const [iterations] = useStored<StoredIteration[]>(`docum:iterations:${projectKey}`, NO_ITERATIONS);
  const [workItemId, setWorkItemId] = useState<number | null>(null);
  const [personKey, setPersonKey] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [nextAutoSync, setNextAutoSync] = useState<number | null>(null);
  const { mutate } = useSWRConfig();

  // --- Periodo (los presets son relativos a hoy; "Sprint actual" usa las iteraciones conocidas) ---
  const storedPreset = stored.v === 2 ? stored.preset : DEFAULT_PRESET;
  const period = useMemo(() => {
    if (storedPreset === "custom" && stored.from && stored.to) {
      return { preset: "custom" as const, from: stored.from, to: stored.to, label: "Personalizado" };
    }
    return resolvePreset(storedPreset === "custom" ? DEFAULT_PRESET : storedPreset, today, iterations);
  }, [storedPreset, stored.from, stored.to, today, iterations]);

  const range = useMemo(() => periodRange(period), [period]);
  const prevRange = useMemo(() => previousRange(range, period.preset), [range, period.preset]);
  const trend = useMemo(() => trendRange(range), [range]);
  const [chartUnit, setChartUnit] = useStored<TimeUnit>("docum:chart-unit", "day");

  // El dataset incluye el periodo anterior (deltas) y la ventana de tendencia (gráficas)
  const fetchFrom = isoLocal(Math.min(prevRange.from, trend.from));
  const dataset = useSWR<DatasetResponse>(`/api/projects/${projectKey}/dataset?from=${fetchFrom}&to=${period.to}`, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    // Mientras el servidor sincroniza con Azure en segundo plano, se consulta de nuevo
    refreshInterval: (data) => (data?.sync.running ? 8000 : 0),
  });
  const data = dataset.data?.projectKey === projectKey ? dataset.data : undefined;
  const model = useMemo(() => (data ? buildModel(data) : undefined), [data]);
  const epics = model?.epics ?? NO_EPICS;
  const tags = useMemo(() => PROJECTS[projectKey].goal?.tags.map((t) => t.tag) ?? [], [projectKey]);

  // El dataset trae siempre las épicas monitoreadas; el filtro descarta IDs que ya no estén configurados
  const filters: Filters = useMemo(
    () => ({
      from: period.from,
      to: period.to,
      people: stored.people,
      includeOthers: stored.includeOthers,
      epics: (stored.epics ?? []).filter((id) => epics.some((e) => e.id === id)),
      tag: stored.tag && tags.includes(stored.tag) ? stored.tag : null,
    }),
    [period.from, period.to, stored.people, stored.includeOthers, stored.epics, epics, stored.tag, tags],
  );

  // Guarda las iteraciones conocidas (para resolver "Sprint actual" sin depender del periodo)
  useEffect(() => {
    if (!model?.iterations.length) return;
    const key = `docum:iterations:${projectKey}`;
    const known = readStored<StoredIteration[]>(key, NO_ITERATIONS);
    const merged = new Map(known.map((i) => [`${i.name}|${i.start}`, i]));
    for (const i of model.iterations) merged.set(`${i.name}|${i.start}`, i);
    if (merged.size !== known.length) writeStored(key, [...merged.values()]);
  }, [model, projectKey]);

  const people = useMemo(() => (model ? visiblePeople(model, filters) : []), [model, filters]);
  const scoped = useMemo(() => (model ? scopedWork(model, filters) : []), [model, filters]);

  const update = useCallback(
    (patch: Partial<StoredFilters>) => setStored({ ...stored, v: 2, preset: storedPreset, ...patch }),
    [stored, storedPreset, setStored],
  );

  const setProjectKey = useCallback(
    (key: ProjectKey) => {
      if (key === projectKey) return;
      setWorkItemId(null);
      setPersonKey(null);
      setProjectKeyRaw(key);
      toast.message(`Proyecto ${key} · ${PROJECTS[key].name}`, { description: PROJECTS[key].client, duration: 1800 });
    },
    [projectKey, setProjectKeyRaw],
  );

  // --- Sincronización automática cada hora (ambos proyectos) mientras el tablero esté abierto ---
  // El servidor decide qué proyecto ya cumplió su hora (o su reintento tras un error).
  const refreshAutoSchedule = useCallback(async () => {
    try {
      const r = await api<{ nextAutoAt: string | null }>("/api/sync/auto");
      setNextAutoSync(nextCheck(r.nextAutoAt));
    } catch {
      setNextAutoSync(Date.now() + 10 * MINUTE);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<{ nextAutoAt: string | null }>("/api/sync/auto")
      .then((r) => !cancelled && setNextAutoSync(nextCheck(r.nextAutoAt)))
      .catch(() => !cancelled && setNextAutoSync(Date.now() + 10 * MINUTE));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (nextAutoSync === null) return;
    const delay = Math.min(Math.max(nextAutoSync - Date.now(), 0), 60 * MINUTE);
    const timer = setTimeout(async () => {
      const due = nextAutoSync <= Date.now() + 1000;
      if (due) setAutoSyncing(true);
      try {
        const r = await api<AutoSyncResponse>("/api/sync/auto", { method: "POST" });
        const synced = PROJECT_KEYS.filter((k) => r.results[k]?.status === "ok");
        await Promise.all(synced.map((k) => mutate((key) => typeof key === "string" && /^\/api\/projects\/[^/]+\/(dataset|goal)/.test(key) && key.startsWith(`/api/projects/${k}/`))));
        setNextAutoSync(nextCheck(r.nextAutoAt));
      } catch {
        setNextAutoSync(Date.now() + 10 * MINUTE);
      } finally {
        setAutoSyncing(false);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [nextAutoSync, mutate]);

  const syncNow = useCallback(
    async (full = false) => {
      setSyncing(true);
      const id = toast.loading(full ? "Resincronizando todo desde Azure…" : "Sincronizando con Azure…", { description: "Solo lectura: Azure no se modifica." });
      try {
        const res = await api<{ items: number; revisions: number; status: string }>(`/api/projects/${projectKey}/sync${full ? "?full=1" : ""}`, {
          method: "POST",
        });
        await Promise.all([dataset.mutate(), mutate(`/api/projects/${projectKey}/goal`)]);
        toast.success(res.status === "skipped" ? "Ya hay una sincronización en curso" : "Datos de Azure actualizados", {
          id,
          description: res.status === "ok" ? `${res.items} ítems y ${res.revisions} cambios leídos` : undefined,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo sincronizar", { id });
      } finally {
        setSyncing(false);
        void refreshAutoSchedule();
      }
    },
    [projectKey, dataset, mutate, refreshAutoSchedule],
  );

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  }, [router]);

  // --- Atajos de teclado ---
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || paletteOpen || isSheetOpen()) return;
      const nav = NAV.find((n) => n.key === e.key);
      if (nav) {
        router.push(nav.href);
        return;
      }
      switch (e.key) {
        case "+":
        case "=":
          e.preventDefault();
          changeScale(1);
          break;
        case "-":
        case "_":
          e.preventDefault();
          changeScale(-1);
          break;
        case "0":
          changeScale(0);
          break;
        case "f":
        case "F":
          void toggleFullscreen();
          break;
        case "?":
          setShortcutsOpen(true);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, router]);

  const value: AppContextValue = {
    projectKey,
    project: PROJECTS[projectKey],
    setProjectKey,
    today,
    period,
    comparison: comparisonLabel(period.preset),
    trend,
    chartUnit,
    setChartUnit,
    setPreset: (preset) => update({ preset }),
    setCustomPeriod: (from, to) => update({ preset: "custom", from, to }),
    filters,
    setPeople: (keys) => update({ people: keys }),
    togglePerson: (key) => update({ people: stored.people.includes(key) ? stored.people.filter((k) => k !== key) : [...stored.people, key] }),
    setIncludeOthers: (includeOthers) =>
      update({ includeOthers, people: includeOthers ? stored.people : stored.people.filter((k) => model?.people.get(k)?.inRoster) }),
    epics,
    setEpics: (ids) => update({ epics: ids }),
    tags,
    setTag: (tag) => update({ tag }),
    range,
    prevRange,
    dataset: { data, error: dataset.error, isLoading: !data && !dataset.error, mutate: dataset.mutate },
    model,
    scoped,
    people,
    sync: data?.sync,
    syncNow,
    syncing: syncing || autoSyncing,
    nextAutoSync,
    openWorkItem: setWorkItemId,
    openPerson: setPersonKey,
    paletteOpen,
    setPaletteOpen,
    setShortcutsOpen,
    filtersOpen,
    setFiltersOpen,
    logout,
  };

  const closeWorkItem = useCallback(() => setWorkItemId(null), []);
  const closePerson = useCallback(() => setPersonKey(null), []);

  return (
    <AppContext value={value}>
      {/* display: contents → el acento del proyecto llega también a paneles, paleta y diálogos */}
      <div data-project={projectKey} className="contents">
        {children}
        <MemberSheet personKey={personKey} onClose={closePerson} />
        <WorkItemSheet workItemId={workItemId} onClose={closeWorkItem} />
        <CommandPalette />
        <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    </AppContext>
  );
}
