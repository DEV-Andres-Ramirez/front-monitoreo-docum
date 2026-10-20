import type { Metadata } from "next";
import { ActivitiesView } from "@/components/views/activities-view";

export const metadata: Metadata = { title: "Actividades" };

export default function ActividadesPage() {
  return <ActivitiesView />;
}
