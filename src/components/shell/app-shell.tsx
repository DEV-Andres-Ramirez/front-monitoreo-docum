"use client";

import clsx from "clsx";
import { useSyncExternalStore } from "react";
import { AppProvider, useApp } from "./app-provider";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

const COLLAPSE_KEY = "docum:sidebar-collapsed";
const COLLAPSE_EVENT = "docum:sidebar";

function subscribe(cb: () => void) {
  window.addEventListener(COLLAPSE_EVENT, cb);
  return () => window.removeEventListener(COLLAPSE_EVENT, cb);
}
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <Frame>{children}</Frame>
    </AppProvider>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { projectKey } = useApp();
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const toggle = () => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
    } catch {
      /* sin almacenamiento */
    }
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  };

  return (
    <div data-project={projectKey} className="app-bg noise relative min-h-dvh flex-1">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className={clsx("relative z-10 transition-[padding] duration-300", collapsed ? "lg:pl-[5.25rem]" : "lg:pl-[17.5rem]")}>
        <Topbar />
        <MobileNav />
        <main className="mx-auto max-w-[93.75rem] px-4 pb-32 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">{children}</main>
      </div>
    </div>
  );
}

/** Esqueleto del shell mientras se resuelve la fecha del servidor (Suspense). */
export function ShellSkeleton() {
  return (
    <div className="app-bg min-h-dvh flex-1">
      <div className="fixed inset-y-0 left-0 hidden w-[17.5rem] border-r border-line bg-surface/80 lg:block" />
      <div className="lg:pl-[17.5rem]">
        <div className="h-[5.5rem] border-b border-line" />
        <div className="mx-auto max-w-[93.75rem] space-y-5 px-4 pt-7 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="shimmer h-36 rounded-[1.25rem]" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="shimmer h-80 rounded-[1.25rem] xl:col-span-2" />
            <div className="shimmer h-80 rounded-[1.25rem]" />
          </div>
        </div>
      </div>
    </div>
  );
}
