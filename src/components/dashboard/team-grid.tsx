"use client";

import clsx from "clsx";
import { CheckCircle2, CircleAlert, CircleDashed, Coffee, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Avatar, Skeleton, StatusPill, type StatusTone } from "@/components/ui/primitives";
import { formatHours } from "@/lib/dates";
import type { TeamMember } from "@/lib/types";

export type MemberStatus = { key: string; label: string; icon: typeof CheckCircle2; tone: StatusTone };

export function memberStatus(m: TeamMember, businessDay = true): MemberStatus {
  if (!m.inRange) return { key: "fuera", label: "Fuera de vigencia", icon: CircleDashed, tone: "neutral" };
  if (!businessDay) {
    return m.dayHours > 0
      ? { key: "completo", label: "Registró (fin de semana)", icon: CheckCircle2, tone: "good" }
      : { key: "descanso", label: "Fin de semana", icon: Coffee, tone: "neutral" };
  }
  if (m.dayHours === 0) return { key: "sin", label: "Sin registro", icon: CircleAlert, tone: "warning" };
  if (m.dayHours < m.expectedHours) return { key: "parcial", label: "Parcial", icon: CircleDashed, tone: "info" };
  return { key: "completo", label: "Completo", icon: CheckCircle2, tone: "good" };
}

export function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

type Handlers = { onOpen: (m: TeamMember) => void; onRegister: (m: TeamMember) => void };

// ------------------------------------------------------------------ Tarjetas
export function TeamCards({ members, loading, businessDay, onOpen, onRegister }: Handlers & { members?: TeamMember[]; loading: boolean; businessDay: boolean }) {
  if (loading && !members) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-[1.25rem]" />
        ))}
      </div>
    );
  }
  return (
    <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {(members ?? []).map((m, i) => (
          <MemberCard key={m.memberId} member={m} index={i} businessDay={businessDay} onOpen={onOpen} onRegister={onRegister} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

function MemberCard({ member: m, index, businessDay, onOpen, onRegister }: Handlers & { member: TeamMember; index: number; businessDay: boolean }) {
  const status = memberStatus(m, businessDay);
  const expected = businessDay ? m.expectedHours : 0;
  const ratio = expected ? Math.min(m.dayHours / expected, 1) : m.dayHours > 0 ? 1 : 0;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, delay: Math.min(index, 12) * 0.025, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      onClick={() => onOpen(m)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(m)}
      tabIndex={0}
      role="button"
      aria-label={`${m.name}, ${status.label}`}
      className={clsx("card group cursor-pointer p-4 transition-shadow hover:shadow-pop sm:p-5", !m.inRange && "opacity-60")}
    >
      <div className="flex items-start gap-3">
        <Avatar name={m.name} status={status.tone} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-foreground" title={m.name}>
            {m.name}
          </h3>
          <p className="truncate text-xs text-muted" title={m.role}>
            {m.role}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted">{Math.round(m.allocation * 100)} % asignado</span>
            <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted">{m.assignmentType}</span>
          </div>
        </div>
        <StatusPill tone={status.tone} icon={status.icon} label={status.label} compact />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-xs">
          <span className="text-muted">{status.label}</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatHours(m.dayHours)} <span className="font-normal text-subtle">/ {expected ? formatHours(expected) : "—"}</span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-3">
          <motion.div
            className={clsx("h-full rounded-full", ratio >= 1 ? "bg-gradient-to-r from-brand-lime to-brand-green" : "bg-accent")}
            initial={{ width: 0 }}
            animate={{ width: `${ratio * 100}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted">
          Semana <b className="font-semibold tabular-nums text-foreground">{formatHours(m.weekHours)}</b>
          {m.dayCount > 0 && <span className="text-subtle"> · {m.dayCount} act.</span>}
        </span>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={(e) => {
            e.stopPropagation();
            onRegister(m);
          }}
          className="flex items-center gap-1 rounded-xl bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-fg transition hover:bg-accent hover:text-white"
        >
          <Plus className="size-3.5" /> Registrar
        </motion.button>
      </div>
    </motion.article>
  );
}

// ------------------------------------------------------------------ Lista
export function TeamList({ members, loading, businessDay, onOpen, onRegister }: Handlers & { members?: TeamMember[]; loading: boolean; businessDay: boolean }) {
  if (loading && !members) return <Skeleton className="h-96 rounded-[1.25rem]" />;
  return (
    <div className="card overflow-hidden">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[47.5rem] text-sm">
          <thead className="bg-surface-2 text-left text-[0.6875rem] uppercase tracking-wider text-subtle">
            <tr>
              <th className="px-4 py-3 font-semibold">Colaborador</th>
              <th className="px-4 py-3 font-semibold">Asignación</th>
              <th className="w-56 px-4 py-3 font-semibold">Hoy</th>
              <th className="px-4 py-3 text-right font-semibold">Semana</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m, i) => {
              const status = memberStatus(m, businessDay);
              const expected = businessDay ? m.expectedHours : 0;
              const ratio = expected ? Math.min(m.dayHours / expected, 1) : 0;
              return (
                <motion.tr
                  key={m.memberId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i, 20) * 0.015 }}
                  onClick={() => onOpen(m)}
                  className={clsx("cursor-pointer border-t border-line transition-colors hover:bg-surface-2", !m.inRange && "opacity-60")}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} size="sm" status={status.tone} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.name}</p>
                        <p className="truncate text-xs text-subtle">{m.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    <b className="font-semibold text-foreground">{Math.round(m.allocation * 100)} %</b> · {m.assignmentType}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <div className={clsx("h-full rounded-full", ratio >= 1 ? "bg-good" : "bg-accent")} style={{ width: `${ratio * 100}%` }} />
                      </div>
                      <span className="w-20 text-right text-xs tabular-nums">
                        {formatHours(m.dayHours)}
                        <span className="text-subtle"> / {expected || "—"}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-display font-semibold tabular-nums">{formatHours(m.weekHours)}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={status.tone} icon={status.icon} label={status.label} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRegister(m);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent-fg hover:bg-accent-soft"
                    >
                      <Plus className="size-3.5" /> Registrar
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
