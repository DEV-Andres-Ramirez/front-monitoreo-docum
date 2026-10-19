import { cookies } from "next/headers";
import { audit } from "@/lib/audit";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  (await cookies()).delete(SESSION_COOKIE);
  await audit(request, { action: "logout", entity: "session" });
  return Response.json({ ok: true });
}
