"use client";

import clsx from "clsx";
import { Mail, Tag, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Gantt } from "@/components/gantt/gantt";
import { useApp } from "@/components/shell/app-provider";
import { Avatar, Button, Chip, EmptyState, FLAG_ICON, FlagBadge, HealthBadge, PersonBadges, TypeBadge } from "@/components/ui/primitives";
import { Popover } from "@/components/ui/popover";
import { Sheet } from "@/components/ui/sheet";
import { useTheme } from "@/components/ui/theme";
import { PersonItems } from "@/components/views/undated-board";
import { HEALTH_RULES } from "@/lib/analytics/health";
import { CATEGORIES, CATEGORY_LABEL, inEpics, inTag, inTypes, isAlive, perPerson } from "@/lib/analytics/metrics";
import { personRoleLabel, type Person } from "@/lib/analytics/model";
import { categoryColor } from "@/lib/analytics/state-colors";
import type { MemberFlagKind, StateCategory } from "@/lib/analytics/types";
import { PROJECTS } from "@/lib/config";
import { api } from "./client-api";

/** Panel de un colaborador: desempeño del periodo, mini-Gantt e ítems por estado. */
export function MemberSheet({ personKey, onClose }: { personKey: string | null; onClose: () => void }) {
  const { model } = useApp();
  const person = personKey ? model?.people.get(personKey) : undefined;
  return (
    <Sheet
      open={personKey !== null}
      onClose={onClose}
      width="sm:w-[min(64rem,calc(100vw-1rem))]"
      title={
        person ? (
          <div className="flex items-center gap-3">
            <Avatar name={person.name} size="lg" />
            <div className="min-w-0">
              <p className="flex min-w-0 items-center gap-2">
                <span className="truncate">{person.name}</span>
                <PersonBadges person={person} />
              </p>
              <p className="truncate font-sans text-sm font-normal text-muted">
                {person.inGlobal
                  ? `${personRoleLabel(person, { allocation: true })} · ${person.assignmentType}`
                  : person.inRoster
                    ? "Sin asignación al proyecto en Global (sin cargo ni %) · igual cuenta en el análisis"
                    : "Fuera de Global para este proyecto"}
              </p>
            </div>
          </div>
        ) : null
      }
    >
      {person ? <Body key={person.key} person={person} /> : <EmptyState title="Colaborador no encontrado" />}
    </Sheet>
  );
}

const fmt = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 1 });

function Body({ person }: { person: Person }) {
  const { view } = useApp();
  return (
    <div className="space-y-5">
      <FlagControl person={person} />
      {view.dated ? <DatedBody person={person} /> : <PersonItems kind={view.key === "hu" ? "hu" : "bugs"} personKey={person.key} />}
    </div>
  );
}

/** Proyecto "otro" para la marca de asignación (348 ↔ 005), con su nombre corto ("Acueducto", "Positiva"). */
function otherProjectName(projectKey: keyof typeof PROJECTS) {
  const other = Object.values(PROJECTS).find((p) => p.key !== projectKey);
  return other ? other.name.replace("SGDEA", "").trim() : "otro proyecto";
}

const FLAG_KINDS: { kind: MemberFlagKind; title: string; hint: string }[] = [
  { kind: "vacaciones", title: "En vacaciones", hint: "Opcional: hasta qué fecha" },
  { kind: "otro_proyecto", title: "Asignado a otro proyecto", hint: "Trabaja para otro proyecto" },
  { kind: "otro", title: "Otra", hint: "Licencia, incapacidad, capacitación…" },
];

/**
 * Marca especial de la persona en este proyecto (vacaciones, otro proyecto…). Con marca no se evalúa en el
 * semáforo y sus pendientes no generan alertas; lo que entrega sí cuenta. Queda en la bitácora.
 */
function FlagControl({ person }: { person: Person }) {
  const { projectKey, dataset, today } = useApp();
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<MemberFlagKind>("vacaciones");
  const defaultLabel = (k: MemberFlagKind) => (k === "vacaciones" ? "En vacaciones" : k === "otro_proyecto" ? `Asignado al proyecto de ${otherProjectName(projectKey)}` : "");
  const [label, setLabel] = useState(defaultLabel("vacaciones"));
  const [until, setUntil] = useState("");
  if (!person.inRoster || !person.employeeId) return null;

  async function save(close: () => void) {
    setBusy(true);
    try {
      await api("/api/members/flag", {
        method: "PUT",
        body: JSON.stringify({ projectKey, employeeId: person.employeeId, kind, label: label.trim(), until: until || null }),
      });
      await dataset.mutate();
      toast.success("Marca guardada", { description: `${person.name}: ${label.trim()}. No se evaluará en el semáforo.` });
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la marca");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    try {
      await api("/api/members/flag", { method: "DELETE", body: JSON.stringify({ projectKey, employeeId: person.employeeId }) });
      await dataset.mutate();
      toast.success("Marca quitada", { description: `${person.name} vuelve a evaluarse en el semáforo.` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo quitar la marca");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line p-3" aria-label="Marca especial">
      <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-subtle">Marca especial</span>
      {person.flag ? (
        <>
          <FlagBadge flag={person.flag} className="text-xs" />
          <span className="min-w-0 flex-1 text-xs text-muted">No se evalúa en el semáforo ni genera alertas; lo que entrega sí cuenta.</span>
          <Button size="sm" variant="ghost" icon={X} loading={busy} onClick={() => void clear()}>
            Quitar marca
          </Button>
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 text-xs text-muted">Sin marca: se evalúa normalmente.</span>
          <Popover
            align="end"
            panelClassName="w-[20rem] max-w-[calc(100vw-2rem)]"
            trigger={({ open, toggle }) => (
              <Button size="sm" variant="secondary" icon={Tag} onClick={toggle} aria-expanded={open}>
                Poner marca
              </Button>
            )}
          >
            {({ close }) => (
              <div className="space-y-3">
                <p className="text-xs text-muted">La persona dejará de evaluarse en el semáforo y sus pendientes no generarán alertas. Lo que entregue sí cuenta.</p>
                <div className="space-y-1">
                  {FLAG_KINDS.map((k) => {
                    const Icon = FLAG_ICON[k.kind];
                    return (
                      <button
                        key={k.kind}
                        onClick={() => {
                          setKind(k.kind);
                          setLabel(defaultLabel(k.kind));
                        }}
                        aria-pressed={kind === k.kind}
                        className={clsx("flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left", kind === k.kind ? "bg-accent-soft text-accent-fg" : "hover:bg-surface-2")}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{k.title}</span>
                          <span className="block text-[0.6875rem] text-muted">{k.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <label className="block text-[0.6875rem] text-subtle">
                  Texto de la etiqueta
                  <input
                    value={label}
                    maxLength={80}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Ej.: En incapacidad"
                    className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm text-foreground outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
                  />
                </label>
                <label className="block text-[0.6875rem] text-subtle">
                  Hasta (opcional; sin fecha, se quita a mano)
                  <input
                    type="date"
                    value={until}
                    min={today}
                    onChange={(e) => setUntil(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm text-foreground outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
                  />
                </label>
                <Button className="w-full" variant="primary" size="sm" loading={busy} disabled={!label.trim()} onClick={() => void save(close)}>
                  Guardar marca
                </Button>
              </div>
            )}
          </Popover>
        </>
      )}
    </section>
  );
}

function DatedBody({ person }: { person: Person }) {
  const { model, range, filters, openWorkItem, openPerson } = useApp();
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const [cat, setCat] = useState<StateCategory | "all">("all");
  const items = useMemo(
    () =>
      model!.work.filter((i) => i.personKey === person.key && isAlive(i, range) && inTypes(i, filters.types) && inEpics(i, filters.epics) && inTag(i, filters.tag)),
    [model, person.key, range, filters.types, filters.epics, filters.tag],
  );
  const row = useMemo(() => perPerson([person], items, range, model!.now)[0], [person, items, range, model]);
  const listed = items.filter((i) => cat === "all" || i.cat === cat).sort((a, b) => (b.deliveredAt ?? b.createdAt) - (a.deliveredAt ?? a.createdAt));

  const stats = [
    { label: "Entregó", value: String(row.delivered), hint: "en el periodo" },
    { label: "Horas trabajadas", value: `${fmt(row.hoursDelivered)} h`, hint: "Completed Work de lo entregado" },
    { label: "En curso", value: String(row.wip), hint: "ahora mismo" },
    {
      label: "A tiempo",
      value: row.onTimeRate === null ? "—" : `${Math.round(row.onTimeRate * 100)} %`,
      hint: row.onTimeBase ? `de ${row.onTimeBase} entregas con fecha objetivo` : "sin entregas con fecha objetivo",
    },
    { label: "Atrasadas", value: String(row.overdue), hint: "sin entregar y con la fecha pasada", tone: row.overdue > 0 },
  ];

  return (
    <>
      <section className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface-2 p-3" aria-label="Semáforo del periodo">
        <div className="flex items-center gap-2">
          <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-subtle">Semáforo</span>
          <HealthBadge level={row.health.level} reasons={row.health.reasons} />
        </div>
        <ul className="min-w-0 flex-1 space-y-0.5 text-sm">
          {row.health.reasons.map((r) => (
            <li key={r} className="flex items-start gap-1.5">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-subtle" aria-hidden />
              {r}
            </li>
          ))}
        </ul>
        <p className="w-full text-[0.6875rem] text-subtle sm:w-auto">
          {row.elapsedDays} {row.elapsedDays === 1 ? "día hábil transcurrido" : "días hábiles transcurridos"}
          {row.elapsedDays < HEALTH_RULES.minDays && row.health.level !== "idle" ? " · periodo corto: solo cuentan atrasos y puntualidad" : ""}
        </p>
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-surface-2 p-3">
              <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-subtle">{s.label}</p>
              <p className={clsx("font-display text-lg font-semibold tabular-nums", s.tone && "text-critical-fg")}>{s.value}</p>
              <p className="truncate text-[0.6875rem] text-muted">{s.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {person.email && (
          <a href={`mailto:${person.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
            <Mail className="size-3" /> {person.email}
          </a>
        )}
        {person.azureEmails.length > 0 && <span className="text-subtle">· En Azure: {person.azureEmails.join(", ")}</span>}
        {person.matchedBy && person.matchedBy !== "global" && <span className="rounded-md bg-surface-3 px-1.5 py-0.5">vinculado por {person.matchedBy}</span>}
      </div>

      {items.length === 0 ? (
        <EmptyState title="Sin ítems en las épicas monitoreadas en este periodo" description="Amplía el periodo, revisa el filtro de épica o el vínculo de su correo en Azure." />
      ) : (
        <>
          <section>
            <h3 className="mb-2 font-display text-sm font-semibold">Cronograma del periodo</h3>
            <Gantt items={items} model={model!} range={range} zoom={range.to - range.from <= 21 * 86_400_000 ? "day" : "week"} groupBy="feature" sort="start" onOpenItem={openWorkItem} onOpenPerson={openPerson} />
          </section>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold">Ítems ({listed.length})</h3>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                <Chip active={cat === "all"} onClick={() => setCat("all")} count={items.length}>
                  Todos
                </Chip>
                {CATEGORIES.map((c) => (
                  <Chip key={c} active={cat === c} onClick={() => setCat(c)} count={row.byCat[c]}>
                    {CATEGORY_LABEL[c]}
                  </Chip>
                ))}
              </div>
            </div>
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {listed.slice(0, 80).map((i) => (
                <li key={i.id}>
                  <button onClick={() => openWorkItem(i.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-surface-2">
                    <TypeBadge type={i.type} />
                    <span className="font-mono text-[0.6875rem] text-subtle">#{i.id}</span>
                    <span className="min-w-0 flex-1 truncate">{i.title}</span>
                    {i.countedHours > 0 && <span className="text-xs tabular-nums text-muted" title="Completed Work">{i.countedHours} h</span>}
                    <span className="flex w-36 shrink-0 items-center gap-1.5 text-xs text-muted">
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: categoryColor(i.cat, dark) }} />
                      <span className="truncate">{i.state}</span>
                    </span>
                    {(i.overdue || i.onTime === false) && <span className="rounded-md bg-critical-soft px-1.5 text-[0.6875rem] font-semibold text-critical-fg">+{Math.ceil(i.delayDays)} d</span>}
                  </button>
                </li>
              ))}
            </ul>
            {listed.length > 80 && <p className="mt-2 text-xs text-subtle">Mostrando 80 de {listed.length}. Usa el Cronograma o el Backlog para ver todos.</p>}
          </section>
        </>
      )}
    </>
  );
}
