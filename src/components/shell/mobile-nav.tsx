"use client";

import clsx from "clsx";
import { ChevronDown, Keyboard, LogOut, MoreHorizontal, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DisplayControls } from "@/components/ui/display-controls";
import { Sheet } from "@/components/ui/sheet";
import { ThemeSwitchButton, ThemeToggle } from "@/components/ui/theme-toggle";
import { PROJECTS, PROJECT_KEYS } from "@/lib/config";
import { useApp } from "./app-provider";
import { EpicFilter, MobileFiltersButton, PeoplePanel, PeriodPanel, SyncChip, TagFilter } from "./filter-bar";
import { navFor, navItems } from "./nav";

/** Barra superior + tab bar inferior + panel de filtros para pantallas < lg. */
export function MobileNav() {
  const pathname = usePathname();
  const { projectKey, project, setProjectKey, setPaletteOpen, logout, syncNow, sync, syncing, setShortcutsOpen, filtersOpen, setFiltersOpen, tags } = useApp();
  const active = navFor(pathname, projectKey);
  const items = navItems(projectKey);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // Las tres primeras vistas del proyecto van en la barra; el resto, en "Más"
  const tabs = [items[0], items[1], null, items[2]];

  return (
    <>
      {/* App bar */}
      <header className="glass sticky top-0 z-30 border-b border-line lg:hidden">
        <div className="flex items-center gap-2 px-4 pb-2 pt-3">
          <Image src="/linktic_icon.png" alt="LinkTic" width={32} height={32} className="size-8 object-contain" priority />
          <div className="relative min-w-0 flex-1">
            <button onClick={() => setProjectsOpen((o) => !o)} className="flex max-w-full items-center gap-2 rounded-xl px-2 py-1 text-left" aria-expanded={projectsOpen}>
              <span className="grid h-6 min-w-8 place-items-center rounded-lg bg-accent px-1 font-display text-[0.6875rem] font-bold text-white">{projectKey}</span>
              <span className="min-w-0">
                <span className="block truncate font-display text-[0.9375rem] font-semibold leading-tight">{project.name}</span>
                <span className="block truncate text-[0.6875rem] text-subtle">{active.label}</span>
              </span>
              <ChevronDown className={clsx("size-4 shrink-0 text-muted transition-transform", projectsOpen && "rotate-180")} />
            </button>
            <AnimatePresence>
              {projectsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-line bg-elevated p-1.5 shadow-pop"
                >
                  {PROJECT_KEYS.map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        setProjectKey(key);
                        setProjectsOpen(false);
                      }}
                      className={clsx("flex w-full items-center gap-3 rounded-xl p-2 text-left", key === projectKey ? "bg-accent-soft" : "hover:bg-surface-2")}
                    >
                      <span className="grid size-9 place-items-center rounded-xl font-display text-xs font-bold text-white" style={{ background: PROJECTS[key].accent }}>
                        {key}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{PROJECTS[key].name}</span>
                        <span className="block truncate text-[0.6875rem] text-subtle">{PROJECTS[key].client}</span>
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <DisplayControls className="hidden sm:flex" />
          <button onClick={() => setPaletteOpen(true)} className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-muted" aria-label="Buscar">
            <Search className="size-4" />
          </button>
          <ThemeSwitchButton />
        </div>
        <div className="flex items-center gap-2 px-4 pb-3">
          <MobileFiltersButton />
          <SyncChip compact />
        </div>
      </header>

      {/* Tab bar inferior */}
      <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Principal">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2">
          {tabs.map((item) =>
            item ? (
              <Link
                key={item.href}
                href={item.href}
                className={clsx("relative flex flex-col items-center gap-0.5 py-2.5 text-[0.625rem] font-semibold", item.href === active.href ? "text-accent-fg" : "text-subtle")}
              >
                {item.href === active.href && <motion.span layoutId="tab-dot" className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
                <item.icon className="size-5" />
                {item.short}
              </Link>
            ) : (
              <div key="filters" className="flex justify-center">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setFiltersOpen(true)}
                  className="btn-glow -mt-6 grid size-14 place-items-center rounded-2xl bg-accent text-white shadow-xl shadow-accent/40"
                  aria-label="Filtros"
                >
                  <SlidersHorizontal className="size-6" />
                </motion.button>
              </div>
            ),
          )}
          <button
            onClick={() => setMoreOpen(true)}
            className={clsx("flex flex-col items-center gap-0.5 py-2.5 text-[0.625rem] font-semibold", ["/backlog", "/bitacora"].includes(active.href) ? "text-accent-fg" : "text-subtle")}
          >
            <MoreHorizontal className="size-5" />
            Más
          </button>
        </div>
      </nav>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros" description="Aplican a todas las vistas">
        <div className="space-y-5">
          <PeriodPanel />
          <div>
            <p className="mb-2 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-subtle">Épica</p>
            <EpicFilter inline />
          </div>
          {tags.length > 0 && (
            <div>
              <p className="mb-2 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-subtle">Tag</p>
              <TagFilter />
            </div>
          )}
          <div>
            <p className="mb-2 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-subtle">Colaboradores</p>
            <PeoplePanel />
          </div>
        </div>
      </Sheet>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Más opciones">
        <div className="space-y-2">
          {items.slice(3).map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
              <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-fg">
                <item.icon className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="block text-xs text-muted">{item.description}</span>
              </span>
            </Link>
          ))}
          <p className="px-1 pt-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">Tema</p>
          <ThemeToggle />
          <p className="px-1 pt-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle">Pantalla</p>
          <DisplayControls size="lg" />
          <div className="grid grid-cols-2 gap-2 pt-3">
            <button onClick={() => void syncNow()} disabled={syncing || sync?.running} className="flex items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm font-semibold">
              <RefreshCw className={clsx("size-4", (syncing || sync?.running) && "animate-spin")} /> Sincronizar
            </button>
            <button
              onClick={() => {
                setMoreOpen(false);
                setShortcutsOpen(true);
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm font-semibold"
            >
              <Keyboard className="size-4" /> Atajos
            </button>
          </div>
          <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-xl bg-critical-soft py-2.5 text-sm font-semibold text-critical-fg">
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </div>
      </Sheet>
    </>
  );
}
