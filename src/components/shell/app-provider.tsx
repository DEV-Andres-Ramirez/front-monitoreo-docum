"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR, { type KeyedMutator } from "swr";
import { ActivityForm, type ActivityFormState } from "@/components/dashboard/activity-form";
import { api, fetcher, useProjectKey } from "@/components/dashboard/client-api";
import { MemberDrawer } from "@/components/dashboard/member-drawer";
import { WorkItemSheet } from "@/components/dashboard/work-item-sheet";
import { isSheetOpen } from "@/components/ui/sheet";
import { PROJECTS, type ProjectKey, type ProjectMeta } from "@/lib/config";
import { addDaysISO, todayISO, weekRange } from "@/lib/dates";
import type { Activity, StatsResponse, TeamMember, TeamResponse, WorkItemsResponse } from "@/lib/types";
import { CommandPalette } from "./command-palette";
import { NAV } from "./nav";
import { ShortcutsDialog } from "./shortcuts-dialog";

type Remote<T> = { data?: T; error?: Error; isLoading: boolean; mutate: KeyedMutator<T> };

type AppContextValue = {
  projectKey: ProjectKey;
  project: ProjectMeta;
  setProjectKey: (key: ProjectKey) => void;
  today: string;
  date: string;
  setDate: (date: string) => void;
  team: Remote<TeamResponse>;
  /** Datos del equipo del proyecto activo (undefined mientras carga o si son de otro proyecto) */
  teamData?: TeamResponse;
  members: TeamMember[];
  week: Remote<StatsResponse>;
  weekData?: StatsResponse;
  workItems: Remote<WorkItemsResponse>;
  openRegister: (member?: TeamMember | null, date?: string) => void;
  openEdit: (activity: Activity) => void;
  openMember: (member: TeamMember, date?: string) => void;
  openMemberById: (employeeId: string, date?: string) => void;
  openWorkItem: (id: number) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  syncAzure: () => Promise<void>;
  syncing: boolean;
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [projectKey, setProjectKeyRaw] = useProjectKey();
  const [today] = useState(todayISO);
  const [date, setDateRaw] = useState(today);
  const [form, setForm] = useState<ActivityFormState>({ open: false });
  const [drawer, setDrawer] = useState<{ member: TeamMember | null; date?: string }>({ member: null });
  const [workItemId, setWorkItemId] = useState<number | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const setDate = useCallback((d: string) => setDateRaw(d > today ? today : d), [today]);
  const week = weekRange(date);

  const team = useSWR<TeamResponse>(`/api/projects/${projectKey}/team?date=${date}`, fetcher, { keepPreviousData: true });
  const weekStats = useSWR<StatsResponse>(`/api/projects/${projectKey}/stats?from=${week.start}&to=${week.end}`, fetcher, {
    keepPreviousData: true,
  });
  const workItems = useSWR<WorkItemsResponse>(`/api/projects/${projectKey}/work-items`, fetcher, { revalidateOnFocus: false });

  const teamData = team.data?.projectKey === projectKey ? team.data : undefined;
  const weekData = weekStats.data?.projectKey === projectKey ? weekStats.data : undefined;
  const members = useMemo(() => teamData?.members ?? [], [teamData]);

  const setProjectKey = useCallback(
    (key: ProjectKey) => {
      if (key === projectKey) return;
      setDrawer({ member: null });
      setWorkItemId(null);
      setProjectKeyRaw(key);
      toast.message(`Proyecto ${key} · ${PROJECTS[key].name}`, { description: PROJECTS[key].client, duration: 1800 });
    },
    [projectKey, setProjectKeyRaw],
  );

  const openRegister = useCallback((member?: TeamMember | null, d?: string) => setForm({ open: true, member: member ?? null, activity: null, date: d }), []);
  const openEdit = useCallback((activity: Activity) => setForm({ open: true, member: null, activity }), []);
  const openMember = useCallback((member: TeamMember, d?: string) => setDrawer({ member, date: d }), []);
  const openMemberById = useCallback(
    (employeeId: string, d?: string) => {
      const m = members.find((x) => x.employeeId === employeeId);
      if (m) setDrawer({ member: m, date: d });
    },
    [members],
  );

  const syncAzure = useCallback(async () => {
    setSyncing(true);
    try {
      await api(`/api/projects/${projectKey}/work-items`, { method: "POST" });
      await workItems.mutate();
      toast.success("Backlog de Azure sincronizado", { description: "Lectura de solo consulta: Azure no se modifica." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo sincronizar Azure");
    } finally {
      setSyncing(false);
    }
  }, [projectKey, workItems]);

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
        case "n":
        case "N":
          e.preventDefault();
          openRegister(null);
          break;
        case "t":
        case "T":
          setDate(today);
          break;
        case "ArrowLeft":
          setDate(addDaysISO(date, -1));
          break;
        case "ArrowRight":
          setDate(addDaysISO(date, 1));
          break;
        case "?":
          setShortcutsOpen(true);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [date, today, paletteOpen, openRegister, setDate, router]);

  const value: AppContextValue = {
    projectKey,
    project: PROJECTS[projectKey],
    setProjectKey,
    today,
    date,
    setDate,
    team,
    teamData,
    members,
    week: weekStats,
    weekData,
    workItems,
    openRegister,
    openEdit,
    openMember,
    openMemberById,
    openWorkItem: setWorkItemId,
    paletteOpen,
    setPaletteOpen,
    setShortcutsOpen,
    syncAzure,
    syncing,
    logout,
  };

  const closeForm = useCallback(() => setForm((f) => ({ ...f, open: false })), []);
  const closeDrawer = useCallback(() => setDrawer({ member: null }), []);
  const closeWorkItem = useCallback(() => setWorkItemId(null), []);

  return (
    <AppContext value={value}>
      {/* display: contents → el acento del proyecto llega también a paneles, paleta y diálogos */}
      <div data-project={projectKey} className="contents">
        {children}
        <MemberDrawer
          member={drawer.member}
          date={drawer.date ?? date}
          projectKey={projectKey}
          onClose={closeDrawer}
          onRegister={openRegister}
          onEdit={openEdit}
        />
        <WorkItemSheet
          workItemId={workItemId}
          items={workItems.data?.items}
          projectKey={projectKey}
          members={members}
          today={today}
          onClose={closeWorkItem}
          onEdit={openEdit}
        />
        <ActivityForm
          state={form}
          onClose={closeForm}
          projectKey={projectKey}
          members={members}
          defaultDate={date}
          today={today}
          workItems={{ items: workItems.data?.items, loading: workItems.isLoading, error: workItems.error?.message }}
        />
        <CommandPalette />
        <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    </AppContext>
  );
}
