"use client";

import { ExternalLink, ShieldCheck } from "lucide-react";
import { AnimatePresence } from "motion/react";
import useSWR from "swr";
import { EmptyState, Skeleton, StateBadge, TypeBadge } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import type { ProjectKey } from "@/lib/config";
import { formatDayMonth, formatHours } from "@/lib/dates";
import type { Activity, TeamMember, WorkItem } from "@/lib/types";
import { ActivityItem } from "./activity-item";
import { fetcher } from "./client-api";

/** Detalle de un work item de Azure (solo lectura) con todas las actividades registradas en él. */
export function WorkItemSheet({
  workItemId,
  items,
  projectKey,
  today,
  onClose,
  onEdit,
}: {
  workItemId: number | null;
  items: WorkItem[] | undefined;
  projectKey: ProjectKey;
  members: TeamMember[];
  today: string;
  onClose: () => void;
  onEdit: (a: Activity) => void;
}) {
  const item = items?.find((w) => w.id === workItemId);
  const byId = new Map((items ?? []).map((w) => [w.id, w]));
  const path: WorkItem[] = [];
  for (let p = item?.parentId ? byId.get(item.parentId) : undefined; p && path.length < 6; p = p.parentId ? byId.get(p.parentId) : undefined) path.unshift(p);

  const { data, isLoading } = useSWR<{ activities: Activity[] }>(
    workItemId ? `/api/projects/${projectKey}/activities?workItemId=${workItemId}&from=2024-01-01&to=${today}` : null,
    fetcher,
  );
  const total = (data?.activities ?? []).reduce((s, a) => s + a.hours, 0);
  const people = new Set((data?.activities ?? []).map((a) => a.employeeId)).size;

  return (
    <Sheet
      open={workItemId !== null}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {item && <TypeBadge type={item.type} />}
          <span className="font-mono text-base text-subtle">#{workItemId}</span>
        </span>
      }
      description={item?.title ?? "Work item fuera de las épicas monitoreadas"}
    >
      <div className="space-y-5">
        {path.length > 0 && (
          <nav className="flex flex-wrap items-center gap-1 text-xs text-muted" aria-label="Ruta en el backlog">
            {path.map((p) => (
              <span key={p.id} className="flex items-center gap-1">
                <TypeBadge type={p.type} />
                <span className="max-w-[180px] truncate">{p.title}</span>
                <span className="text-subtle">›</span>
              </span>
            ))}
          </nav>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-line bg-surface-2 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Horas</p>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">{formatHours(total)}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface-2 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Registros</p>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">{data?.activities.length ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface-2 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Personas</p>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">{data ? people : "—"}</p>
          </div>
        </div>

        {item && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <StateBadge state={item.state} />
            {item.assignedTo && <span>Asignado en Azure a {item.assignedTo}</span>}
            <a href={item.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 font-semibold text-accent-fg hover:underline">
              Abrir en Azure <ExternalLink className="size-3" />
            </a>
          </div>
        )}
        <p className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-[11px] text-muted">
          <ShieldCheck className="size-3.5 text-good-fg" /> Azure DevOps se consulta en modo solo lectura: aquí nada modifica el work item.
        </p>

        <div>
          <h3 className="mb-3 font-display font-semibold">Actividades registradas</h3>
          {isLoading && !data ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : !data?.activities.length ? (
            <EmptyState title="Nadie ha registrado horas aquí" description="Cuando se asocien actividades a este ítem aparecerán en esta traza." />
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {data.activities.map((a) => (
                  <div key={a.id}>
                    <p className="mb-1 px-1 text-[11px] font-semibold capitalize text-subtle">{formatDayMonth(a.workDate)}</p>
                    <ActivityItem activity={a} projectKey={projectKey} onEdit={onEdit} showEmployee />
                  </div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
