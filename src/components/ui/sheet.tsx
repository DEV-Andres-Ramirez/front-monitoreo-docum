"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { useBreakpoint } from "./display";

/** Pila de hojas abiertas: Escape solo cierra la de más arriba. */
const openSheets: symbol[] = [];
export const isSheetOpen = () => openSheets.length > 0;

/** Escritorio = ancho efectivo ≥ sm (respeta la escala de la interfaz). */
export function useIsDesktop() {
  return useBreakpoint("sm");
}

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Las hojas apiladas (p. ej. formulario sobre el detalle) usan level 2 */
  level?: 1 | 2;
  width?: string;
};

/** Panel lateral en escritorio / bottom sheet en móvil. */
export function Sheet({ open, onClose, title, description, children, footer, level = 1, width = "sm:w-[36.25rem]" }: SheetProps) {
  const desktop = useIsDesktop();

  useEffect(() => {
    if (!open) return;
    const token = Symbol("sheet");
    openSheets.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openSheets[openSheets.length - 1] === token) onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      openSheets.splice(openSheets.indexOf(token), 1);
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const hidden = desktop ? { x: "100%" } : { y: "100%" };

  return (
    <AnimatePresence>
      {open && (
        <div className={`fixed inset-0 ${level === 2 ? "z-[70]" : "z-50"}`} role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[0.1875rem]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            onClick={onClose}
          />
          <motion.aside
            initial={hidden}
            animate={{ x: 0, y: 0 }}
            exit={{ ...hidden, transition: { duration: 0.22, ease: "easeIn" } }}
            transition={{ type: "spring", damping: 34, stiffness: 340 }}
            className={`absolute inset-x-0 bottom-0 flex max-h-[94dvh] flex-col rounded-t-[1.75rem] border-t border-line bg-surface shadow-pop sm:inset-y-2 sm:left-auto sm:right-2 sm:max-h-none sm:rounded-[1.75rem] sm:border ${width}`}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-line-strong sm:hidden" />
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 pb-4 pt-4 sm:px-7 sm:pt-6">
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-semibold leading-tight text-foreground sm:text-xl">{title}</div>
                {description && <div className="mt-1 text-sm text-muted">{description}</div>}
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-muted transition hover:rotate-90 hover:bg-surface-3 hover:text-foreground"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </button>
            </header>
            <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
            {footer && <footer className="border-t border-line px-5 py-4 sm:px-7">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
