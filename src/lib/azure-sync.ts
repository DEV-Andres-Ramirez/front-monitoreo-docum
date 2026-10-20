// Sincronización Azure Analytics → Supabase (copia de SOLO LECTURA).
// Lee de Azure únicamente con GET (analyticsRead) y escribe solo en nuestra base.
import "server-only";
import { analyticsRead, azureConfig, type AzureConfig } from "./azure";
import { PROJECT_KEYS, type ProjectKey } from "./config";
import { db } from "./supabase";

/** Tipos que se analizan (se excluyen Test Case / Test Suite / Test Plan). */
const TYPES = ["Epic", "Feature", "User Story", "Task", "Bug", "Product Backlog Item", "Issue"];
const FULL_WINDOW_DAYS = 365;
const INCREMENTAL_OVERLAP_MIN = 10;
const LOCK_MINUTES = 5;
const BATCH = 500;
/** Sincronización automática: cada hora y, si la última falló, un reintento a los 10 minutos. */
export const AUTO_INTERVAL_MINUTES = 60;
const RETRY_AFTER_ERROR_MINUTES = 10;

/** Normaliza el correo de Azure: minúsculas y sin el prefijo "oidconflict_upnreuse_<guid>_". */
export function normalizeEmail(raw: string | null | undefined) {
  if (!raw) return null;
  const email = raw.trim().toLowerCase();
  const match = email.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})$/);
  const clean = match ? match[1] : email;
  return clean.replace(/^oidconflict_upnreuse_[0-9a-f-]+_/, "");
}

type ODataWorkItem = {
  WorkItemId: number;
  WorkItemType: string;
  Title: string | null;
  State: string | null;
  StateCategory: string | null;
  Priority: number | null;
  ParentWorkItemId: number | null;
  CreatedDate: string | null;
  ChangedDate: string | null;
  ActivatedDate: string | null;
  InProgressDate: string | null;
  ResolvedDate: string | null;
  CompletedDate: string | null;
  ClosedDate: string | null;
  StartDate: string | null;
  TargetDate: string | null;
  StoryPoints: number | null;
  Effort: number | null;
  OriginalEstimate: number | null;
  CompletedWork: number | null;
  RemainingWork: number | null;
  LeadTimeDays: number | null;
  CycleTimeDays: number | null;
  TagNames: string | null;
  Custom_FechadeEntregaReal?: string | null;
  AssignedTo: { UserEmail: string | null; UserName: string | null } | null;
  Iteration: { IterationName: string | null; IterationPath: string | null; StartDate: string | null; EndDate: string | null } | null;
};

type ODataRevision = {
  WorkItemId: number;
  Revision: number;
  State: string | null;
  StateCategory: string | null;
  ChangedDate: string;
  AssignedTo: { UserEmail: string | null } | null;
};

const ITEM_FIELDS = [
  "WorkItemId", "WorkItemType", "Title", "State", "StateCategory", "Priority", "ParentWorkItemId",
  "CreatedDate", "ChangedDate", "ActivatedDate", "InProgressDate", "ResolvedDate", "CompletedDate", "ClosedDate",
  "StartDate", "TargetDate", "StoryPoints", "Effort", "OriginalEstimate", "CompletedWork", "RemainingWork",
  "LeadTimeDays", "CycleTimeDays", "TagNames",
];
const CUSTOM_DELIVERY = "Custom_FechadeEntregaReal";

const typeFilter = `(${TYPES.map((t) => `WorkItemType eq '${t}'`).join(" or ")})`;
const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

async function fetchItems(cfg: AzureConfig, since: Date, full: boolean) {
  const window = full
    ? `(ChangedDate ge ${iso(since)} or StateCategory eq 'Proposed' or StateCategory eq 'InProgress' or StateCategory eq 'Resolved')`
    : `ChangedDate ge ${iso(since)}`;
  const build = (fields: string[]) =>
    `WorkItems?$select=${fields.join(",")}` +
    `&$expand=AssignedTo($select=UserEmail,UserName),Iteration($select=IterationName,IterationPath,StartDate,EndDate)` +
    `&$filter=${encodeURIComponent(`${typeFilter} and ${window}`)}`;
  try {
    return await analyticsRead<ODataWorkItem>(cfg, build([...ITEM_FIELDS, CUSTOM_DELIVERY]));
  } catch (error) {
    // El campo personalizado de entrega real no existe en todos los procesos (Azure responde 400).
    if ((error as { status?: unknown } | null)?.status === 400) return analyticsRead<ODataWorkItem>(cfg, build(ITEM_FIELDS));
    throw error;
  }
}

async function fetchRevisions(cfg: AzureConfig, since: Date) {
  const query =
    `WorkItemRevisions?$select=WorkItemId,Revision,State,StateCategory,ChangedDate` +
    `&$expand=AssignedTo($select=UserEmail)` +
    `&$filter=${encodeURIComponent(`${typeFilter} and ChangedDate ge ${iso(since)}`)}`;
  return analyticsRead<ODataRevision>(cfg, query);
}

function category(raw: string | null) {
  return raw ?? "Removed"; // Analytics devuelve null para estados de la categoría "Removed"
}

function toItemRow(key: ProjectKey, w: ODataWorkItem, now: string) {
  return {
    project_key: key,
    id: w.WorkItemId,
    type: w.WorkItemType,
    title: w.Title,
    state: w.State,
    state_category: category(w.StateCategory),
    priority: w.Priority,
    parent_id: w.ParentWorkItemId,
    assigned_email: normalizeEmail(w.AssignedTo?.UserEmail),
    assigned_name: w.AssignedTo?.UserName ?? null,
    iteration_name: w.Iteration?.IterationName ?? null,
    iteration_path: w.Iteration?.IterationPath ?? null,
    iteration_start: w.Iteration?.StartDate ?? null,
    iteration_end: w.Iteration?.EndDate ?? null,
    created_at: w.CreatedDate,
    changed_at: w.ChangedDate,
    activated_at: w.ActivatedDate,
    in_progress_at: w.InProgressDate,
    resolved_at: w.ResolvedDate,
    completed_at: w.CompletedDate,
    closed_at: w.ClosedDate,
    start_date: w.StartDate,
    target_date: w.TargetDate,
    delivery_date: w.Custom_FechadeEntregaReal ?? null,
    story_points: w.StoryPoints,
    effort: w.Effort,
    original_estimate: w.OriginalEstimate,
    completed_work: w.CompletedWork,
    remaining_work: w.RemainingWork,
    lead_time_days: w.LeadTimeDays,
    cycle_time_days: w.CycleTimeDays,
    tags: w.TagNames,
    synced_at: now,
  };
}

async function upsert(table: string, rows: Record<string, unknown>[], onConflict: string) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await db().from(table).upsert(rows.slice(i, i + BATCH), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export type SyncResult = { status: "ok" | "skipped" | "error"; mode?: "full" | "incremental"; items?: number; revisions?: number; error?: string };
export type SyncTrigger = "manual" | "auto" | "initial";
export type SyncStatus = Awaited<ReturnType<typeof syncStatus>>;

/** Última corrida, si hay una en curso y cuándo toca la siguiente automática. */
export async function syncStatus(key: ProjectKey) {
  const runsTable = () => db().from("azure_sync_runs").select("started_at, finished_at, status, items, revisions, error").eq("project_key", key);
  // La última corrida exitosa se consulta aparte: una racha de errores no debe "olvidarla".
  const [recent, ok] = await Promise.all([
    runsTable().order("started_at", { ascending: false }).limit(5),
    runsTable().eq("status", "ok").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (recent.error) throw new Error(recent.error.message);
  if (ok.error) throw new Error(ok.error.message);
  const runs = recent.data ?? [];
  const now = Date.now();
  const running = runs.some((r) => r.status === "running" && new Date(r.started_at).getTime() > now - LOCK_MINUTES * 60_000);
  const last = runs[0];
  const lastAt: string | null = ok.data?.finished_at ?? null;
  const lastAttemptAt: string | null = last ? (last.finished_at ?? last.started_at) : null;

  let nextAuto = lastAt ? new Date(lastAt).getTime() + AUTO_INTERVAL_MINUTES * 60_000 : now;
  if (last?.status === "error" && lastAttemptAt) nextAuto = Math.max(nextAuto, new Date(lastAttemptAt).getTime() + RETRY_AFTER_ERROR_MINUTES * 60_000);

  return {
    running,
    lastAt,
    lastAttemptAt,
    lastStatus: (last?.status ?? null) as "running" | "ok" | "error" | null,
    lastError: last?.status === "error" ? (last.error as string | null) : null,
    lastItems: ok.data?.items ?? 0,
    lastRevisions: ok.data?.revisions ?? 0,
    /** Cuándo corresponde la próxima sincronización automática (null mientras hay una en curso). */
    nextAutoAt: running ? null : new Date(nextAuto).toISOString(),
  };
}

export const isSyncDue = (status: SyncStatus, now = Date.now()) => !status.running && status.nextAutoAt !== null && new Date(status.nextAutoAt).getTime() <= now;

/**
 * Sincronización automática de todos los proyectos: solo corre los que ya cumplieron su hora
 * (o su reintento tras un error). Devuelve el resultado y el estado de cada uno.
 */
export async function syncDueProjects() {
  const results = {} as Record<ProjectKey, SyncResult>;
  const statuses = {} as Record<ProjectKey, SyncStatus>;
  for (const key of PROJECT_KEYS) {
    const before = await syncStatus(key);
    results[key] = isSyncDue(before) ? await syncProject(key, { trigger: "auto" }) : { status: "skipped" };
    statuses[key] = results[key].status === "skipped" ? before : await syncStatus(key);
  }
  const pending = PROJECT_KEYS.map((k) => statuses[k].nextAutoAt).filter((v): v is string => v !== null);
  const nextAutoAt = pending.length ? pending.reduce((a, b) => (a < b ? a : b)) : null;
  return { results, statuses, nextAutoAt };
}

/** Sincroniza un proyecto. Sin `full`, hace incremental desde la última marca de agua. */
export async function syncProject(key: ProjectKey, { full = false, trigger = "manual" as SyncTrigger } = {}): Promise<SyncResult> {
  const cfg = azureConfig(key);
  const status = await syncStatus(key);
  if (status.running) return { status: "skipped" };

  const { data: lastOk } = await db()
    .from("azure_sync_runs")
    .select("watermark")
    .eq("project_key", key)
    .eq("status", "ok")
    .not("watermark", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const mode: "full" | "incremental" = full || !lastOk?.watermark ? "full" : "incremental";
  const since =
    mode === "full"
      ? new Date(Date.now() - FULL_WINDOW_DAYS * 86_400_000)
      : new Date(new Date(lastOk!.watermark as string).getTime() - INCREMENTAL_OVERLAP_MIN * 60_000);

  const { data: run, error: runError } = await db().from("azure_sync_runs").insert({ project_key: key, mode, status: "running" }).select("id").single();
  if (runError) throw new Error(runError.message);

  try {
    const now = new Date().toISOString();
    const [items, revisions] = await Promise.all([fetchItems(cfg, since, mode === "full"), fetchRevisions(cfg, since)]);

    await upsert("azure_work_items", items.map((w) => toItemRow(key, w, now)), "project_key,id");
    await upsert(
      "azure_revisions",
      revisions.map((r) => ({
        project_key: key,
        work_item_id: r.WorkItemId,
        revision: r.Revision,
        state: r.State,
        state_category: category(r.StateCategory),
        assigned_email: normalizeEmail(r.AssignedTo?.UserEmail),
        changed_at: r.ChangedDate,
      })),
      "project_key,work_item_id,revision",
    );

    const stamps = [...items.map((w) => w.ChangedDate), ...revisions.map((r) => r.ChangedDate)].filter(Boolean) as string[];
    const latest = stamps.reduce((max, s) => Math.max(max, new Date(s).getTime()), 0);
    const watermark = latest ? new Date(latest).toISOString() : (lastOk?.watermark ?? now);

    await db()
      .from("azure_sync_runs")
      .update({ status: "ok", finished_at: new Date().toISOString(), items: items.length, revisions: revisions.length, watermark })
      .eq("id", run.id);
    await db().from("audit_log").insert({
      action: "azure_sync",
      entity: "azure",
      project_key: key,
      new_data: { mode, trigger, items: items.length, revisions: revisions.length },
    });
    return { status: "ok", mode, items: items.length, revisions: revisions.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[sync ${key}]`, error);
    await db().from("azure_sync_runs").update({ status: "error", finished_at: new Date().toISOString(), error: message.slice(0, 1000) }).eq("id", run.id);
    await db().from("audit_log").insert({ action: "azure_sync_failed", entity: "azure", project_key: key, new_data: { mode, trigger, error: message.slice(0, 500) } });
    return { status: "error", mode, error: message };
  }
}
