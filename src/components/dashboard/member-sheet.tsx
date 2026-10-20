"use client";

import clsx from "clsx";
import { Mail } from "lucide-react";
import { useMemo, useState } from "react";
import { Gantt } from "@/components/gantt/gantt";
import { useApp } from "@/components/shell/app-provider";
import { Avatar, Chip, EmptyState, ProgressRing, TypeBadge } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { useTheme } from "@/components/ui/theme";
import { CATEGORIES, CATEGORY_LABEL, inEpics, isAlive, perPerson } from "@/lib/analytics/metrics";
import type { Person } from "@/lib/analytics/model";
import { categoryColor } from "@/lib/analytics/state-colors";
import type { StateCategory } from "@/lib/analytics/types";

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
              <p className="truncate">{person.name}</p>
              <p className="truncate font-sans text-sm font-normal text-muted">
                {person.inRoster ? `${person.role} · ${Math.round(person.allocation * 100)} % · ${person.assignmentType}` : "Fuera de la planeación de este proyecto"}
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

function Body({ person }: { person: Person }) {
  const { model, range, filters, openWorkItem, openPerson } = useApp();
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const [cat, setCat] = useState<StateCategory | "all">("all");
  const items = useMemo(
    () => model!.work.filter((i) => i.personKey === person.key && isAlive(i, range) && inEpics(i, filters.epics)),
    [model, person.key, range, filters.epics],
  );
  const row = useMemo(() => perPerson([person], items, range, model!.now)[0], [person, items, range, model]);
  const listed = items.filter((i) => cat === "all" || i.cat === cat).sort((a, b) => (b.deliveredAt ?? b.createdAt) - (a.deliveredAt ?? a.createdAt));

  const stats = [
    { label: "Entregado", value: `${row.hoursDelivered.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h`, hint: `${row.delivered} ítems` },
    { label: "En curso", value: String(row.wip), hint: `${row.hoursOpen.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h abiertas` },
    { label: "A tiempo", value: row.onTimeRate === null ? "—" : `${Math.round(row.onTimeRate * 100)} %`, hint: "de las entregas con objetivo" },
    { label: "Cycle time", value: row.cycleP50 === null ? "—" : `${row.cycleP50.toLocaleString("es-CO", { maximumFractionDigits: 1 })} d`, hint: "mediana" },
    { label: "Vencidos", value: String(row.overdue), hint: "sin entregar", tone: row.overdue > 0 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {row.utilization !== null && (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
            <div className="relative grid place-items-center">
              <ProgressRing value={Math.min(row.utilization, 1)} size={52} />
              <span className="absolute text-xs font-bold tabular-nums">{Math.round(row.utilization * 100)}%</span>
            </div>
            <div>
              <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-subtle">Utilización</p>
              <p className="text-sm font-semibold">
                {row.hoursDelivered.toLocaleString("es-CO", { maximumFractionDigits: 1 })} de {row.capacity?.toLocaleString("es-CO", { maximumFractionDigits: 0 })} h de capacidad
              </p>
            </div>
          </div>
        )}
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
        {person.matchedBy && person.matchedBy !== "planeación" && <span className="rounded-md bg-surface-3 px-1.5 py-0.5">vinculado por {person.matchedBy}</span>}
      </div>

      {items.length === 0 ? (
        <EmptyState title="Sin ítems en las épicas monitoreadas en este periodo" description="Amplía el periodo, revisa el filtro de épica o el vínculo de su correo en Azure." />
      ) : (
        <>
          <section>
            <h3 className="mb-2 font-display text-sm font-semibold">Cronograma del periodo</h3>
            <Gantt items={items} model={model!} range={range} zoom="week" groupBy="feature" sort="start" onOpenItem={openWorkItem} onOpenPerson={openPerson} />
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
                    {i.countedHours > 0 && <span className="text-xs tabular-nums text-muted">{i.countedHours} h</span>}
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
    </div>
  );
}
