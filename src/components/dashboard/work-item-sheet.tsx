"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, CircleDot, ExternalLink, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useApp } from "@/components/shell/app-provider";
import { Avatar, EmptyState, PersonBadges, TypeBadge } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { useTheme } from "@/components/ui/theme";
import { CATEGORY_LABEL } from "@/lib/analytics/metrics";
import { DAY, personRoleLabel, type Item } from "@/lib/analytics/model";
import { categoryColor } from "@/lib/analytics/state-colors";

const fmt = (t: number | null) => (t ? format(t, "EEE d MMM yyyy · HH:mm", { locale: es }) : "—");
const fmtDate = (t: number | null) => (t ? format(t, "d MMM yyyy", { locale: es }) : "—");
const dur = (ms: number) => {
  const d = ms / DAY;
  if (d >= 1) return `${d.toLocaleString("es-CO", { maximumFractionDigits: 1 })} d`;
  const h = ms / 3_600_000;
  return h >= 1 ? `${h.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h` : `${Math.max(1, Math.round(ms / 60_000))} min`;
};

/** Detalle de un ítem de Azure (solo lectura): plan vs. real, horas y traza completa de estados. */
export function WorkItemSheet({ workItemId, onClose }: { workItemId: number | null; onClose: () => void }) {
  const { model } = useApp();
  const item = workItemId !== null ? model?.byId.get(workItemId) : undefined;
  return (
    <Sheet
      open={workItemId !== null}
      onClose={onClose}
      width="sm:w-[40rem]"
      title={
        <span className="flex items-center gap-2">
          {item && <TypeBadge type={item.type} />}
          <span className="font-mono text-base text-subtle">#{workItemId}</span>
        </span>
      }
      description={item?.title ?? "Ítem fuera del periodo cargado"}
    >
      {item ? <Detail item={item} /> : <EmptyState title="No hay datos de este ítem en el periodo" description="Amplía el periodo o sincroniza de nuevo." />}
    </Sheet>
  );
}

function Detail({ item: i }: { item: Item }) {
  const { model, openPerson, openWorkItem } = useApp();
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const person = i.personKey ? model!.people.get(i.personKey) : undefined;
  const path: Item[] = [];
  for (let p = i.parentId ? model!.byId.get(i.parentId) : undefined; p && path.length < 6; p = p.parentId ? model!.byId.get(p.parentId) : undefined) path.unshift(p);
  const children = model!.items.filter((c) => c.parentId === i.id);
  const now = model!.now;
  const segments = i.segments.map((s) => ({ ...s, end: s.to ?? now }));
  const total = segments.reduce((sum, s) => sum + (s.end - s.from), 0) || 1;
  const timeByCat = new Map<string, number>();
  for (const s of segments) timeByCat.set(s.cat, (timeByCat.get(s.cat) ?? 0) + (s.end - s.from));

  return (
    <div className="space-y-5">
      {path.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted" aria-label="Ruta en el backlog">
          {path.map((p) => (
            <button key={p.id} onClick={() => openWorkItem(p.id)} className="flex items-center gap-1 hover:text-foreground">
              <TypeBadge type={p.type} />
              <span className="max-w-[11rem] truncate">{p.title}</span>
              <span className="text-subtle">›</span>
            </button>
          ))}
        </nav>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Estado">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: categoryColor(i.cat, dark) }} />
            <span className="truncate">{i.state}</span>
          </span>
          <span className="text-[0.6875rem] font-normal text-subtle">{CATEGORY_LABEL[i.cat]}</span>
        </Stat>
        <Stat label="Horas (puntos)">
          {i.hours ? `${i.hours.toLocaleString("es-CO")} h` : "—"}
          <span className="text-[0.6875rem] font-normal text-subtle">{i.hours && !i.countedHours ? "no suman: cuentan sus tareas" : i.sp !== null ? "Story Points" : i.effort !== null ? "Effort" : i.estimate !== null ? "Estimación original" : "sin estimar"}</span>
        </Stat>
        <Stat label="Trabajo reportado">
          {i.completedWork !== null ? `${i.completedWork.toLocaleString("es-CO")} h` : "—"}
          <span className="text-[0.6875rem] font-normal text-subtle">{i.remaining !== null ? `${i.remaining} h restantes` : "completado en Azure"}</span>
        </Stat>
        <Stat label="Sprint">
          <span className="truncate">{i.iteration?.split("\\").pop() ?? "—"}</span>
          <span className="text-[0.6875rem] font-normal text-subtle">{i.iterStart ? `${fmtDate(new Date(i.iterStart).getTime())} – ${fmtDate(new Date(i.iterEnd!).getTime())}` : "sin fechas"}</span>
        </Stat>
      </div>

      {person && (
        <button onClick={() => openPerson(person.key)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-left transition hover:border-line-strong">
          <Avatar name={person.name} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
              <span className="truncate">{person.name}</span>
              <PersonBadges person={person} />
            </span>
            <span className="block truncate text-xs text-subtle">
              {personRoleLabel(person)} · asignado en Azure como {i.email}
            </span>
          </span>
        </button>
      )}

      {/* Plan vs. real */}
      <section className="rounded-2xl border border-line p-4">
        <h3 className="mb-3 font-display text-sm font-semibold">Plan vs. real</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Creado</dt>
          <dd className="text-right tabular-nums">{fmtDate(i.createdAt)}</dd>
          <dt className="text-muted">Inicio planeado</dt>
          <dd className="text-right tabular-nums">{fmtDate(i.plannedStart)}</dd>
          <dt className="text-muted">Fecha objetivo</dt>
          <dd className="text-right tabular-nums">{fmtDate(i.plannedEnd)}</dd>
          <dt className="text-muted">Inicio real</dt>
          <dd className="text-right tabular-nums">{fmtDate(i.actualStart)}</dd>
          <dt className="text-muted">Entrega real</dt>
          <dd className="text-right tabular-nums">{fmtDate(i.deliveredAt)}</dd>
          <dt className="text-muted">Creación → cierre</dt>
          <dd className="text-right tabular-nums">{i.leadTime !== null ? `${i.leadTime.toLocaleString("es-CO", { maximumFractionDigits: 1 })} d` : "abierto"}</dd>
          <dt className="text-muted">Días de en curso a cerrado</dt>
          <dd className="text-right tabular-nums">{i.cycleTime !== null ? `${i.cycleTime.toLocaleString("es-CO", { maximumFractionDigits: 1 })} d` : "—"}</dd>
        </dl>
        <p
          className={clsx(
            "mt-3 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold",
            i.overdue || i.onTime === false ? "bg-critical-soft text-critical-fg" : i.onTime ? "bg-good-soft text-good-fg" : "bg-surface-2 text-muted",
          )}
        >
          {i.overdue ? (
            <>
              <AlertTriangle className="size-4" /> Vencido: {Math.ceil(i.delayDays)} días después de la fecha objetivo
            </>
          ) : i.onTime === false ? (
            <>
              <AlertTriangle className="size-4" /> Entregado con {Math.ceil(i.delayDays)} días de retraso
            </>
          ) : i.onTime ? (
            <>
              <CheckCircle2 className="size-4" /> Entregado a tiempo
            </>
          ) : (
            <>
              <CircleDot className="size-4" /> {i.plannedEnd ? "En plazo" : "Sin fecha objetivo ni sprint con fechas"}
            </>
          )}
        </p>
      </section>

      {/* Traza de estados */}
      <section>
        <h3 className="mb-2 font-display text-sm font-semibold">Traza de estados</h3>
        <div className="mb-3 flex h-2.5 overflow-hidden rounded-full" role="img" aria-label="Proporción del tiempo en cada estado">
          {segments.map((s, idx) => (
            <motion.span
              key={idx}
              initial={{ width: 0 }}
              animate={{ width: `${((s.end - s.from) / total) * 100}%` }}
              transition={{ duration: 0.7, delay: idx * 0.05 }}
              style={{ background: categoryColor(s.cat, dark) }}
              title={`${s.state}: ${dur(s.end - s.from)}`}
            />
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {[...timeByCat.entries()].map(([cat, ms]) => (
            <span key={cat} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: categoryColor(cat as Item["cat"], dark) }} />
              {CATEGORY_LABEL[cat as Item["cat"]]}: <b className="font-semibold text-foreground">{dur(ms)}</b> ({Math.round((ms / total) * 100)} %)
            </span>
          ))}
        </div>
        <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[0.4375rem] before:top-2 before:w-px before:bg-line">
          {segments.map((s, idx) => (
            <li key={idx} className="relative pl-7">
              <span className="absolute left-0 top-1 size-[0.9375rem] rounded-full border-2 border-surface shadow" style={{ background: categoryColor(s.cat, dark) }} />
              <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold">{s.state}</span>
                <span className="text-xs tabular-nums text-muted">{s.to ? dur(s.end - s.from) : `${dur(s.end - s.from)} (actual)`}</span>
              </p>
              <p className="text-xs capitalize text-subtle">{fmt(s.from)}</p>
            </li>
          ))}
        </ol>
        {i.segments.length <= 1 && <p className="mt-2 text-xs text-subtle">Sin más cambios de estado en la ventana sincronizada (12 meses).</p>}
      </section>

      {children.length > 0 && (
        <section>
          <h3 className="mb-2 font-display text-sm font-semibold">Ítems hijos ({children.length})</h3>
          <ul className="space-y-1">
            {children.map((c) => (
              <li key={c.id}>
                <button onClick={() => openWorkItem(c.id)} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition hover:bg-surface-2">
                  <TypeBadge type={c.type} />
                  <span className="font-mono text-[0.6875rem] text-subtle">#{c.id}</span>
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <span className="size-1.5 rounded-full" style={{ background: categoryColor(c.cat, dark) }} />
                    {c.state}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <p className="flex items-center gap-1.5 text-[0.6875rem] text-muted">
          <ShieldCheck className="size-3.5 text-good-fg" /> Solo lectura: aquí nada modifica Azure DevOps.
        </p>
        <a href={i.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-accent-fg hover:underline">
          Abrir en Azure <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-2xl border border-line bg-surface-2 p-3">
      <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-subtle">{label}</p>
      <div className="flex min-w-0 flex-col text-sm font-semibold">{children}</div>
    </div>
  );
}
