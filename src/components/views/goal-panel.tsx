"use client";

import clsx from "clsx";
import { CalendarCheck, CheckCircle2, ChevronDown, Flag, History, Target, TrendingUp, Undo2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { ChartCard } from "@/components/charts/chart-card";
import { useChartTheme, withAlpha } from "@/components/charts/chart-theme";
import { GoalCumulativeChart, GoalDailyChart, goalDayLabel, goalDayTitle, type CumulativeSeries } from "@/components/charts/goal-charts";
import { fetcher } from "@/components/dashboard/client-api";
import { useApp } from "@/components/shell/app-provider";
import { Popover } from "@/components/ui/popover";
import { Segmented, Skeleton } from "@/components/ui/primitives";
import { goalProgress, snapshotDays, tagColor, type GoalProgress, type GoalResponse, type GoalTotal, type TagProgress } from "@/lib/analytics/goal";
import { capitalizeFirst, formatDayMonth, isBusinessDay } from "@/lib/dates";

const num = (n: number, digits = 1) => n.toLocaleString("es-CO", { maximumFractionDigits: digits });
const pct = (n: number) => `${num(n * 100)} %`;
const dayShort = (iso: string) => formatDayMonth(iso);

/**
 * Meta de cierre del proyecto (348): avance por tag frente a la meta diaria y la fecha de cierre.
 * Cuenta todas las tareas de las épicas con los tags de la meta (sin filtro de personas ni épica).
 * Se puede ver como quedó al cierre de cualquier día hábil desde el inicio (snapshots).
 */
export function GoalPanel() {
  const { projectKey, project, today, filters, epics } = useApp();
  const theme = useChartTheme(projectKey);
  const { data, error } = useSWR<GoalResponse>(project.goal ? `/api/projects/${projectKey}/goal` : null, fetcher, { revalidateOnFocus: false });
  // null = en vivo (hoy); una fecha = snapshot al cierre de ese día hábil
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [series, setSeries] = useState<CumulativeSeries>("total");
  const progress = useMemo(
    () =>
      data?.goal && data.projectKey === projectKey
        ? goalProgress(data.goal, data.tasks, { asOf: snapshot ?? today, live: snapshot === null, tag: filters.tag })
        : null,
    [data, projectKey, today, filters.tag, snapshot],
  );

  if (!project.goal) return null;
  if (error) return <p className="card p-4 text-sm text-critical-fg">No se pudo cargar la meta de cierre: {error.message}</p>;
  if (!progress) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const { goal, tags, total, businessDaysLeft, days, live, asOf } = progress;
  const goalColor = withAlpha(theme.text, theme.dark ? 0.7 : 0.6);
  const closed = live && today > goal.deadline;
  const dailyText = [...new Set(tags.map((t) => t.daily))].length === 1 ? `${tags[0]?.daily ?? 0} tareas diarias por tag` : tags.map((t) => `${t.daily} de ${t.tag}`).join(" y ") + " por día";
  const epicNames = epics.map((e) => e.title).join(" y ");
  const options = snapshotDays(goal, today);
  const seriesValue = series === "total" || tags.some((t) => t.tag === series) ? series : "total";

  return (
    <div className="space-y-4">
      <section className={clsx("card overflow-hidden", !live && "ring-2 ring-accent/40")}>
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-fg">
              <Flag className="size-[1.125rem]" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-[0.9375rem] font-semibold leading-tight">Meta de cierre de las épicas</h2>
              <p className="mt-0.5 text-xs text-muted">
                Cierre: {goalDayTitle(goal.deadline)} · {dailyText}, de lunes a viernes sin festivos, desde el {goalDayTitle(goal.start)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SnapshotPicker options={options} value={snapshot} onChange={setSnapshot} today={today} />
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                closed ? "bg-surface-3 text-muted" : businessDaysLeft <= 5 ? "bg-warning-soft text-warning-fg" : "bg-accent-soft text-accent-fg",
              )}
            >
              <CalendarCheck className="size-3.5" />
              {closed ? "Plazo cumplido" : `${businessDaysLeft} días hábiles restantes${live ? " (incluye hoy)" : ` después del ${dayShort(asOf)}`}`}
            </span>
          </div>
        </header>
        {!live && (
          <div className="flex flex-wrap items-center gap-2 border-b border-accent/30 bg-accent-soft px-4 py-2 text-sm text-accent-fg sm:px-5">
            <History className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              Estás viendo cómo quedó la meta al <strong>cierre del {goalDayTitle(asOf)}</strong>. Las cifras y gráficas solo cuentan hasta ese día.
            </span>
            <button onClick={() => setSnapshot(null)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold hover:bg-accent/10">
              <Undo2 className="size-3.5" /> Volver a hoy
            </button>
          </div>
        )}
        <p className="px-4 pt-3 text-[0.6875rem] text-subtle sm:px-5">
          Cuenta todas las tareas {tags.map((t) => t.tag).join(" / ")} de {epicNames || "las épicas monitoreadas"}, sin importar quién las tenga. Aquí no aplican los filtros de personas ni de épica
          {filters.tag ? `; sí el de tag (${filters.tag})` : ""}. Una tarea cuenta como completada el día de su entrega real (entregada o cerrada); si fue en fin de semana o festivo, cuenta el
          siguiente día hábil.
        </p>
        <div className={clsx("grid grid-cols-1 gap-3 p-4 sm:p-5", tags.length > 1 && "lg:grid-cols-3")}>
          {tags.map((t) => (
            <GoalTile key={t.tag} p={progress} t={t} title={t.tag} color={tagColor(t.index, theme.dark)} today={today} />
          ))}
          {tags.length > 1 && <GoalTile p={progress} t={total} title="Total del proyecto" today={today} />}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <ChartCard
          className="xl:col-span-3"
          title="Avance diario vs. meta"
          subtitle={`¿Se cumplió la meta cada día hábil? Barras = tareas completadas ese día · línea punteada = meta (${dailyText})`}
          icon={Target}
          legend={[
            ...tags.map((t) => ({ label: t.tag, color: tagColor(t.index, theme.dark) })),
            { label: "Meta diaria", color: goalColor, dashed: true },
          ]}
          summary="Tareas completadas por día hábil y tag frente a la meta diaria, desde el inicio de la meta hasta el cierre."
          table={{
            columns: ["Día hábil", ...tags.map((t) => t.tag), "Meta por tag", "¿Cumplió?"],
            rows: days.map((d) => {
              const counts = tags.map((t) => d.done[t.tag] ?? 0);
              const missed = tags.filter((t) => (d.done[t.tag] ?? 0) < t.daily).map((t) => t.tag);
              const open = live && d.date === today;
              const verdict = d.date > asOf ? "—" : open ? (missed.length ? "En curso" : "Sí") : missed.length ? `No (${missed.join(", ")})` : "Sí";
              return [goalDayTitle(d.date), ...(d.date > asOf ? tags.map(() => "—") : counts), tags.map((t) => t.daily).join(" / "), verdict];
            }),
          }}
          height={300}
        >
          <div className="flex h-full flex-col">
            <p className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span className="font-medium text-foreground">Días con la meta cumplida:</span>
              {tags.map((t) => (
                <span key={t.tag} className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: tagColor(t.index, theme.dark) }} />
                  {t.tag} <strong className="tabular-nums text-foreground">{t.daysMet}</strong> de {progress.closedDays}
                </span>
              ))}
            </p>
            <div className="min-h-0 flex-1">
              <GoalDailyChart progress={progress} theme={theme} today={today} />
            </div>
          </div>
        </ChartCard>

        <ChartCard
          className="xl:col-span-2"
          title="Avance acumulado vs. meta"
          subtitle={`Lo completado frente a lo que se esperaba llevar cada día. Verde = adelante de lo esperado; rojo = atrás.${live ? " La línea llega al cierre de ayer: lo de hoy está en el avance diario." : ""}`}
          icon={TrendingUp}
          actions={
            tags.length > 1 ? (
              <Segmented size="sm" value={seriesValue} onChange={setSeries} options={[{ value: "total", label: "Total" }, ...tags.map((t) => ({ value: t.tag, label: t.tag }))]} />
            ) : undefined
          }
          legend={[
            { label: "Completadas", color: seriesValue === "total" ? theme.accent : tagColor(tags.find((t) => t.tag === seriesValue)?.index ?? 0, theme.dark) },
            { label: "Esperado a cada día", color: goalColor, dashed: true },
            { label: "Meta final", color: theme.reference, dashed: true },
          ]}
          summary="Tareas completadas acumuladas frente a lo esperado (meta diaria × días hábiles) y la meta final, hasta la fecha de cierre."
          table={{
            columns: ["Día hábil", ...tags.flatMap((t) => [`${t.tag} completadas`, `${t.tag} esperadas`])],
            rows: days.map((d, i) => [goalDayTitle(d.date), ...tags.flatMap((t) => [t.cumulative[i].actual ?? "—", t.cumulative[i].goal])]),
          }}
          height={300}
        >
          <GoalCumulativeChart progress={progress} series={seriesValue} theme={theme} today={today} />
        </ChartCard>
      </div>
    </div>
  );
}

/** "Ver cómo quedó al cierre de…": hoy en vivo o un día hábil anterior desde el inicio de la meta. */
function SnapshotPicker({ options, value, onChange, today }: { options: string[]; value: string | null; onChange: (v: string | null) => void; today: string }) {
  if (!options.length) return null;
  const label = value ? `Cierre del ${dayShort(value)}` : isBusinessDay(today) ? "Hoy (en curso)" : "Hoy";
  return (
    <Popover
      align="end"
      panelClassName="w-[17rem] max-w-[calc(100vw-2rem)]"
      trigger={({ open, toggle }) => (
        <button
          onClick={toggle}
          aria-expanded={open}
          className={clsx(
            "inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition",
            value ? "border-accent/50 bg-accent-soft text-accent-fg" : "border-line bg-surface text-foreground hover:border-line-strong",
          )}
          title="Ver cómo quedó la meta al cierre de un día hábil anterior"
        >
          <History className="size-3.5" />
          <span className="text-muted">Ver al cierre de:</span> {label}
          <ChevronDown className={clsx("size-3.5 text-subtle transition-transform", open && "rotate-180")} />
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <p className="mb-2 text-xs text-muted">Elige un día hábil para ver cómo quedó la meta con todo lo completado hasta ese día.</p>
          <ul className="scrollbar-thin max-h-72 space-y-0.5 overflow-y-auto">
            {[null, ...options].map((d) => (
              <li key={d ?? "hoy"}>
                <button
                  onClick={() => {
                    onChange(d);
                    close();
                  }}
                  aria-pressed={value === d}
                  className={clsx("flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm", value === d ? "bg-accent text-white" : "hover:bg-surface-2")}
                >
                  {d === null ? "Hoy (en vivo)" : capitalizeFirst(goalDayTitle(d))}
                  {d === null && <span className={clsx("text-[0.6875rem] normal-case", value === null ? "text-white/80" : "text-subtle")}>actual</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Popover>
  );
}

function ProgressBar({ value, marker, color }: { value: number; marker?: number; color?: string }) {
  return (
    <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-3" role="presentation">
      <div className={clsx("h-full rounded-full", !color && "bg-accent")} style={{ width: `${Math.min(100, value * 100)}%`, background: color }} />
      {marker !== undefined && marker > 0 && marker < 1 && <span className="absolute inset-y-0 w-0.5 bg-foreground/80" style={{ left: `${marker * 100}%` }} />}
    </div>
  );
}

function Stat({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("min-w-0 rounded-xl bg-surface-2/70 px-3 py-2", className)}>
      <dt className="text-[0.625rem] font-semibold uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{children}</dd>
      {hint && <dd className="mt-0.5 text-[0.6875rem] leading-snug text-muted">{hint}</dd>}
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

/** Tarjeta de un tag o del total, con las métricas en lenguaje claro. */
function GoalTile({ p, t, title, color, today }: { p: GoalProgress; t: TagProgress | GoalTotal; title: string; color?: string; today: string }) {
  const { goal, live, asOf, closedThrough, closedDays } = p;
  const late = t.projectedEnd !== null && t.projectedEnd > goal.deadline;
  const daysMet = "daysMet" in t ? t.daysMet : null;
  const todayOpen = live && isBusinessDay(today);
  const range = closedThrough ? `${dayShort(goal.start)} al ${dayShort(closedThrough)}` : "";
  return (
    <div className={clsx("@container rounded-2xl border p-4", color ? "border-line bg-surface-2/40" : "border-line-strong")}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-display text-sm font-semibold">
          {color && <span className="size-2.5 rounded-full" style={{ background: color }} />}
          {title}
        </span>
        <span className="text-xs tabular-nums text-muted">
          {num(t.done, 0)} de {num(t.total, 0)} completadas
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tracking-tight tabular-nums">{pct(t.pct)}</p>
      <div className="mt-2">
        <ProgressBar value={t.pct} marker={t.total ? t.expected / t.total : undefined} color={color} />
        <p className="mt-1 text-[0.6875rem] text-muted">
          Faltan {num(t.remaining, 0)} · <span className="font-semibold text-foreground">▏</span> lo esperado {closedThrough ? `al ${dayShort(closedThrough)}` : "a la fecha"} ({num(t.expected, 0)})
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-2 @xs:grid-cols-2">
        <Stat
          label={live ? "Completadas hoy" : `Completadas el ${dayShort(asOf)}`}
          hint={live ? (todayOpen ? "el día sigue en curso" : "hoy no es día hábil") : `meta del día: ${t.daily}`}
        >
          {live && !todayOpen ? (
            "—"
          ) : live && t.dayDone < t.daily ? (
            // El día sigue abierto: aún no es incumplimiento, solo lo que falta
            <span>
              {t.dayDone} de {t.daily} <span className="font-normal text-muted">· faltan {t.daily - t.dayDone}</span>
            </span>
          ) : (
            <Verdict ok={t.dayDone >= t.daily}>
              {t.dayDone} de {t.daily}
            </Verdict>
          )}
        </Stat>
        <Stat
          label="Frente a lo esperado"
          hint={
            closedDays === 0
              ? "aún no hay días hábiles cerrados"
              : `${live ? "Al cierre de ayer llevábamos" : "Llevábamos"} ${num(t.doneClosed, 0)}; se esperaban ${num(t.expected, 0)} (${t.daily} × ${closedDays} ${closedDays === 1 ? "día hábil" : "días hábiles"})`
          }
        >
          {closedDays === 0 ? "—" : <Verdict ok={t.gap >= 0}>{t.gap >= 0 ? `+${num(t.gap, 0)} adelante` : `${num(-t.gap, 0)} atrás`}</Verdict>}
        </Stat>
        <Stat label="Ritmo actual" hint={t.currentPace === null ? "aún no hay días hábiles cerrados" : `promedio por día hábil, del ${range}`}>
          {t.currentPace === null ? "—" : `${num(t.currentPace)} por día`}
        </Stat>
        <Stat label="Si seguimos así, terminamos el" hint={late ? `después del cierre (${dayShort(goal.deadline)})` : t.remaining <= 0 ? undefined : "al ritmo actual"}>
          {t.remaining <= 0 ? (
            <Verdict ok>completado</Verdict>
          ) : t.projectedEnd === null ? (
            <Verdict ok={false}>sin ritmo para proyectar</Verdict>
          ) : (
            <Verdict ok={!late}>
              <span title={goalDayTitle(t.projectedEnd)}>{capitalizeFirst(goalDayLabel(t.projectedEnd, today))}</span>
            </Verdict>
          )}
        </Stat>
        {daysMet !== null ? (
          <Stat label="Días con la meta cumplida" hint="días hábiles cerrados" className="@xs:col-span-2">
            {daysMet} de {closedDays}
          </Stat>
        ) : (
          <Stat label="Pendientes" hint="tareas por completar" className="@xs:col-span-2">
            {num(t.remaining, 0)}
          </Stat>
        )}
      </dl>
    </div>
  );
}
