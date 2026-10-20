"use client";

import clsx from "clsx";
import { ArrowRight, Check, Eye, EyeOff, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const controls = useAnimationControls();
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No fue posible ingresar");
      }
      setSuccess(true);
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible ingresar");
      setLoading(false);
      controls.start({ x: [0, -12, 12, -8, 8, -4, 4, 0], transition: { duration: 0.5 } });
    }
  }

  const checkCaps = (e: React.KeyboardEvent) => setCapsLock(e.getModifierState?.("CapsLock") ?? false);

  return (
    <motion.form onSubmit={onSubmit} animate={controls} className="space-y-4">
      <label htmlFor="token" className="block text-sm font-medium text-foreground">
        Token de acceso
      </label>
      <div
        className={clsx(
          "group flex items-center gap-2 rounded-2xl border bg-surface px-4 transition-all focus-within:ring-4",
          error ? "border-critical/60 focus-within:ring-critical/15" : "border-line focus-within:border-accent focus-within:ring-accent/15",
        )}
      >
        <KeyRound className="size-5 shrink-0 text-subtle transition-colors group-focus-within:text-accent-fg" />
        <input
          id="token"
          name="token"
          type={visible ? "text" : "password"}
          autoComplete="current-password"
          autoFocus
          value={token}
          onKeyDown={checkCaps}
          onKeyUp={checkCaps}
          onChange={(e) => {
            setToken(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Ingresa tu token único"
          aria-invalid={!!error}
          aria-describedby="token-help"
          className="h-13 w-full bg-transparent py-3.5 text-base text-foreground outline-none placeholder:text-subtle"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="rounded-lg p-1.5 text-subtle transition hover:bg-surface-3 hover:text-foreground"
          aria-label={visible ? "Ocultar token" : "Mostrar token"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      <div id="token-help" className="min-h-5" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {error ? (
            <motion.p key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm font-medium text-critical-fg" role="alert">
              {error}
            </motion.p>
          ) : capsLock ? (
            <motion.p key="caps" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-sm text-warning-fg">
              <TriangleAlert className="size-4" /> Bloq Mayús está activado
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <motion.button
        type="submit"
        disabled={loading || !token.trim()}
        whileHover={{ scale: loading ? 1 : 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="btn-glow relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#00b4ff] to-[#0080f0] font-semibold text-white shadow-lg shadow-[#0090ff]/30 transition-opacity disabled:cursor-not-allowed disabled:opacity-55"
      >
        <AnimatePresence mode="wait" initial={false}>
          {success ? (
            <motion.span key="ok" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2">
              <Check className="size-4" /> Bienvenido
            </motion.span>
          ) : loading ? (
            <motion.span key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Validando…
            </motion.span>
          ) : (
            <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
              Ingresar al tablero <ArrowRight className="size-4" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <p className="text-center text-xs text-subtle">Los intentos de ingreso quedan registrados en la bitácora.</p>
    </motion.form>
  );
}
