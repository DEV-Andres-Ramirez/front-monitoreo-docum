"use client";

import clsx from "clsx";
import { Link2, Loader2, Minus, Plus, Save } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/primitives";
import type { ProjectKey } from "@/lib/config";
import { todayISO } from "@/lib/dates";
import type { Activity, TeamMember, WorkItem } from "@/lib/types";
import { api, refreshProjectData } from "./client-api";
import { WorkItemPicker } from "./work-item-picker";

const QUICK_HOURS = [0.5, 1, 2, 4, 8];

export type ActivityFormState = {
  open: boolean;
  member?: TeamMember | null;
  activity?: Activity | null;
};

type Props = {
  state: ActivityFormState;
  onClose: () => void;
  projectKey: ProjectKey;
  members: TeamMember[];
  defaultDate: string;
  workItems: { items: WorkItem[] | undefined; loading: boolean; error?: string };
};

export function ActivityForm(props: Props) {
  // Remontar el formulario cada vez que cambia el objetivo reinicia su estado sin efectos.
  const formKey = `${props.state.activity?.id ?? "new"}-${props.state.member?.employeeId ?? "any"}-${props.state.open}`;
  const editing = !!props.state.activity;
  return (
    <Sheet
      open={props.state.open}
      onClose={props.onClose}
      level={2}
      title={editing ? "Editar actividad" : "Registrar actividad"}
      description={editing ? "Los cambios quedan en la bitácora de auditoría." : "Lo que hizo el colaborador, cuánto tiempo y en qué ítem de Azure."}
    >
      <FormBody key={formKey} {...props} />
    </Sheet>
  );
}

function FormBody({ state, onClose, projectKey, members, defaultDate, workItems }: Props) {
  const activity = state.activity ?? null;
  const [employeeId, setEmployeeId] = useState(activity?.employeeId ?? state.member?.employeeId ?? "");
  const [workDate, setWorkDate] = useState(activity?.workDate ?? defaultDate);
  const [hours, setHours] = useState<number>(activity?.hours ?? 1);
  const [description, setDescription] = useState(activity?.description ?? "");
  const [evidenceUrl, setEvidenceUrl] = useState(activity?.evidenceUrl ?? "");
  const [workItemId, setWorkItemId] = useState<number | null>(activity?.workItemId ?? null);
  const [saving, setSaving] = useState(false);

  const lockedMember = activity
    ? members.find((m) => m.employeeId === activity.employeeId)
    : state.member ?? null;
  const member = lockedMember ?? members.find((m) => m.employeeId === employeeId);

  const clampHours = (v: number) => Math.min(24, Math.max(0.25, Math.round(v * 4) / 4));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
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
        toast.success(`Actividad registrada para ${member?.name.split(" ")[0] ?? "el colaborador"}`);
      }
      await refreshProjectData(projectKey);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 pb-2">
      <Field label="Colaborador">
        {lockedMember ? (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-slate-50 p-3">
            <Avatar name={lockedMember.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{lockedMember.name}</p>
              <p className="truncate text-xs text-muted">{lockedMember.role}</p>
            </div>
          </div>
        ) : (
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="h-11 w-full rounded-2xl border border-line bg-white px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
            required
          >
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
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Fecha">
          <input
            type="date"
            value={workDate}
            max={todayISO()}
            onChange={(e) => setWorkDate(e.target.value)}
            required
            className="h-11 w-full rounded-2xl border border-line bg-white px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
          />
        </Field>
        <Field label="Horas invertidas">
          <div className="flex h-11 items-center rounded-2xl border border-line bg-white">
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
              hours === h ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {h} h
          </motion.button>
        ))}
      </div>

      <Field label="HU, tarea o recurso de Azure DevOps">
        <WorkItemPicker
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
          className="w-full resize-y rounded-2xl border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
        />
      </Field>

      <Field label="Evidencia (enlace, opcional)">
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="url"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://…"
            className="h-11 w-full rounded-2xl border border-line bg-white pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
          />
        </div>
      </Field>

      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-white/95 px-5 pt-4 backdrop-blur sm:-mx-7 sm:px-7">
        <button type="button" onClick={onClose} className="h-11 flex-1 rounded-2xl border border-line text-sm font-semibold text-muted transition hover:bg-slate-50 sm:flex-none sm:px-6">
          Cancelar
        </button>
        <motion.button
          type="submit"
          disabled={saving}
          whileTap={{ scale: 0.97 }}
          className="accent-transition flex h-11 flex-[2] items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-semibold text-white shadow-lg shadow-accent/30 disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {activity ? "Guardar cambios" : "Registrar actividad"}
        </motion.button>
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
