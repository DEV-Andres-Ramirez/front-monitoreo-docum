// Contratos JSON entre los Route Handlers y la UI.
import type { WorkItem } from "./azure";

export type { WorkItem };

export type TeamMember = {
  memberId: string;
  employeeId: string;
  name: string;
  email: string | null;
  role: string;
  allocation: number;
  assignmentType: string;
  startDate: string | null;
  endDate: string | null;
  /** La fecha consultada está dentro del rango de asignación */
  inRange: boolean;
  /** Jornada nominal del colaborador (JORNADA_HORAS × % asignado) */
  expectedHours: number;
  dayHours: number;
  dayCount: number;
  weekHours: number;
};

export type TeamResponse = {
  projectKey: string;
  date: string;
  isBusinessDay: boolean;
  weekStart: string;
  weekEnd: string;
  members: TeamMember[];
  totals: {
    dayHours: number;
    /** Horas esperadas del día (0 en fin de semana) */
    dayExpected: number;
    weekHours: number;
    dayActivities: number;
    reported: number;
    /** Colaboradores que deben reportar ese día (vigentes y día hábil) */
    due: number;
    total: number;
  };
};

export type Activity = {
  id: string;
  projectKey: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  hours: number;
  description: string;
  evidenceUrl: string | null;
  workItemId: number;
  workItemType: string | null;
  workItemTitle: string | null;
  workItemState: string | null;
  workItemUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkItemsResponse = { items: WorkItem[]; fetchedAt: string };

export type StatsDay = {
  date: string;
  businessDay: boolean;
  hours: number;
  activities: number;
  reported: number;
  /** Colaboradores que debían reportar ese día */
  due: number;
  expected: number;
};

export type StatsResponse = {
  projectKey: string;
  from: string;
  to: string;
  azureOk: boolean;
  daily: StatsDay[];
  byMember: { employeeId: string; name: string; hours: number; expected: number; daysReported: number; activities: number }[];
  memberDays: { employeeId: string; date: string; hours: number; activities: number }[];
  byType: { type: string; hours: number; activities: number }[];
  byFeature: { id: number | null; title: string; hours: number }[];
  byWorkItem: { workItemId: number; hours: number; activities: number; employeeIds: string[] }[];
  totals: {
    hours: number;
    activities: number;
    expected: number;
    prevHours: number;
    prevExpected: number;
    prevActivities: number;
  };
};

export type AuditEntry = {
  id: number;
  occurredAt: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  projectKey: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
};

export type AuditResponse = { entries: AuditEntry[]; nextCursor: number | null };
