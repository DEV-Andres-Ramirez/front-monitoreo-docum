"use client";

import clsx from "clsx";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useId } from "react";
import { addDaysISO, eachDay, weekRange } from "@/lib/dates";
import { useApp } from "./app-provider";

/** Tira semanal Lun→Dom con anillo de cobertura por día. */
export function WeekStrip({ className }: { className?: string }) {
  const id = useId();
  const { date, setDate, today, weekData } = useApp();
  const { start, end } = weekRange(date);
  const days = eachDay(start, end);
  const byDate = new Map(weekData?.daily.map((d) => [d.date, d]));

  return (
    <div className={clsx("flex items-center gap-1.5", className)}>
      <button
        onClick={() => setDate(addDaysISO(date, -7))}
        className="grid size-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-foreground"
        aria-label="Semana anterior"
      >
        <ChevronLeft className="size-4" />
      </button>
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1 shadow-sm">
        {days.map((d) => {
          const stat = byDate.get(d);
          const future = d > today;
          const selected = d === date;
          const coverage = stat && stat.due > 0 ? Math.min(stat.reported / stat.due, 1) : stat && stat.hours > 0 ? 1 : 0;
          const weekend = stat ? !stat.businessDay : [0, 6].includes(parseISO(d).getDay());
          const r = 15;
          const c = 2 * Math.PI * r;
          return (
            <button
              key={d}
              disabled={future}
              onClick={() => setDate(d)}
              aria-pressed={selected}
              aria-label={`${format(parseISO(d), "EEEE d 'de' MMMM", { locale: es })}${stat?.due ? `, ${stat.reported} de ${stat.due} reportaron` : ""}`}
              className={clsx(
                "relative flex w-[46px] shrink-0 flex-col items-center rounded-xl py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                selected ? "text-white" : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              {selected && (
                <motion.span layoutId={`week-day-${id}`} className="absolute inset-0 rounded-xl bg-accent shadow-md shadow-accent/30" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
              )}
              <span className={clsx("relative text-[10px] font-semibold uppercase", weekend && !selected && "text-subtle")}>
                {format(parseISO(d), "EEEEEE", { locale: es })}
              </span>
              <span className="relative grid size-9 place-items-center">
                <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
                  <circle cx="18" cy="18" r={r} fill="none" strokeWidth="2.5" stroke={selected ? "rgb(255 255 255 / 0.3)" : "var(--surface-3)"} />
                  {!future && coverage > 0 && (
                    <motion.circle
                      cx="18"
                      cy="18"
                      r={r}
                      fill="none"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      stroke={selected ? "#fff" : coverage >= 1 ? "var(--good)" : "var(--accent)"}
                      strokeDasharray={c}
                      initial={{ strokeDashoffset: c }}
                      animate={{ strokeDashoffset: c * (1 - coverage) }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                </svg>
                <span className={clsx("relative font-display text-sm font-semibold tabular-nums", selected ? "text-white" : "text-foreground", d === today && !selected && "text-accent-fg")}>
                  {format(parseISO(d), "d")}
                </span>
              </span>
              {d === today && <span className={clsx("relative mt-0.5 size-1 rounded-full", selected ? "bg-white" : "bg-accent")} />}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => setDate(addDaysISO(date, 7))}
        disabled={end >= today}
        className="grid size-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-foreground disabled:opacity-30"
        aria-label="Semana siguiente"
      >
        <ChevronRight className="size-4" />
      </button>
      <label className="relative grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-foreground" title="Elegir fecha">
        <CalendarDays className="size-4" />
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Elegir fecha"
        />
      </label>
      {date !== today && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setDate(today)}
          className="shrink-0 rounded-xl bg-accent-soft px-3 py-2 text-xs font-semibold text-accent-fg"
        >
          Hoy
        </motion.button>
      )}
    </div>
  );
}
