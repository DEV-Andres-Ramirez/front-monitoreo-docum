// Contrato del dataset de análisis (servidor → cliente) y tipos del motor.

export type StateCategory = "Proposed" | "InProgress" | "Resolved" | "Completed" | "Removed";

/** Ítem de Azure tal como lo entrega el RPC azure_dataset (fechas ISO). */
export type AzureItem = {
  id: number;
  type: string;
  title: string | null;
  state: string | null;
  cat: StateCategory;
  priority: number | null;
  parentId: number | null;
  email: string | null;
  name: string | null;
  iteration: string | null;
  iterStart: string | null;
  iterEnd: string | null;
  created: string | null;
  changed: string | null;
  activated: string | null;
  inProgress: string | null;
  resolved: string | null;
  completed: string | null;
  closed: string | null;
  start: string | null;
  target: string | null;
  delivery: string | null;
  sp: number | null;
  effort: number | null;
  estimate: number | null;
  completedWork: number | null;
  remaining: number | null;
  leadDays: number | null;
  cycleDays: number | null;
  tags: string | null;
};

export type Transition = { id: number; state: string | null; cat: StateCategory; at: string };

export type RosterMember = {
  employeeId: string;
  name: string;
  email: string | null;
  role: string;
  allocation: number;
  assignmentType: string;
  startDate: string | null;
  endDate: string | null;
};

export type SyncInfo = {
  running: boolean;
  lastAt: string | null;
  lastStatus: "running" | "ok" | "error" | null;
  lastError: string | null;
};

export type DatasetResponse = {
  projectKey: string;
  from: string;
  to: string;
  org: string;
  project: string;
  epicIds: number[];
  generatedAt: string;
  sync: SyncInfo;
  roster: RosterMember[];
  employees: { id: string; name: string; email: string | null }[];
  aliases: { alias: string; employeeId: string }[];
  items: AzureItem[];
  transitions: Transition[];
};
