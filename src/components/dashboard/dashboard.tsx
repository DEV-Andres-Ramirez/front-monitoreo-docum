"use client";

import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { LayoutGrid, Plus, RefreshCw, Table2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { PROJECTS } from "@/lib/config";
import { todayISO, weekRange } from "@/lib/dates";
import type { Activity, TeamMember, TeamResponse, WorkItemsResponse } from "@/lib/types";
import { ActivitiesTable } from "./activities-table";
import { ActivityForm, type ActivityFormState } from "./activity-form";
import { api, fetcher, useProjectKey } from "./client-api";
import { DateNav } from "./date-nav";
import { Header } from "./header";
import { KpiCards } from "./kpi-cards";
import { MemberDrawer } from "./member-drawer";
import { TeamGrid } from "./team-grid";

type Tab = "equipo" | "actividades";

export function Dashboard() {
  const [projectKey, setProjectKey] = useProjectKey();
  const [date, setDate] = useState(todayISO);
  const [tab, setTab] = useState<Tab>("equipo");
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [form, setForm] = useState<ActivityFormState>({ open: false });
  const [syncing, setSyncing] = useState(false);
  const project = PROJECTS[projectKey];

  const team = useSWR<TeamResponse>(`/api/projects/${projectKey}/team?date=${date}`, fetcher, { keepPreviousData: true });
  const workItems = useSWR<WorkItemsResponse>(`/api/projects/${projectKey}/work-items`, fetcher, {
    revalidateOnFocus: false,
  });

  // keepPreviousData conserva el dato anterior: se descarta si es de otro proyecto.
  const teamData = team.data?.projectKey === projectKey ? team.data : undefined;
  const members = teamData?.members ?? [];

  const closeForm = useCallback(() => setForm((f) => ({ ...f, open: false })), []);
  const closeDrawer = useCallback(() => setSelected(null), []);
  const openRegister = (member: TeamMember | null) => setForm({ open: true, member, activity: null });
  const openEdit = (activity: Activity) => setForm({ open: true, member: null, activity });

  async function syncAzure() {
    setSyncing(true);
    try {
      await api(`/api/projects/${projectKey}/work-items`, { method: "POST" });
      await workItems.mutate();
      toast.success("Backlog de Azure sincronizado (solo lectura)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo sincronizar Azure");
    } finally {
      setSyncing(false);
    }
  }

  function changeProject(key: typeof projectKey) {
    if (key === projectKey) return;
    setSelected(null);
    setProjectKey(key);
  }

  return (
    <div
      className="app-bg min-h-dvh flex-1"
      style={{ "--accent": project.accent, "--accent-soft": project.accentSoft } as React.CSSProperties}
    >
      <Header projectKey={projectKey} onProjectChange={changeProject} />

      <main className="mx-auto max-w-7xl space-y-6 px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
        {/* Encabezado del proyecto */}
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={projectKey}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.3 }}
              className="min-w-0"
            >
              <p className="accent-transition text-xs font-semibold uppercase tracking-[0.18em] text-accent">{project.client}</p>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {projectKey} · {project.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full border border-line bg-white px-2.5 py-1">Épicas: {project.epics}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1">
                  <span className={`size-1.5 rounded-full ${workItems.error ? "bg-red-500" : workItems.data ? "bg-emerald-500" : "animate-pulse bg-amber-400"}`} />
                  Azure DevOps ·{" "}
                  {workItems.error
                    ? "sin conexión"
                    : workItems.data
                      ? `${workItems.data.items.length} ítems · ${formatDistanceToNow(new Date(workItems.data.fetchedAt), { locale: es, addSuffix: true })}`
                      : "leyendo…"}
                </span>
                <button
                  onClick={syncAzure}
                  disabled={syncing}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium text-muted transition hover:bg-white hover:text-accent"
                >
                  <RefreshCw className={`size-3 ${syncing ? "animate-spin" : ""}`} /> Sincronizar
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
          <DateNav value={date} onChange={setDate} />
        </section>

        <KpiCards data={teamData} />

        {team.error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            No fue posible cargar el equipo: {team.error.message}
          </div>
        )}

        {/* Pestañas */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex rounded-2xl border border-line bg-white/80 p-1 shadow-sm">
            {(
              [
                { key: "equipo", label: "Equipo", icon: LayoutGrid },
                { key: "actividades", label: "Actividades", icon: Table2 },
              ] as const
            ).map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className="relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium">
                {tab === t.key && (
                  <motion.span layoutId="tab-pill" className="accent-transition absolute inset-0 rounded-xl bg-accent shadow-md shadow-accent/30" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
                <t.icon className={`relative size-4 ${tab === t.key ? "text-white" : "text-muted"}`} />
                <span className={`relative ${tab === t.key ? "text-white" : "text-muted"}`}>{t.label}</span>
              </button>
            ))}
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => openRegister(null)}
            className="accent-transition hidden items-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/30 sm:flex"
          >
            <Plus className="size-4" /> Registrar actividad
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${tab}-${projectKey}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {tab === "equipo" ? (
              <TeamGrid members={teamData?.members} loading={!teamData} onOpen={setSelected} onRegister={openRegister} />
            ) : (
              <ActivitiesTable key={`${projectKey}-${weekRange(date).start}`} projectKey={projectKey} date={date} members={members} onEdit={openEdit} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* FAB móvil */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => openRegister(null)}
        className="accent-transition fixed bottom-5 right-5 z-30 grid size-14 place-items-center rounded-2xl bg-accent text-white shadow-xl shadow-accent/40 sm:hidden"
        aria-label="Registrar actividad"
      >
        <Plus className="size-6" />
      </motion.button>

      <MemberDrawer
        member={selected}
        date={date}
        projectKey={projectKey}
        onClose={closeDrawer}
        onRegister={openRegister}
        onEdit={openEdit}
      />
      <ActivityForm
        state={form}
        onClose={closeForm}
        projectKey={projectKey}
        members={members}
        defaultDate={date}
        workItems={{ items: workItems.data?.items, loading: workItems.isLoading, error: workItems.error?.message }}
      />
    </div>
  );
}
