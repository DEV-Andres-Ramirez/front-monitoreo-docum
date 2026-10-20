"use client";

import clsx from "clsx";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo } from "react";
import { useApp } from "@/components/shell/app-provider";
import { Avatar, Skeleton } from "@/components/ui/primitives";
import { JORNADA_HORAS } from "@/lib/config";
import { eachDay, formatHours, isBusinessDay, weekRange } from "@/lib/dates";
import type { TeamMember } from "@/lib/types";

/** Escala secuencial (un solo tono, el acento): claro → intenso según horas / esperado. */
const STEPS = [
  { min: 0.0001, label: "< 50 %", mix: 22 },
  { min: 0.5, label: "50–89 %", mix: 45 },
  { min: 0.9, label: "90–110 %", mix: 72 },
  { min: 1.1, label: "> 110 %", mix: 95 },
];

function stepFor(ratio: number) {
  return [...STEPS].reverse().find((s) => ratio >= s.min) ?? null;
}

function inRangeOn(m: TeamMember, d: string) {
  return (!m.startDate || m.startDate <= d) && (!m.endDate || m.endDate >= d);
}

/** Matriz persona × día de la semana seleccionada (heatmap con valor escrito en cada celda). */
export function ComplianceMatrix({ members }: { members: TeamMember[] }) {
  const { date, today, weekData, openMember, openRegister } = useApp();
  const { start, end } = weekRange(date);
  const days = eachDay(start, end);

  const cell = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of weekData?.memberDays ?? []) map.set(`${d.employeeId}|${d.date}`, d.hours);
    return map;
  }, [weekData]);

  if (!weekData) return <Skeleton className="h-[420px] rounded-[1.25rem]" />;

  const dayTotals = days.map((d) => members.reduce((s, m) => s + (cell.get(`${m.employeeId}|${d}`) ?? 0), 0));

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div>
          <h3 className="font-display text-[15px] font-semibold">Matriz de cumplimiento semanal</h3>
          <p className="text-xs text-muted">Horas registradas frente a la jornada esperada (8 h × % asignado). Clic en una celda para ver o registrar.</p>
        </div>
        <ul className="flex flex-wrap items-center gap-3 text-[11px] text-muted" aria-label="Escala">
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded border border-dashed border-warning bg-warning-soft" /> Sin registro
          </li>
          {STEPS.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span className="size-3 rounded" style={{ background: `color-mix(in oklab, var(--accent) ${s.mix}%, var(--surface))` }} /> {s.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="scrollbar-thin max-h-[640px] overflow-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 bg-surface-2 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">Colaborador</th>
              {days.map((d) => (
                <th
                  key={d}
                  className={clsx(
                    "bg-surface-2 px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wider",
                    d === date ? "text-accent-fg" : isBusinessDay(d) ? "text-subtle" : "text-subtle/60",
                  )}
                >
                  {format(parseISO(d), "EEE", { locale: es })}
                  <span className="block font-display text-sm normal-case tracking-normal text-foreground">{format(parseISO(d), "d")}</span>
                </th>
              ))}
              <th className="bg-surface-2 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-subtle">Semana</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const expected = JORNADA_HORAS * m.allocation;
              const weekTotal = days.reduce((s, d) => s + (cell.get(`${m.employeeId}|${d}`) ?? 0), 0);
              return (
                <tr key={m.memberId} className="group">
                  <td className="sticky left-0 z-[5] border-t border-line bg-surface px-4 py-2 group-hover:bg-surface-2">
                    <button onClick={() => openMember(m)} className="flex max-w-[240px] items-center gap-2.5 text-left">
                      <Avatar name={m.name} size="xs" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{m.name}</span>
                        <span className="block truncate text-[10px] text-subtle">{Math.round(m.allocation * 100)} % · {m.role}</span>
                      </span>
                    </button>
                  </td>
                  {days.map((d) => {
                    const hours = cell.get(`${m.employeeId}|${d}`) ?? 0;
                    const business = isBusinessDay(d);
                    const due = business && inRangeOn(m, d) && d <= today;
                    const step = hours > 0 ? stepFor(business ? hours / expected : 1) : null;
                    return (
                      <td key={d} className="border-t border-line p-1 group-hover:bg-surface-2">
                        <button
                          onClick={() => (hours > 0 ? openMember(m, d) : d <= today ? openRegister(m, d) : undefined)}
                          disabled={d > today}
                          title={`${m.name} · ${format(parseISO(d), "EEEE d", { locale: es })}: ${formatHours(hours)}${business ? ` de ${formatHours(expected)}` : ""}`}
                          className={clsx(
                            "grid h-10 w-full min-w-12 place-items-center rounded-lg text-xs font-semibold tabular-nums transition hover:scale-[1.06] hover:shadow-md disabled:pointer-events-none",
                            !step && due && "border border-dashed border-warning/70 bg-warning-soft text-warning-fg",
                            !step && !due && "bg-surface-2 text-subtle/60",
                            d === date && "ring-2 ring-accent/40",
                          )}
                          style={step ? { background: `color-mix(in oklab, var(--accent) ${step.mix}%, var(--surface))`, color: "var(--fg)" } : undefined}
                        >
                          {hours > 0 ? hours.toLocaleString("es-CO", { maximumFractionDigits: 2 }) : due ? "—" : ""}
                        </button>
                      </td>
                    );
                  })}
                  <td className="border-t border-line px-3 py-2 text-right font-display text-sm font-semibold tabular-nums group-hover:bg-surface-2">
                    {formatHours(weekTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr>
              <td className="sticky left-0 z-20 border-t border-line-strong bg-surface-2 px-4 py-2.5 text-xs font-semibold text-muted">Total del equipo</td>
              {dayTotals.map((t, i) => (
                <td key={days[i]} className="border-t border-line-strong bg-surface-2 py-2.5 text-center font-display text-xs font-semibold tabular-nums">
                  {t ? t.toLocaleString("es-CO", { maximumFractionDigits: 1 }) : "—"}
                </td>
              ))}
              <td className="border-t border-line-strong bg-surface-2 px-3 py-2.5 text-right font-display text-sm font-semibold tabular-nums">
                {formatHours(dayTotals.reduce((s, t) => s + t, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
