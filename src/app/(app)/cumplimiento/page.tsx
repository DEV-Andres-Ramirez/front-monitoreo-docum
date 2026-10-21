import type { Metadata } from "next";
import { ComplianceView } from "@/components/views/compliance-view";

export const metadata: Metadata = { title: "Cumplimiento" };

export default function CumplimientoPage() {
  return <ComplianceView />;
}
