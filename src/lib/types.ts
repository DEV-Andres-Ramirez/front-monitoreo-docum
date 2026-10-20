// Contratos JSON entre los Route Handlers y la UI.
// El dataset de análisis de Azure está en src/lib/analytics/types.ts.

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
