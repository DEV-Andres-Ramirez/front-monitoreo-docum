import { History, Layers, LayoutDashboard, ListChecks, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; short: string; description: string; icon: LucideIcon; key: string };

export const NAV: NavItem[] = [
  { href: "/", key: "1", label: "Resumen", short: "Resumen", icon: LayoutDashboard, description: "Indicadores y analítica del equipo" },
  { href: "/equipo", key: "2", label: "Equipo", short: "Equipo", icon: Users, description: "Estado diario y cumplimiento por colaborador" },
  { href: "/actividades", key: "3", label: "Actividades", short: "Actividades", icon: ListChecks, description: "Registro detallado y exportación" },
  { href: "/backlog", key: "4", label: "Backlog Azure", short: "Backlog", icon: Layers, description: "Épicas, features, HU y tareas con horas (solo lectura)" },
  { href: "/bitacora", key: "5", label: "Bitácora", short: "Bitácora", icon: History, description: "Traza de auditoría de todo lo que pasa" },
];

export function navFor(pathname: string) {
  return NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href))) ?? NAV[0];
}
