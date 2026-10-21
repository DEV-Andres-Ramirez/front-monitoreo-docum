"use client";

import { ArrowRight, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/shell/app-provider";
import { Skeleton } from "@/components/ui/primitives";
import { useTheme } from "@/components/ui/theme";
import { categoryColor } from "@/lib/analytics/state-colors";
import { pctText } from "./compliance-view";
import { useCompliance } from "./use-compliance";

/** Tarjeta compacta de cumplimiento para el Resumen (proyectos con análisis de cumplimiento). */
export function ComplianceSummary() {
  const { project, epics } = useApp();
  const { analysis } = useCompliance();
  const { resolved } = useTheme();
  if (!project.compliance) return null;
  if (!analysis) return <Skeleton className="h-36 w-full rounded-2xl" />;
  const dark = resolved === "dark";
  const { hu, tasks } = analysis;
  const blocks = [
    {
      title: "Historias de usuario",
      main: pctText(hu.pctDone),
      caption: `${hu.done} de ${hu.total} en producción`,
      bars: [
        { label: "Producción", value: hu.pctDone, color: categoryColor("Completed", dark) },
        { label: `QA o más · ${pctText(hu.pctQa)} (${hu.qa})`, value: hu.pctQa, color: categoryColor("Resolved", dark) },
      ],
      period: `+${hu.qaInPeriod} a QA · +${hu.doneInPeriod} a producción en el periodo`,
    },
    {
      title: "Tareas",
      main: pctText(tasks.pctDone),
      caption: `${tasks.done} de ${tasks.total} cerradas`,
      bars: [{ label: "Cerradas", value: tasks.pctDone, color: categoryColor("Completed", dark) }],
      period: `+${tasks.doneInPeriod} cerradas en el periodo`,
    },
  ];
  return (
    <section className="card p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-fg">
            <ClipboardCheck className="size-[1.125rem]" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[0.9375rem] font-semibold leading-tight">Cumplimiento · {epics.map((e) => e.title).join(" y ")}</h2>
            <p className="mt-0.5 text-xs text-muted">Todas las HU y tareas de la épica: total, completadas y % de cumplimiento</p>
          </div>
        </div>
        <Link href="/cumplimiento" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-semibold shadow-sm transition hover:bg-surface-2">
          Ver análisis de cumplimiento <ArrowRight className="size-3.5" />
        </Link>
      </header>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {blocks.map((b) => (
          <div key={b.title} className="rounded-2xl border border-line bg-surface-2/60 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">{b.title}</span>
              <span className="text-xs tabular-nums text-muted">{b.caption}</span>
            </div>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums tracking-tight">{b.main}</p>
            <div className="mt-2 space-y-1.5">
              {b.bars.map((bar) => (
                <div key={bar.label}>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, bar.value * 100)}%`, background: bar.color }} />
                  </div>
                  <p className="mt-0.5 text-[0.6875rem] text-muted">{bar.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[0.6875rem] text-subtle">{b.period}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
