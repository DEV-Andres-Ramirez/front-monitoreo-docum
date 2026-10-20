// =====================================================================
// Cliente Azure DevOps — REGLA DE ORO: SOLO LECTURA.
// Está prohibido crear, modificar o borrar cualquier cosa en Azure DevOps.
// Toda llamada pasa por azureRequest(), que solo permite:
//   · GET a dev.azure.com/{org}/… (REST de lectura)
//   · GET a analytics.dev.azure.com/{org}/{project}/_odata/… (Azure Analytics, OData)
//   · POST a dev.azure.com/{org}/{project}/_apis/wit/wiql (consulta WIQL; es de lectura)
// No agregar PATCH/PUT/DELETE ni otros POST. Los PAT solo tienen permisos de lectura.
// =====================================================================
import "server-only";
import type { ProjectKey } from "./config";

const API_VERSION = "7.1";
const ODATA_VERSION = "v4.0-preview";
const ALLOWED_HOSTS = new Set(["dev.azure.com", "analytics.dev.azure.com"]);

export type AzureConfig = { org: string; project: string; epicIds: number[]; pat: string };

export function azureConfig(key: ProjectKey): AzureConfig {
  const org = process.env[`AZURE_${key}_ORG`];
  const project = process.env[`AZURE_${key}_PROJECT`];
  const pat = process.env[`AZURE_${key}_PAT`];
  const epicIds = (process.env[`AZURE_${key}_EPIC_IDS`] ?? "")
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v > 0);
  if (!org || !project || !pat) {
    throw new Error(`Azure DevOps no está configurado para el proyecto ${key}`);
  }
  return { org, project, epicIds, pat };
}

export class AzureHttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Único punto de salida hacia Azure. Valida host, método y ruta antes de llamar. */
async function azureRequest<T>(cfg: AzureConfig, url: string, wiql?: string): Promise<T> {
  const target = new URL(url);
  const isWiql = wiql !== undefined;
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.host)) {
    throw new Error(`REGLA DE ORO: host no permitido (${target.host})`);
  }
  if (target.host === "analytics.dev.azure.com" && (isWiql || !target.pathname.includes("/_odata/"))) {
    throw new Error("REGLA DE ORO: Analytics solo admite consultas OData por GET");
  }
  if (isWiql && !/\/_apis\/wit\/wiql$/.test(target.pathname)) {
    throw new Error("REGLA DE ORO: solo se permiten consultas WIQL como POST hacia Azure DevOps");
  }
  const res = await fetch(target, {
    method: isWiql ? "POST" : "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`:${cfg.pat}`).toString("base64")}`,
      Accept: "application/json",
      ...(isWiql ? { "Content-Type": "application/json" } : {}),
    },
    body: isWiql ? JSON.stringify({ query: wiql }) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new AzureHttpError(`Azure DevOps respondió ${res.status} (${cfg.project}) ${detail}`, res.status);
  }
  return res.json() as Promise<T>;
}

/** REST de lectura (GET) o WIQL (POST de consulta) bajo dev.azure.com/{org}/… */
export function azureRead<T>(cfg: AzureConfig, path: string, wiql?: string) {
  return azureRequest<T>(cfg, `https://dev.azure.com/${encodeURIComponent(cfg.org)}/${path}`, wiql);
}

/**
 * Consulta Azure Analytics (OData) y recorre todas las páginas (@odata.nextLink).
 * `query` es la parte después de /_odata/v4.0-preview/, p. ej. "WorkItems?$select=…".
 */
export async function analyticsRead<T>(cfg: AzureConfig, query: string): Promise<T[]> {
  const base = `https://analytics.dev.azure.com/${encodeURIComponent(cfg.org)}/${encodeURIComponent(cfg.project)}/_odata/${ODATA_VERSION}/`;
  const rows: T[] = [];
  let next: string | undefined = base + query;
  for (let page = 0; next && page < 200; page++) {
    const data: { value: T[]; "@odata.nextLink"?: string } = await azureRequest(cfg, next);
    rows.push(...data.value);
    next = data["@odata.nextLink"];
  }
  return rows;
}

export const API = { version: API_VERSION };

/** URL pública de un work item (para abrirlo en Azure, solo lectura). */
export function workItemUrl(cfg: Pick<AzureConfig, "org" | "project">, id: number) {
  return `https://dev.azure.com/${encodeURIComponent(cfg.org)}/${encodeURIComponent(cfg.project)}/_workitems/edit/${id}`;
}
