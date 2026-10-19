"use client";

import clsx from "clsx";
import { CheckCircle2, CircleAlert, CircleDashed, Plus, Search, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Avatar, Chip, Skeleton } from "@/components/ui/primitives";
import { formatHours } from "@/lib/dates";
import type { TeamMember } from "@/lib/types";

type StatusFilter = "todos" | "pendientes" | "reportados";
type TypeFilter = "todos" | "Fijo" | "Multiproyecto";

export function memberStatus(m: TeamMember) {
  if (!m.inRange) return { key: "fuera", label: "Fuera de vigencia", icon: CircleDashed, tone: "bg-slate-100 text-slate-500" } as const;
  if (m.dayHours === 0) return { key: "sin", label: "Sin registro", icon: CircleAlert, tone: "bg-amber-50 text-amber-700" } as const;
  if (m.dayHours < m.expectedHours) return { key: "parcial", label: "Parcial", icon: CircleDashed, tone: "bg-sky-50 text-sky-700" } as const;
  return { key: "completo", label: "Completo", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" } as const;
}

export function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function TeamGrid({
  members,
  loading,
  onOpen,
  onRegister,
}: {
  members: TeamMember[] | undefined;
  loading: boolean;
  onOpen: (m: TeamMember) => void;
  onRegister: (m: TeamMember) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [type, setType] = useState<TypeFilter>("todos");

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return (members ?? []).filter((m) => {
      if (q && !normalize(`${m.name} ${m.role} ${m.email ?? ""}`).includes(q)) return false;
      if (status === "pendientes" && m.dayHours > 0) return false;
      if (status === "reportados" && m.dayHours === 0) return false;
      if (type !== "todos" && m.assignmentType !== type) return false;
      return true;
    });
  }, [members, search, status, type]);

  const pending = (members ?? []).filter((m) => m.dayHours === 0).length;

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cargo o correo"
            className="h-11 w-full rounded-2xl border border-line bg-white pl-10 pr-4 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
          />
        </div>
        <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0 lg:pb-0">
          <Chip active={status === "todos"} onClick={() => setStatus("todos")}>Todos</Chip>
          <Chip active={status === "pendientes"} onClick={() => setStatus("pendientes")}>Pendientes · {pending}</Chip>
          <Chip active={status === "reportados"} onClick={() => setStatus("reportados")}>Con registro</Chip>
          <span className="mx-1 w-px shrink-0 bg-line" />
          <Chip active={type === "todos"} onClick={() => setType("todos")}>Toda asignación</Chip>
          <Chip active={type === "Fijo"} onClick={() => setType("Fijo")}>Fijo</Chip>
          <Chip active={type === "Multiproyecto"} onClick={() => setType("Multiproyecto")}>Multiproyecto</Chip>
        </div>
      </div>

      {loading && !members ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-dashed border-line bg-white/60 py-16 text-center">
          <Users className="size-8 text-slate-300" />
          <p className="mt-3 font-medium text-foreground">Sin colaboradores para este filtro</p>
          <p className="text-sm text-muted">Ajusta la búsqueda o los filtros.</p>
        </div>
      ) : (
        <motion.div layout className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((m, i) => (
              <MemberCard key={m.memberId} member={m} index={i} onOpen={onOpen} onRegister={onRegister} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </section>
  );
}

function MemberCard({
  member: m,
  index,
  onOpen,
  onRegister,
}: {
  member: TeamMember;
  index: number;
  onOpen: (m: TeamMember) => void;
  onRegister: (m: TeamMember) => void;
}) {
  const status = memberStatus(m);
  const ratio = m.expectedHours ? Math.min(m.dayHours / m.expectedHours, 1) : 0;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, delay: Math.min(index, 12) * 0.03, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      onClick={() => onOpen(m)}
      className={clsx(
        "group cursor-pointer rounded-3xl border border-white bg-white/90 p-4 shadow-[0_10px_30px_-20px_rgba(15,40,80,0.4)] transition-shadow hover:shadow-[0_18px_40px_-20px_rgba(15,40,80,0.45)] sm:p-5",
        !m.inRange && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={m.name} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-foreground" title={m.name}>{m.name}</h3>
          <p className="truncate text-xs text-muted" title={m.role}>{m.role}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
              {Math.round(m.allocation * 100)}% asignado
            </span>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{m.assignmentType}</span>
          </div>
        </div>
        <span className={clsx("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold", status.tone)}>
          <status.icon className="size-3" />
          <span className="hidden sm:inline">{status.label}</span>
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-xs">
          <span className="text-muted">Hoy</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatHours(m.dayHours)} <span className="font-normal text-muted">/ {formatHours(m.expectedHours)}</span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className={clsx("h-full rounded-full", ratio >= 1 ? "bg-gradient-to-r from-brand-lime to-brand-green" : "accent-transition bg-accent")}
            initial={{ width: 0 }}
            animate={{ width: `${ratio * 100}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted">
          Semana: <b className="font-semibold text-foreground tabular-nums">{formatHours(m.weekHours)}</b>
          {m.dayCount > 0 && <> · {m.dayCount} act.</>}
        </span>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={(e) => {
            e.stopPropagation();
            onRegister(m);
          }}
          className="accent-transition flex items-center gap-1 rounded-xl bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-white"
        >
          <Plus className="size-3.5" /> Registrar
        </motion.button>
      </div>
    </motion.article>
  );
}
