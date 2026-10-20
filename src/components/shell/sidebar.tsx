"use client";

import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Keyboard, LogOut, PanelLeftClose, PanelLeftOpen, RefreshCw, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Kbd } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PROJECTS, PROJECT_KEYS } from "@/lib/config";
import { formatTime } from "@/lib/dates";
import { useApp } from "./app-provider";
import { NAV, navFor } from "./nav";

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const active = navFor(pathname);
  const { projectKey, setProjectKey, scoped, model, sync, syncNow, syncing, nextAutoSync, logout, setShortcutsOpen } = useApp();
  const overdue = scoped.filter((i) => i.overdue).length;
  const running = syncing || sync?.running;

  return (
    <motion.aside
      animate={{ width: collapsed ? "5.25rem" : "17.5rem" }}
      transition={{ type: "spring", stiffness: 380, damping: 40 }}
      className="scrollbar-thin fixed inset-y-0 left-0 z-40 hidden flex-col overflow-y-auto overflow-x-hidden border-r border-line bg-surface/80 backdrop-blur-xl lg:flex"
    >
      {/* Marca */}
      <div className={clsx("flex h-[4.5rem] items-center gap-3 px-5", collapsed && "justify-center px-0")}>
        <Image src="/linktic_icon.png" alt="LinkTic" width={36} height={36} className="size-9 object-contain" priority />
        {!collapsed && (
          <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="min-w-0 leading-tight">
            <p className="font-display text-[1.0625rem] font-semibold tracking-tight">Monitoreo Docum</p>
            <p className="text-[0.6875rem] text-subtle">LinkTic · Evolucionamos contigo</p>
          </motion.div>
        )}
      </div>

      {/* Selector de proyecto */}
      <div className={clsx("px-4", collapsed && "px-3")}>
        {!collapsed && <p className="mb-2 px-1 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-subtle">Proyecto</p>}
        <div className="space-y-1.5">
          {PROJECT_KEYS.map((key) => {
            const p = PROJECTS[key];
            const selected = key === projectKey;
            return (
              <button
                key={key}
                onClick={() => setProjectKey(key)}
                title={`${key} · ${p.name}`}
                className={clsx(
                  "group relative flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition-colors",
                  selected ? "border-transparent" : "border-transparent hover:bg-surface-2",
                  collapsed && "justify-center",
                )}
              >
                {selected && (
                  <motion.span
                    layoutId="project-card"
                    className="absolute inset-0 rounded-2xl border border-line bg-surface shadow-card"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  />
                )}
                <span
                  className="relative grid size-10 shrink-0 place-items-center rounded-xl font-display text-sm font-bold text-white shadow-sm transition-transform group-active:scale-95"
                  style={{ background: selected ? `linear-gradient(135deg, ${p.accent}, ${key === "348" ? "#00C2FF" : "#22D400"})` : "var(--subtle)" }}
                >
                  {key}
                </span>
                {!collapsed && (
                  <span className="relative min-w-0">
                    <span className={clsx("block truncate text-sm font-semibold", selected ? "text-foreground" : "text-muted")}>{p.name}</span>
                    <span className="block truncate text-[0.6875rem] text-subtle">{p.client}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navegación */}
      <nav className={clsx("mt-6 flex-1 space-y-1 px-4", collapsed && "px-3")} aria-label="Principal">
        {!collapsed && <p className="mb-2 px-1 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-subtle">Vistas</p>}
        {NAV.map((item) => {
          const isActive = item.href === active.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={clsx(
                "group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                isActive ? "text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-xl bg-accent-soft"
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                >
                  <span className={clsx("absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent", collapsed ? "-left-3" : "-left-4")} />
                </motion.span>
              )}
              <item.icon className="relative size-[1.125rem] shrink-0" />
              {!collapsed && <span className="relative flex-1">{item.label}</span>}
              {!collapsed && item.href === "/cronograma" && overdue > 0 && (
                <span className="relative rounded-full bg-critical-soft px-2 py-0.5 text-[0.625rem] font-bold tabular-nums text-critical-fg" title={`${overdue} ítems vencidos`}>
                  {overdue}
                </span>
              )}
              {!collapsed && item.href !== "/cronograma" && (
                <Kbd className="relative opacity-0 transition-opacity group-hover:opacity-100">{item.key}</Kbd>
              )}
              {collapsed && item.href === "/cronograma" && overdue > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-critical" />}
            </Link>
          );
        })}
      </nav>

      {/* Azure */}
      {!collapsed && (
        <div className="mx-4 mb-3 rounded-2xl border border-line bg-surface-2 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <ShieldCheck className="size-4 text-good-fg" />
            Azure DevOps
            <span className="ml-auto rounded-md bg-surface-3 px-1.5 py-0.5 text-[0.625rem] font-semibold text-muted">Solo lectura</span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[0.6875rem] text-muted">
            <span className={clsx("size-1.5 rounded-full", running ? "animate-pulse bg-warning" : sync?.lastStatus === "error" ? "bg-critical" : sync?.lastAt ? "bg-good" : "bg-subtle")} />
            {running
              ? "Sincronizando…"
              : sync?.lastAt
                ? `Actualizado ${formatDistanceToNow(new Date(sync.lastAt), { locale: es, addSuffix: true })}`
                : "Sin sincronizar"}
          </p>
          {model && <p className="mt-0.5 text-[0.6875rem] text-subtle">{model.work.length.toLocaleString("es-CO")} ítems asignados en el periodo</p>}
          <p className="mt-0.5 text-[0.6875rem] text-subtle">
            Automática cada hora{nextAutoSync && !running ? ` · próxima ${formatTime(new Date(nextAutoSync).toISOString())}` : ""}
          </p>
          <button
            onClick={() => void syncNow()}
            disabled={!!running}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface py-1.5 text-xs font-semibold text-muted transition hover:text-foreground"
          >
            <RefreshCw className={clsx("size-3.5", running && "animate-spin")} /> Sincronizar ahora
          </button>
        </div>
      )}

      {/* Pie */}
      <div className={clsx("space-y-2 border-t border-line p-4", collapsed && "px-3")}>
        <ThemeToggle compact={collapsed} className={collapsed ? "flex-col" : undefined} />
        <div className={clsx("flex items-center gap-2", collapsed && "flex-col")}>
          <div className={clsx("flex min-w-0 flex-1 items-center gap-2.5", collapsed && "hidden")}>
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-sky to-brand-blue font-display text-xs font-bold text-white">
              SM
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold">Scrum Master</span>
              <span className="flex items-center gap-1 text-[0.6875rem] text-subtle">
                <span className="size-1.5 rounded-full bg-good" /> Sesión activa
              </span>
            </span>
          </div>
          <button onClick={() => setShortcutsOpen(true)} className="rounded-lg p-2 text-muted transition hover:bg-surface-3 hover:text-foreground" title="Atajos de teclado (?)">
            <Keyboard className="size-4" />
          </button>
          <button onClick={logout} className="rounded-lg p-2 text-muted transition hover:bg-critical-soft hover:text-critical-fg" title="Cerrar sesión">
            <LogOut className="size-4" />
          </button>
        </div>
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-[0.6875rem] font-medium text-subtle transition hover:bg-surface-2 hover:text-foreground"
          title={collapsed ? "Expandir menú" : "Contraer menú"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /> Contraer</>}
        </button>
      </div>
    </motion.aside>
  );
}
