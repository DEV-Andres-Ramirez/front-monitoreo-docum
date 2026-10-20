// Traza de eventos de la aplicación (login, logout, sincronización de Azure).
// Las sincronizaciones con Azure se registran desde src/lib/azure-sync.ts (azure_sync / azure_sync_failed).
import "server-only";
import { db } from "./supabase";

type AuditEvent = {
  action: "login_success" | "login_failed" | "logout" | "azure_refresh" | "alias_linked" | "alias_unlinked";
  entity?: string;
  entityId?: string;
  projectKey?: string;
  newData?: Record<string, unknown>;
};

export async function audit(request: Request, event: AuditEvent) {
  try {
    await db()
      .from("audit_log")
      .insert({
        action: event.action,
        entity: event.entity ?? null,
        entity_id: event.entityId ?? null,
        project_key: event.projectKey ?? null,
        new_data: event.newData ?? null,
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        user_agent: request.headers.get("user-agent"),
      });
  } catch (error) {
    // La auditoría nunca debe tumbar el flujo principal.
    console.error("[audit]", error);
  }
}
