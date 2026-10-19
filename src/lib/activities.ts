import "server-only";
import { getWorkItems } from "./azure";
import type { ProjectKey } from "./config";
import type { Activity } from "./types";

export const ACTIVITY_SELECT =
  "id, project_key, employee_id, work_date, hours, description, evidence_url, work_item_id, work_item_type, work_item_title, work_item_state, work_item_url, created_at, updated_at, employee:employees(full_name)";

type ActivityRow = {
  id: string;
  project_key: string;
  employee_id: string;
  work_date: string;
  hours: number | string;
  description: string;
  evidence_url: string | null;
  work_item_id: number;
  work_item_type: string | null;
  work_item_title: string | null;
  work_item_state: string | null;
  work_item_url: string | null;
  created_at: string;
  updated_at: string;
  employee: { full_name: string } | { full_name: string }[] | null;
};

export function toActivity(raw: unknown): Activity {
  const row = raw as ActivityRow;
  const employee = Array.isArray(row.employee) ? row.employee[0] : row.employee;
  return {
    id: row.id,
    projectKey: row.project_key,
    employeeId: row.employee_id,
    employeeName: employee?.full_name ?? "—",
    workDate: row.work_date,
    hours: Number(row.hours),
    description: row.description,
    evidenceUrl: row.evidence_url,
    workItemId: row.work_item_id,
    workItemType: row.work_item_type,
    workItemTitle: row.work_item_title,
    workItemState: row.work_item_state,
    workItemUrl: row.work_item_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Valida que el work item pertenezca a las épicas del proyecto y devuelve su snapshot. */
export async function workItemSnapshot(key: ProjectKey, workItemId: number) {
  const { items } = await getWorkItems(key);
  const item = items.find((w) => w.id === workItemId);
  if (!item) {
    throw new Error(`El work item #${workItemId} no pertenece a las épicas del proyecto ${key}`);
  }
  return {
    work_item_id: item.id,
    work_item_type: item.type,
    work_item_title: item.title,
    work_item_state: item.state,
    work_item_url: item.url,
  };
}
