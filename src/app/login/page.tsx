import type { Metadata } from "next";
import Image from "next/image";
import { FadeUp } from "@/components/ui/fade-up";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingreso · Monitoreo Docum" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-[#f2f8ff] px-4 py-10">
      {/* Fondo animado de marca */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-blob absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-brand-sky/30 blur-3xl" />
        <div className="animate-blob absolute -bottom-32 -right-16 h-[30rem] w-[30rem] rounded-full bg-brand-lime/25 blur-3xl [animation-delay:-5s]" />
        <div className="animate-blob absolute left-1/3 top-1/2 h-72 w-72 rounded-full bg-brand-blue/20 blur-3xl [animation-delay:-9s]" />
        <div className="absolute inset-0 bg-[radial-gradient(#0090ff14_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>

      <FadeUp className="relative w-full max-w-md">
        <div className="glass rounded-3xl border border-white/70 p-8 shadow-[0_30px_80px_-20px_rgba(0,80,160,0.35)] sm:p-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <Image src="/linktic_logo.png" alt="LinkTic" width={600} height={368} priority className="h-auto w-44" />
            <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-foreground">
              Monitoreo de actividades
            </h1>
            <p className="mt-1.5 text-sm text-muted">Tablero de control del Scrum Master · Docum</p>
          </div>
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Uso interno LinkTic · Proyectos 348 Acueducto y 005 Positiva
        </p>
      </FadeUp>
    </main>
  );
}
