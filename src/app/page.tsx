import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/dashboard";

// El tablero depende de la fecha actual (America/Bogota), por eso se renderiza por request detrás
// de Suspense; el esqueleto forma parte del shell estático. Los datos llegan desde los Route Handlers.
export default function Home() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="app-bg min-h-dvh flex-1">
      <div className="glass h-[68px] border-b border-white/60" />
      <div className="mx-auto max-w-7xl space-y-6 px-4 pt-8 sm:px-6">
        <div className="shimmer h-16 w-full max-w-md rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shimmer h-32 rounded-3xl" />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer h-44 rounded-3xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
