// Aplica migraciones SQL al proyecto Supabase vía Management API (alternativa al MCP).
//
// Uso:
//   node --env-file=.env scripts/apply-migrations.mjs                 # todas las de supabase/migrations
//   node --env-file=.env scripts/apply-migrations.mjs 0003_algo.sql   # solo las indicadas
//
// Requiere en .env: SUPABASE_URL y SUPABASE_ACCESS_TOKEN (token personal sbp_..., solo local).
// Las migraciones deben ser idempotentes (create if not exists / on conflict).
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!token || !ref) {
  console.error("Faltan SUPABASE_ACCESS_TOKEN (sbp_...) o SUPABASE_URL en el entorno");
  process.exit(1);
}

const dir = join(import.meta.dirname, "..", "supabase", "migrations");
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
  return JSON.parse(body || "[]");
}

for (const file of files) {
  process.stdout.write(`→ ${file} … `);
  await query(await readFile(join(dir, file), "utf8"));
  console.log("OK");
}

const summary = await query(
  "select (select count(*) from public.employees) as colaboradores, (select count(*) from public.project_members) as asignaciones, (select count(*) from public.activity_logs) as actividades",
);
console.log(`Proyecto ${ref}:`, summary[0]);
