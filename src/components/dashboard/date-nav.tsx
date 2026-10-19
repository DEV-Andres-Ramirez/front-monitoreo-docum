"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { addDaysISO, formatLong, todayISO } from "@/lib/dates";

export function DateNav({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const today = todayISO();
  const isToday = value === today;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-2xl border border-line bg-white p-1 shadow-sm">
        <button
          onClick={() => onChange(addDaysISO(value, -1))}
          className="rounded-xl p-2 text-muted transition hover:bg-slate-100 hover:text-foreground"
          aria-label="Día anterior"
        >
          <ChevronLeft className="size-4" />
        </button>
        <label className="relative flex cursor-pointer items-center gap-2 px-2 py-1">
          <CalendarDays className="size-4 text-accent accent-transition" />
          <span className="relative block h-5 min-w-40 overflow-hidden text-sm font-medium capitalize text-foreground sm:min-w-48">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={value}
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="absolute inset-0 whitespace-nowrap"
              >
                {formatLong(value)}
              </motion.span>
            </AnimatePresence>
          </span>
          <input
            type="date"
            value={value}
            max={today}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Seleccionar fecha"
          />
        </label>
        <button
          onClick={() => onChange(addDaysISO(value, 1))}
          disabled={value >= today}
          className="rounded-xl p-2 text-muted transition hover:bg-slate-100 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          aria-label="Día siguiente"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <AnimatePresence>
        {!isToday && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => onChange(today)}
            className="accent-transition rounded-xl bg-accent-soft px-3 py-2 text-sm font-semibold text-accent"
          >
            Hoy
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
