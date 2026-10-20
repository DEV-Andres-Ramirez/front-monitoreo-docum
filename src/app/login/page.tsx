import { Activity, BarChart3, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { FadeUp } from "@/components/ui/fade-up";
import { ThemeSwitchButton } from "@/components/ui/theme-toggle";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingreso" };

const FEATURES = [
  { icon: Activity, title: "Traza diaria por colaborador", text: "Horas, evidencia y actividad de cada persona, día a día." },
  { icon: ShieldCheck, title: "Azure DevOps en solo lectura", text: "Cada registro se asocia a una HU o tarea de las épicas, sin tocar Azure." },
  { icon: BarChart3, title: "Analítica y auditoría", text: "Cobertura, cumplimiento y bitácora completa de cambios." },
];

export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh flex-1 bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca */}
      <section className="relative hidden overflow-hidden bg-[#050b18] p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="animate-blob absolute -left-32 -top-32 h-[34rem] w-[34rem] rounded-full bg-[#00c2ff]/25 blur-3xl" />
          <div className="animate-blob absolute -bottom-40 right-0 h-[30rem] w-[30rem] rounded-full bg-[#22d400]/20 blur-3xl [animation-delay:-6s]" />
          <div className="animate-blob absolute left-1/3 top-1/2 h-80 w-80 rounded-full bg-[#0090ff]/25 blur-3xl [animation-delay:-10s]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_70%_60%_at_40%_40%,black,transparent)]" />
        </div>

        <FadeUp className="relative">
          <div className="inline-flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-2 shadow-lg">
            <Image src="/linktic_logo.png" alt="LinkTic" width={600} height={390} priority className="h-10 w-auto" />
          </div>
        </FadeUp>

        <div className="relative mt-auto max-w-xl">
          <FadeUp delay={0.1}>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7fd8ff]">Línea Docum · Uso interno</p>
            <h2 className="mt-4 font-display text-5xl font-semibold leading-[1.05] tracking-tight">
              Control diario de actividades,{" "}
              <span className="bg-gradient-to-r from-[#00c2ff] via-[#38a8ff] to-[#3ddc5a] bg-clip-text text-transparent">con traza completa.</span>
            </h2>
            <p className="mt-5 max-w-md text-base text-white/65">Proyectos 348 · SGDEA Acueducto y 005 · Positiva SGDEA, en un solo tablero para el Scrum Master.</p>
          </FadeUp>
          <ul className="mt-10 space-y-4">
            {FEATURES.map((f, i) => (
              <FadeUp key={f.title} delay={0.2 + i * 0.08}>
                <li className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#00c2ff] to-[#0090ff] shadow-lg shadow-[#0090ff]/30">
                    <f.icon className="size-5" />
                  </span>
                  <span>
                    <span className="block font-semibold">{f.title}</span>
                    <span className="block text-sm text-white/60">{f.text}</span>
                  </span>
                </li>
              </FadeUp>
            ))}
          </ul>
        </div>
        <p className="relative mt-10 text-xs text-white/40">© {2026} LinkTic · Evolucionamos contigo</p>
      </section>

      {/* Formulario */}
      <section className="app-bg relative flex items-center justify-center px-4 py-10">
        <div className="absolute right-4 top-4">
          <ThemeSwitchButton />
        </div>
        <FadeUp className="relative w-full max-w-md">
          <div className="card p-8 shadow-pop sm:p-10">
            <div className="mb-8">
              <Image src="/linktic_logo.png" alt="LinkTic" width={600} height={390} priority className="mb-6 h-14 w-auto lg:hidden" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-fg">
                <ShieldCheck className="size-3.5" /> Acceso restringido
              </span>
              <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground">Bienvenido de nuevo</h1>
              <p className="mt-1.5 text-sm text-muted">Ingresa el token único del Scrum Master para abrir el tablero.</p>
            </div>
            <LoginForm />
          </div>
          <p className="mt-6 text-center text-xs text-subtle">Monitoreo Docum · Proyectos 348 Acueducto y 005 Positiva</p>
        </FadeUp>
      </section>
    </main>
  );
}
