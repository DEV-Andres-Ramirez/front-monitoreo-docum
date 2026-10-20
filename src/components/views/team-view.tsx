"use client";

import { Grid3x3, LayoutGrid, List, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { TeamCards, TeamList, memberStatus, normalize } from "@/components/dashboard/team-grid";
import { useApp } from "@/components/shell/app-provider";
import { Chip, EmptyState, Segmented } from "@/components/ui/primitives";
import { ComplianceMatrix } from "./compliance-matrix";

type Layout = "cards" | "list" | "matrix";
type StatusFilter = "todos" | "pendientes" | "reportados";
type TypeFilter = "todos" | "Fijo" | "Multiproyecto";

const LAYOUT_KEY = "docum:team-layout";
const LAYOUT_EVENT = "docum:team-layout";
const subscribe = (cb: () => void) => {
  window.addEventListener(LAYOUT_EVENT, cb);
  return () => window.removeEventListener(LAYOUT_EVENT, cb);
};
const readLayout = (): Layout => {
  try {
    const v = localStorage.getItem(LAYOUT_KEY);
    return v === "list" || v === "matrix" ? v : "cards";
  } catch {
    return "cards";
  }
};

export function TeamView() {
  const { teamData, openMember, openRegister } = useApp();
  const layout = useSyncExternalStore(subscribe, readLayout, () => "cards" as Layout);
  const setLayout = (l: Layout) => {
    try {
      localStorage.setItem(LAYOUT_KEY, l);
    } catch {
      /* sin almacenamiento */
    }
    window.dispatchEvent(new Event(LAYOUT_EVENT));
  };
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [type, setType] = useState<TypeFilter>("todos");

  const all = useMemo(() => teamData?.members ?? [], [teamData]);
  const businessDay = teamData?.isBusinessDay ?? true;
  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return all.filter((m) => {
      if (q && !normalize(`${m.name} ${m.role} ${m.email ?? ""}`).includes(q)) return false;
      if (status === "pendientes" && !(m.inRange && m.dayHours === 0)) return false;
      if (status === "reportados" && m.dayHours === 0) return false;
      if (type !== "todos" && m.assignmentType !== type) return false;
      return true;
    });
  }, [all, search, status, type]);

  const counts = useMemo(() => {
    const c = { completo: 0, parcial: 0, sin: 0 };
    for (const m of all) {
      const k = memberStatus(m, businessDay).key;
      if (k in c) c[k as keyof typeof c] += 1;
    }
    return c;
  }, [all, businessDay]);
  const pending = all.filter((m) => m.inRange && m.dayHours === 0).length;

  return (
    <div className="space-y-5">
      {/* Resumen de estados */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Completos", value: counts.completo, tone: "bg-good", hint: "jornada cubierta" },
          { label: "Parciales", value: counts.parcial, tone: "bg-accent", hint: "por debajo de lo esperado" },
          { label: "Sin registro", value: businessDay ? counts.sin : 0, tone: "bg-warning", hint: businessDay ? "pendientes de hoy" : "fin de semana" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card flex items-center gap-3 p-3 sm:p-4">
            <span className={`h-10 w-1.5 shrink-0 rounded-full ${s.tone}`} />
            <div className="min-w-0">
              <p className="font-display text-2xl font-semibold tabular-nums leading-none">{teamData ? s.value : "—"}</p>
              <p className="mt-1 truncate text-xs font-medium text-foreground">{s.label}</p>
              <p className="hidden truncate text-[11px] text-subtle sm:block">{s.hint}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Barra de herramientas */}
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, cargo o correo"
              className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm outline-none transition placeholder:text-subtle focus:border-accent focus:ring-4 focus:ring-accent/10"
            />
          </div>
          <Segmented
            value={layout}
            onChange={setLayout}
            options={[
              { value: "cards", label: "Tarjetas", icon: LayoutGrid },
              { value: "list", label: "Lista", icon: List },
              { value: "matrix", label: "Matriz", icon: Grid3x3 },
            ]}
          />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip active={status === "todos"} onClick={() => setStatus("todos")} count={all.length}>
            Todos
          </Chip>
          <Chip active={status === "pendientes"} onClick={() => setStatus("pendientes")} count={pending}>
            Pendientes
          </Chip>
          <Chip active={status === "reportados"} onClick={() => setStatus("reportados")}>
            Con registro
          </Chip>
          <span className="mx-1 w-px shrink-0 bg-line" />
          <Chip active={type === "todos"} onClick={() => setType("todos")}>
            Toda asignación
          </Chip>
          <Chip active={type === "Fijo"} onClick={() => setType("Fijo")}>
            Fijo
          </Chip>
          <Chip active={type === "Multiproyecto"} onClick={() => setType("Multiproyecto")}>
            Multiproyecto
          </Chip>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={layout} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {teamData && filtered.length === 0 ? (
            <EmptyState variant="search" title="Sin colaboradores para este filtro" description="Ajusta la búsqueda o los filtros." />
          ) : layout === "cards" ? (
            <TeamCards members={teamData ? filtered : undefined} loading={!teamData} businessDay={businessDay} onOpen={(m) => openMember(m)} onRegister={(m) => openRegister(m)} />
          ) : layout === "list" ? (
            <TeamList members={teamData ? filtered : undefined} loading={!teamData} businessDay={businessDay} onOpen={(m) => openMember(m)} onRegister={(m) => openRegister(m)} />
          ) : (
            <ComplianceMatrix members={filtered} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
