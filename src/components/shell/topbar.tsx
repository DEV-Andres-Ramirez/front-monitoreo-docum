"use client";

import { Plus, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { Button, Kbd } from "@/components/ui/primitives";
import { capitalizeFirst, formatLong } from "@/lib/dates";
import { useApp } from "./app-provider";
import { navFor } from "./nav";
import { WeekStrip } from "./week-strip";

/** Encabezado de escritorio: título de la vista, búsqueda ⌘K, semana y acción primaria. */
export function Topbar() {
  const pathname = usePathname();
  const nav = navFor(pathname);
  const { project, projectKey, date, setPaletteOpen, openRegister } = useApp();

  return (
    <header className="glass sticky top-0 z-30 hidden border-b border-line lg:block">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-3 px-8 py-4">
        <div className="min-w-[240px] flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={nav.href + projectKey} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <p className="flex items-center gap-2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-fg">
                {projectKey} · {project.name}
                <span className="text-subtle">/</span>
                <span className="text-subtle">{nav.label}</span>
              </p>
              <h1 className="mt-0.5 truncate font-display text-2xl font-semibold tracking-tight text-foreground">
                {nav.href === "/" ? capitalizeFirst(formatLong(date)) : nav.label}
              </h1>
            </motion.div>
          </AnimatePresence>
        </div>

        <WeekStrip />

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaletteOpen(true)}
            title="Buscar o ejecutar (⌘K)"
            aria-label="Buscar o ejecutar"
            className="flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm text-subtle shadow-sm transition hover:border-line-strong hover:text-muted 2xl:w-64 2xl:justify-start 2xl:px-3"
          >
            <Search className="size-4 shrink-0" />
            <span className="hidden flex-1 text-left 2xl:inline">Buscar o ejecutar…</span>
            <span className="hidden gap-1 2xl:flex">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <Button variant="primary" icon={Plus} onClick={() => openRegister(null)} className="h-10">
            Registrar
            <span className="hidden 2xl:flex">
              <Kbd className="border-white/30 bg-white/15 text-white shadow-none">N</Kbd>
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
