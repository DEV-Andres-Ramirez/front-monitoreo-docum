// Colores por categoría de estado (orden FIJO). Validados con el validador de dataviz:
// En curso / Entregado / Cerrado pasan todas las parejas en claro (#fff) y oscuro (#0d1526).
// "Por iniciar" es gris neutro a propósito (estado de fondo); siempre va con etiqueta.
import type { StateCategory } from "./types";

export const CATEGORY_COLORS: Record<StateCategory, { light: string; dark: string }> = {
  Proposed: { light: "#97a3b4", dark: "#5d6e87" },
  InProgress: { light: "#2a78d6", dark: "#3987e5" },
  Resolved: { light: "#eb6834", dark: "#d95926" },
  Completed: { light: "#1baf7a", dark: "#199e70" },
  Removed: { light: "#c4ccd8", dark: "#3a4760" },
};

/** Estado "vencido / retraso": color de estado crítico (reservado, siempre con ícono o texto). */
export const DELAY_COLOR = "#d03b3b";

export function categoryColor(cat: StateCategory, dark: boolean) {
  return dark ? CATEGORY_COLORS[cat].dark : CATEGORY_COLORS[cat].light;
}
