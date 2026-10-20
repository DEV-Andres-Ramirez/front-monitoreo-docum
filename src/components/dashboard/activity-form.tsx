"use client";

import clsx from "clsx";
import { History, Link2, Minus, Plus, Save } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Avatar, Button, Kbd } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import type { ProjectKey } from "@/lib/config";
import { addDaysISO, formatDayMonth, formatHours } from "@/lib/dates";
import type { Activity, TeamMember, WorkItem } from "@/lib/types";
import { api, fetcher, refreshProjectData } from "./client-api";
import { WorkItemPicker } from "./work-item-picker";

const QUICK_HOURS = [0.5, 1, 2, 4, 8];

export type ActivityFormState = {
  open: boolean;
  member?: TeamMember | null;
  activity?: Activity | null;
  /** Fecha sugerida (p. ej. celda de la matriz) */
  date?: string;
};

type Props = {
  state: ActivityFormState;
  onClose: () => void;
  projectKey: ProjectKey;
  members: TeamMember[];
  defaultDate: string;
  today: string;
  workItems: { items: WorkItem[] | undefined; loading: boolean; error?: string };
};

export function ActivityForm(props: Props) {
  // Remontar el formulario cada vez que cambia el objetivo reinicia su estado sin efectos.
  const formKey = `${props.state.activity?.id ?? "new"}-${props.state.member?.employeeId ?? "any"}-${props.state.date ?? ""}-${props.state.open}`;
  const editing = !!props.state.activity;
  return (
    <Sheet
      open={props.state.open}
      onClose={props.onClose}
      level={2}
      title={editing ? "Editar actividad" : "Registrar actividad"}
      description={editing ? "Los cambios quedan en la bitácora de auditoría." : "Qué hizo, cuánto tiempo y en qué ítem de Azure."}
    >
      <FormBody key={formKey} {...props} />
    </Sheet>
  );
}

function FormBody({ state, onClose, projectKey, members, defaultDate, today, workItems }: Props) {
  const activity = state.activity ?? null;
  const [employeeId, setEmployeeId] = useState(activity?.employeeId ?? state.member?.employeeId ?? "");
  const [workDate, setWorkDate] = useState(activity?.workDate ?? state.date ?? defaultDate);
  const [hours, setHours] = useState<number>(activity?.hours ?? 1);
  const [description, setDescription] = useState(activity?.description ?? "");
  const [evidenceUrl, setEvidenceUrl] = useState(activity?.evidenceUrl ?? "");
  const [workItemId, setWorkItemId] = useState<number | null>(activity?.workItemId ?? null);
  const [pickerKey, setPickerKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const lockedMember = activity ? members.find((m) => m.employeeId === activity.employeeId) : (state.member ?? null);
  const member = lockedMember ?? members.find((m) => m.employeeId === employeeId);
  const workItem = workItems.items?.find((w) => w.id === workItemId);

  // Última actividad del colaborador (para "Repetir")
  const { data: recent } = useSWR<{ activities: Activity[] }>(
    !activity && employeeId ? `/api/projects/${projectKey}/activities?employeeId=${employeeId}&from=${addDaysISO(today, -45)}&to=${today}` : null,
    fetcher,
  );
  const last = recent?.activities[0];

  const clampHours = (v: number) => Math.min(24, Math.max(0.25, Math.round(v * 4) / 4));

  function repeatLast() {
    if (!last) return;
    setWorkItemId(last.workItemId);
    setHours(last.hours);
    setDescription(last.description);
    setPickerKey((k) => k + 1);
    toast.message("Se copió la última actividad", { description: "Ajusta lo necesario antes de guardar." });
  }

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (saving) return;
    if (!employeeId) return toast.error("Selecciona un colaborador");
    if (!workItemId) return toast.error("Asocia una HU o tarea de Azure");
    if (description.trim().length < 3) return toast.error("Describe la actividad");

    setSaving(true);
    const payload = { employeeId, workDate, hours, description, evidenceUrl: evidenceUrl.trim() || null, workItemId };
    try {
      if (activity) {
        await api(`/api/activities/${activity.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Actividad actualizada");
      } else {
        await api(`/api/projects/${projectKey}/activities`, { method: "POST", body: JSON.stringify(payload) });
        toast.success(`Actividad registrada para ${member?.name.split(" ")[0] ?? "el colaborador"}`, { description: `${formatHours(hours)} · #${workItemId}` });
      }
      await refreshProjectData(projectKey);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  const input = "h-11 w-full rounded-2xl border border-line bg-surface px-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10";

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          void submit();
        }
      }}
      className="space-y-5 pb-2"
    >
      <Field label="Colaborador">
        {lockedMember ? (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
            <Avatar name={lockedMember.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{lockedMember.name}</p>
              <p className="truncate text-xs text-muted">{lockedMember.role}</p>
            </div>
          </div>
        ) : (
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={input} required>
            <option value="">Selecciona un colaborador…</option>
            {[...members]
              .sort((a, b) => a.name.localeCompare(b.name, "es"))
              .map((m) => (
                <option key={m.employeeId} value={m.employeeId}>
                  {m.name} — {m.role}
                </option>
              ))}
          </select>
        )}
        {last && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={repeatLast}
            className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-line-strong px-3 py-2 text-left text-xs text-muted transition hover:border-accent hover:text-foreground"
          >
            <History className="size-3.5 shrink-0 text-accent-fg" />
            <span className="min-w-0 flex-1 truncate">
              Repetir última: <b className="font-semibold text-foreground">#{last.workItemId}</b> · {formatHours(last.hours)} · {last.description}
            </span>
          </motion.button>
        )}
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Fecha">
          <input type="date" value={workDate} max={today} onChange={(e) => setWorkDate(e.target.value)} required className={input} />
        </Field>
        <Field label="Horas invertidas">
          <div className="flex h-11 items-center rounded-2xl border border-line bg-surface">
            <button type="button" onClick={() => setHours((h) => clampHours(h - 0.25))} className="px-3 text-muted hover:text-foreground" aria-label="Restar 15 minutos">
              <Minus className="size-4" />
            </button>
            <input
              type="number"
              step={0.25}
              min={0.25}
              max={24}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              onBlur={() => setHours((h) => clampHours(h || 0.25))}
              aria-label="Horas"
              className="w-full bg-transparent text-center font-display text-lg font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button type="button" onClick={() => setHours((h) => clampHours(h + 0.25))} className="px-3 text-muted hover:text-foreground" aria-label="Sumar 15 minutos">
              <Plus className="size-4" />
            </button>
          </div>
        </Field>
      </div>
      <div className="-mt-3 flex flex-wrap gap-1.5">
        {QUICK_HOURS.map((h) => (
          <motion.button
            type="button"
            key={h}
            whileTap={{ scale: 0.9 }}
            onClick={() => setHours(h)}
            className={clsx(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
              hours === h ? "bg-accent text-white" : "bg-surface-3 text-muted hover:text-foreground",
            )}
          >
            {h.toLocaleString("es-CO")} h
          </motion.button>
        ))}
      </div>

      <Field label="HU, tarea o recurso de Azure DevOps">
        <WorkItemPicker
          key={pickerKey}
          items={workItems.items}
          loading={workItems.loading}
          error={workItems.error}
          value={workItemId}
          onChange={setWorkItemId}
          memberEmail={member?.email}
        />
      </Field>

      <Field label="¿Qué hizo?">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={4000}
          required
          placeholder="Describe la actividad realizada, avances, bloqueos…"
          className="w-full resize-y rounded-2xl border border-line bg-surface px-3.5 py-3 text-sm outline-none transition placeholder:text-subtle focus:border-accent focus:ring-4 focus:ring-accent/10"
        />
        <p className="mt-1 text-right text-[11px] tabular-nums text-subtle">{description.length} / 4000</p>
      </Field>

      <Field label="Evidencia (enlace, opcional)">
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input type="url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://…" className={clsx(input, "pl-10")} />
        </div>
      </Field>

      <div className="sticky -bottom-5 -mx-5 -mb-5 space-y-3 border-t border-line bg-surface/95 px-5 pb-5 pt-4 backdrop-blur sm:-mx-7 sm:px-7">
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted" aria-live="polite">
          Resumen:
          <b className="font-semibold text-foreground">{formatHours(hours)}</b>·
          <span className="capitalize">{formatDayMonth(workDate)}</span>·
          <span className={workItem ? "text-foreground" : "text-warning-fg"}>{workItem ? `#${workItem.id}` : "sin ítem de Azure"}</span>·
          <span className={member ? "text-foreground" : "text-warning-fg"}>{member ? member.name.split(" ").slice(0, 2).join(" ") : "sin colaborador"}</span>
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="lg" onClick={onClose} className="flex-1 sm:flex-none sm:px-6">
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="lg" loading={saving} icon={Save} className="flex-[2]">
            {activity ? "Guardar cambios" : "Registrar actividad"}
            <span className="hidden items-center gap-0.5 sm:flex">
              <Kbd className="border-white/30 bg-white/15 text-white shadow-none">⌘</Kbd>
              <Kbd className="border-white/30 bg-white/15 text-white shadow-none">↵</Kbd>
            </span>
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-foreground">{label}</p>
      {children}
    </div>
  );
}
