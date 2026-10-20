import type { Metadata } from "next";
import { ScheduleView } from "@/components/views/schedule-view";

export const metadata: Metadata = { title: "Cronograma" };

export default function CronogramaPage() {
  return <ScheduleView />;
}
