"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useMemo } from "react";
import { useStored } from "@/components/dashboard/client-api";
import { Gantt, GanttLegend, type GanttGroup, type GanttSort, type GanttZoom } from "@/components/gantt/gantt";
import { useApp } from "@/components/shell/app-provider";
import { Chip, EmptyState, Segmented } from "@/components/ui/primitives";
import { isAlive } from "@/lib/analytics/metrics";
import { TYPE_ORDER, typeMeta } from "@/lib/work-item-types";
import { DatasetGate } from "./dataset-gate";

type ScheduleOptions = { zoom: GanttZoom; group: GanttGroup; sort: GanttSort; hideClosed: boolean; onlyOverdue: boolean; types: string[] };
const DEFAULTS: ScheduleOptions = { zoom: "week", group: "person", sort: "start", hideClosed: false, onlyOverdue: false, types: [] };

export function ScheduleView() {
  const { view } = useApp();
  if (!view.dated) {
    return (
      <EmptyState
        variant="chart"
        title="Los bugs no tienen cronograma"
        description="Las fechas que llegan de Azure para los bugs no son confiables, así que no se dibujan en el Gantt. Mira su estado actual en el Resumen o en Colaboradores, o cambia a Tareas o Historias de usuario."
      />
    );
  }
  return (
    <DatasetGate>
      <Schedule />
    </DatasetGate>
  );
}

function Schedule() {
  const { scoped, range, model, openWorkItem, openPerson } = useApp();
  const [opts, setOpts] = useStored<ScheduleOptions>("docum:schedule", DEFAULTS);
  const set = (patch: Partial<ScheduleOptions>) => setOpts({ ...opts, ...patch });

  const items = useMemo(
    () =>
      scoped.filter(
        (i) =>
          isAlive(i, range) &&
          (!opts.hideClosed || i.cat !== "Completed") &&
          (!opts.onlyOverdue || i.overdue || i.onTime === false) &&
          (!opts.types.length || opts.types.includes(i.type)),
      ),
    [scoped, range, opts],
  );
  const presentTypes = TYPE_ORDER.filter((t) => scoped.some((i) => i.type === t));
  const overdue = items.filter((i) => i.overdue).length;
  const withTarget = items.filter((i) => i.onTime !== null);
  const onTime = withTarget.length ? Math.round((withTarget.filter((i) => i.onTime).length / withTarget.length) * 100) : null;
  const noPlan = items.filter((i) => i.plannedEnd === null).length;

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 p-3 sm:p-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            value={opts.zoom}
            onChange={(zoom) => set({ zoom })}
            options={[
              { value: "day", label: "Días" },
              { value: "week", label: "Semanas" },
              { value: "month", label: "Meses" },
            ]}
          />
          <Segmented
            size="sm"
            value={opts.group}
            onChange={(group) => set({ group })}
            options={[
              { value: "person", label: "Por colaborador" },
              { value: "feature", label: "Por feature" },
              { value: "sprint", label: "Por sprint" },
            ]}
          />
          <label className="flex items-center gap-2 text-xs text-muted">
            Ordenar
            <select value={opts.sort} onChange={(e) => set({ sort: e.target.value as GanttSort })} className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-foreground">
              <option value="start">por inicio</option>
              <option value="target">por fecha objetivo</option>
              <option value="state">por estado</option>
            </select>
          </label>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {presentTypes.map((t) => (
            <Chip key={t} active={opts.types.includes(t)} onClick={() => set({ types: opts.types.includes(t) ? opts.types.filter((x) => x !== t) : [...opts.types, t] })}>
              {typeMeta(t).plural}
            </Chip>
          ))}
          <Chip active={opts.hideClosed} onClick={() => set({ hideClosed: !opts.hideClosed })}>
            {opts.hideClosed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} Ocultar cerrados
          </Chip>
          <Chip active={opts.onlyOverdue} onClick={() => set({ onlyOverdue: !opts.onlyOverdue })}>
            <AlertTriangle className="size-3.5" /> Solo con retraso
          </Chip>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1 font-semibold text-foreground">
            <CalendarClock className="size-3.5" /> {items.length.toLocaleString("es-CO")} ítems
          </span>
          {onTime !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-good-soft px-2.5 py-1 font-semibold text-good-fg">
              <CheckCircle2 className="size-3.5" /> {onTime} % a tiempo
            </span>
          )}
          {overdue > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-critical-soft px-2.5 py-1 font-semibold text-critical-fg">
              <AlertTriangle className="size-3.5" /> {overdue} atrasados
            </span>
          )}
          {noPlan > 0 && <span className="text-subtle">{noPlan} sin fecha objetivo ni sprint con fechas</span>}
        </div>
        <GanttLegend />
      </div>

      {items.length === 0 ? (
        <EmptyState variant="search" title="No hay ítems para mostrar" description="Ajusta los filtros, el periodo o los colaboradores seleccionados." />
      ) : (
        <Gantt items={items} model={model!} range={range} zoom={opts.zoom} groupBy={opts.group} sort={opts.sort} onOpenItem={openWorkItem} onOpenPerson={openPerson} />
      )}
      <p className="text-xs text-subtle">
        Plan = fecha de inicio y objetivo del ítem en Azure; si no las tiene, se usan las fechas del sprint. Real = primer paso a &quot;en curso&quot; y entrega (fecha de
        entrega real, &quot;Entregado&quot; o cierre).
      </p>
    </div>
  );
}
