"use client";

import { ExternalLink, Link2, Loader2, Pencil, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, StateBadge, TypeBadge } from "@/components/ui/primitives";
import type { ProjectKey } from "@/lib/config";
import { formatHours } from "@/lib/dates";
import type { Activity } from "@/lib/types";
import { api, refreshProjectData } from "./client-api";

/** Borra (lógico) y ofrece "Deshacer" en el toast. */
export async function deleteActivity(activity: Activity, projectKey: ProjectKey) {
  await api(`/api/activities/${activity.id}`, { method: "DELETE" });
  await refreshProjectData(projectKey);
  toast.success("Actividad eliminada", {
    description: `${activity.employeeName} · ${formatHours(activity.hours)}`,
    duration: 7000,
    action: {
      label: "Deshacer",
      onClick: async () => {
        try {
          await api(`/api/activities/${activity.id}/restore`, { method: "POST" });
          await refreshProjectData(projectKey);
          toast.success("Actividad restaurada");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "No se pudo restaurar");
        }
      },
    },
  });
}

/** Botón de borrado con confirmación en línea (sin diálogos del navegador). */
export function DeleteButton({ activity, projectKey }: { activity: Activity; projectKey: ProjectKey }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3500);
    return () => clearTimeout(t);
  }, [confirming]);

  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(true);
    try {
      await deleteActivity(activity, projectKey);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
      setDeleting(false);
    }
  }

  if (confirming) {
    return (
      <motion.button
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={remove}
        disabled={deleting}
        className="flex items-center gap-1 rounded-lg bg-critical px-2 py-1 text-[0.6875rem] font-semibold text-white"
      >
        {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />} ¿Eliminar?
      </motion.button>
    );
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setConfirming(true);
      }}
      className="rounded-lg p-1.5 text-subtle transition hover:bg-critical-soft hover:text-critical-fg"
      aria-label="Eliminar actividad"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}

export function WorkItemLink({ activity }: { activity: Activity }) {
  return (
    <a
      href={activity.workItemUrl ?? "#"}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="group/wi inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs transition hover:border-accent/50"
      title="Abrir en Azure DevOps (solo lectura)"
    >
      <TypeBadge type={activity.workItemType} />
      <span className="font-mono text-subtle">#{activity.workItemId}</span>
      <span className="truncate text-foreground">{activity.workItemTitle}</span>
      <ExternalLink className="size-3 shrink-0 text-subtle group-hover/wi:text-accent-fg" />
    </a>
  );
}

export function EvidenceLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 rounded-lg bg-good-soft px-2 py-1 text-xs font-medium text-good-fg transition hover:brightness-95"
    >
      <Link2 className="size-3" /> Evidencia
    </a>
  );
}

export function ActivityItem({
  activity,
  projectKey,
  onEdit,
  showEmployee = false,
}: {
  activity: Activity;
  projectKey: ProjectKey;
  onEdit: (a: Activity) => void;
  showEmployee?: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="group relative rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-line-strong"
    >
      <div className="flex items-start gap-3">
        {showEmployee ? (
          <Avatar name={activity.employeeName} size="sm" />
        ) : (
          <span className="grid h-9 min-w-12 shrink-0 place-items-center rounded-xl bg-accent-soft px-2 font-display text-sm font-semibold tabular-nums text-accent-fg">
            {formatHours(activity.hours)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {showEmployee && (
            <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
              {activity.employeeName}
              <span className="rounded-md bg-accent-soft px-1.5 py-0.5 font-display tabular-nums text-accent-fg">{formatHours(activity.hours)}</span>
            </p>
          )}
          <p className="mt-0.5 whitespace-pre-line text-sm text-foreground">{activity.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <WorkItemLink activity={activity} />
            <StateBadge state={activity.workItemState} />
            {activity.evidenceUrl && <EvidenceLink url={activity.evidenceUrl} />}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
          <button onClick={() => onEdit(activity)} className="rounded-lg p-1.5 text-subtle transition hover:bg-surface-3 hover:text-foreground" aria-label="Editar actividad">
            <Pencil className="size-3.5" />
          </button>
          <DeleteButton activity={activity} projectKey={projectKey} />
        </div>
      </div>
    </motion.div>
  );
}
