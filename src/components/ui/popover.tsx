"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * Popover anclado al disparador (sin portales: queda dentro del contenedor de acento).
 * Se cierra con clic fuera o Escape. El contenido ocupa su propia capa (z-50), sin
 * superponerse a los controles vecinos cuando está cerrado.
 */
export function Popover({
  trigger,
  children,
  align = "start",
  className,
  panelClassName,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (props: { close: () => void }) => React.ReactNode;
  align?: "start" | "end";
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={clsx("relative", className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className={clsx(
              "absolute top-full z-50 mt-2 rounded-2xl border border-line bg-elevated p-3 shadow-pop",
              align === "end" ? "right-0" : "left-0",
              panelClassName,
            )}
          >
            {children({ close: () => setOpen(false) })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
