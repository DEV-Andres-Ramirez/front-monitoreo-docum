import type { Metadata } from "next";
import { TeamView } from "@/components/views/team-view";

export const metadata: Metadata = { title: "Equipo" };

export default function EquipoPage() {
  return <TeamView />;
}
