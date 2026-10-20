"use client";

import clsx from "clsx";
import { Download, Pencil, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { DeleteButton, EvidenceLink, WorkItemLink } from "@/components/dashboard/activity-item";
import { fetcher } from "@/components/dashboard/client-api";
import { normalize } from "@/components/dashboard/team-grid";
import { useApp } from "@/components/shell/app-provider";
import { Avatar, Button, Chip, EmptyState, Segmented, Skeleton, StateBadge } from "@/components/ui/primitives";
import { addDaysISO, formatDayMonth, formatHours, weekRange } from "@/lib/dates";
import type { Activity } from "@/lib/types";
import { TYPE_ORDER, typeMeta } from "@/lib/work-item-types";

type Preset = "semana" | "15d" | "mes" | "custom";

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

export function ActivitiesView() {
  const { projectKey, date, members, openEdit, openRegister } = useApp();
  const [preset, setPreset] = useState<Preset>("semana");
  const [custom, setCustom] = useState(() => weekRange(date));
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState("todos");
  const [search, setSearch] = useState("");

  const range =
    preset === "semana" ? weekRange(date) : preset === "15d" ? { start: addDaysISO(date, -14), end: date } : preset === "mes" ? { start: addDaysISO(date, -29), end: date } : custom;

  const { data, isLoading } = useSWR<{ activities: Activity[] }>(
    `/api/projects/${projectKey}/activities?from=${range.start}&to=${range.end}${employeeId ? `&employeeId=${employeeId}` : ""}`,
    fetcher,
    { keepPreviousData: true },
  );

  const rows = useMemo(() => {
    const q = normalize(search.trim().replace(/^#/, ""));
    return (data?.activities ?? []).filter(
      (a) =>
        (type === "todos" || a.workItemType === type) &&
        (!q || normalize(`${a.employeeName} ${a.description} ${a.workItemId} ${a.workItemTitle ?? ""}`).includes(q)),
    );
  }, [data, search, type]);

  const groups = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of rows) map.set(a.workDate, [...(map.get(a.workDate) ?? []), a]);
    return [...map.entries()];
  }, [rows]);
  const total = rows.reduce((s, a) => s + a.hours, 0);
  const people = new Set(rows.map((a) => a.employeeId)).size;

  function exportCSV() {
    const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `actividades-${projectKey}-${range.start}_a_${range.end}.csv` }).click();
    URL.revokeObjectURL(url);
  }

  const input = "h-10 rounded-xl border border-line bg-surface px-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10";

  return (
    <div className="space-y-5">
      {/* Filtros: una sola fila */}
      <div className="card flex flex-col gap-3 p-3 sm:p-4 xl:flex-row xl:items-center">
        <Segmented
          size="sm"
          value={preset}
          onChange={setPreset}
          options={[
            { value: "semana", label: "Semana" },
            { value: "15d", label: "15 días" },
            { value: "mes", label: "30 días" },
            { value: "custom", label: "Rango" },
          ]}
        />
        <AnimatePresence initial={false}>
          {preset === "custom" && (
            <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="flex items-center gap-2 overflow-hidden">
              <input type="date" value={custom.start} max={custom.end} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, start: e.target.value }))} className={input} aria-label="Desde" />
              <span className="text-subtle">→</span>
              <input type="date" value={custom.end} min={custom.start} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, end: e.target.value }))} className={input} aria-label="Hasta" />
            </motion.div>
          )}
        </AnimatePresence>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={clsx(input, "xl:w-56")} aria-label="Colaborador">
          <option value="">Todo el equipo</option>
          {[...members]
            .sort((a, b) => a.name.localeCompare(b.name, "es"))
            .map((m) => (
              <option key={m.employeeId} value={m.employeeId}>
                {m.name}
              </option>
            ))}
        </select>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar texto, persona o #ítem" className={clsx(input, "w-full pl-9")} />
        </div>
        <Button icon={Download} onClick={exportCSV} disabled={rows.length === 0}>
          CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Chip active={type === "todos"} onClick={() => setType("todos")}>
            Todos los tipos
          </Chip>
          {TYPE_ORDER.filter((t) => t !== "Bug").map((t) => (
            <Chip key={t} active={type === t} onClick={() => setType(t)}>
              {typeMeta(t).plural}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span>
            <b className="font-display text-base text-foreground tabular-nums">{rows.length}</b> actividades
          </span>
          <span>
            <b className="font-display text-base text-foreground tabular-nums">{people}</b> personas
          </span>
          <span>
            <b className="font-display text-base text-foreground tabular-nums">{formatHours(total)}</b>
          </span>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No hay actividades en este rango"
          description="Cambia el rango o los filtros, o registra una actividad nueva."
          action={
            <Button variant="primary" onClick={() => openRegister(null)}>
              Registrar actividad
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map(([day, items], gi) => (
            <motion.section key={day} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(gi, 6) * 0.04 }} className="card overflow-hidden">
              <header className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2.5">
                <h3 className="text-sm font-semibold capitalize">{formatDayMonth(day)}</h3>
                <span className="text-xs text-muted">
                  {items.length} act. · <b className="font-display text-sm tabular-nums text-foreground">{formatHours(items.reduce((s, a) => s + a.hours, 0))}</b>
                </span>
              </header>
              <ul>
                <AnimatePresence initial={false}>
                  {items.map((a) => (
                    <motion.li
                      key={a.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="group grid grid-cols-[auto_1fr_auto] items-start gap-3 border-t border-line px-4 py-3 first:border-t-0 transition-colors hover:bg-surface-2 md:grid-cols-[220px_1fr_80px_auto]"
                    >
                      <div className="flex min-w-0 items-center gap-2.5 md:col-auto">
                        <Avatar name={a.employeeName} size="sm" />
                        <span className="hidden min-w-0 md:block">
                          <span className="block truncate text-sm font-medium">{a.employeeName}</span>
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold md:hidden">{a.employeeName}</p>
                        <p className="line-clamp-3 text-sm text-foreground" title={a.description}>
                          {a.description}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <WorkItemLink activity={a} />
                          <StateBadge state={a.workItemState} />
                          {a.evidenceUrl && <EvidenceLink url={a.evidenceUrl} />}
                          <span className="font-display text-sm font-semibold tabular-nums md:hidden">{formatHours(a.hours)}</span>
                        </div>
                      </div>
                      <p className="hidden text-right font-display text-base font-semibold tabular-nums md:block">{formatHours(a.hours)}</p>
                      <div className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                        <button onClick={() => openEdit(a)} className="rounded-lg p-1.5 text-subtle transition hover:bg-surface-3 hover:text-foreground" aria-label="Editar actividad">
                          <Pencil className="size-3.5" />
                        </button>
                        <DeleteButton activity={a} projectKey={projectKey} />
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </motion.section>
          ))}
        </div>
      )}
    </div>
  );
}
