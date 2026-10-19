import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { audit } from "@/lib/audit";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";

function sameToken(a: string, b: string) {
  // Comparación en tiempo constante sobre hashes de igual longitud.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function POST(request: Request) {
  const expected = process.env.ACCESS_TOKEN;
  if (!expected) {
    return Response.json({ error: "ACCESS_TOKEN no está configurado en el servidor" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  if (!token || !sameToken(token, expected)) {
    await audit(request, { action: "login_failed", entity: "session" });
    await new Promise((r) => setTimeout(r, 800)); // freno a la fuerza bruta
    return Response.json({ error: "Token de acceso incorrecto" }, { status: 401 });
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions);
  await audit(request, { action: "login_success", entity: "session" });
  return Response.json({ ok: true });
}
