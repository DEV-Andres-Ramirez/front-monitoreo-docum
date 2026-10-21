"use client";

import { Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { DisplayControls } from "@/components/ui/display-controls";
import { Kbd } from "@/components/ui/primitives";
import { useApp } from "./app-provider";
import { FilterBar, SyncChip } from "./filter-bar";
import { navFor } from "./nav";

/**
 * Encabezado de escritorio en dos filas que no se superponen:
 * 1) vista + sincronización + tamaño/pantalla completa + búsqueda  2) filtros globales.
 */
export function Topbar() {
  const pathname = usePathname();
  const { project, projectKey, setPaletteOpen } = useApp();
  const nav = navFor(pathname, projectKey);

  return (
    <header className="glass sticky top-0 z-30 hidden border-b border-line lg:block">
      <div className="mx-auto max-w-[93.75rem] space-y-3 px-8 py-4">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={nav.href + projectKey} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                <p className="flex items-center gap-2 whitespace-nowrap text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-accent-fg">
                  {projectKey} · {project.name}
                  <span className="text-subtle">/</span>
                  <span className="truncate text-subtle">{nav.description}</span>
                </p>
                <h1 className="mt-0.5 truncate font-display text-2xl font-semibold tracking-tight text-foreground">{nav.label}</h1>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SyncChip />
            <DisplayControls />
            <button
              onClick={() => setPaletteOpen(true)}
              title="Buscar o ejecutar (⌘K)"
              aria-label="Buscar o ejecutar"
              className="flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm text-subtle shadow-sm transition hover:border-line-strong hover:text-muted 2xl:w-56 2xl:justify-start 2xl:px-3"
            >
              <Search className="size-4 shrink-0" />
              <span className="hidden flex-1 text-left 2xl:inline">Buscar…</span>
              <span className="hidden gap-1 2xl:flex">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
          </div>
        </div>
        <FilterBar />
      </div>
    </header>
  );
}
