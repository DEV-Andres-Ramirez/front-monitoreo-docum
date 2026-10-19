// Sesión firmada (JWT HS256) en cookie httpOnly.
// Se usa desde proxy.ts y desde los Route Handlers, por eso no importa "server-only".
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "docum_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 h

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET no está configurado");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken() {
  return new SignJWT({ role: "scrum-master" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("scrum-master")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
