"use client";

import { Activity, CalendarClock, Clock, Users } from "lucide-react";
import { motion } from "motion/react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Skeleton } from "@/components/ui/primitives";
import type { TeamResponse } from "@/lib/types";

export function KpiCards({ data }: { data: TeamResponse | undefined }) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-3xl" />
        ))}
      </div>
    );
  }

  const { totals, members } = data;
  const expected = members.filter((m) => m.inRange).reduce((s, m) => s + m.expectedHours, 0);
  const coverage = totals.total ? Math.round((totals.reported / totals.total) * 100) : 0;

  const cards = [
    {
      label: "Horas registradas",
      icon: Clock,
      value: <AnimatedNumber value={totals.dayHours} decimals={2} />,
      hint: `de ${expected.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h esperadas`,
      progress: expected ? totals.dayHours / expected : 0,
    },
    {
      label: "Colaboradores reportados",
      icon: Users,
      value: (
        <>
          <AnimatedNumber value={totals.reported} />
          <span className="text-lg text-muted">/{totals.total}</span>
        </>
      ),
      hint: `${coverage}% de cobertura del día`,
      progress: coverage / 100,
    },
    {
      label: "Actividades del día",
      icon: Activity,
      value: <AnimatedNumber value={totals.dayActivities} />,
      hint: "registros asociados a Azure",
    },
    {
      label: "Horas de la semana",
      icon: CalendarClock,
      value: <AnimatedNumber value={totals.weekHours} decimals={2} />,
      hint: "lunes a domingo",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -3 }}
          className="group relative overflow-hidden rounded-3xl border border-white bg-white/90 p-4 shadow-[0_10px_30px_-18px_rgba(15,40,80,0.35)] sm:p-5"
        >
          <div className="accent-transition absolute -right-6 -top-6 size-20 rounded-full bg-accent-soft transition-transform duration-500 group-hover:scale-125" />
          <div className="relative flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-muted sm:text-sm">{card.label}</p>
            <card.icon className="accent-transition size-4 shrink-0 text-accent sm:size-5" />
          </div>
          <p className="relative mt-2 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{card.value}</p>
          <p className="relative mt-1 truncate text-[11px] text-muted sm:text-xs">{card.hint}</p>
          {card.progress !== undefined && (
            <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className="accent-transition h-full rounded-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(card.progress, 1) * 100}%` }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
