"use client";

import clsx from "clsx";
import { Maximize, Minimize, Minus, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { canGrow, canShrink, setUiScale, stepUiScale, useFullscreen, useUiScale } from "./display";

/** Muestra el nuevo tamaño en un aviso breve (útil al ajustar desde lejos en un TV). */
export function announceScale(scale: number) {
  toast(`Tamaño de la interfaz: ${Math.round(scale * 100)} %`, { id: "ui-scale", duration: 1400 });
}

export function changeScale(direction: 1 | -1 | 0) {
  const next = direction === 0 ? setUiScale(1) : stepUiScale(direction);
  announceScale(next);
}

/**
 * Controles de visualización: reducir / porcentaje (clic = 100 %) / aumentar + pantalla completa.
 * `size="lg"` agranda los botones para usarlos en un TV o pantalla táctil.
 */
export function DisplayControls({ className, size = "md", showFullscreen = true }: { className?: string; size?: "md" | "lg"; showFullscreen?: boolean }) {
  const scale = useUiScale();
  const fullscreen = useFullscreen();
  const pct = Math.round(scale * 100);
  const btn = clsx(
    "grid place-items-center rounded-[0.625rem] text-muted transition hover:bg-surface-3 hover:text-foreground disabled:pointer-events-none disabled:opacity-35",
    size === "lg" ? "size-11" : "size-8",
  );

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <div role="group" aria-label="Tamaño de la interfaz" className="flex items-center rounded-xl border border-line bg-surface p-0.5 shadow-sm">
        <button onClick={() => changeScale(-1)} disabled={!canShrink(scale)} className={btn} title="Reducir tamaño ( − )" aria-label="Reducir tamaño">
          <Minus className="size-4" />
        </button>
        <button
          onClick={() => changeScale(0)}
          title="Restablecer al 100 % ( 0 )"
          aria-label={`Tamaño actual ${pct} %, restablecer al 100 %`}
          className={clsx(
            "relative overflow-hidden rounded-[0.625rem] font-display font-semibold tabular-nums transition hover:bg-surface-3",
            size === "lg" ? "h-11 min-w-16 text-base" : "h-8 min-w-12 text-xs",
            pct === 100 ? "text-muted" : "text-accent-fg",
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={pct} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="block px-1.5">
              {pct} %
            </motion.span>
          </AnimatePresence>
        </button>
        <button onClick={() => changeScale(1)} disabled={!canGrow(scale)} className={btn} title="Aumentar tamaño ( + )" aria-label="Aumentar tamaño">
          <Plus className="size-4" />
        </button>
      </div>
      {showFullscreen && fullscreen.supported && (
        <button
          onClick={fullscreen.toggle}
          title={fullscreen.active ? "Salir de pantalla completa ( F )" : "Pantalla completa ( F )"}
          aria-label={fullscreen.active ? "Salir de pantalla completa" : "Pantalla completa"}
          aria-pressed={fullscreen.active}
          className={clsx(
            "grid place-items-center rounded-xl border shadow-sm transition",
            size === "lg" ? "size-12" : "size-10",
            fullscreen.active ? "border-accent bg-accent text-white shadow-accent/30" : "border-line bg-surface text-muted hover:text-foreground",
          )}
        >
          {fullscreen.active ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
        </button>
      )}
    </div>
  );
}
