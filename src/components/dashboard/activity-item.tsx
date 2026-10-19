"use client";

import { ExternalLink, Link2, Loader2, Pencil, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StateBadge, TypeBadge } from "@/components/ui/primitives";
import type { ProjectKey } from "@/lib/config";
import { formatHours } from "@/lib/dates";
import type { Activity } from "@/lib/types";
import { api, refreshProjectData } from "./client-api";

/** Botón de borrado con confirmación en línea (sin diálogos del navegador). */
export function DeleteButton({ activity, projectKey }: { activity: Activity; projectKey: ProjectKey }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3500);
    return () => clearTimeout(t);
  }, [confirming]);

  async function remove() {
    setDeleting(true);
    try {
      await api(`/api/activities/${activity.id}`, { method: "DELETE" });
      toast.success("Actividad eliminada (queda en la bitácora)");
      await refreshProjectData(projectKey);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
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
        className="flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-[11px] font-semibold text-white"
      >
        {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />} ¿Eliminar?
      </motion.button>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} className="rounded-lg p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600" aria-label="Eliminar">
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
      className="group/wi inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1 text-xs transition hover:border-accent/50"
    >
      <TypeBadge type={activity.workItemType} />
      <span className="font-mono text-muted">#{activity.workItemId}</span>
      <span className="truncate text-foreground">{activity.workItemTitle}</span>
      <ExternalLink className="size-3 shrink-0 text-muted group-hover/wi:text-accent" />
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
      className="relative rounded-2xl border border-line bg-white p-3.5"
    >
      <div className="flex items-start gap-3">
        <span className="accent-transition grid h-9 min-w-12 shrink-0 place-items-center rounded-xl bg-accent-soft px-2 font-display text-sm font-semibold text-accent tabular-nums">
          {formatHours(activity.hours)}
        </span>
        <div className="min-w-0 flex-1">
          {showEmployee && <p className="text-xs font-semibold text-foreground">{activity.employeeName}</p>}
          <p className="whitespace-pre-line text-sm text-foreground">{activity.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <WorkItemLink activity={activity} />
            <StateBadge state={activity.workItemState} />
            {activity.evidenceUrl && (
              <a
                href={activity.evidenceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              >
                <Link2 className="size-3" /> Evidencia
              </a>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button onClick={() => onEdit(activity)} className="rounded-lg p-1.5 text-muted transition hover:bg-slate-100 hover:text-foreground" aria-label="Editar">
            <Pencil className="size-3.5" />
          </button>
          <DeleteButton activity={activity} projectKey={projectKey} />
        </div>
      </div>
    </motion.div>
  );
}
