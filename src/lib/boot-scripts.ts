// Scripts que corren en <head> ANTES del primer pintado (sin parpadeo ni saltos de diseño).
// Módulo neutral (sin "use client"): lo importan el layout (servidor) y los hooks del cliente.

export const THEME_KEY = "docum:theme";
export const THEME_EVENT = "docum:theme-change";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

export const SCALE_KEY = "docum:ui-scale";
export const DISPLAY_EVENT = "docum:display-change";
export const SCALE_STEPS = [0.75, 0.85, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2, 2.25, 2.5, 3] as const;
export const SCALE_MIN = SCALE_STEPS[0];
export const SCALE_MAX = SCALE_STEPS[SCALE_STEPS.length - 1];
/** Mismos cortes que Tailwind, evaluados sobre el ancho efectivo (ventana ÷ escala). */
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 } as const;

/** Aplica el tema guardado (claro / oscuro / sistema) en <html data-theme>. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("${DARK_QUERY}").matches);var r=document.documentElement;r.setAttribute("data-theme",d?"dark":"light");r.style.colorScheme=d?"dark":"light";}catch(e){}})()`;

/**
 * Aplica la escala de la interfaz (font-size de <html>) y los breakpoints efectivos
 * (<html data-bp="sm md …">), y los recalcula al redimensionar la ventana.
 * Expone window.__documApplyDisplay para que la UI lo invoque al cambiar la escala.
 */
export const DISPLAY_INIT_SCRIPT = `(function(){var K="${SCALE_KEY}",B=${JSON.stringify(Object.entries(BREAKPOINTS))};function a(){var s=1;try{s=parseFloat(localStorage.getItem(K))||1}catch(e){}if(!(s>=${SCALE_MIN}&&s<=${SCALE_MAX}))s=1;var r=document.documentElement;r.style.fontSize=(s*100)+"%";var w=window.innerWidth/s,b=[];for(var i=0;i<B.length;i++)if(w>=B[i][1])b.push(B[i][0]);r.setAttribute("data-bp",b.join(" "));r.setAttribute("data-scale",String(s));window.dispatchEvent(new Event("${DISPLAY_EVENT}"))}window.__documApplyDisplay=a;a();window.addEventListener("resize",a)})()`;
