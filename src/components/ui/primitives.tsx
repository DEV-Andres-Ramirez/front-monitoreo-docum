"use client";

import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { forwardRef, useId } from "react";
import { typeMeta } from "@/lib/work-item-types";
import { useTheme } from "./theme";

// ---------------------------------------------------------------- Avatar
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

export type StatusTone = "good" | "warning" | "critical" | "info" | "neutral";

const RING: Record<StatusTone, string> = {
  good: "ring-good",
  warning: "ring-warning",
  critical: "ring-critical",
  info: "ring-accent",
  neutral: "ring-line-strong",
};

export function Avatar({ name, size = "md", status }: { name: string; size?: "xs" | "sm" | "md" | "lg"; status?: StatusTone }) {
  return (
    <div
      className={clsx(
        "grid shrink-0 place-items-center bg-gradient-to-br font-display font-semibold text-white shadow-sm",
        AVATAR_GRADIENTS[hash(name) % AVATAR_GRADIENTS.length],
        size === "xs" && "size-6 rounded-lg text-[0.625rem]",
        size === "sm" && "size-8 rounded-xl text-xs",
        size === "md" && "size-11 rounded-2xl text-sm",
        size === "lg" && "size-14 rounded-2xl text-lg",
        status && ["ring-2 ring-offset-2 ring-offset-surface", RING[status]],
      )}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  return (
    <div className="flex -space-x-2">
      {shown.map((n) => (
        <div key={n} title={n} className="rounded-lg ring-2 ring-surface">
          <Avatar name={n} size="xs" />
        </div>
      ))}
      {names.length > max && (
        <span className="grid size-6 place-items-center rounded-lg bg-surface-3 text-[0.625rem] font-semibold text-muted ring-2 ring-surface">
          +{names.length - max}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Skeleton
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("shimmer rounded-xl", className)} />;
}

// ---------------------------------------------------------------- Badges
export function TypeBadge({ type, className }: { type: string | null | undefined; className?: string }) {
  const { resolved } = useTheme();
  const meta = typeMeta(type);
  const color = resolved === "dark" ? meta.dark : meta.light;
  return (
    <span
      className={clsx("inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold text-foreground", className)}
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {meta.label}
    </span>
  );
}

export function stateTone(state: string | null | undefined): StatusTone {
  const s = (state ?? "").toLowerCase();
  if (/cerrad|closed|done|resuelt|terminad/.test(s)) return "good";
  if (/curso|active|desarrollo|progress|prueba/.test(s)) return "info";
  return "neutral";
}

const TONE_CLASS: Record<StatusTone, string> = {
  good: "bg-good-soft text-good-fg",
  warning: "bg-warning-soft text-warning-fg",
  critical: "bg-critical-soft text-critical-fg",
  info: "bg-info-soft text-info-fg",
  neutral: "bg-surface-3 text-muted",
};

export function StateBadge({ state }: { state: string | null | undefined }) {
  return (
    <span className={clsx("inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-medium", TONE_CLASS[stateTone(state)])}>
      {state || "—"}
    </span>
  );
}

/** Insignia de estado: siempre ícono + texto (el color nunca va solo). */
export function StatusPill({
  tone,
  icon: Icon,
  label,
  compact = false,
}: {
  tone: StatusTone;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  compact?: boolean;
}) {
  return (
    <span className={clsx("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[0.6875rem] font-semibold", TONE_CLASS[tone])} title={label}>
      <Icon className="size-3" />
      <span className={compact ? "sr-only" : undefined}>{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------- No Global
/** Etiqueta de un miembro del proyecto que no está en Global (la base de personal); igual cuenta en el análisis. */
export function NoGlobalBadge({ className }: { className?: string }) {
  return (
    <span
      title="No está en el personal de Global de este proyecto; se incluye en el análisis"
      className={clsx(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-info-fg/25 bg-info-soft px-1.5 py-px text-[0.625rem] font-semibold uppercase tracking-wide text-info-fg",
        className,
      )}
    >
      No Global
    </span>
  );
}

// ---------------------------------------------------------------- Chip & Segmented
export function Chip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-accent bg-accent text-white shadow-sm shadow-accent/30"
          : "border-line bg-surface text-muted hover:border-line-strong hover:text-foreground",
      )}
    >
      {children}
      {count !== undefined && (
        <span className={clsx("rounded-full px-1.5 text-[0.625rem] tabular-nums", active ? "bg-white/25" : "bg-surface-3")}>{count}</span>
      )}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; title?: string; icon?: React.ComponentType<{ className?: string }> }[];
  size?: "sm" | "md";
  className?: string;
}) {
  const id = useId();
  return (
    <div role="tablist" className={clsx("inline-flex rounded-xl border border-line bg-surface-2 p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            title={o.title}
            aria-label={o.title ?? o.label}
            onClick={() => onChange(o.value)}
            className={clsx(
              "relative flex items-center gap-1.5 rounded-[0.625rem] font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
              active ? "text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[0.625rem] bg-surface shadow-sm ring-1 ring-line"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            {o.icon && <o.icon className="relative size-4" />}
            {o.label && <span className="relative">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Button
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon: Icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-sm",
        variant === "primary" && "btn-glow bg-accent text-white shadow-lg shadow-accent/25 hover:brightness-110",
        variant === "secondary" && "border border-line bg-surface text-foreground shadow-sm hover:border-line-strong hover:bg-surface-2",
        variant === "ghost" && "text-muted hover:bg-surface-3 hover:text-foreground",
        variant === "danger" && "bg-critical text-white hover:brightness-110",
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
});

// ---------------------------------------------------------------- Kbd
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={clsx(
        "inline-grid h-5 min-w-5 place-items-center rounded-md border border-line-strong bg-surface-2 px-1 font-sans text-[0.625rem] font-semibold text-muted shadow-[inset_0_-1px_0_var(--line-strong)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

// ---------------------------------------------------------------- EmptyState
export function EmptyState({
  title,
  description,
  action,
  variant = "inbox",
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "inbox" | "chart" | "search" | "done";
  className?: string;
}) {
  return (
    <div className={clsx("grid place-items-center rounded-3xl border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center", className)}>
      <EmptyIllustration variant={variant} />
      <p className="mt-4 font-display text-base font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function EmptyIllustration({ variant }: { variant: "inbox" | "chart" | "search" | "done" }) {
  return (
    <svg viewBox="0 0 120 90" className="h-20 w-28" aria-hidden>
      <defs>
        <linearGradient id="es-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-sky)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="80" rx="42" ry="6" fill="var(--surface-3)" />
      <rect x="22" y="14" width="76" height="58" rx="12" fill="var(--surface)" stroke="var(--line-strong)" />
      {variant === "chart" && (
        <>
          <rect x="36" y="44" width="9" height="18" rx="3" fill="var(--line-strong)" />
          <rect x="51" y="34" width="9" height="28" rx="3" fill="url(#es-g)" />
          <rect x="66" y="40" width="9" height="22" rx="3" fill="var(--line-strong)" />
          <rect x="81" y="28" width="9" height="34" rx="3" fill="url(#es-g)" opacity="0.6" />
        </>
      )}
      {variant === "inbox" && (
        <>
          <rect x="34" y="28" width="52" height="6" rx="3" fill="var(--line-strong)" />
          <rect x="34" y="40" width="38" height="6" rx="3" fill="var(--surface-3)" />
          <path d="M34 54h14l4 6h16l4-6h14" stroke="url(#es-g)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {variant === "search" && (
        <>
          <circle cx="56" cy="42" r="13" stroke="url(#es-g)" strokeWidth="4" fill="none" />
          <path d="M66 52l10 10" stroke="url(#es-g)" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {variant === "done" && (
        <>
          <circle cx="60" cy="43" r="17" fill="url(#es-g)" />
          <path d="M52 43l6 6 11-12" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------- Progress ring
export function ProgressRing({ value, size = 36, stroke = 4, className }: { value: number; size?: number; stroke?: number; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }} className={clsx("shrink-0 -rotate-90", className)} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - clamped) }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}
