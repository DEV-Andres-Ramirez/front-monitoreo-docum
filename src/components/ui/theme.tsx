"use client";

// Tema claro / oscuro / sistema. El valor inicial lo aplica el script inline de layout.tsx
// antes del primer pintado; este módulo lo mantiene sincronizado en el cliente.
import { useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const KEY = "docum:theme";
const EVENT = "docum:theme-change";
const MEDIA = "(prefers-color-scheme: dark)";

/** Script que corre antes del primer pintado (inyectado en <head>). */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("${MEDIA}").matches);var r=document.documentElement;r.setAttribute("data-theme",d?"dark":"light");r.style.colorScheme=d?"dark":"light";}catch(e){}})()`;

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function resolve(pref: ThemePref): ResolvedTheme {
  if (pref !== "system") return pref;
  return window.matchMedia(MEDIA).matches ? "dark" : "light";
}

function apply(pref: ThemePref) {
  const theme = resolve(pref);
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

function subscribe(callback: () => void) {
  const media = window.matchMedia(MEDIA);
  const onMedia = () => {
    if (readPref() === "system") apply("system");
    callback();
  };
  media.addEventListener("change", onMedia);
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    media.removeEventListener("change", onMedia);
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * Cambia el tema. Si el navegador soporta View Transitions, revela el nuevo tema
 * con un círculo que crece desde el punto del clic.
 */
export function setTheme(pref: ThemePref, origin?: { x: number; y: number }) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* sin almacenamiento: se aplica igual */
  }
  const changes = resolve(pref) !== document.documentElement.getAttribute("data-theme");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };

  if (!changes || reduce || !doc.startViewTransition || !origin) {
    apply(pref);
    window.dispatchEvent(new Event(EVENT));
    return;
  }
  const transition = doc.startViewTransition(() => {
    apply(pref);
    window.dispatchEvent(new Event(EVENT));
  });
  const radius = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
        { duration: 550, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {});
}

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as ThemePref);
  const resolved = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light") as ResolvedTheme,
    () => "light" as ResolvedTheme,
  );
  return { pref, resolved, setTheme };
}
