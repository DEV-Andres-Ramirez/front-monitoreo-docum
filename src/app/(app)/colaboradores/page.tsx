import type { Metadata } from "next";
import { PeopleView } from "@/components/views/people-view";

export const metadata: Metadata = { title: "Colaboradores" };

export default function ColaboradoresPage() {
  return <PeopleView />;
}
