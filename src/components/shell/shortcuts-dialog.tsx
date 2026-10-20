"use client";

import { Keyboard } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { Kbd } from "@/components/ui/primitives";
import { NAV } from "./nav";

const GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: "General",
    items: [
      { keys: ["⌘", "K"], label: "Paleta de comandos" },
      { keys: ["N"], label: "Registrar actividad" },
      { keys: ["?"], label: "Ver atajos" },
      { keys: ["Esc"], label: "Cerrar panel" },
    ],
  },
  {
    title: "Fecha",
    items: [
      { keys: ["←"], label: "Día anterior" },
      { keys: ["→"], label: "Día siguiente" },
      { keys: ["T"], label: "Ir a hoy" },
    ],
  },
  { title: "Vistas", items: NAV.map((n) => ({ keys: [n.key], label: n.label })) },
  {
    title: "Pantalla (TV)",
    items: [
      { keys: ["F"], label: "Pantalla completa" },
      { keys: ["+"], label: "Aumentar tamaño" },
      { keys: ["−"], label: "Reducir tamaño" },
      { keys: ["0"], label: "Tamaño al 100 %" },
    ],
  },
  { title: "Formulario", items: [{ keys: ["⌘", "↵"], label: "Guardar actividad" }, { keys: ["↑", "↓"], label: "Moverse entre HU / tareas" }] },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center px-4" role="dialog" aria-modal="true" aria-label="Atajos de teclado">
          <motion.div className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="relative w-full max-w-lg rounded-3xl border border-line bg-elevated p-6 shadow-pop"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-fg">
                <Keyboard className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold">Atajos de teclado</h2>
                <p className="text-xs text-muted">Trabaja más rápido sin soltar el teclado</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {GROUPS.map((g) => (
                <div key={g.title}>
                  <p className="mb-2 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-subtle">{g.title}</p>
                  <ul className="space-y-1.5">
                    {g.items.map((i) => (
                      <li key={i.label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted">{i.label}</span>
                        <span className="flex gap-1">
                          {i.keys.map((k) => (
                            <Kbd key={k}>{k}</Kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
