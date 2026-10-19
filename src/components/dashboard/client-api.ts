"use client";

import { useSyncExternalStore } from "react";
import { mutate } from "swr";
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

/** Revalida equipo y actividades del proyecto tras crear/editar/borrar. */
export function refreshProjectData(projectKey: ProjectKey) {
  return mutate(
    (key) => typeof key === "string" && key.startsWith(`/api/projects/${projectKey}/`) && !key.includes("/work-items"),
  );
}

// --- Proyecto activo persistido en localStorage (sin desajustes de hidratación) ---
const STORAGE_KEY = "docum:project";
const EVENT = "docum:project-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

let memory: string | null = null;

function read() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? memory;
  } catch {
    return memory;
  }
}

export function useProjectKey(): [ProjectKey, (key: ProjectKey) => void] {
  const stored = useSyncExternalStore(subscribe, read, () => null);
  const key: ProjectKey = stored && isProjectKey(stored) ? stored : "348";
  const set = (next: ProjectKey) => {
    memory = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* almacenamiento bloqueado: se mantiene en memoria */
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return [key, set];
}
