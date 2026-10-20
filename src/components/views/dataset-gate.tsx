"use client";

import { CloudDownload, RefreshCw, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useApp } from "@/components/shell/app-provider";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";

/** Muestra carga / primera sincronización / error antes de las vistas que necesitan el dataset. */
export function DatasetGate({ children }: { children: React.ReactNode }) {
  const { dataset, model, syncNow, syncing } = useApp();

  if (dataset.error && !model) {
    return (
      <EmptyState
        title="No fue posible cargar los datos de Azure"
        description={dataset.error.message}
        action={
          <Button variant="primary" icon={RefreshCw} loading={syncing} onClick={() => void dataset.mutate()}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (!model) {
    return (
      <div className="space-y-5">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card flex items-center gap-4 p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-fg">
            <CloudDownload className="size-6 animate-pulse" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold">Leyendo Azure DevOps…</p>
            <p className="text-sm text-muted">La primera vez se sincroniza el historial completo (puede tardar hasta un minuto). Después, cada actualización es incremental.</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-subtle">
              <ShieldCheck className="size-3.5 text-good-fg" /> Solo lectura: Azure no se modifica.
            </p>
          </div>
        </motion.div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-[1.25rem]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Skeleton className="h-80 rounded-[1.25rem] xl:col-span-2" />
          <Skeleton className="h-80 rounded-[1.25rem]" />
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {model.work.length === 0 && (
        <div className="mt-4">
          <Button icon={RefreshCw} loading={syncing} onClick={() => void syncNow(true)}>
            Resincronizar todo desde Azure
          </Button>
        </div>
      )}
    </>
  );
}
