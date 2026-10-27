"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/components/dashboard/client-api";
import { useApp } from "@/components/shell/app-provider";
import { complianceAnalysis, type ComplianceResponse } from "@/lib/analytics/compliance";
import { buildIdentity } from "@/lib/analytics/model";
import { isoLocalDate } from "@/lib/dates";

/**
 * Datos y análisis de cumplimiento del proyecto activo (si lo tiene configurado).
 * La identidad (Global / No Global / fuera de Global) sale del dataset; el resto, de /compliance.
 */
export function useCompliance() {
  const { projectKey, project, dataset, model, filters, prevRange, today, chartUnit, openWorkItem } = useApp();
  const config = project.compliance;
  const { data, error } = useSWR<ComplianceResponse>(config ? `/api/projects/${projectKey}/compliance` : null, fetcher, { revalidateOnFocus: false });
  const ds = dataset.data;
  const identity = useMemo(() => (ds ? buildIdentity(ds) : null), [ds]);

  const analysis = useMemo(() => {
    if (!config || !identity || !data?.compliance || data.projectKey !== projectKey) return null;
    return complianceAnalysis(data.items, {
      config,
      identity,
      today,
      period: { from: filters.from, to: filters.to, prevFrom: isoLocalDate(prevRange.from), prevTo: isoLocalDate(prevRange.to) },
      people: filters.people,
      epicIds: ds?.epicIds ?? [],
      epics: filters.epics,
      unit: chartUnit,
    });
  }, [config, identity, data, projectKey, today, filters.from, filters.to, filters.people, filters.epics, ds, prevRange, chartUnit]);

  /** Abre el detalle si el ítem está en el dataset; si no (p. ej. tarea sin asignar), lo abre en Azure. */
  const openItem = useCallback(
    (id: number) => {
      if (model?.byId.has(id)) return openWorkItem(id);
      if (ds) window.open(`https://dev.azure.com/${encodeURIComponent(ds.org)}/${encodeURIComponent(ds.project)}/_workitems/edit/${id}`, "_blank", "noopener");
    },
    [model, ds, openWorkItem],
  );

  return { config, analysis, error: error as Error | undefined, openItem, generatedAt: data?.generatedAt };
}
