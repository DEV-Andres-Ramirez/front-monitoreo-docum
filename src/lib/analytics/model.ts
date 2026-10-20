// Modelo de análisis (cliente): identidad, horas sin doble conteo, fechas plan/real y traza.
import { JORNADA_HORAS } from "@/lib/config";
import type { AzureItem, DatasetResponse, RosterMember, StateCategory, Transition } from "./types";

export const DAY = 86_400_000;
const WORK_TYPES = new Set(["User Story", "Task", "Bug", "Product Backlog Item", "Issue"]);

export type Person = {
  key: string; // emp:<uuid> | ext:<correo>
  name: string;
  email: string | null;
  employeeId: string | null;
  inRoster: boolean;
  role: string | null;
  allocation: number; // 0 si no está en la planeación del proyecto
  assignmentType: string | null;
  startDate: string | null;
  endDate: string | null;
  azureEmails: string[];
  matchedBy: "alias" | "email" | "usuario" | "nombre" | "planeación" | null;
};

export type Segment = { state: string; cat: StateCategory; from: number; to: number | null };

export type Item = AzureItem & {
  url: string;
  isWork: boolean;
  personKey: string | null;
  /** Horas declaradas: Story Points / Effort / Estimación original (1 punto = 1 hora) */
  hours: number;
  /** Horas que suman en los totales (0 si el padre tiene hijos con horas: sin doble conteo) */
  countedHours: number;
  createdAt: number;
  plannedStart: number | null;
  plannedEnd: number | null;
  actualStart: number | null;
  deliveredAt: number | null;
  completedAt: number | null;
  onTime: boolean | null;
  overdue: boolean;
  /** Días de retraso frente a la fecha objetivo (entregado tarde o vencido) */
  delayDays: number;
  cycleTime: number | null;
  leadTime: number | null;
  segments: Segment[];
  epicId: number | null;
  featureId: number | null;
  inMonitoredEpics: boolean;
};

export type Model = {
  projectKey: string;
  now: number;
  items: Item[];
  work: Item[];
  byId: Map<number, Item>;
  people: Map<string, Person>;
  epicIds: number[];
  iterations: { name: string; start: number; end: number; count: number }[];
};

export const normalizeText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const local = (email: string) => email.split("@")[0];
const ts = (v: string | null | undefined) => (v ? new Date(v).getTime() : null);
/** Fin del día (hora local del navegador) de un instante */
export const endOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

/** Horas declaradas de un ítem (1 punto de esfuerzo = 1 hora). */
export const declaredHours = (i: AzureItem) => i.sp ?? i.effort ?? i.estimate ?? 0;

function buildIdentity(ds: DatasetResponse) {
  const roster = new Map<string, RosterMember>(ds.roster.map((r) => [r.employeeId, r]));
  const employees = ds.employees;
  const byEmail = new Map<string, string>();
  const byLocal = new Map<string, string[]>();
  for (const e of employees) {
    if (!e.email) continue;
    const em = e.email.toLowerCase();
    byEmail.set(em, e.id);
    byLocal.set(local(em), [...(byLocal.get(local(em)) ?? []), e.id]);
  }
  const tokens = new Map(employees.map((e) => [e.id, new Set(normalizeText(e.name).split(/\s+/))]));
  const aliases = new Map(ds.aliases.map((a) => [a.alias.toLowerCase(), a.employeeId]));

  const resolve = (email: string, name: string | null): { id: string; by: Person["matchedBy"] } | null => {
    if (aliases.has(email)) return { id: aliases.get(email)!, by: "alias" };
    if (byEmail.has(email)) return { id: byEmail.get(email)!, by: "email" };
    const sameLocal = byLocal.get(local(email)) ?? [];
    if (sameLocal.length === 1) return { id: sameLocal[0], by: "usuario" };
    if (name) {
      const wanted = normalizeText(name).split(/\s+/).filter((t) => t.length > 1);
      if (wanted.length >= 2) {
        const hits = employees.filter((e) => wanted.every((t) => tokens.get(e.id)!.has(t)));
        if (hits.length === 1) return { id: hits[0].id, by: "nombre" };
      }
    }
    return null;
  };
  return { roster, employees: new Map(employees.map((e) => [e.id, e])), resolve };
}

function segmentsFor(item: AzureItem, transitions: Transition[] | undefined): Segment[] {
  const points: { state: string; cat: StateCategory; at: number }[] = transitions?.length
    ? transitions.map((t) => ({ state: t.state ?? t.cat, cat: t.cat, at: new Date(t.at).getTime() }))
    : // Sin revisiones en la ventana sincronizada: se reconstruye con las fechas del ítem
      ([
        item.created && { state: "Creado", cat: "Proposed" as const, at: ts(item.created)! },
        item.inProgress && { state: "En curso", cat: "InProgress" as const, at: ts(item.inProgress)! },
        item.resolved && { state: "Entregado", cat: "Resolved" as const, at: ts(item.resolved)! },
        item.completed && { state: item.state ?? "Cerrado", cat: "Completed" as const, at: ts(item.completed)! },
      ].filter(Boolean) as { state: string; cat: StateCategory; at: number }[]);
  points.sort((a, b) => a.at - b.at);
  return points.map((p, i) => ({ state: p.state, cat: p.cat, from: p.at, to: points[i + 1]?.at ?? null }));
}

export function buildModel(ds: DatasetResponse, now = Date.now()): Model {
  const identity = buildIdentity(ds);
  const urlBase = `https://dev.azure.com/${encodeURIComponent(ds.org)}/${encodeURIComponent(ds.project)}/_workitems/edit/`;
  const transitionsById = new Map<number, Transition[]>();
  for (const t of ds.transitions) transitionsById.set(t.id, [...(transitionsById.get(t.id) ?? []), t]);

  // Padres con hijos que declaran horas → el padre no suma (regla "hojas primero")
  const parentsWithHours = new Set<number>();
  for (const i of ds.items) if (i.parentId && WORK_TYPES.has(i.type) && declaredHours(i) > 0) parentsWithHours.add(i.parentId);

  const people = new Map<string, Person>();
  const ensureEmployee = (id: string, by: Person["matchedBy"], azureEmail?: string) => {
    const key = `emp:${id}`;
    let p = people.get(key);
    if (!p) {
      const e = identity.employees.get(id);
      const r = identity.roster.get(id);
      p = {
        key,
        name: e?.name ?? r?.name ?? "Colaborador",
        email: e?.email ?? null,
        employeeId: id,
        inRoster: !!r,
        role: r?.role ?? null,
        allocation: r?.allocation ?? 0,
        assignmentType: r?.assignmentType ?? null,
        startDate: r?.startDate ?? null,
        endDate: r?.endDate ?? null,
        azureEmails: [],
        matchedBy: by,
      };
      people.set(key, p);
    }
    if (azureEmail && !p.azureEmails.includes(azureEmail)) p.azureEmails.push(azureEmail);
    if (by && (!p.matchedBy || p.matchedBy === "planeación")) p.matchedBy = by;
    return p;
  };
  // Toda la planeación aparece, aunque no tenga ítems
  for (const r of ds.roster) ensureEmployee(r.employeeId, "planeación");

  const personCache = new Map<string, string>();
  const personOf = (email: string | null, name: string | null) => {
    if (!email) return null;
    if (personCache.has(email)) return personCache.get(email)!;
    const match = identity.resolve(email, name);
    let key: string;
    if (match) key = ensureEmployee(match.id, match.by, email).key;
    else {
      key = `ext:${email}`;
      if (!people.has(key)) {
        people.set(key, {
          key,
          name: name ?? email,
          email,
          employeeId: null,
          inRoster: false,
          role: null,
          allocation: 0,
          assignmentType: null,
          startDate: null,
          endDate: null,
          azureEmails: [email],
          matchedBy: null,
        });
      }
    }
    personCache.set(email, key);
    return key;
  };

  const byId = new Map<number, Item>();
  const items: Item[] = ds.items.map((raw) => {
    const isWork = WORK_TYPES.has(raw.type);
    const hours = declaredHours(raw);
    const plannedStart = ts(raw.start) ?? ts(raw.iterStart);
    const plannedEnd = ts(raw.target) ?? ts(raw.iterEnd);
    const completedAt = ts(raw.completed);
    const deliveredAt = ts(raw.delivery) ?? ts(raw.resolved) ?? completedAt;
    const actualStart = ts(raw.inProgress);
    const due = plannedEnd !== null ? endOfDay(plannedEnd) : null;
    const onTime = deliveredAt !== null && due !== null ? deliveredAt <= due : null;
    const overdue = isWork && deliveredAt === null && due !== null && due < now;
    const delayDays = due === null ? 0 : deliveredAt !== null ? Math.max(0, (deliveredAt - due) / DAY) : overdue ? (now - due) / DAY : 0;
    const item: Item = {
      ...raw,
      url: urlBase + raw.id,
      isWork,
      personKey: isWork ? personOf(raw.email, raw.name) : null,
      hours,
      countedHours: isWork && hours > 0 && !parentsWithHours.has(raw.id) ? hours : 0,
      createdAt: ts(raw.created) ?? 0,
      plannedStart,
      plannedEnd,
      actualStart,
      deliveredAt,
      completedAt,
      onTime,
      overdue,
      delayDays,
      cycleTime: raw.cycleDays ?? (completedAt && actualStart ? (completedAt - actualStart) / DAY : null),
      leadTime: raw.leadDays ?? (completedAt && raw.created ? (completedAt - ts(raw.created)!) / DAY : null),
      segments: segmentsFor(raw, transitionsById.get(raw.id)),
      epicId: null,
      featureId: null,
      inMonitoredEpics: false,
    };
    byId.set(raw.id, item);
    return item;
  });

  // Ancestros: Feature y Épica de cada ítem, y si cuelga de una épica monitoreada
  const monitored = new Set(ds.epicIds);
  for (const item of items) {
    let current = item.parentId ? byId.get(item.parentId) : undefined;
    for (let depth = 0; current && depth < 8; depth++) {
      if (current.type === "Feature" && item.featureId === null) item.featureId = current.id;
      if (current.type === "Epic" && item.epicId === null) item.epicId = current.id;
      if (monitored.has(current.id)) item.inMonitoredEpics = true;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    if (monitored.has(item.id)) item.inMonitoredEpics = true;
  }

  // Sprints (iteraciones con fechas) presentes en los datos
  const iterMap = new Map<string, { name: string; start: number; end: number; count: number }>();
  for (const i of items) {
    if (!i.iteration || !i.iterStart || !i.iterEnd) continue;
    const key = `${i.iteration}|${i.iterStart}`;
    const it = iterMap.get(key) ?? { name: i.iteration, start: ts(i.iterStart)!, end: ts(i.iterEnd)!, count: 0 };
    it.count += 1;
    iterMap.set(key, it);
  }

  return {
    projectKey: ds.projectKey,
    now,
    items,
    work: items.filter((i) => i.isWork && i.personKey),
    byId,
    people,
    epicIds: ds.epicIds,
    iterations: [...iterMap.values()].sort((a, b) => a.start - b.start),
  };
}

/** Capacidad en horas de una persona de la planeación en [from, to] (8 h × % × días hábiles vigentes). */
export function capacityHours(p: Person, from: number, to: number) {
  if (!p.inRoster || !p.allocation) return null;
  const start = Math.max(from, p.startDate ? new Date(`${p.startDate}T00:00:00`).getTime() : from);
  const end = Math.min(to, p.endDate ? new Date(`${p.endDate}T23:59:59`).getTime() : to);
  let days = 0;
  for (let t = start; t <= end; t += DAY) {
    const dow = new Date(t).getDay();
    if (dow !== 0 && dow !== 6) days += 1;
  }
  return days * JORNADA_HORAS * p.allocation;
}

/** Categoría de un ítem en un instante, según su traza de estados. */
export function categoryAt(item: Item, t: number): StateCategory | null {
  if (item.createdAt > t) return null;
  let cat: StateCategory | null = item.segments.length ? null : "Proposed";
  for (const s of item.segments) {
    if (s.from <= t) cat = s.cat;
    else break;
  }
  return cat ?? "Proposed";
}
