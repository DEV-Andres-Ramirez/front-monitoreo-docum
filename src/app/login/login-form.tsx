"use client";

import { ArrowRight, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { motion, useAnimationControls } from "motion/react";
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

  return (
    <motion.form
      onSubmit={onSubmit}
      animate={controls}
      className="space-y-4"
    >
      <label htmlFor="token" className="block text-sm font-medium text-foreground">
        Token de acceso
      </label>
      <div
        className={`group flex items-center gap-2 rounded-2xl border bg-white px-4 transition-all focus-within:ring-4 ${
          error
            ? "border-red-300 focus-within:ring-red-100"
            : "border-line focus-within:border-brand-blue focus-within:ring-brand-blue/15"
        }`}
      >
        <KeyRound className="size-5 shrink-0 text-muted transition-colors group-focus-within:text-brand-blue" />
        <input
          id="token"
          name="token"
          type={visible ? "text" : "password"}
          autoComplete="current-password"
          autoFocus
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Ingresa tu token único"
          className="h-13 w-full bg-transparent py-3.5 text-base outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="rounded-lg p-1.5 text-muted transition hover:bg-slate-100 hover:text-foreground"
          aria-label={visible ? "Ocultar token" : "Mostrar token"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      <motion.p
        initial={false}
        animate={{ opacity: error ? 1 : 0, height: error ? "auto" : 0 }}
        className="overflow-hidden text-sm font-medium text-red-600"
        role="alert"
      >
        {error}
      </motion.p>

      <motion.button
        type="submit"
        disabled={loading || !token.trim()}
        whileHover={{ scale: loading ? 1 : 1.015 }}
        whileTap={{ scale: 0.98 }}
        className="relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-sky via-brand-blue to-brand-blue font-semibold text-white shadow-lg shadow-brand-blue/30 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      >
        {success ? (
          "Bienvenido"
        ) : loading ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Validando…
          </>
        ) : (
          <>
            Ingresar <ArrowRight className="size-4" />
          </>
        )}
      </motion.button>
    </motion.form>
  );
}
