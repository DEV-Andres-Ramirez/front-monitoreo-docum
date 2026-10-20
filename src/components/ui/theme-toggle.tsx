"use client";

import clsx from "clsx";
import { Monitor, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useId } from "react";
import { useTheme, type ThemePref } from "./theme";

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "system", label: "Sistema", icon: Monitor },
  { value: "dark", label: "Oscuro", icon: Moon },
];

/** Selector segmentado Claro / Sistema / Oscuro. `compact` muestra solo íconos. */
export function ThemeToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { pref, setTheme } = useTheme();
  const id = useId();

  return (
    <div role="radiogroup" aria-label="Tema" className={clsx("flex rounded-xl border border-line bg-surface-2 p-0.5", className)}>
      {OPTIONS.map((o) => {
        const active = pref === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            title={o.label}
            onClick={(e) => setTheme(o.value, { x: e.clientX, y: e.clientY })}
            className={clsx(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-[0.625rem] px-2 py-1.5 text-xs font-medium transition-colors",
              active ? "text-foreground" : "text-subtle hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`theme-pill-${id}`}
                className="absolute inset-0 rounded-[0.625rem] bg-surface shadow-sm ring-1 ring-line"
                transition={{ type: "spring", stiffness: 500, damping: 36 }}
              />
            )}
            <o.icon className="relative size-3.5" />
            {!compact && <span className="relative">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Botón único que alterna claro ↔ oscuro (para barras compactas). */
export function ThemeSwitchButton({ className }: { className?: string }) {
  const { resolved, setTheme } = useTheme();
  const dark = resolved === "dark";
  return (
    <button
      onClick={(e) => setTheme(dark ? "light" : "dark", { x: e.clientX, y: e.clientY })}
      className={clsx("grid size-10 place-items-center rounded-xl border border-line bg-surface text-muted transition hover:text-foreground", className)}
      aria-label={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
    >
      <motion.span key={resolved} initial={{ rotate: -90, scale: 0.5, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }}>
        {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </motion.span>
    </button>
  );
}
