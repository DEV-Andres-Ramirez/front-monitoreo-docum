import type { Metadata } from "next";
import { BacklogView } from "@/components/views/backlog-view";

export const metadata: Metadata = { title: "Backlog Azure" };

export default function BacklogPage() {
  return <BacklogView />;
}
