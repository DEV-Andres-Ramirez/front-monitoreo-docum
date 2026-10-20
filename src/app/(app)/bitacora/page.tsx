import type { Metadata } from "next";
import { AuditView } from "@/components/views/audit-view";

export const metadata: Metadata = { title: "Bitácora" };

export default function BitacoraPage() {
  return <AuditView />;
}
