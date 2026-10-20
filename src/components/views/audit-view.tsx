"use client";

import clsx from "clsx";
import { ArrowRight, CloudDownload, CloudOff, Link2, Link2Off, LogIn, LogOut, PencilLine, PlusCircle, RefreshCw, ShieldAlert, Trash2, Undo2, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/components/dashboard/client-api";
import { useApp } from "@/components/shell/app-provider";
import { Avatar, Button, Chip, EmptyState, Segmented, Skeleton, type StatusTone } from "@/components/ui/primitives";
import { addDaysISO, formatDayMonth, formatHours, formatTime, isoOfTimestamp } from "@/lib/dates";
import type { AuditEntry, AuditResponse } from "@/lib/types";

const ACTION_META: Record<string, { label: string; icon: LucideIcon; tone: StatusTone }> = {
  login_success: { label: "Inicio de sesión", icon: LogIn, tone: "good" },
  login_failed: { label: "Intento de ingreso fallido", icon: ShieldAlert, tone: "critical" },
  logout: { label: "Cierre de sesión", icon: LogOut, tone: "neutral" },
  activity_created: { label: "Actividad registrada", icon: PlusCircle, tone: "info" },
  activity_updated: { label: "Actividad editada", icon: PencilLine, tone: "info" },
  activity_deleted: { label: "Actividad eliminada", icon: Trash2, tone: "critical" },
  activity_restored: { label: "Actividad restaurada", icon: Undo2, tone: "good" },
  azure_refresh: { label: "Sincronización de Azure (solo lectura)", icon: RefreshCw, tone: "neutral" },
  azure_sync: { label: "Sincronización con Azure (solo lectura)", icon: CloudDownload, tone: "info" },
  azure_sync_failed: { label: "Falló la sincronización con Azure", icon: CloudOff, tone: "critical" },
  alias_linked: { label: "Correo de Azure vinculado", icon: Link2, tone: "good" },
  alias_unlinked: { label: "Vínculo de correo eliminado", icon: Link2Off, tone: "neutral" },
};

const SYNC_TRIGGER: Record<string, string> = { auto: "automática (cada hora)", manual: "manual", initial: "inicial" };

const FILTERS: { key: string; label: string; actions: string[] }[] = [
  { key: "todos", label: "Todo", actions: [] },
  { key: "azure", label: "Sincronizaciones", actions: ["azure_sync", "azure_sync_failed", "azure_refresh"] },
  { key: "sesiones", label: "Sesiones", actions: ["login_success", "login_failed", "logout"] },
  { key: "vinculos", label: "Vinculaciones", actions: ["alias_linked", "alias_unlinked"] },
  { key: "legado", label: "Registro manual (legado)", actions: ["activity_created", "activity_updated", "activity_deleted", "activity_restored"] },
];

const TONE_ICON: Record<StatusTone, string> = {
  good: "bg-good-soft text-good-fg",
  warning: "bg-warning-soft text-warning-fg",
  critical: "bg-critical-soft text-critical-fg",
  info: "bg-info-soft text-info-fg",
  neutral: "bg-surface-3 text-muted",
};

const FIELDS: { key: string; label: string; format?: (v: unknown) => string }[] = [
  { key: "work_date", label: "Fecha" },
  { key: "hours", label: "Horas", format: (v) => formatHours(Number(v)) },
  { key: "work_item_id", label: "Work item", format: (v) => `#${v}` },
  { key: "description", label: "Descripción" },
  { key: "evidence_url", label: "Evidencia" },
];

function browser(ua: string | null) {
  if (!ua) return "";
  const name = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return [name, os].filter(Boolean).join(" · ");
}

export function AuditView() {
  const { projectKey, today, model } = useApp();
  const [days, setDays] = useState<"7" | "30" | "90">("7");
  const [filter, setFilter] = useState("todos");
  const actions = FILTERS.find((f) => f.key === filter)?.actions ?? [];
  const from = addDaysISO(today, -(Number(days) - 1));
  const names = useMemo(() => new Map([...(model?.people.values() ?? [])].filter((p) => p.employeeId).map((p) => [p.employeeId!, p.name])), [model]);

  const { data, size, setSize, isLoading, isValidating } = useSWRInfinite<AuditResponse>(
    (index, prev) => {
      if (prev && !prev.nextCursor) return null;
      const cursor = index === 0 ? "" : `&cursor=${prev?.nextCursor}`;
      return `/api/audit?project=${projectKey}&from=${from}&to=${today}&actions=${actions.join(",")}${cursor}`;
    },
    fetcher,
  );
  const entries = useMemo(() => data?.flatMap((p) => p.entries) ?? [], [data]);
  const hasMore = !!data?.at(-1)?.nextCursor;

  const groups = useMemo(() => {
    const map = new Map<string, AuditEntry[]>();
    for (const e of entries) {
      const d = isoOfTimestamp(e.occurredAt);
      map.set(d, [...(map.get(d) ?? []), e]);
    }
    return [...map.entries()];
  }, [entries]);

  return (
    <div className="space-y-5">
      <div className="card flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {FILTERS.map((f) => (
            <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </Chip>
          ))}
        </div>
        <Segmented
          size="sm"
          value={days}
          onChange={setDays}
          options={[
            { value: "7", label: "7 días" },
            { value: "30", label: "30 días" },
            { value: "90", label: "90 días" },
          ]}
        />
      </div>

      {isLoading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState title="Sin eventos en este periodo" description="Aquí verás ingresos, registros, ediciones, borrados y sincronizaciones." />
      ) : (
        <div className="space-y-6">
          {groups.map(([day, list]) => (
            <section key={day}>
              <h3 className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-subtle">
                <span className="capitalize">{formatDayMonth(day)}</span>
                <span className="h-px flex-1 bg-line" />
                <span>{list.length} eventos</span>
              </h3>
              <ol className="relative space-y-2 before:absolute before:bottom-3 before:left-[1.1875rem] before:top-3 before:w-px before:bg-line">
                {list.map((e, i) => (
                  <AuditRow key={e.id} entry={e} index={i} names={names} />
                ))}
              </ol>
            </section>
          ))}
          {hasMore && (
            <div className="flex justify-center">
              <Button onClick={() => setSize(size + 1)} loading={isValidating}>
                Cargar más eventos
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AuditRow({ entry, index, names }: { entry: AuditEntry; index: number; names: Map<string, string> }) {
  const meta = ACTION_META[entry.action] ?? { label: entry.action, icon: PencilLine, tone: "neutral" as StatusTone };
  const data = (entry.newData ?? {}) as Record<string, unknown>;
  const old = (entry.oldData ?? {}) as Record<string, unknown>;
  const isActivity = entry.entity === "activity_logs";
  const employee = isActivity ? (names.get(String(data.employee_id)) ?? "Colaborador") : null;
  const changes = entry.action === "activity_updated" ? FIELDS.filter((f) => String(old[f.key] ?? "") !== String(data[f.key] ?? "")) : [];

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.025 }}
      className="relative flex gap-3 pl-0"
    >
      <span className={clsx("relative z-[1] grid size-10 shrink-0 place-items-center rounded-xl ring-4 ring-background", TONE_ICON[meta.tone])}>
        <meta.icon className="size-4" />
      </span>
      <div className="card min-w-0 flex-1 p-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold">{meta.label}</p>
          <time className="text-xs tabular-nums text-subtle" dateTime={entry.occurredAt}>
            {formatTime(entry.occurredAt)}
          </time>
        </div>

        {isActivity && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            {employee && (
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Avatar name={employee} size="xs" /> {employee}
              </span>
            )}
            <span>· {formatHours(Number(data.hours ?? 0))}</span>
            <span className="truncate">
              · <span className="font-mono text-xs">#{String(data.work_item_id)}</span> {String(data.work_item_title ?? "")}
            </span>
            <span className="text-xs text-subtle">· del {formatDayMonth(String(data.work_date))}</span>
          </div>
        )}

        {changes.length > 0 && (
          <ul className="mt-2.5 space-y-1 rounded-xl bg-surface-2 p-2.5 text-xs">
            {changes.map((c) => {
              const fmt = c.format ?? ((v: unknown) => String(v ?? "—"));
              return (
                <li key={c.key} className="grid grid-cols-[90px_1fr] items-start gap-2">
                  <span className="font-semibold text-muted">{c.label}</span>
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="max-w-full truncate rounded bg-critical-soft px-1.5 py-0.5 text-critical-fg line-through decoration-1">{old[c.key] == null ? "—" : fmt(old[c.key])}</span>
                    <ArrowRight className="size-3 shrink-0 text-subtle" />
                    <span className="max-w-full truncate rounded bg-good-soft px-1.5 py-0.5 text-good-fg">{data[c.key] == null ? "—" : fmt(data[c.key])}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {(entry.action === "azure_sync" || entry.action === "azure_sync_failed") && (
          <p className="mt-1 text-xs text-muted">
            {data.mode === "full" ? "Sincronización completa" : "Sincronización incremental"}
            {typeof data.trigger === "string" && SYNC_TRIGGER[data.trigger] && ` ${SYNC_TRIGGER[data.trigger]}`}
            {data.items !== undefined && ` · ${Number(data.items).toLocaleString("es-CO")} ítems y ${Number(data.revisions).toLocaleString("es-CO")} cambios leídos`}
            {typeof data.error === "string" && <span className="block text-critical-fg">{data.error}</span>}
          </p>
        )}
        {(entry.action === "alias_linked" || entry.action === "alias_unlinked") && (
          <p className="mt-1 text-xs text-muted">
            {String(data.alias ?? "")}
            {data.employeeId ? ` → ${names.get(String(data.employeeId)) ?? "colaborador"}` : ""}
          </p>
        )}
        {!isActivity && (entry.ip || entry.userAgent) && (
          <p className="mt-1 text-xs text-subtle">
            {[browser(entry.userAgent), entry.ip ? `IP ${entry.ip}` : null].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </motion.li>
  );
}
