// Cumplimiento de HU, Tareas y Bugs de las épicas monitoreadas (vista "Cumplimiento", hoy solo 005).
// TypeScript puro, se calcula en el cliente. Cuenta TODO lo de las épicas (de quien sea o sin asignar);
// con personas elegidas en el filtro, solo lo asignado a ellas; con épicas elegidas, solo lo de ellas.
import type { ProjectCompliance } from "@/lib/config";
import { isoLocalDate } from "@/lib/dates";
import { buckets, type TimeUnit } from "./metrics";
import { classifyAssignee, type Assignee, type Identity } from "./model";
import type { StateCategory } from "./types";

/** Ítem de cumplimiento (RPC azure_compliance_items). Fechas ISO en hora de Bogotá. */
export type ComplianceItem = {
  id: number;
  type: string;
  title: string | null;
  state: string | null;
  cat: StateCategory;
  parentId: number | null;
  email: string | null;
  name: string | null;
  created: string | null;
  /** Fecha objetivo o, si no tiene, fin del sprint */
  target: string | null;
  /** Llegó a Entregado (Resolved) o Completado */
  qa: string | null;
  /** Completado */
  done: string | null;
};
export type ComplianceResponse = { projectKey: string; compliance: ProjectCompliance | null; items: ComplianceItem[]; generatedAt: string };

export type Stage = Exclude<StateCategory, "Removed">;
export const STAGES: Stage[] = ["Proposed", "InProgress", "Resolved", "Completed"];
/** Nombres de etapa por tipo (HU: flujo de levantamiento → desarrollo → QA → producción). */
export const HU_STAGE_LABEL: Record<Stage, string> = {
  Proposed: "Por iniciar",
  InProgress: "En desarrollo",
  Resolved: "En QA / aprobación",
  Completed: "En producción",
};
export const TASK_STAGE_LABEL: Record<Stage, string> = {
  Proposed: "Nuevas",
  InProgress: "Activas",
  Resolved: "Entregadas",
  Completed: "Cerradas",
};
/** Bugs: Nuevo → En desarrollo → Revisión QA (Devuelto, Bloqueado, Certificado para prod.) → Cerrado. */
export const BUG_STAGE_LABEL: Record<Stage, string> = {
  Proposed: "Nuevos",
  InProgress: "En desarrollo",
  Resolved: "En revisión QA",
  Completed: "Cerrados",
};

const stageOf = (i: ComplianceItem): Stage => (i.cat === "Removed" ? "Proposed" : i.cat);

export type TypeSummary = {
  total: number;
  byStage: Record<Stage, number>;
  /** Entregado (QA) o más */
  qa: number;
  /** Completado (HU en producción / tarea cerrada) */
  done: number;
  pctQa: number;
  pctDone: number;
  doneInPeriod: number;
  doneInPrev: number;
  qaInPeriod: number;
  qaInPrev: number;
  overdue: number;
  unassigned: number;
  /** Sin asignar y sin cumplir (pendientes sin responsable) */
  unassignedOpen: number;
  /** Estados de Azure con su etapa (para la tabla) */
  states: { state: string; stage: Stage; count: number }[];
};

export type HuRow = {
  item: ComplianceItem;
  assignee: Assignee;
  feature: ComplianceItem | null;
  tasksTotal: number;
  tasksDone: number;
  /** null si la HU no tiene tareas */
  pct: number | null;
  overdue: boolean;
  /** Todas sus tareas cerradas, pero la HU sigue sin llegar a QA */
  readyForQa: boolean;
};

export type GroupRow = {
  key: string;
  label: string;
  hu: { total: number; qa: number; done: number };
  tasks: { total: number; done: number };
  bugs: { total: number; done: number };
  overdue: number;
};
export type PersonRow = GroupRow & { assignee: Assignee };

export type TrendPoint = {
  start: number;
  date: string;
  huScope: number;
  huQa: number;
  huDone: number;
  taskScope: number;
  taskDone: number;
};

/** Bug del alcance con su responsable y etapa (los bugs no usan fechas: solo estado y cantidades). */
/** HU o bug del alcance con su responsable y etapa (sin fechas: solo estado y cantidades). */
export type ItemRow = { item: ComplianceItem; assignee: Assignee; stage: Stage; epicId: number | null; feature: ComplianceItem | null };

export type ComplianceAnalysis = {
  hu: TypeSummary;
  tasks: TypeSummary;
  /** null si el proyecto no mide bugs. Sin fechas: los campos de periodo y vencidas quedan en 0 */
  bugs: TypeSummary | null;
  /** Bugs del alcance (personas y épicas del filtro) para el tablero de Bugs */
  bugItems: ItemRow[];
  /** HU del alcance para el tablero de HU (sin fechas, igual que los bugs) */
  huItems: ItemRow[];
  /** Por épica monitoreada (en el orden configurado) */
  epics: GroupRow[];
  features: GroupRow[];
  hus: HuRow[];
  people: PersonRow[];
  trend: TrendPoint[];
  findings: {
    huWithoutTasks: HuRow[];
    readyForQa: HuRow[];
    unassignedTasks: ComplianceItem[];
    unassignedBugs: ComplianceItem[];
    overdueTasks: ComplianceItem[];
  };
};

export type ComplianceOptions = {
  config: ProjectCompliance;
  identity: Identity;
  today: string;
  /** Periodo del filtro global y el de comparación (ISO, ambos incluidos) */
  period: { from: string; to: string; prevFrom: string; prevTo: string };
  /** Claves de persona elegidas en el filtro (vacío = todo) */
  people: string[];
  /** Épicas monitoreadas del proyecto (en el orden configurado) */
  epicIds: number[];
  /** Épicas elegidas en el filtro (vacío = todas) */
  epics: number[];
  unit: TimeUnit;
};

const pct = (n: number, d: number) => (d ? n / d : 0);
const inRange = (d: string | null, from: string, to: string) => d !== null && d >= from && d <= to;

function summarize(items: ComplianceItem[], level: "qa" | "done", assignees: Map<number, Assignee>, o: ComplianceOptions): TypeSummary {
  const byStage: Record<Stage, number> = { Proposed: 0, InProgress: 0, Resolved: 0, Completed: 0 };
  const states = new Map<string, { state: string; stage: Stage; count: number }>();
  for (const i of items) {
    const stage = stageOf(i);
    byStage[stage] += 1;
    const name = i.state ?? stage;
    const s = states.get(name) ?? { state: name, stage, count: 0 };
    s.count += 1;
    states.set(name, s);
  }
  const qa = items.filter((i) => i.qa).length;
  const done = items.filter((i) => i.done).length;
  const { from, to, prevFrom, prevTo } = o.period;
  return {
    total: items.length,
    byStage,
    qa,
    done,
    pctQa: pct(qa, items.length),
    pctDone: pct(done, items.length),
    doneInPeriod: items.filter((i) => inRange(i.done, from, to)).length,
    doneInPrev: items.filter((i) => inRange(i.done, prevFrom, prevTo)).length,
    qaInPeriod: items.filter((i) => inRange(i.qa, from, to)).length,
    qaInPrev: items.filter((i) => inRange(i.qa, prevFrom, prevTo)).length,
    overdue: items.filter((i) => i.target !== null && i.target < o.today && !i[level]).length,
    unassigned: items.filter((i) => assignees.get(i.id)?.kind === "sinAsignar").length,
    unassignedOpen: items.filter((i) => !i[level] && assignees.get(i.id)?.kind === "sinAsignar").length,
    states: [...states.values()].sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || b.count - a.count),
  };
}

/** Resumen sin datos de fechas (HU y bugs): sin completados en el periodo ni atrasadas. */
const undated = (s: TypeSummary): TypeSummary => ({ ...s, doneInPeriod: 0, doneInPrev: 0, qaInPeriod: 0, qaInPrev: 0, overdue: 0 });

const emptyGroup = (key: string, label: string): GroupRow => ({
  key,
  label,
  hu: { total: 0, qa: 0, done: 0 },
  tasks: { total: 0, done: 0 },
  bugs: { total: 0, done: 0 },
  overdue: 0,
});

export function complianceAnalysis(all: ComplianceItem[], o: ComplianceOptions): ComplianceAnalysis {
  const byId = new Map(all.map((i) => [i.id, i]));
  const assignees = new Map(all.map((i) => [i.id, classifyAssignee(o.identity, i.email, i.name)]));
  const monitored = new Set(o.epicIds);
  /** Épica monitoreada de la que cuelga el ítem (o él mismo, si es una) */
  const epicOf = (i: ComplianceItem) => {
    let cur: ComplianceItem | undefined = i;
    for (let d = 0; cur && d < 10; d++) {
      if (monitored.has(cur.id)) return cur.id;
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return null;
  };
  const selected = new Set(o.people);
  const selectedEpics = new Set(o.epics);
  const inScope = (i: ComplianceItem) => (!selected.size || selected.has(assignees.get(i.id)!.key)) && (!selectedEpics.size || selectedEpics.has(epicOf(i) ?? -1));

  const allHus = all.filter((i) => i.type === o.config.userStory);
  const allTasks = all.filter((i) => i.type === o.config.task);
  const hus = allHus.filter(inScope);
  const tasks = allTasks.filter(inScope);
  const bugs = o.config.bug ? all.filter((i) => i.type === o.config.bug && inScope(i)) : [];

  const featureOf = (i: ComplianceItem) => {
    let cur = i.parentId ? byId.get(i.parentId) : undefined;
    for (let d = 0; cur && d < 8; d++) {
      if (cur.type === "Feature") return cur;
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return null;
  };
  const taskOverdue = (i: ComplianceItem) => i.target !== null && i.target < o.today && !i.done;

  // Por HU: sus tareas (todas: la HU es la unidad, aunque las tareas sean de otra persona)
  const tasksByHu = new Map<number, ComplianceItem[]>();
  for (const t of allTasks) if (t.parentId) tasksByHu.set(t.parentId, [...(tasksByHu.get(t.parentId) ?? []), t]);
  const huRows = hus.map<HuRow>((h) => {
    const mine = tasksByHu.get(h.id) ?? [];
    const tasksDone = mine.filter((t) => t.done).length;
    const stage = stageOf(h);
    return {
      item: h,
      assignee: assignees.get(h.id)!,
      feature: featureOf(h),
      tasksTotal: mine.length,
      tasksDone,
      pct: mine.length ? tasksDone / mine.length : null,
      // Las HU no usan fechas (decisión del usuario): nunca cuentan como atrasadas
      overdue: false,
      readyForQa: mine.length > 0 && tasksDone === mine.length && (stage === "Proposed" || stage === "InProgress"),
    };
  });

  // Por épica, por Feature y por persona
  const epicGroups = new Map<string, GroupRow>(o.epicIds.filter((id) => !selectedEpics.size || selectedEpics.has(id)).map((id) => [String(id), emptyGroup(String(id), byId.get(id)?.title ?? `Épica #${id}`)]));
  const featureGroups = new Map<string, GroupRow>();
  const personGroups = new Map<string, PersonRow>();
  const epic = (i: ComplianceItem) => {
    const key = String(epicOf(i) ?? "none");
    if (!epicGroups.has(key)) epicGroups.set(key, emptyGroup(key, "Sin épica"));
    return epicGroups.get(key)!;
  };
  const feature = (i: ComplianceItem) => {
    const f = featureOf(i);
    const key = f ? String(f.id) : "none";
    if (!featureGroups.has(key)) featureGroups.set(key, emptyGroup(key, f?.title ?? "Sin feature"));
    return featureGroups.get(key)!;
  };
  const person = (i: ComplianceItem) => {
    const a = assignees.get(i.id)!;
    if (!personGroups.has(a.key)) personGroups.set(a.key, { ...emptyGroup(a.key, a.name), assignee: a });
    return personGroups.get(a.key)!;
  };
  for (const h of hus) {
    for (const g of [epic(h), feature(h), person(h)]) {
      g.hu.total += 1;
      if (h.qa) g.hu.qa += 1;
      if (h.done) g.hu.done += 1;
    }
  }
  for (const t of tasks) {
    for (const g of [epic(t), feature(t), person(t)]) {
      g.tasks.total += 1;
      if (t.done) g.tasks.done += 1;
      if (taskOverdue(t)) g.overdue += 1;
    }
  }
  // Bugs: solo cantidades (sus fechas no son confiables, no suman vencidas)
  for (const b of bugs) {
    for (const g of [epic(b), feature(b), person(b)]) {
      g.bugs.total += 1;
      if (b.done) g.bugs.done += 1;
    }
  }

  // Tendencia acumulada desde el primer ítem creado hasta hoy
  const firstCreated = [...hus, ...tasks].map((i) => i.created).filter((d): d is string => !!d).sort()[0] ?? o.today;
  const range = { from: new Date(`${firstCreated}T00:00:00`).getTime(), to: new Date(`${o.today}T23:59:59`).getTime() };
  const upTo = (d: string | null, end: string) => d !== null && d <= end;
  const trend = buckets(range, o.unit).map<TrendPoint>((b) => {
    const end = isoLocalDate(Math.min(b.end, range.to));
    return {
      start: b.start,
      date: end,
      huScope: hus.filter((i) => upTo(i.created, end)).length,
      huQa: hus.filter((i) => upTo(i.qa, end)).length,
      huDone: hus.filter((i) => upTo(i.done, end)).length,
      taskScope: tasks.filter((i) => upTo(i.created, end)).length,
      taskDone: tasks.filter((i) => upTo(i.done, end)).length,
    };
  });

  const byName = (a: GroupRow, b: GroupRow) => a.label.localeCompare(b.label, "es");
  return {
    hu: undated(summarize(hus, "qa", assignees, o)),
    tasks: summarize(tasks, "done", assignees, o),
    bugs: o.config.bug ? undated(summarize(bugs, "done", assignees, o)) : null,
    bugItems: bugs.map((b) => ({ item: b, assignee: assignees.get(b.id)!, stage: stageOf(b), epicId: epicOf(b), feature: featureOf(b) })),
    huItems: hus.map((h) => ({ item: h, assignee: assignees.get(h.id)!, stage: stageOf(h), epicId: epicOf(h), feature: featureOf(h) })),
    epics: [...epicGroups.values()],
    features: [...featureGroups.values()].sort((a, b) => (a.key === "none" ? 1 : b.key === "none" ? -1 : byName(a, b))),
    hus: huRows,
    people: [...personGroups.values()].sort(
      (a, b) =>
        Number(a.assignee.kind === "sinAsignar") - Number(b.assignee.kind === "sinAsignar") ||
        b.hu.total + b.tasks.total + b.bugs.total - (a.hu.total + a.tasks.total + a.bugs.total) ||
        byName(a, b),
    ),
    trend,
    findings: {
      huWithoutTasks: huRows.filter((r) => r.tasksTotal === 0 && !r.item.done),
      readyForQa: huRows.filter((r) => r.readyForQa),
      unassignedTasks: tasks.filter((t) => !t.done && assignees.get(t.id)!.kind === "sinAsignar"),
      unassignedBugs: bugs.filter((b) => !b.done && assignees.get(b.id)!.kind === "sinAsignar"),
      overdueTasks: tasks.filter(taskOverdue),
    },
  };
}
