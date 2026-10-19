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
  expectedHours: number;
  dayHours: number;
  dayCount: number;
  weekHours: number;
};

export type TeamResponse = {
  projectKey: string;
  date: string;
  weekStart: string;
  weekEnd: string;
  members: TeamMember[];
  totals: {
    dayHours: number;
    weekHours: number;
    dayActivities: number;
    reported: number;
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
