"use client";

import { Loader2, LogOut } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PROJECTS, PROJECT_KEYS, type ProjectKey } from "@/lib/config";
import { api } from "./client-api";

export function Header({ projectKey, onProjectChange }: { projectKey: ProjectKey; onProjectChange: (key: ProjectKey) => void }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="glass sticky top-0 z-40 border-b border-white/60">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <motion.div initial={{ rotate: -20, scale: 0.6, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
            <Image src="/linktic_icon.png" alt="LinkTic" width={40} height={40} className="size-10 object-contain" priority />
          </motion.div>
          <div className="min-w-0 leading-tight">
            <p className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">Monitoreo Docum</p>
            <p className="truncate text-xs text-muted">LinkTic · Control diario de actividades</p>
          </div>
        </div>

        <button
          onClick={logout}
          disabled={leaving}
          className="order-2 flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:order-3"
          aria-label="Cerrar sesión"
        >
          {leaving ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          <span className="hidden sm:inline">Salir</span>
        </button>

        <ProjectSwitcher value={projectKey} onChange={onProjectChange} />
      </div>
    </header>
  );
}

function ProjectSwitcher({ value, onChange }: { value: ProjectKey; onChange: (key: ProjectKey) => void }) {
  return (
    <div className="order-3 flex w-full rounded-2xl border border-line bg-slate-100/80 p-1 sm:order-2 sm:w-auto" role="tablist" aria-label="Proyecto">
      {PROJECT_KEYS.map((key) => {
        const project = PROJECTS[key];
        const active = key === value;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className="relative flex-1 rounded-xl px-3 py-2 text-left sm:min-w-44 sm:flex-none"
          >
            {active && (
              <motion.span
                layoutId="project-pill"
                className="absolute inset-0 rounded-xl bg-white shadow-md"
                style={{ boxShadow: `0 6px 20px -8px ${project.accent}88` }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              <span
                className="grid h-7 min-w-9 place-items-center rounded-lg px-1.5 font-display text-xs font-bold text-white transition-transform"
                style={{ background: active ? project.accent : "#94a3b8", transform: active ? "scale(1)" : "scale(0.92)" }}
              >
                {key}
              </span>
              <span className={`truncate text-sm font-medium transition-colors ${active ? "text-foreground" : "text-muted"}`}>
                {project.name}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
