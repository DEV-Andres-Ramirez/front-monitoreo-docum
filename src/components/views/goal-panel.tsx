"use client";

import clsx from "clsx";
import { CalendarCheck, CheckCircle2, Flag, Target, TrendingUp, XCircle } from "lucide-react";
import { useMemo } from "react";
import useSWR from "swr";
import { ChartCard } from "@/components/charts/chart-card";
import { useChartTheme, withAlpha } from "@/components/charts/chart-theme";
import { GoalCumulativeChart, GoalDailyChart, goalDayLabel, goalDayTitle } from "@/components/charts/goal-charts";
import { fetcher } from "@/components/dashboard/client-api";
import { useApp } from "@/components/shell/app-provider";
import { Skeleton } from "@/components/ui/primitives";
import { goalProgress, tagColor, type GoalResponse, type TagProgress } from "@/lib/analytics/goal";

const num = (n: number, digits = 1) => n.toLocaleString("es-CO", { maximumFractionDigits: digits });
const pct = (n: number) => `${num(n * 100)} %`;
const signed = (n: number) => `${n > 0 ? "+" : ""}${num(n, 0)}`;

/**
 * Meta de cierre del proyecto (348): avance por tag frente a la meta diaria y la fecha de cierre.
 * Cuenta todas las tareas de las épicas con los tags de la meta (sin filtro de personas ni épica).
 */
export function GoalPanel() {
  const { projectKey, project, today, filters, epics } = useApp();
  const theme = useChartTheme(projectKey);
  const { data, error } = useSWR<GoalResponse>(project.goal ? `/api/projects/${projectKey}/goal` : null, fetcher, { revalidateOnFocus: false });
  const progress = useMemo(
    () => (data?.goal && data.projectKey === projectKey ? goalProgress(data.goal, data.tasks, today, filters.tag) : null),
    [data, projectKey, today, filters.tag],
  );

  if (!project.goal) return null;
  if (error) return <p className="card p-4 text-sm text-critical-fg">No se pudo cargar la meta de cierre: {error.message}</p>;
  if (!progress) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const { goal, tags, total, businessDaysLeft, days } = progress;
  const goalColor = withAlpha(theme.text, theme.dark ? 0.7 : 0.6);
  const closed = today > goal.deadline;
  const dailyText = [...new Set(tags.map((t) => t.daily))].length === 1 ? `${tags[0]?.daily ?? 0} tareas diarias por tag` : tags.map((t) => `${t.daily} de ${t.tag}`).join(" y ") + " por día";
  const epicNames = epics.map((e) => e.title).join(" y ");

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-fg">
              <Flag className="size-[1.125rem]" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-[0.9375rem] font-semibold leading-tight">Meta de cierre de las épicas</h2>
              <p className="mt-0.5 text-xs text-muted">
                Cierre: {goalDayTitle(goal.deadline)} · {dailyText} (lunes a viernes sin festivos, desde el {goalDayTitle(goal.start)})
              </p>
            </div>
          </div>
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              closed ? "bg-surface-3 text-muted" : businessDaysLeft <= 5 ? "bg-warning-soft text-warning-fg" : "bg-accent-soft text-accent-fg",
            )}
          >
            <CalendarCheck className="size-3.5" />
            {closed ? "Plazo cumplido" : `${businessDaysLeft} días hábiles restantes (incluye hoy)`}
          </span>
        </header>
        <p className="px-4 pt-3 text-[0.6875rem] text-subtle sm:px-5">
          Cuenta todas las tareas {tags.map((t) => t.tag).join(" / ")} de {epicNames || "las épicas monitoreadas"}, sin importar el colaborador (incluye a quienes están fuera de la planeación). Aquí no aplican los filtros
          de personas ni de épica{filters.tag ? `; sí el de tag (${filters.tag})` : ""}. Completada = entregada o cerrada, según su fecha de entrega real.
        </p>
        <div className={clsx("grid grid-cols-1 gap-3 p-4 sm:p-5", tags.length > 1 && "md:grid-cols-3")}>
          {tags.map((t) => (
            <TagTile key={t.tag} t={t} color={tagColor(t.index, theme.dark)} deadline={goal.deadline} today={today} />
          ))}
          {tags.length > 1 && <TotalTile total={total} daily={tags.reduce((s, t) => s + t.daily, 0)} />}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <ChartCard
          className="xl:col-span-3"
          title="Avance diario vs. meta"
          subtitle={`Tareas completadas por día y tag · meta ${dailyText} en días hábiles`}
          icon={Target}
          legend={[
            ...tags.map((t) => ({ label: t.tag, color: tagColor(t.index, theme.dark) })),
            { label: "Meta diaria", color: goalColor, dashed: true },
          ]}
          summary="Tareas completadas por día y tag frente a la meta diaria, desde el inicio de la meta hasta el cierre."
          table={{
            columns: ["Día", ...tags.map((t) => t.tag), "Meta por tag", "¿Cumplió?"],
            rows: days.map((d) => {
              const counts = tags.map((t) => d.done[t.tag] ?? 0);
              const missed = tags.filter((t) => (d.done[t.tag] ?? 0) < t.daily).map((t) => t.tag);
              const verdict = !d.business ? "Sin meta" : d.date > today ? "—" : d.date === today ? (missed.length ? "En curso" : "Sí") : missed.length ? `No (${missed.join(", ")})` : "Sí";
              return [goalDayTitle(d.date), ...counts, d.business ? tags.map((t) => t.daily).join(" / ") : "—", verdict];
            }),
          }}
          height={300}
        >
          <GoalDailyChart progress={progress} theme={theme} />
        </ChartCard>

        <ChartCard
          className="xl:col-span-2"
          title="Avance acumulado vs. meta"
          subtitle="Completadas frente a lo que debería llevarse a cada día"
          icon={TrendingUp}
          legend={[
            ...tags.map((t) => ({ label: `${t.tag} completadas`, color: tagColor(t.index, theme.dark) })),
            { label: "Meta acumulada", color: goalColor, dashed: true },
            { label: "Total", color: theme.reference, dashed: true },
          ]}
          summary="Tareas completadas acumuladas por tag frente a la meta acumulada y el total, hasta la fecha de cierre."
          table={{
            columns: ["Día", ...tags.flatMap((t) => [`${t.tag} completadas`, `Meta ${t.tag}`])],
            rows: days.map((d, i) => [goalDayTitle(d.date), ...tags.flatMap((t) => [t.cumulative[i].actual ?? "—", t.cumulative[i].goal])]),
          }}
          height={300}
        >
          <GoalCumulativeChart progress={progress} theme={theme} />
        </ChartCard>
      </div>
    </div>
  );
}

function ProgressBar({ value, marker, color }: { value: number; marker?: number; color?: string }) {
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-surface-3" role="presentation">
      <div className={clsx("h-full rounded-full", !color && "bg-accent")} style={{ width: `${Math.min(100, value * 100)}%`, background: color }} />
      {marker !== undefined && marker > 0 && marker < 1 && (
        <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${marker * 100}%` }} title="Meta a la fecha" />
      )}
    </div>
  );
}

function Stat({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.625rem] font-semibold uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums">{children}</dd>
      {hint && <dd className="truncate text-[0.6875rem] text-muted">{hint}</dd>}
    </div>
  );
}

function Verdict({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <span className={clsx("inline-flex items-center gap-1", ok ? "text-good-fg" : "text-critical-fg")}>
      <Icon className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}

function TagTile({ t, color, deadline, today }: { t: TagProgress; color: string; deadline: string; today: string }) {
  const late = t.projectedEnd !== null && t.projectedEnd > deadline;
  return (
    <div className="@container rounded-2xl border border-line bg-surface-2/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-display text-sm font-semibold">
          <span className="size-2.5 rounded-full" style={{ background: color }} />
          {t.tag}
        </span>
        <span className="text-xs tabular-nums text-muted">
          {num(t.done, 0)} de {num(t.total, 0)} completadas
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tracking-tight tabular-nums">{pct(t.pct)}</p>
      <div className="mt-2">
        <ProgressBar value={t.pct} marker={t.total ? t.expectedToDate / t.total : undefined} color={color} />
        <p className="mt-1 text-[0.6875rem] text-muted">Faltan {num(t.remaining, 0)} · la marca indica la meta a la fecha ({num(t.expectedToDate, 0)})</p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 @lg:grid-cols-3">
        <Stat label="Hoy">
          <Verdict ok={t.today >= t.daily}>
            {t.today} de {t.daily}
          </Verdict>
        </Stat>
        <Stat label="Vs. meta a la fecha" hint={`meta: ${num(t.expectedToDate, 0)}`}>
          <Verdict ok={t.gap >= 0}>{signed(t.gap)}</Verdict>
        </Stat>
        <Stat label="Ritmo necesario" hint="por día hábil restante">
          {t.requiredPace === null ? "—" : `${num(t.requiredPace)} / día`}
        </Stat>
        <Stat label="Ritmo actual" hint="promedio últimos 5 días hábiles">
          {num(t.currentPace)} / día
        </Stat>
        <Stat label="Proyección de cierre" hint={late ? "después del cierre, al ritmo actual" : "al ritmo actual"}>
          {t.projectedEnd === null ? (
            <Verdict ok={false}>sin ritmo</Verdict>
          ) : t.remaining <= 0 ? (
            <Verdict ok>completado</Verdict>
          ) : (
            <Verdict ok={!late}>
              <span title={goalDayTitle(t.projectedEnd)}>{goalDayLabel(t.projectedEnd, today)}</span>
            </Verdict>
          )}
        </Stat>
        <Stat label="Días que cumplieron" hint="días hábiles cerrados desde el inicio">
          {t.daysMet} de {t.daysElapsed}
        </Stat>
      </dl>
    </div>
  );
}

function TotalTile({ total, daily }: { total: GoalProgressTotal; daily: number }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm font-semibold">Total del proyecto</span>
        <span className="text-xs tabular-nums text-muted">
          {num(total.done, 0)} de {num(total.total, 0)}
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tracking-tight tabular-nums">{pct(total.pct)}</p>
      <div className="mt-2">
        <ProgressBar value={total.pct} marker={total.total ? total.expectedToDate / total.total : undefined} />
        <p className="mt-1 text-[0.6875rem] text-muted">Tareas completadas ÷ total de tareas</p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
        <Stat label="Hoy">
          <Verdict ok={total.today >= daily}>
            {total.today} de {daily}
          </Verdict>
        </Stat>
        <Stat label="Vs. meta a la fecha" hint={`meta: ${num(total.expectedToDate, 0)}`}>
          <Verdict ok={total.gap >= 0}>{signed(total.gap)}</Verdict>
        </Stat>
        <Stat label="Pendientes">{num(total.remaining, 0)}</Stat>
        <Stat label="Ritmo necesario" hint="por día hábil restante">
          {total.requiredPace === null ? "—" : `${num(total.requiredPace)} / día`}
        </Stat>
      </dl>
    </div>
  );
}

type GoalProgressTotal = ReturnType<typeof goalProgress>["total"];
