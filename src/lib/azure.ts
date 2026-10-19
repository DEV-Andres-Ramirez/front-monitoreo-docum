// =====================================================================
// Cliente Azure DevOps — REGLA DE ORO: SOLO LECTURA.
// Está prohibido crear, modificar o borrar cualquier cosa en Azure DevOps.
// Toda llamada pasa por azureRead(), que solo permite:
//   · GET (cualquier recurso de lectura)
//   · POST a /_apis/wit/wiql (consulta WIQL; es de lectura, Azure la expone como POST)
// No agregar PATCH/PUT/DELETE ni otros POST. Los PAT solo tienen permisos de lectura.
// =====================================================================
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { ProjectKey } from "./config";

const API_VERSION = "7.1";

type AzureConfig = { org: string; project: string; epicIds: number[]; pat: string };

export type WorkItem = {
  id: number;
  title: string;
  type: string;
  state: string;
  assignedTo: string | null;
  assignedEmail: string | null;
  parentId: number | null;
  url: string;
};

export type WorkItemsResult = { items: WorkItem[]; fetchedAt: string };

export function azureConfig(key: ProjectKey): AzureConfig {
  const org = process.env[`AZURE_${key}_ORG`];
  const project = process.env[`AZURE_${key}_PROJECT`];
  const pat = process.env[`AZURE_${key}_PAT`];
  const epicIds = (process.env[`AZURE_${key}_EPIC_IDS`] ?? "")
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v > 0);
  if (!org || !project || !pat || epicIds.length === 0) {
    throw new Error(`Azure DevOps no está configurado para el proyecto ${key}`);
  }
  return { org, project, epicIds, pat };
}

async function azureRead<T>(cfg: AzureConfig, path: string, wiql?: string): Promise<T> {
  const isWiql = wiql !== undefined;
  if (isWiql && !/^[^?]*\/_apis\/wit\/wiql\?/.test(path)) {
    throw new Error("REGLA DE ORO: solo se permiten consultas WIQL como POST hacia Azure DevOps");
  }
  const res = await fetch(`https://dev.azure.com/${encodeURIComponent(cfg.org)}/${path}`, {
    method: isWiql ? "POST" : "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`:${cfg.pat}`).toString("base64")}`,
      Accept: "application/json",
      ...(isWiql ? { "Content-Type": "application/json" } : {}),
    },
    body: isWiql ? JSON.stringify({ query: wiql }) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Azure DevOps respondió ${res.status} (${cfg.project})`);
  }
  return res.json() as Promise<T>;
}

type WiqlLinksResponse = { workItemRelations: { target: { id: number } }[] };
type WorkItemsResponse = {
  value: { id: number; fields: Record<string, unknown> }[];
};

/**
 * Árbol completo (épicas → features → HU → tareas) de las épicas configuradas.
 * Cacheado en el servidor; "Sincronizar Azure" invalida la etiqueta `azure-<key>`.
 */
export async function getWorkItems(key: ProjectKey): Promise<WorkItemsResult> {
  "use cache";
  cacheTag(`azure-${key}`);
  cacheLife("minutes");

  const cfg = azureConfig(key);
  const projectPath = encodeURIComponent(cfg.project);
  const links = await azureRead<WiqlLinksResponse>(
    cfg,
    `${projectPath}/_apis/wit/wiql?api-version=${API_VERSION}`,
    `SELECT [System.Id] FROM WorkItemLinks
     WHERE [Source].[System.Id] IN (${cfg.epicIds.join(",")})
       AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward'
     MODE (Recursive)`,
  );

  // El orden de la respuesta recursiva es el del árbol: se conserva.
  const ids = [...new Set(links.workItemRelations.map((r) => r.target.id))];
  const fields = "System.Id,System.Title,System.WorkItemType,System.State,System.AssignedTo,System.Parent";
  const byId = new Map<number, WorkItem>();

  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200).join(",");
    const data = await azureRead<WorkItemsResponse>(
      cfg,
      `_apis/wit/workitems?ids=${chunk}&fields=${fields}&api-version=${API_VERSION}`,
    );
    for (const w of data.value) {
      const f = w.fields;
      const assigned = f["System.AssignedTo"] as { displayName?: string; uniqueName?: string } | undefined;
      byId.set(w.id, {
        id: w.id,
        title: String(f["System.Title"] ?? ""),
        type: String(f["System.WorkItemType"] ?? ""),
        state: String(f["System.State"] ?? ""),
        assignedTo: assigned?.displayName ?? null,
        assignedEmail: assigned?.uniqueName?.toLowerCase() ?? null,
        parentId: (f["System.Parent"] as number | undefined) ?? null,
        url: `https://dev.azure.com/${encodeURIComponent(cfg.org)}/${projectPath}/_workitems/edit/${w.id}`,
      });
    }
  }

  const items = ids
    .map((id) => byId.get(id))
    .filter((w): w is WorkItem => !!w && w.state !== "Removed");

  return { items, fetchedAt: new Date().toISOString() };
}
