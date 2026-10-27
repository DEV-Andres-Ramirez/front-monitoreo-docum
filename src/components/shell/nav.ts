import { CalendarRange, ClipboardCheck, History, Layers, LayoutDashboard, Users, type LucideIcon } from "lucide-react";
import type { ProjectKey } from "@/lib/config";

export type NavItem = {
  href: string;
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
  /** Atajo de teclado: su posición en el menú del proyecto (1…n) */
  key: string;
  /** Solo en estos proyectos (sin valor = en todos) */
  projects?: ProjectKey[];
};

const ALL: Omit<NavItem, "key">[] = [
  { href: "/", label: "Resumen", short: "Resumen", icon: LayoutDashboard, description: "Indicadores de flujo, entregas y alertas" },
  { href: "/cumplimiento", label: "Cumplimiento", short: "Cumplim.", icon: ClipboardCheck, description: "HU, tareas y bugs: total, completados y % de cumplimiento", projects: ["005"] },
  { href: "/cronograma", label: "Cronograma", short: "Gantt", icon: CalendarRange, description: "Gantt plan vs. real por colaborador" },
  { href: "/colaboradores", label: "Colaboradores", short: "Equipo", icon: Users, description: "Desempeño, carga y estados por persona" },
  { href: "/backlog", label: "Backlog Azure", short: "Backlog", icon: Layers, description: "Épicas, features, HU y tareas (solo lectura)" },
  { href: "/bitacora", label: "Bitácora", short: "Bitácora", icon: History, description: "Ingresos, sincronizaciones y vinculaciones" },
];

/** Vistas del proyecto en orden de menú, con el atajo de teclado según su posición. */
export function navItems(projectKey: ProjectKey): NavItem[] {
  return ALL.filter((n) => !n.projects || n.projects.includes(projectKey)).map((n, i) => ({ ...n, key: String(i + 1) }));
}

/** Vista de la ruta actual (aunque no esté en el menú del proyecto activo). */
export function navFor(pathname: string, projectKey: ProjectKey): NavItem {
  const match = (n: Omit<NavItem, "key">) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href));
  const items = navItems(projectKey);
  return items.find(match) ?? { ...(ALL.find(match) ?? ALL[0]), key: "" };
}
