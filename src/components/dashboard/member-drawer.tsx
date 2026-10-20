"use client";

import { Mail, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import useSWR from "swr";
import { Avatar, Button, Chip, EmptyState, Skeleton, StatusPill } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import type { ProjectKey } from "@/lib/config";
import { addDaysISO, formatDayMonth, formatHours, formatShort, isBusinessDay, weekRange } from "@/lib/dates";
import type { Activity, TeamMember } from "@/lib/types";
import { ActivityItem } from "./activity-item";
import { fetcher } from "./client-api";
import { memberStatus } from "./team-grid";

type Range = "semana" | "30d" | "90d";

export function MemberDrawer({
  member,
  date,
  projectKey,
  onClose,
  onRegister,
  onEdit,
}: {
  member: TeamMember | null;
  date: string;
  projectKey: ProjectKey;
  onClose: () => void;
  onRegister: (m: TeamMember, date?: string) => void;
  onEdit: (a: Activity) => void;
}) {
  return (
    <Sheet open={!!member} onClose={onClose} title={member ? <MemberTitle member={member} /> : null}>
      {member && <DrawerBody key={member.employeeId} member={member} date={date} projectKey={projectKey} onRegister={onRegister} onEdit={onEdit} />}
    </Sheet>
  );
}

function MemberTitle({ member }: { member: TeamMember }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={member.name} size="lg" />
      <div className="min-w-0">
        <p className="truncate">{member.name}</p>
        <p className="truncate font-sans text-sm font-normal text-muted">{member.role}</p>
      </div>
    </div>
  );
}

function DrawerBody({
  member,
  date,
  projectKey,
  onRegister,
  onEdit,
}: {
  member: TeamMember;
  date: string;
  projectKey: ProjectKey;
  onRegister: (m: TeamMember, date?: string) => void;
  onEdit: (a: Activity) => void;
}) {
  const [range, setRange] = useState<Range>("semana");
  const { start, end } = weekRange(date);
  const from = range === "semana" ? start : addDaysISO(date, range === "30d" ? -29 : -89);
  const to = range === "semana" ? end : date;

  const { data, isLoading } = useSWR<{ activities: Activity[] }>(
    `/api/projects/${projectKey}/activities?employeeId=${member.employeeId}&from=${from}&to=${to}`,
    fetcher,
  );

  const groups = new Map<string, Activity[]>();
  for (const a of data?.activities ?? []) groups.set(a.workDate, [...(groups.get(a.workDate) ?? []), a]);
  const total = (data?.activities ?? []).reduce((s, a) => s + a.hours, 0);
  const status = memberStatus(member, isBusinessDay(date));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Día" value={formatHours(member.dayHours)} hint={`de ${formatHours(member.expectedHours)}`} />
        <Stat label="Semana" value={formatHours(member.weekHours)} hint={`${Math.round(member.allocation * 100)} % asignado`} />
        <Stat label="En el rango" value={formatHours(total)} hint={`${data?.activities.length ?? 0} registros`} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <StatusPill tone={status.tone} icon={status.icon} label={status.label} />
        {member.email && (
          <a href={`mailto:${member.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
            <Mail className="size-3" /> {member.email}
          </a>
        )}
        {member.startDate && member.endDate && (
          <span className="text-subtle">
            · Asignación {formatShort(member.startDate)} → {formatShort(member.endDate)}
          </span>
        )}
      </div>

      <Button variant="primary" size="lg" icon={Plus} onClick={() => onRegister(member, date)} className="w-full">
        Registrar actividad del <span className="capitalize">{formatDayMonth(date)}</span>
      </Button>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display font-semibold">Traza de actividades</h3>
          <div className="flex gap-1.5">
            <Chip active={range === "semana"} onClick={() => setRange("semana")}>
              Semana
            </Chip>
            <Chip active={range === "30d"} onClick={() => setRange("30d")}>
              30 días
            </Chip>
            <Chip active={range === "90d"} onClick={() => setRange("90d")}>
              90 días
            </Chip>
          </div>
        </div>

        {isLoading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : groups.size === 0 ? (
          <EmptyState title="Sin actividades en este rango" description="Registra la primera con el botón de arriba." />
        ) : (
          <div className="relative space-y-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
            {[...groups.entries()].map(([day, items]) => (
              <div key={day} className="relative pl-6">
                <span className="absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-surface bg-accent shadow" />
                <p className="mb-2 flex items-baseline justify-between text-xs font-semibold capitalize text-muted">
                  {formatDayMonth(day)}
                  <span className="tabular-nums text-foreground">{formatHours(items.reduce((s, a) => s + a.hours, 0))}</span>
                </p>
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {items.map((a) => (
                      <ActivityItem key={a.id} activity={a} projectKey={projectKey} onEdit={onEdit} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-surface-2 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">{label}</p>
      <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">{value}</p>
      <p className="truncate text-[11px] text-muted">{hint}</p>
    </motion.div>
  );
}
