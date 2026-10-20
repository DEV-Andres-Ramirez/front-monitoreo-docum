import { CalendarRange, History, Layers, LayoutDashboard, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; short: string; description: string; icon: LucideIcon; key: string };

export const NAV: NavItem[] = [
  { href: "/", key: "1", label: "Resumen", short: "Resumen", icon: LayoutDashboard, description: "Indicadores de flujo, entregas y alertas" },
  { href: "/cronograma", key: "2", label: "Cronograma", short: "Gantt", icon: CalendarRange, description: "Gantt plan vs. real por colaborador" },
  { href: "/colaboradores", key: "3", label: "Colaboradores", short: "Equipo", icon: Users, description: "Desempeño, carga y estados por persona" },
  { href: "/backlog", key: "4", label: "Backlog Azure", short: "Backlog", icon: Layers, description: "Épicas, features, HU y tareas (solo lectura)" },
  { href: "/bitacora", key: "5", label: "Bitácora", short: "Bitácora", icon: History, description: "Ingresos, sincronizaciones y vinculaciones" },
];

export function navFor(pathname: string) {
  return NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href))) ?? NAV[0];
}
