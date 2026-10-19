"use client";

import clsx from "clsx";

const AVATAR_GRADIENTS = [
  "from-sky-400 to-blue-600",
  "from-emerald-400 to-green-600",
  "from-cyan-400 to-sky-600",
  "from-lime-400 to-emerald-600",
  "from-blue-400 to-indigo-600",
  "from-teal-400 to-cyan-600",
];

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 2 ? parts[2]?.[0] : parts[1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  return (
    <div
      className={clsx(
        "grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br font-display font-semibold text-white shadow-sm",
        AVATAR_GRADIENTS[hash(name) % AVATAR_GRADIENTS.length],
        size === "sm" && "size-8 rounded-xl text-xs",
        size === "md" && "size-11 text-sm",
        size === "lg" && "size-14 text-lg",
      )}
    >
      {initials(name)}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("shimmer rounded-xl", className)} />;
}

/** Colores oficiales de Azure Boards por tipo de work item */
const TYPE_STYLES: Record<string, { color: string; label: string }> = {
  Epic: { color: "#FF7B00", label: "Épica" },
  Feature: { color: "#773B93", label: "Feature" },
  "User Story": { color: "#009CCC", label: "HU" },
  "Product Backlog Item": { color: "#009CCC", label: "PBI" },
  Task: { color: "#C9A400", label: "Tarea" },
  Bug: { color: "#CC293D", label: "Bug" },
};

export function typeStyle(type: string | null | undefined) {
  return TYPE_STYLES[type ?? ""] ?? { color: "#64748B", label: type ?? "Ítem" };
}

export function TypeBadge({ type }: { type: string | null | undefined }) {
  const style = typeStyle(type);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
      style={{ color: style.color, background: `${style.color}14` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: style.color }} />
      {style.label}
    </span>
  );
}

export function StateBadge({ state }: { state: string | null | undefined }) {
  const s = (state ?? "").toLowerCase();
  const tone =
    /cerrad|closed|done|resuelt|terminad/.test(s)
      ? "bg-emerald-50 text-emerald-700"
      : /curso|active|desarrollo|progress|prueba/.test(s)
        ? "bg-sky-50 text-sky-700"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={clsx("inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium", tone)}>
      {state || "—"}
    </span>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "accent-transition whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium",
        active
          ? "border-accent bg-accent text-white shadow-sm shadow-accent/30"
          : "border-line bg-white text-muted hover:border-slate-300 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
