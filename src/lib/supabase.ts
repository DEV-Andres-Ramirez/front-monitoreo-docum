// Cliente Supabase exclusivo del servidor (llave secreta: omite RLS).
// Las tablas tienen RLS activo sin políticas, así que solo este cliente puede leer/escribir.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error("Supabase no está configurado (SUPABASE_URL / SUPABASE_SECRET_KEY)");
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
