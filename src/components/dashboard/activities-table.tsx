"use client";

import { Download, Inbox, Link2, Pencil, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Avatar, Skeleton, StateBadge } from "@/components/ui/primitives";
import type { ProjectKey } from "@/lib/config";
import { formatDayMonth, formatHours, weekRange } from "@/lib/dates";
import type { Activity, TeamMember } from "@/lib/types";
import { ActivityItem, DeleteButton, WorkItemLink } from "./activity-item";
import { fetcher } from "./client-api";
import { normalize } from "./team-grid";

function toCSV(rows: Activity[]) {
  const header = ["Fecha", "Colaborador", "Horas", "Descripción", "Tipo", "Work item", "Título", "Estado", "URL work item", "Evidencia", "Registrado"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((a) =>
    [a.workDate, a.employeeName, String(a.hours).replace(".", ","), a.description, a.workItemType, a.workItemId, a.workItemTitle, a.workItemState, a.workItemUrl, a.evidenceUrl, a.createdAt]
      .map(esc)
      .join(";"),
  );
  return "﻿" + [header.map(esc).join(";"), ...lines].join("\n");
}

export function ActivitiesTable({
  projectKey,
  date,
  members,
  onEdit,
}: {
  projectKey: ProjectKey;
  date: string;
  members: TeamMember[];
  onEdit: (a: Activity) => void;
}) {
  const week = weekRange(date);
  const [from, setFrom] = useState(week.start);
  const [to, setTo] = useState(week.end);
  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useSWR<{ activities: Activity[] }>(
    `/api/projects/${projectKey}/activities?from=${from}&to=${to}${employeeId ? `&employeeId=${employeeId}` : ""}`,
    fetcher,
    { keepPreviousData: true },
  );

  const rows = useMemo(() => {
    const q = normalize(search.trim());
    return (data?.activities ?? []).filter(
      (a) => !q || normalize(`${a.employeeName} ${a.description} ${a.workItemId} ${a.workItemTitle ?? ""}`).includes(q),
    );
  }, [data, search]);
  const total = rows.reduce((s, a) => s + a.hours, 0);

  function exportCSV() {
    const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement("a"), { href: url, download: `actividades-${projectKey}-${from}_a_${to}.csv` });
    link.click();
    URL.revokeObjectURL(url);
  }

  const input = "h-10 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10";

  return (
    <section className="space-y-4">
      <div className="grid gap-2 rounded-3xl border border-white bg-white/80 p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr_1fr_auto] lg:items-center">
        <label className="flex items-center gap-2 text-xs text-muted">
          Desde <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className={`${input} flex-1`} />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          Hasta <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className={`${input} flex-1`} />
        </label>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={input}>
          <option value="">Todo el equipo</option>
          {[...members]
            .sort((a, b) => a.name.localeCompare(b.name, "es"))
            .map((m) => (
              <option key={m.employeeId} value={m.employeeId}>
                {m.name}
              </option>
            ))}
        </select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar texto o #ítem" className={`${input} w-full pl-9`} />
        </div>
        <button
          onClick={exportCSV}
          disabled={rows.length === 0}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent disabled:opacity-40"
        >
          <Download className="size-4" /> CSV
        </button>
      </div>

      <div className="flex items-center justify-between px-1 text-sm">
        <span className="text-muted">
          <b className="text-foreground">{rows.length}</b> actividades
        </span>
        <span className="text-muted">
          Total: <b className="font-display text-base text-foreground tabular-nums">{formatHours(total)}</b>
        </span>
      </div>

      {isLoading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-dashed border-line bg-white/60 py-16 text-center">
          <Inbox className="size-8 text-slate-300" />
          <p className="mt-3 font-medium">No hay actividades en este rango</p>
          <p className="text-sm text-muted">Registra la primera desde la pestaña Equipo.</p>
        </div>
      ) : (
        <>
          {/* Móvil: tarjetas */}
          <div className="space-y-2 md:hidden">
            <AnimatePresence initial={false}>
              {rows.map((a) => (
                <div key={a.id}>
                  <p className="mb-1 px-1 text-[11px] font-semibold capitalize text-muted">{formatDayMonth(a.workDate)}</p>
                  <ActivityItem activity={a} projectKey={projectKey} onEdit={onEdit} showEmployee />
                </div>
              ))}
            </AnimatePresence>
          </div>

          {/* Escritorio: tabla */}
          <div className="hidden overflow-hidden rounded-3xl border border-white bg-white shadow-[0_10px_30px_-20px_rgba(15,40,80,0.4)] md:block">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="w-28 px-4 py-3 font-semibold">Fecha</th>
                  <th className="w-56 px-4 py-3 font-semibold">Colaborador</th>
                  <th className="w-20 px-4 py-3 text-right font-semibold">Horas</th>
                  <th className="px-4 py-3 font-semibold">Actividad · Work item</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {rows.map((a, i) => (
                    <motion.tr
                      key={a.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: Math.min(i, 15) * 0.015 }}
                      className="border-t border-line align-top transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3 text-xs font-medium capitalize text-muted">{formatDayMonth(a.workDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={a.employeeName} size="sm" />
                          <span className="truncate font-medium" title={a.employeeName}>{a.employeeName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-display font-semibold tabular-nums">{formatHours(a.hours)}</td>
                      <td className="px-4 py-3">
                        <p className="line-clamp-2 text-foreground" title={a.description}>{a.description}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <WorkItemLink activity={a} />
                          <StateBadge state={a.workItemState} />
                          {a.evidenceUrl && (
                            <a href={a.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                              <Link2 className="size-3" /> Evidencia
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-0.5">
                          <button onClick={() => onEdit(a)} className="rounded-lg p-1.5 text-muted transition hover:bg-slate-100 hover:text-foreground" aria-label="Editar">
                            <Pencil className="size-3.5" />
                          </button>
                          <DeleteButton activity={a} projectKey={projectKey} />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
