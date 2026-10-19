// Data Access Layer de autenticación para Route Handlers.
// proxy.ts hace la verificación optimista; aquí se vuelve a verificar en cada request.
import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export async function isAuthenticated() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export function unauthorizedResponse() {
  return Response.json({ error: "Sesión no válida o expirada" }, { status: 401 });
}

export function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Error inesperado";
  console.error("[api]", error);
  return Response.json({ error: message }, { status });
}
