"use client";

import { ArrowRight, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/shell/app-provider";
import { Skeleton } from "@/components/ui/primitives";
import { useTheme } from "@/components/ui/theme";
import { categoryColor } from "@/lib/analytics/state-colors";
import { pctText } from "./compliance-view";
import { useCompliance } from "./use-compliance";

/**
 * Tarjeta compacta de cumplimiento para el Resumen (proyectos con análisis de cumplimiento).
 * Muestra solo el mundo elegido (Tareas, HU o Bugs): los tres no se mezclan. Los bugs sin fechas.
 */
export function ComplianceSummary() {
  const { project, epics, filters, view } = useApp();
  const { analysis } = useCompliance();
  const { resolved } = useTheme();
  if (!project.compliance) return null;
  if (!analysis) return <Skeleton className="h-28 w-full rounded-2xl" />;
  const dark = resolved === "dark";
  const { hu, tasks, bugs } = analysis;
  const shown = filters.epics.length ? epics.filter((e) => filters.epics.includes(e.id)) : epics;
  const scope = shown.length === 1 ? `la épica ${shown[0].title}` : `las ${shown.length} épicas`;

  const block =
    view.key === "hu"
      ? {
          title: "Historias de usuario en producción",
          main: pctText(hu.pctDone),
          caption: `${hu.done} de ${hu.total} HU`,
          bars: [
            { label: `En producción: ${hu.done}`, value: hu.pctDone, color: categoryColor("Completed", dark) },
            { label: `En QA o ya en producción: ${hu.qa} (${pctText(hu.pctQa)})`, value: hu.pctQa, color: categoryColor("Resolved", dark) },
          ],
          note: `En el periodo: +${hu.qaInPeriod} llegaron a QA y +${hu.doneInPeriod} a producción`,
        }
      : view.key === "bugs" && bugs
        ? {
            title: "Bugs cerrados",
            main: pctText(bugs.pctDone),
            caption: `${bugs.done} de ${bugs.total} bugs`,
            bars: [
              { label: `Cerrados: ${bugs.done}`, value: bugs.pctDone, color: categoryColor("Completed", dark) },
              { label: `En revisión QA o ya cerrados: ${bugs.qa} (${pctText(bugs.pctQa)})`, value: bugs.pctQa, color: categoryColor("Resolved", dark) },
            ],
            note: `Estado actual (sin fechas): ${bugs.total - bugs.done} abiertos`,
          }
        : {
            title: "Tareas cerradas",
            main: pctText(tasks.pctDone),
            caption: `${tasks.done} de ${tasks.total} tareas`,
            bars: [{ label: `Cerradas: ${tasks.done}`, value: tasks.pctDone, color: categoryColor("Completed", dark) }],
            note: `En el periodo: +${tasks.doneInPeriod} cerradas`,
          };

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-start gap-3 lg:w-[22rem] lg:shrink-0">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-fg">
            <ClipboardCheck className="size-[1.125rem]" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[0.9375rem] font-semibold leading-tight">Cumplimiento · {block.title.toLowerCase()}</h2>
            <p className="mt-0.5 text-xs text-muted">
              Todo lo de {scope}, de quien sea o sin asignar: total y cuánto se ha completado
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <p className="font-display text-3xl font-semibold tabular-nums tracking-tight">{block.main}</p>
            <p className="text-xs tabular-nums text-muted">{block.caption}</p>
          </div>
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            {block.bars.map((bar) => (
              <div key={bar.label}>
                <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, bar.value * 100)}%`, background: bar.color }} />
                </div>
                <p className="mt-0.5 text-[0.6875rem] text-muted">{bar.label}</p>
              </div>
            ))}
            <p className="text-[0.6875rem] text-subtle">{block.note}</p>
          </div>
          <Link href="/cumplimiento" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-semibold shadow-sm transition hover:bg-surface-2">
            Ver HU, tareas y bugs <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
