"use client";

import clsx from "clsx";
import { ArrowRight, CheckCircle2, ChevronDown, HeartPulse, Info } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSessionStored, writeStored } from "@/components/dashboard/client-api";
import { useApp } from "@/components/shell/app-provider";
import { Avatar, HEALTH_CLASSES, HEALTH_ICON, HEALTH_TONE, HealthBadge, PersonBadges } from "@/components/ui/primitives";
import { HEALTH_LABEL, HEALTH_LEVELS, HEALTH_ORDER, HEALTH_RULES, type HealthLevel } from "@/lib/analytics/health";
import { perPerson, type PersonRow } from "@/lib/analytics/metrics";

import { formatShort } from "@/lib/dates";

/**
 * Filtro del semáforo en Colaboradores: "active" = con carga o con marca (Va mal, En riesgo, Va bien, No evaluado);
 * "all" incluye Sin carga. Quienes no tienen carga quedan ocultos hasta que se pidan: el filtro vive en
 * sessionStorage, así que cada visita nueva vuelve a ocultarlos.
 */
export type HealthFilter = "active" | "all" | HealthLevel;
export const PEOPLE_HEALTH_KEY = "docum:people-health";
const FILTERS: HealthFilter[] = ["active", "all", ...HEALTH_LEVELS];

export function useHealthFilter(): [HealthFilter, (value: HealthFilter) => void] {
  const [stored, set] = useSessionStored<HealthFilter>(PEOPLE_HEALTH_KEY, "active");
  return [FILTERS.includes(stored) ? stored : "active", set];
}

export const shownLevels = (f: HealthFilter): HealthLevel[] => (f === "active" ? ["bad", "risk", "good", "excused"] : f === "all" ? HEALTH_LEVELS : [f]);

/** Orden por estado: Va mal → En riesgo → Va bien → No evaluado → Sin carga; dentro de cada nivel, más atrasos y menos entregado primero. */
export const byHealth = (a: PersonRow, b: PersonRow) =>
  HEALTH_ORDER[a.health.level] - HEALTH_ORDER[b.health.level] || b.overdue - a.overdue || a.hoursDelivered - b.hoursDelivered || a.person.name.localeCompare(b.person.name, "es");

/** Filas por persona del periodo (personal del proyecto, más quien tenga ítems si se incluyen los de fuera de Global). */
export function useTeamRows() {
  const { people, scoped, range, filters, model } = useApp();
  return useMemo(() => {
    const selected = new Set(filters.people);
    const visible = people.filter((p) => !selected.size || selected.has(p.key));
    return perPerson(visible, scoped, range, model?.now).filter((r) => r.person.inRoster || r.active > 0);
  }, [people, scoped, range, filters.people, model]);
}

export function healthCounts(rows: PersonRow[]) {
  const counts: Record<HealthLevel, number> = { bad: 0, risk: 0, good: 0, excused: 0, idle: 0 };
  for (const r of rows) counts[r.health.level] += 1;
  return counts;
}

const BAR_COLOR: Record<HealthLevel, string> = { bad: "bg-critical", risk: "bg-warning", good: "bg-good", excused: "bg-info-fg/60", idle: "bg-line-strong" };

/**
 * Niveles que se muestran como contador y en la barra: los de quienes tienen carga, y "No evaluado" solo si
 * hay alguien con marca. "Sin carga" no se muestra aquí: tiene su propio botón para mostrarlos.
 */
const VISIBLE_LEVELS = HEALTH_LEVELS.filter((l) => l !== "idle");
const counterLevels = (counts: Record<HealthLevel, number>) => VISIBLE_LEVELS.filter((l) => l !== "excused" || counts.excused > 0);

/** Barra apilada de los niveles con carga (con 2 px de separación); la leyenda son los contadores. */
export function HealthStackBar({ counts, className }: { counts: Record<HealthLevel, number>; className?: string }) {
  const total = VISIBLE_LEVELS.reduce((s, l) => s + counts[l], 0);
  if (!total) return <div className={clsx("h-2.5 rounded-full bg-surface-3", className)} />;
  return (
    <div
      className={clsx("flex h-2.5 gap-0.5 overflow-hidden rounded-full", className)}
      role="img"
      aria-label={VISIBLE_LEVELS.map((l) => `${HEALTH_LABEL[l]} ${counts[l]}`).join(", ")}
    >
      {VISIBLE_LEVELS.filter((l) => counts[l] > 0).map((l) => (
        <motion.span key={l} className={BAR_COLOR[l]} initial={{ width: 0 }} animate={{ width: `${(counts[l] / total) * 100}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
      ))}
    </div>
  );
}

/** Contadores por nivel (ícono + etiqueta + número). Con `onSelect` son botones de filtro. */
export function HealthCounters({ counts, active, onSelect }: { counts: Record<HealthLevel, number>; active?: HealthLevel[]; onSelect?: (level: HealthLevel) => void }) {
  const levels = counterLevels(counts);
  return (
    <div className={clsx("grid grid-cols-2 gap-2", levels.length > 3 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
      {levels.map((l) => {
        const Icon = HEALTH_ICON[l];
        const on = !active || active.includes(l);
        const body = (
          <>
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left text-xs font-semibold">{HEALTH_LABEL[l]}</span>
            <span className="font-display text-lg font-semibold tabular-nums leading-none">{counts[l]}</span>
          </>
        );
        const cls = clsx(
          "flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 transition",
          on ? HEALTH_CLASSES[l] : "border-line bg-surface text-muted",
          onSelect && "hover:-translate-y-px hover:shadow-sm",
        );
        return onSelect ? (
          <button key={l} type="button" aria-pressed={active?.length === 1 && active[0] === l} onClick={() => onSelect(l)} className={cls} title={`Ver solo: ${HEALTH_LABEL[l]}`}>
            {body}
          </button>
        ) : (
          <div key={l} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** Cómo se calcula el semáforo (reglas decididas con el usuario, desde HEALTH_RULES). */
export function HealthRules() {
  const R = HEALTH_RULES;
  const pct = (n: number) => `${Math.round(n * 100)} %`;
  return (
    <details className="group rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-foreground">
        <Info className="size-3.5 text-subtle" /> ¿Cómo se calcula?
        <ChevronDown className="ml-auto size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-2 space-y-1.5">
        <li>
          <strong className="text-critical-fg">Va mal:</strong> {R.overdueBad} o más pendientes atrasados · no entregó nada en {R.minDays}+ días hábiles · entregó a tiempo menos del{" "}
          {pct(R.onTimeBad)} (con {R.onTimeMinBase}+ entregas con fecha objetivo).
        </li>
        <li>
          <strong className="text-warning-fg">En riesgo:</strong> 1 o {R.overdueBad - 1} pendientes atrasados · a tiempo entre {pct(R.onTimeBad)} y {pct(R.onTimeRisk)} · nada en curso teniendo
          ítems por iniciar.
        </li>
        <li>
          <strong className="text-good-fg">Va bien:</strong> entregó en el periodo y nada de lo anterior. <strong className="text-info-fg">No evaluado:</strong> tiene una marca (vacaciones, otro
          proyecto…): lo que entrega cuenta, pero no recibe alertas. <strong className="text-foreground">Sin carga:</strong> no tiene ítems en el periodo; se oculta hasta que se pida.
        </li>
        <li>
          Un pendiente atrasado es uno sin entregar cuya fecha objetivo ya pasó. Las horas son las que cada persona reporta en Azure (Completed Work); no se usan las estimadas. Con menos de{" "}
          {R.minDays} días hábiles transcurridos (Hoy, Ayer) solo cuentan atrasos y puntualidad.
        </li>
      </ul>
    </details>
  );
}

function PersonLine({ row, onOpen }: { row: PersonRow; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-surface-2">
        <Avatar name={row.person.name} size="sm" status={HEALTH_TONE[row.health.level]} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{row.person.name}</span>
            <PersonBadges person={row.person} />
          </span>
          <span className="block truncate text-[0.6875rem] text-muted">{row.health.reasons.join(" · ")}</span>
        </span>
      </button>
    </li>
  );
}

const LIST_SIZE = 5;

/** Tarjeta del Resumen: semáforo del equipo en el periodo, con quién va mal y quién está en riesgo. */
export function TeamHealthCard() {
  const { period, openPerson, view } = useApp();
  const rows = useTeamRows();
  const counts = useMemo(() => healthCounts(rows), [rows]);
  const [showIdle, setShowIdle] = useState(false);
  const [showExcused, setShowExcused] = useState(false);
  if (!rows.length) return null;
  const sorted = [...rows].sort(byHealth);
  const lists = (["bad", "risk"] as const).map((l) => ({ level: l, rows: sorted.filter((r) => r.health.level === l) }));
  const idle = sorted.filter((r) => r.health.level === "idle");
  const excused = sorted.filter((r) => r.health.level === "excused");
  const goTo = (f: HealthFilter) => writeStored(PEOPLE_HEALTH_KEY, f, "session");

  return (
    <section className="card p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-fg">
            <HeartPulse className="size-[1.125rem]" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[0.9375rem] font-semibold leading-tight">Semáforo del equipo</h2>
            <p className="mt-0.5 text-xs text-muted">
              Medido con {view.label.toLowerCase()} · {formatShort(period.from)} – {formatShort(period.to)} · {rows.length} colaboradores · clic en una persona para ver por qué
            </p>
          </div>
        </div>
        <Link
          href="/colaboradores"
          onClick={() => goTo("active")}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-semibold shadow-sm transition hover:bg-surface-2"
        >
          Ver colaboradores <ArrowRight className="size-3.5" />
        </Link>
      </header>

      <div className="mt-4 space-y-3">
        <HealthCounters counts={counts} />
        <HealthStackBar counts={counts} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {lists.map(({ level, rows: list }) => (
          <div key={level} className="min-w-0">
            <div className="mb-1 flex items-center justify-between gap-2 px-2">
              <HealthBadge level={level} />
              {list.length > LIST_SIZE && (
                <Link href="/colaboradores" onClick={() => goTo(level)} className="text-[0.6875rem] font-medium text-accent-fg hover:underline">
                  Ver los {list.length}
                </Link>
              )}
            </div>
            {list.length ? (
              <ul className="space-y-0.5">
                {list.slice(0, LIST_SIZE).map((r) => (
                  <PersonLine key={r.person.key} row={r} onOpen={() => openPerson(r.person.key)} />
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-1.5 px-2 py-2 text-xs text-muted">
                <CheckCircle2 className="size-3.5 text-good-fg" /> Nadie en este nivel.
              </p>
            )}
          </div>
        ))}
      </div>

      {excused.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <button type="button" onClick={() => setShowExcused(!showExcused)} aria-expanded={showExcused} className="flex w-full items-center gap-2 text-left text-xs text-muted">
            <HealthBadge level="excused" size="sm" />
            <span className="min-w-0 flex-1 truncate">
              {excused.length} {excused.length === 1 ? "persona con marca" : "personas con marca"} (vacaciones u otro proyecto): lo que entregan cuenta, pero no reciben alertas
            </span>
            <ChevronDown className={clsx("size-3.5 shrink-0 transition-transform", showExcused && "rotate-180")} />
          </button>
          {showExcused && (
            <ul className="mt-2 space-y-0.5">
              {excused.map((r) => (
                <PersonLine key={r.person.key} row={r} onOpen={() => openPerson(r.person.key)} />
              ))}
            </ul>
          )}
        </div>
      )}

      {idle.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <button type="button" onClick={() => setShowIdle(!showIdle)} aria-expanded={showIdle} className="flex w-full items-center gap-2 text-left text-xs text-muted">
            <HealthBadge level="idle" size="sm" />
            <span className="min-w-0 flex-1 truncate">
              {idle.length} {idle.length === 1 ? "persona" : "personas"} del proyecto sin ítems en el periodo
            </span>
            <ChevronDown className={clsx("size-3.5 shrink-0 transition-transform", showIdle && "rotate-180")} />
          </button>
          {showIdle && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {idle.map((r) => (
                <li key={r.person.key}>
                  <button
                    type="button"
                    onClick={() => openPerson(r.person.key)}
                    className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border border-dashed border-line-strong bg-surface-2 py-0.5 pl-0.5 pr-2.5 text-[0.6875rem] text-muted transition hover:text-foreground"
                  >
                    <Avatar name={r.person.name} size="xs" />
                    <span className="truncate">{r.person.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
