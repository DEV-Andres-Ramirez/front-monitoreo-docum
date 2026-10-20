"use client";

// Escala de la interfaz (para pantallas grandes / TV) y pantalla completa.
//
// · La escala cambia el font-size de <html>: todo lo medido en rem (texto, espacios, tamaños)
//   crece o se reduce; las gráficas se redibujan nítidas a su tamaño real.
// · Las media queries no "ven" esa escala, por eso los breakpoints de Tailwind (sm…2xl) están
//   redefinidos en globals.css sobre <html data-bp="sm md lg …">, que se calcula con el
//   ANCHO EFECTIVO = ancho de la ventana ÷ escala. Así, a 200 % en un TV de 1920 px el
//   tablero usa el diseño de 960 px, igual que el zoom nativo del navegador.
// · El script inline (DISPLAY_INIT_SCRIPT, src/lib/boot-scripts.ts) aplica todo antes del primer pintado.
import { useSyncExternalStore } from "react";
import { BREAKPOINTS, DISPLAY_EVENT, SCALE_KEY, SCALE_MAX, SCALE_MIN, SCALE_STEPS } from "@/lib/boot-scripts";

export { SCALE_STEPS };
const MIN = SCALE_MIN;
const MAX = SCALE_MAX;
const EVENT = DISPLAY_EVENT;
export type Breakpoint = keyof typeof BREAKPOINTS;

function readScale() {
  const v = Number(document.documentElement.getAttribute("data-scale"));
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function subscribeDisplay(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

function apply() {
  (window as Window & { __documApplyDisplay?: () => void }).__documApplyDisplay?.();
}

export function setUiScale(scale: number) {
  const next = Math.min(MAX, Math.max(MIN, Math.round(scale * 100) / 100));
  try {
    localStorage.setItem(SCALE_KEY, String(next));
  } catch {
    /* sin almacenamiento: no persiste */
  }
  apply();
  return next;
}

/** Siguiente paso de la escala (+1 / −1). */
export function stepUiScale(direction: 1 | -1) {
  const current = readScale();
  const steps = SCALE_STEPS as readonly number[];
  const next =
    direction > 0 ? (steps.find((s) => s > current + 0.001) ?? MAX) : ([...steps].reverse().find((s) => s < current - 0.001) ?? MIN);
  return setUiScale(next);
}

export const canGrow = (scale: number) => scale < MAX - 0.001;
export const canShrink = (scale: number) => scale > MIN + 0.001;

export function useUiScale() {
  return useSyncExternalStore(subscribeDisplay, readScale, () => 1);
}

/** ¿El ancho efectivo (ventana ÷ escala) alcanza el breakpoint? */
export function useBreakpoint(bp: Breakpoint) {
  return useSyncExternalStore(
    subscribeDisplay,
    () => (document.documentElement.getAttribute("data-bp") ?? "").split(" ").includes(bp),
    () => true,
  );
}

// ------------------------------------------------------------------ Pantalla completa
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

function subscribeFullscreen(cb: () => void) {
  document.addEventListener("fullscreenchange", cb);
  document.addEventListener("webkitfullscreenchange", cb);
  return () => {
    document.removeEventListener("fullscreenchange", cb);
    document.removeEventListener("webkitfullscreenchange", cb);
  };
}

const isFullscreen = () => {
  const d = document as FsDocument;
  return !!(d.fullscreenElement ?? d.webkitFullscreenElement);
};

export function useFullscreen() {
  const active = useSyncExternalStore(subscribeFullscreen, isFullscreen, () => false);
  const supported = useSyncExternalStore(
    () => () => {},
    () => {
      const el = document.documentElement as FsElement;
      return !!(el.requestFullscreen || el.webkitRequestFullscreen);
    },
    () => true,
  );
  return { active, supported, toggle: toggleFullscreen };
}

export async function toggleFullscreen() {
  const d = document as FsDocument;
  const el = document.documentElement as FsElement;
  try {
    if (isFullscreen()) await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
    else await (el.requestFullscreen?.({ navigationUI: "hide" }) ?? el.webkitRequestFullscreen?.());
  } catch {
    /* el navegador puede rechazarlo (p. ej. sin gesto del usuario) */
  }
}
