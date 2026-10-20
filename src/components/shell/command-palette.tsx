"use client";

import { Command } from "cmdk";
import { CalendarRange, FolderKanban, Layers, LogOut, Maximize, Monitor, Moon, RefreshCw, RotateCcw, Search, Sun, UserRound, Users, ZoomIn, ZoomOut } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Avatar, Kbd, TypeBadge } from "@/components/ui/primitives";
import { toggleFullscreen } from "@/components/ui/display";
import { changeScale } from "@/components/ui/display-controls";
import { setTheme } from "@/components/ui/theme";
import { PRESET_LABEL, type PeriodPreset } from "@/lib/analytics/period";
import { PROJECTS, PROJECT_KEYS } from "@/lib/config";
import { useApp } from "./app-provider";
import { NAV } from "./nav";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const PRESETS: PeriodPreset[] = ["sprint", "14d", "30d", "90d", "month", "quarter"];

/** Paleta ⌘K: navegación, acciones, personas, ítems de Azure, periodo y pantalla. */
export function CommandPalette() {
  const router = useRouter();
  const app = useApp();
  const { paletteOpen, setPaletteOpen } = app;

  const run = (fn: () => void) => {
    setPaletteOpen(false);
    // deja cerrar la paleta antes de abrir otros paneles
    setTimeout(fn, 60);
  };

  return (
    <AnimatePresence>
      {paletteOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
          <motion.div
            className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPaletteOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-elevated shadow-pop"
          >
            <Command
              label="Paleta de comandos"
              loop
              filter={(value, search, keywords) => {
                const hay = norm(`${value} ${(keywords ?? []).join(" ")}`);
                return norm(search)
                  .split(/\s+/)
                  .filter(Boolean)
                  .every((token) => hay.includes(token))
                  ? 1
                  : 0;
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setPaletteOpen(false);
              }}
            >
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Search className="size-4 text-subtle" />
                <Command.Input autoFocus placeholder="Busca personas, HU, vistas o acciones…" className="h-14 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-subtle focus-visible:outline-none" />
                <Kbd>Esc</Kbd>
              </div>
              <Command.List className="scrollbar-thin max-h-[56vh] overflow-y-auto p-2">
                <Command.Empty>Sin resultados.</Command.Empty>

                <Command.Group heading="Acciones">
                  <Command.Item onSelect={() => run(() => void app.syncNow())} keywords={["azure", "sincronizar", "actualizar", "refrescar"]}>
                    <RefreshCw className="size-4 text-accent-fg" /> Sincronizar con Azure ahora
                  </Command.Item>
                  <Command.Item onSelect={() => run(() => app.setPeople([]))} keywords={["todos", "equipo", "limpiar filtro"]}>
                    <Users className="size-4 text-muted" /> Ver todo el equipo
                  </Command.Item>
                </Command.Group>

                {app.epics.length > 1 && (
                  <Command.Group heading="Épica">
                    {[{ id: 0, title: "Todas las épicas monitoreadas" }, ...app.epics].map((e) => {
                      const current = e.id === 0 ? app.filters.epics.length === 0 : app.filters.epics.length === 1 && app.filters.epics[0] === e.id;
                      return (
                        <Command.Item key={e.id} value={`épica ${e.title}`} onSelect={() => run(() => app.setEpics(e.id === 0 ? [] : [e.id]))} keywords={["épica", "alcance"]}>
                          <Layers className="size-4 text-muted" /> {e.title}
                          {current && <span className="ml-auto text-[0.6875rem] text-subtle">Actual</span>}
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}

                <Command.Group heading="Periodo">
                  {PRESETS.map((p) => (
                    <Command.Item key={p} onSelect={() => run(() => app.setPreset(p))} keywords={["periodo", "fechas"]}>
                      <CalendarRange className="size-4 text-muted" /> {PRESET_LABEL[p]}
                      {app.period.preset === p && <span className="ml-auto text-[0.6875rem] text-subtle">Actual</span>}
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group heading="Ir a">
                  {NAV.map((n) => (
                    <Command.Item key={n.href} onSelect={() => run(() => router.push(n.href))} keywords={[n.description]}>
                      <n.icon className="size-4 text-muted" /> {n.label} <Kbd className="ml-auto">{n.key}</Kbd>
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group heading="Proyecto">
                  {PROJECT_KEYS.map((k) => (
                    <Command.Item key={k} onSelect={() => run(() => app.setProjectKey(k))} keywords={[PROJECTS[k].client]}>
                      <FolderKanban className="size-4 text-muted" /> Cambiar a {k} · {PROJECTS[k].name}
                      {k === app.projectKey && <span className="ml-auto text-[0.6875rem] text-subtle">Actual</span>}
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group heading="Pantalla">
                  <Command.Item onSelect={() => run(() => void toggleFullscreen())} keywords={["pantalla completa", "fullscreen", "tv", "presentar"]}>
                    <Maximize className="size-4 text-muted" /> Pantalla completa <Kbd className="ml-auto">F</Kbd>
                  </Command.Item>
                  <Command.Item onSelect={() => changeScale(1)} keywords={["aumentar", "agrandar", "zoom", "tamaño", "tv"]}>
                    <ZoomIn className="size-4 text-muted" /> Aumentar tamaño <Kbd className="ml-auto">+</Kbd>
                  </Command.Item>
                  <Command.Item onSelect={() => changeScale(-1)} keywords={["reducir", "achicar", "zoom", "tamaño"]}>
                    <ZoomOut className="size-4 text-muted" /> Reducir tamaño <Kbd className="ml-auto">−</Kbd>
                  </Command.Item>
                  <Command.Item onSelect={() => changeScale(0)} keywords={["restablecer", "100", "zoom", "tamaño"]}>
                    <RotateCcw className="size-4 text-muted" /> Tamaño al 100 % <Kbd className="ml-auto">0</Kbd>
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Tema">
                  <Command.Item onSelect={() => run(() => setTheme("light"))} keywords={["claro", "light"]}>
                    <Sun className="size-4 text-muted" /> Tema claro
                  </Command.Item>
                  <Command.Item onSelect={() => run(() => setTheme("dark"))} keywords={["oscuro", "dark", "noche"]}>
                    <Moon className="size-4 text-muted" /> Tema oscuro
                  </Command.Item>
                  <Command.Item onSelect={() => run(() => setTheme("system"))} keywords={["sistema", "auto"]}>
                    <Monitor className="size-4 text-muted" /> Tema del sistema
                  </Command.Item>
                </Command.Group>

                {app.people.length > 0 && (
                  <Command.Group heading={`Colaboradores · ${app.people.length}`}>
                    {app.people.map((p) => (
                      <Command.Item key={p.key} value={`persona ${p.name} ${p.role ?? ""} ${p.email ?? ""}`} onSelect={() => run(() => app.openPerson(p.key))}>
                        <Avatar name={p.name} size="xs" />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className="truncate text-xs text-subtle">{p.inRoster ? p.role : "Fuera de la planeación"}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {app.scoped.length > 0 && (
                  <Command.Group heading="Ítems de Azure">
                    {app.scoped.slice(0, 400).map((w) => (
                      <Command.Item key={w.id} value={`item ${w.id} ${w.title ?? ""}`} onSelect={() => run(() => app.openWorkItem(w.id))}>
                        <TypeBadge type={w.type} />
                        <span className="font-mono text-xs text-subtle">#{w.id}</span>
                        <span className="min-w-0 flex-1 truncate">{w.title}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                <Command.Group heading="Sesión">
                  <Command.Item onSelect={() => run(() => void app.logout())} keywords={["salir", "logout"]}>
                    <LogOut className="size-4 text-critical-fg" /> Cerrar sesión
                  </Command.Item>
                </Command.Group>
              </Command.List>
              <div className="flex items-center gap-4 border-t border-line bg-surface-2 px-4 py-2.5 text-[0.6875rem] text-subtle">
                <span className="flex items-center gap-1">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd> navegar
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>↵</Kbd> seleccionar
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <UserRound className="size-3" /> Scrum Master
                </span>
              </div>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
