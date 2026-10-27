"use client";

import { useSyncExternalStore } from "react";
import { isProjectKey, type ProjectKey } from "@/lib/config";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** fetch JSON contra los Route Handlers; una sesión vencida devuelve al login. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  if (res.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa intencional: limpia el estado al expirar la sesión
    window.location.href = "/login";
    throw new ApiError("Sesión expirada", 401);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Error ${res.status}`, res.status);
  return data as T;
}

export const fetcher = <T,>(url: string) => api<T>(url);

// ------------------------------------------------------------------ Preferencias en localStorage
// Valores persistidos con useSyncExternalStore (sin desajustes de hidratación).
// `fallback` debe ser una constante de módulo (referencia estable).
const EVENT = "docum:stored-change";
const cache = new Map<string, { raw: string | null; value: unknown }>();
const memory = new Map<string, string>();

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

type StoreKind = "local" | "session";
const storage = (kind: StoreKind) => (kind === "session" ? sessionStorage : localStorage);
const memKey = (key: string, kind: StoreKind) => (kind === "session" ? `session:${key}` : key);

function readRaw(key: string, kind: StoreKind = "local") {
  const mem = memKey(key, kind);
  try {
    return storage(kind).getItem(key) ?? memory.get(mem) ?? null;
  } catch {
    return memory.get(mem) ?? null;
  }
}

export function readStored<T>(key: string, fallback: T, kind: StoreKind = "local"): T {
  const raw = readRaw(key, kind);
  const cacheKey = memKey(key, kind);
  const hit = cache.get(cacheKey);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  cache.set(cacheKey, { raw, value });
  return value;
}

export function writeStored<T>(key: string, value: T, kind: StoreKind = "local") {
  const raw = JSON.stringify(value);
  memory.set(memKey(key, kind), raw);
  try {
    storage(kind).setItem(key, raw);
  } catch {
    /* almacenamiento bloqueado: queda en memoria */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useStored<T>(key: string, fallback: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readStored(key, fallback),
    () => fallback,
  );
  return [value, (next: T) => writeStored(key, next)];
}

/** Como useStored, pero en sessionStorage: dura mientras la pestaña esté abierta (una visita nueva vuelve al valor por defecto). */
export function useSessionStored<T>(key: string, fallback: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readStored(key, fallback, "session"),
    () => fallback,
  );
  return [value, (next: T) => writeStored(key, next, "session")];
}

const PROJECT_FALLBACK = "348";

export function useProjectKey(): [ProjectKey, (key: ProjectKey) => void] {
  const [stored, set] = useStored<string>("docum:project-key", PROJECT_FALLBACK);
  return [isProjectKey(stored) ? stored : "348", set];
}
