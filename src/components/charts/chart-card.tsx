"use client";

import clsx from "clsx";
import { BarChart3, Table2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useUiScale } from "@/components/ui/display";
import { EmptyState, Segmented, Skeleton } from "@/components/ui/primitives";

export type LegendItem = { label: string; color: string; dashed?: boolean; value?: string };

type Props = {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  legend?: LegendItem[];
  actions?: React.ReactNode;
  /** Vista tabular equivalente (accesibilidad y lectura exacta) */
  table?: { columns: string[]; rows: (string | number)[][] };
  loading?: boolean;
  empty?: { title: string; description?: string } | false;
  summary: string;
  height?: number;
  className?: string;
  children: React.ReactNode;
};

/** Contenedor estándar de gráficas: título, leyenda HTML, alternar gráfica ↔ tabla, estados. */
export function ChartCard({ title, subtitle, icon: Icon, legend, actions, table, loading, empty, summary, height: baseHeight = 260, className, children }: Props) {
  const [mode, setMode] = useState<"chart" | "table">("chart");
  // Alturas en px de diseño → escaladas con la interfaz (TV / pantallas grandes)
  const height = Math.round(baseHeight * useUiScale());

  return (
    <section className={clsx("card flex min-w-0 flex-col p-4 sm:p-5", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-fg">
              <Icon className="size-[1.125rem]" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="font-display text-[0.9375rem] font-semibold leading-tight text-foreground">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {table && (
            <Segmented
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: "chart", label: "", title: "Ver gráfica", icon: BarChart3 },
                { value: "table", label: "", title: "Ver tabla", icon: Table2 },
              ]}
            />
          )}
        </div>
      </header>

      {legend && legend.length > 0 && mode === "chart" && !loading && !empty && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Leyenda">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5 text-xs text-muted">
              {l.dashed ? (
                <span className="w-4 border-t-2 border-dashed" style={{ borderColor: l.color }} />
              ) : (
                <span className="size-2.5 rounded-[0.1875rem]" style={{ background: l.color }} />
              )}
              <span>{l.label}</span>
              {l.value && <b className="font-semibold tabular-nums text-foreground">{l.value}</b>}
            </li>
          ))}
        </ul>
      )}

      <div className="relative mt-3 flex-1" style={{ minHeight: height }}>
        {loading ? (
          <Skeleton className="absolute inset-0 rounded-2xl" />
        ) : empty ? (
          <EmptyState variant="chart" title={empty.title} description={empty.description} className="h-full border-none bg-transparent py-6" />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {mode === "chart" ? (
              <motion.figure
                key="chart"
                role="img"
                aria-label={summary}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="m-0"
                style={{ height }}
              >
                {children}
              </motion.figure>
            ) : (
              <motion.div
                key="table"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="scrollbar-thin overflow-auto rounded-xl border border-line"
                style={{ maxHeight: height }}
              >
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-surface-2 text-muted">
                    <tr>
                      {table?.columns.map((c) => (
                        <th key={c} className="px-3 py-2 font-semibold">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table?.rows.map((r, i) => (
                      <tr key={i} className="border-t border-line">
                        {r.map((cell, j) => (
                          <td key={j} className={clsx("px-3 py-1.5", j > 0 && "tabular-nums")}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
