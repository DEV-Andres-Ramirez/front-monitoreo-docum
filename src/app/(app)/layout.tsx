import { Suspense } from "react";
import { AppShell, ShellSkeleton } from "@/components/shell/app-shell";

// El shell depende de la fecha actual (America/Bogota) y del estado del cliente, por eso se
// renderiza por request detrás de Suspense; el esqueleto forma parte del shell estático.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
