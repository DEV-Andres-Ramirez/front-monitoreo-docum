"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, ChevronRight, CircleDot, Diamond } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBreakpoint } from "@/components/ui/display";
import { Avatar, TypeBadge } from "@/components/ui/primitives";
import { useTheme } from "@/components/ui/theme";
import { CATEGORY_LABEL } from "@/lib/analytics/metrics";
import { DAY, type Item, type Model, type Person } from "@/lib/analytics/model";
import { DELAY_COLOR, categoryColor } from "@/lib/analytics/state-colors";

export type GanttZoom = "day" | "week" | "month";
export type GanttGroup = "person" | "feature" | "sprint";
export type GanttSort = "start" | "target" | "state";

/** rem por día según el zoom */
const DAY_REM: Record<GanttZoom, number> = { day: 2.4, week: 0.85, month: 0.28 };
const LABEL_REM_WIDE = 21;
const LABEL_REM_NARROW = 12;
const ROW_REM = 2.75;
const GROUP_ROW_REM = 3.25;
const PAGE = 25;

type Group = { key: string; title: string; subtitle: string; person?: Person; items: Item[] };

const fmt = (t: number | null, pattern = "d MMM yyyy") => (t ? format(t, pattern, { locale: es }) : "—");
const days = (a: number, b: number) => Math.round(((b - a) / DAY) * 10) / 10;

function sortItems(items: Item[], sort: GanttSort) {
  const rank = { InProgress: 0, Resolved: 1, Proposed: 2, Completed: 3, Removed: 4 } as const;
  const start = (i: Item) => i.actualStart ?? i.plannedStart ?? i.createdAt;
  return [...items].sort((a, b) =>
    sort === "target"
      ? (a.plannedEnd ?? Infinity) - (b.plannedEnd ?? Infinity)
      : sort === "state"
        ? rank[a.cat] - rank[b.cat] || start(a) - start(b)
        : start(a) - start(b),
  );
}

export function Gantt({
  items,
  model,
  range,
  zoom,
  groupBy,
  sort,
  onOpenItem,
  onOpenPerson,
}: {
  items: Item[];
  model: Model;
  range: { from: number; to: number };
  zoom: GanttZoom;
  groupBy: GanttGroup;
  sort: GanttSort;
  onOpenItem: (id: number) => void;
  onOpenPerson: (key: string) => void;
}) {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const LABEL_REM = useBreakpoint("sm") ? LABEL_REM_WIDE : LABEL_REM_NARROW;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pages, setPages] = useState<Record<string, number>>({});
  const [hover, setHover] = useState<{ item: Item; x: number; y: number } | null>(null);
  // Ancho disponible (en rem) para que la línea de tiempo llene la tarjeta
  const scroller = useRef<HTMLDivElement>(null);
  const [availableRem, setAvailableRem] = useState(0);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setAvailableRem(el.clientWidth / rootPx - LABEL_REM - 0.5);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [LABEL_REM]);

  // Ventana: el periodo, ampliada a la semana completa
  const start = useMemo(() => {
    const d = new Date(range.from);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [range.from]);
  // Se extiende hasta 60 días después del periodo para ver las fechas objetivo próximas
  const end = useMemo(() => {
    const maxTarget = items.reduce((m, i) => Math.max(m, i.plannedEnd ?? 0), range.to);
    return Math.min(Math.max(range.to, maxTarget), range.to + 60 * DAY);
  }, [items, range.to]);
  const totalDays = Math.max(1, Math.ceil((end - start) / DAY));
  const unit = Math.max(DAY_REM[zoom], availableRem > 0 ? availableRem / totalDays : 0);
  const width = totalDays * unit;
  const x = (t: number) => ((Math.min(Math.max(t, start), end) - start) / DAY) * unit;

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const i of items) {
      let key: string;
      let title: string;
      let subtitle = "";
      let person: Person | undefined;
      if (groupBy === "person") {
        person = model.people.get(i.personKey!);
        key = i.personKey!;
        title = person?.name ?? "Sin asignar";
        subtitle = person?.inRoster ? (person.role ?? "") : "Fuera de la planeación";
      } else if (groupBy === "feature") {
        const f = i.featureId ? model.byId.get(i.featureId) : undefined;
        key = String(i.featureId ?? "none");
        title = f?.title ?? "Sin feature";
        subtitle = f ? `Feature #${f.id}` : "Ítems sin feature";
      } else {
        key = i.iteration ?? "none";
        title = i.iteration ?? "Sin sprint";
        subtitle = i.iterStart && i.iterEnd ? `${fmt(new Date(i.iterStart).getTime(), "d MMM")} – ${fmt(new Date(i.iterEnd).getTime(), "d MMM")}` : "";
      }
      const g = map.get(key) ?? { key, title, subtitle, person, items: [] };
      g.items.push(i);
      map.set(key, g);
    }
    return [...map.values()]
      .map((g) => ({ ...g, items: sortItems(g.items, sort) }))
      .sort((a, b) => b.items.length - a.items.length || a.title.localeCompare(b.title, "es"));
  }, [items, groupBy, sort, model]);

  // Encabezado: meses + marcas (días o semanas)
  const months = useMemo(() => {
    const out: { t: number; label: string }[] = [];
    const d = new Date(start);
    d.setDate(1);
    for (let t = d.getTime(); t <= end; ) {
      out.push({ t: Math.max(t, start), label: format(t, zoom === "month" ? "MMM yy" : "MMMM yyyy", { locale: es }) });
      const n = new Date(t);
      n.setMonth(n.getMonth() + 1);
      t = n.getTime();
    }
    return out;
  }, [start, end, zoom]);
  const ticks = useMemo(() => {
    const out: { t: number; label: string; weekend: boolean }[] = [];
    const step = zoom === "day" ? 1 : 7;
    for (let t = start; t <= end; t += step * DAY) {
      const dow = new Date(t).getDay();
      out.push({ t, label: zoom === "day" ? format(t, "EEEEEE d", { locale: es }) : format(t, "d MMM", { locale: es }), weekend: dow === 0 || dow === 6 });
    }
    return out;
  }, [start, end, zoom]);
  const sprints = model.iterations.filter((s) => s.end >= start && s.start <= end);

  const today = model.now;
  const showToday = today >= start && today <= end;

  return (
    <div className="card relative overflow-hidden">
      {/* Desplazamiento propio (horizontal y vertical) para que el encabezado y la columna de nombres queden fijos */}
      <div ref={scroller} className="scrollbar-thin max-h-[calc(100dvh-15rem)] min-h-[20rem] overflow-auto" onMouseLeave={() => setHover(null)}>
        <div style={{ width: `${LABEL_REM + width}rem` }} className="relative">
          {/* Encabezado de tiempo */}
          <div className="sticky top-0 z-20 flex border-b border-line bg-surface-2">
            <div className="sticky left-0 z-30 flex shrink-0 items-end border-r border-line bg-surface-2 px-4 pb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-subtle" style={{ width: `${LABEL_REM}rem` }}>
              {groupBy === "person" ? "Colaborador · ítem" : groupBy === "feature" ? "Feature · ítem" : "Sprint · ítem"}
            </div>
            <div className="relative" style={{ width: `${width}rem`, height: "3.25rem" }}>
              {months.map((m) => (
                <span key={m.t} className="absolute top-1.5 border-l border-line-strong pl-1.5 text-[0.6875rem] font-semibold capitalize text-muted" style={{ left: `${x(m.t)}rem` }}>
                  {m.label}
                </span>
              ))}
              {zoom !== "month" &&
                ticks.map((t) => (
                  <span
                    key={t.t}
                    className={clsx("absolute bottom-1.5 pl-1 text-[0.625rem] tabular-nums", t.weekend && zoom === "day" ? "text-subtle/60" : "text-subtle")}
                    style={{ left: `${x(t.t)}rem` }}
                  >
                    {t.label}
                  </span>
                ))}
              {showToday && (
                <span className="absolute bottom-0 z-10 -translate-x-1/2 rounded-t-md bg-accent px-1.5 text-[0.625rem] font-bold text-white" style={{ left: `${x(today)}rem` }}>
                  Hoy
                </span>
              )}
            </div>
          </div>

          {/* Cuerpo */}
          <div className="relative">
            {/* Fondo: fines de semana, semanas, sprints y hoy */}
            <div className="pointer-events-none absolute inset-y-0" style={{ left: `${LABEL_REM}rem`, width: `${width}rem` }} aria-hidden>
              {zoom === "day" &&
                ticks
                  .filter((t) => t.weekend)
                  .map((t) => <div key={t.t} className="absolute inset-y-0 bg-surface-3/60" style={{ left: `${x(t.t)}rem`, width: `${unit}rem` }} />)}
              {ticks.map((t) => (
                <div key={`l${t.t}`} className="absolute inset-y-0 border-l border-line/70" style={{ left: `${x(t.t)}rem` }} />
              ))}
              {sprints.map((s, i) => (
                <div
                  key={`${s.name}${s.start}`}
                  className={clsx("absolute inset-y-0", i % 2 ? "bg-accent/[0.035]" : "bg-transparent")}
                  style={{ left: `${x(s.start)}rem`, width: `${x(s.end) - x(s.start)}rem` }}
                  title={s.name}
                />
              ))}
              {showToday && <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-accent/70" style={{ left: `${x(today)}rem` }} />}
            </div>

            {groups.map((g) => {
              const open = !collapsed.has(g.key);
              const delivered = g.items.filter((i) => i.onTime !== null);
              const onTime = delivered.length ? Math.round((delivered.filter((i) => i.onTime).length / delivered.length) * 100) : null;
              const overdue = g.items.filter((i) => i.overdue).length;
              const gStart = Math.min(...g.items.map((i) => i.actualStart ?? i.plannedStart ?? i.createdAt));
              const gEnd = Math.max(...g.items.map((i) => i.deliveredAt ?? i.plannedEnd ?? today));
              const shown = g.items.slice(0, (pages[g.key] ?? 1) * PAGE);
              return (
                <div key={g.key} role="rowgroup">
                  {/* Fila de grupo */}
                  <div className="relative flex border-b border-line bg-surface-2/70" style={{ height: `${GROUP_ROW_REM}rem` }}>
                    <div className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-line bg-surface-2 px-3" style={{ width: `${LABEL_REM}rem` }}>
                      <button
                        onClick={() =>
                          setCollapsed((c) => {
                            const n = new Set(c);
                            if (n.has(g.key)) n.delete(g.key);
                            else n.add(g.key);
                            return n;
                          })
                        }
                        className="grid size-6 shrink-0 place-items-center rounded-md text-subtle hover:bg-surface-3"
                        aria-label={open ? "Contraer grupo" : "Expandir grupo"}
                        aria-expanded={open}
                      >
                        <ChevronRight className={clsx("size-4 transition-transform", open && "rotate-90")} />
                      </button>
                      {g.person && <Avatar name={g.person.name} size="sm" />}
                      <button
                        onClick={() => g.person && onOpenPerson(g.person.key)}
                        className={clsx("min-w-0 flex-1 text-left", g.person && "hover:underline")}
                        disabled={!g.person}
                      >
                        <span className="block truncate text-sm font-semibold">{g.title}</span>
                        <span className="block truncate text-[0.6875rem] text-subtle">
                          {g.items.length} ítems{onTime !== null && ` · ${onTime} % a tiempo`}
                          {overdue > 0 && <span className="font-semibold text-critical-fg"> · {overdue} vencidos</span>}
                        </span>
                      </button>
                    </div>
                    <div className="relative flex-1">
                      {Number.isFinite(gStart) && (
                        <div
                          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-foreground/25"
                          style={{ left: `${x(gStart)}rem`, width: `${Math.max(x(gEnd) - x(gStart), 0.3)}rem` }}
                          title={`${fmt(gStart)} → ${fmt(gEnd)}`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Filas de ítems */}
                  {open &&
                    shown.map((i) => (
                      <GanttRow key={i.id} item={i} x={x} start={start} end={end} today={today} dark={dark} labelRem={LABEL_REM} onOpen={onOpenItem} onHover={setHover} />
                    ))}
                  {open && g.items.length > shown.length && (
                    <div className="flex border-b border-line">
                      <div className="sticky left-0 z-10 shrink-0 bg-surface px-4 py-2" style={{ width: `${LABEL_REM}rem` }}>
                        <button onClick={() => setPages((p) => ({ ...p, [g.key]: (p[g.key] ?? 1) + 1 }))} className="text-xs font-semibold text-accent-fg hover:underline">
                          Mostrar {Math.min(PAGE, g.items.length - shown.length)} más de {g.items.length - shown.length}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {hover && <GanttTooltip hover={hover} now={today} />}
    </div>
  );
}

function GanttRow({
  item: i,
  x,
  start,
  end,
  today,
  dark,
  labelRem,
  onOpen,
  onHover,
}: {
  item: Item;
  x: (t: number) => number;
  start: number;
  end: number;
  today: number;
  dark: boolean;
  labelRem: number;
  onOpen: (id: number) => void;
  onHover: (h: { item: Item; x: number; y: number } | null) => void;
}) {
  const color = categoryColor(i.cat, dark);
  const actualFrom = i.actualStart;
  const actualTo = i.deliveredAt ?? (i.cat === "InProgress" || i.cat === "Resolved" ? today : null);
  const dueEnd = i.plannedEnd;
  const delayFrom = dueEnd !== null && i.delayDays > 0 ? dueEnd : null;
  const delayTo = delayFrom !== null ? (i.deliveredAt ?? today) : null;
  const clippedLeft = (actualFrom ?? i.plannedStart ?? i.createdAt) < start;
  const clippedRight = (actualTo ?? i.plannedEnd ?? i.createdAt) > end;

  return (
    <div
      role="row"
      className="group relative flex border-b border-line/70 transition-colors hover:bg-surface-2/60"
      style={{ height: `${ROW_REM}rem` }}
      onMouseMove={(e) => onHover({ item: i, x: e.clientX, y: e.clientY })}
      onMouseLeave={() => onHover(null)}
    >
      <button
        onClick={() => onOpen(i.id)}
        className={clsx("sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-line bg-surface px-3 text-left group-hover:bg-surface-2", labelRem > 15 ? "pl-11" : "pl-3")}
        style={{ width: `${labelRem}rem` }}
      >
        <TypeBadge type={i.type} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] text-foreground" title={i.title ?? ""}>
            <span className="font-mono text-[0.6875rem] text-subtle">#{i.id}</span> {i.title}
          </span>
          <span className="flex items-center gap-1 text-[0.6875rem] text-subtle">
            <span className="size-1.5 rounded-full" style={{ background: color }} />
            {i.state}
            {i.countedHours > 0 && <span>· {i.countedHours} h</span>}
          </span>
        </span>
        {i.overdue && <AlertTriangle className="size-3.5 shrink-0 text-critical-fg" aria-label="Vencido" />}
      </button>

      <button className="relative flex-1 cursor-pointer" onClick={() => onOpen(i.id)} aria-label={`Ver detalle de #${i.id}`}>
        {/* Línea base planeada (inicio → objetivo) */}
        {i.plannedStart !== null && i.plannedEnd !== null && (
          <div
            className="absolute bottom-[0.45rem] h-[0.3rem] rounded-full bg-foreground/20"
            style={{ left: `${x(i.plannedStart)}rem`, width: `${Math.max(x(i.plannedEnd) - x(i.plannedStart), 0.2)}rem` }}
          />
        )}
        {/* Real (inicio real → entrega / hoy) */}
        {actualFrom !== null && actualTo !== null && (
          <div
            className={clsx("absolute top-[0.5rem] h-[1.1rem] rounded-md shadow-sm", clippedLeft && "rounded-l-none", clippedRight && "rounded-r-none")}
            style={{
              left: `${x(actualFrom)}rem`,
              width: `${Math.max(x(actualTo) - x(actualFrom), 0.35)}rem`,
              background: i.deliveredAt ? color : `repeating-linear-gradient(135deg, ${color}, ${color} 0.35rem, color-mix(in srgb, ${color} 70%, white) 0.35rem, color-mix(in srgb, ${color} 70%, white) 0.6rem)`,
            }}
          />
        )}
        {/* Retraso después de la fecha objetivo */}
        {delayFrom !== null && delayTo !== null && delayTo > delayFrom && (
          <div
            className="absolute top-[0.5rem] h-[1.1rem] rounded-r-md opacity-80"
            style={{
              left: `${x(delayFrom)}rem`,
              width: `${Math.max(x(delayTo) - x(delayFrom), 0.2)}rem`,
              background: `repeating-linear-gradient(135deg, ${DELAY_COLOR}, ${DELAY_COLOR} 0.25rem, transparent 0.25rem, transparent 0.45rem)`,
            }}
          />
        )}
        {/* Sin iniciar: punto en la creación */}
        {actualFrom === null && i.cat === "Proposed" && i.createdAt >= start && (
          <span className="absolute top-[0.85rem] size-2 -translate-x-1/2 rounded-full border-2" style={{ left: `${x(i.createdAt)}rem`, borderColor: color }} />
        )}
        {/* ◆ fecha objetivo */}
        {dueEnd !== null && dueEnd >= start && dueEnd <= end && (
          <Diamond className="absolute bottom-[0.2rem] size-3 -translate-x-1/2 fill-current text-foreground/70" style={{ left: `${x(dueEnd)}rem` }} aria-hidden />
        )}
        {/* ● entrega real */}
        {i.deliveredAt !== null && i.deliveredAt >= start && i.deliveredAt <= end && (
          <span
            className="absolute top-[0.35rem] size-3.5 -translate-x-1/2 rounded-full border-2 border-surface shadow"
            style={{ left: `${x(i.deliveredAt)}rem`, background: i.onTime === false ? DELAY_COLOR : color }}
            aria-hidden
          />
        )}
      </button>
    </div>
  );
}

function GanttTooltip({ hover, now }: { hover: { item: Item; x: number; y: number }; now: number }) {
  const i = hover.item;
  const left = Math.min(hover.x + 16, (typeof window !== "undefined" ? window.innerWidth : 1200) - 340);
  const top = hover.y + 16;
  return (
    <div className="pointer-events-none fixed z-[60] w-[20rem] rounded-2xl border border-line bg-elevated p-3 text-xs shadow-pop" style={{ left, top }}>
      <p className="flex items-center gap-1.5 font-semibold text-foreground">
        <TypeBadge type={i.type} /> #{i.id}
      </p>
      <p className="mt-1 line-clamp-2 text-[0.8125rem] text-foreground">{i.title}</p>
      <p className="mt-1 text-muted">
        {i.state} · {CATEGORY_LABEL[i.cat]}
        {i.countedHours > 0 && ` · ${i.countedHours} h`}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line pt-2">
        <dt className="text-subtle">Inicio plan</dt>
        <dd className="text-right tabular-nums">{fmt(i.plannedStart)}</dd>
        <dt className="text-subtle">Objetivo</dt>
        <dd className="text-right tabular-nums">{fmt(i.plannedEnd)}</dd>
        <dt className="text-subtle">Inicio real</dt>
        <dd className="text-right tabular-nums">{fmt(i.actualStart)}</dd>
        <dt className="text-subtle">Entrega real</dt>
        <dd className="text-right tabular-nums">{fmt(i.deliveredAt)}</dd>
        {i.cycleTime !== null && (
          <>
            <dt className="text-subtle">Cycle time</dt>
            <dd className="text-right tabular-nums">{i.cycleTime.toLocaleString("es-CO", { maximumFractionDigits: 1 })} d</dd>
          </>
        )}
        {i.leadTime !== null && (
          <>
            <dt className="text-subtle">Creación → cierre</dt>
            <dd className="text-right tabular-nums">{i.leadTime.toLocaleString("es-CO", { maximumFractionDigits: 1 })} d</dd>
          </>
        )}
      </dl>
      <p
        className={clsx(
          "mt-2 flex items-center gap-1 font-semibold",
          i.overdue || i.onTime === false ? "text-critical-fg" : i.onTime ? "text-good-fg" : "text-muted",
        )}
      >
        {i.overdue ? (
          <>
            <AlertTriangle className="size-3.5" /> Vencido hace {Math.ceil(i.delayDays)} d
          </>
        ) : i.onTime === false ? (
          <>
            <AlertTriangle className="size-3.5" /> Entregado {Math.ceil(i.delayDays)} d tarde
          </>
        ) : i.onTime ? (
          <>
            <CheckCircle2 className="size-3.5" /> Entregado a tiempo
          </>
        ) : (
          <>
            <CircleDot className="size-3.5" /> {i.plannedEnd ? `${days(now, i.plannedEnd)} d para el objetivo` : "Sin fecha objetivo"}
          </>
        )}
      </p>
    </div>
  );
}

/** Leyenda del Gantt (siempre con forma + texto). */
export function GanttLegend() {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Leyenda del cronograma">
      {(["InProgress", "Resolved", "Completed"] as const).map((c) => (
        <li key={c} className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm" style={{ background: categoryColor(c, dark) }} /> {CATEGORY_LABEL[c]} (real)
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="h-1 w-5 rounded-full bg-foreground/25" /> Plan (inicio → objetivo)
      </li>
      <li className="flex items-center gap-1.5">
        <Diamond className="size-3 fill-current text-foreground/70" /> Fecha objetivo
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-full border-2 border-surface bg-good shadow" /> Entrega real
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-sm" style={{ background: `repeating-linear-gradient(135deg, ${DELAY_COLOR}, ${DELAY_COLOR} 3px, transparent 3px, transparent 6px)` }} /> Retraso
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-sm" style={{ background: `repeating-linear-gradient(135deg, ${categoryColor("InProgress", dark)}, ${categoryColor("InProgress", dark)} 3px, transparent 3px, transparent 6px)` }} /> En curso (hasta hoy)
      </li>
    </ul>
  );
}
