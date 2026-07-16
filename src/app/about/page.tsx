import type { Metadata } from "next";
import {
  Sparkles,
  Globe,
  GraduationCap,
  BookOpen,
  Users,
  Award,
  ArrowRight,
  Library,
  Gamepad2,
  HeartHandshake,
  ShieldCheck,
} from "lucide-react";
import { T } from "@/components/TranslatedText";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Ruhulqudus Academy – Our Mission & Vision",
  description:
    "Learn about Ruhulqudus Academy, founded by Dr. Jehan Ali Ziad. We teach Arabic and the Holy Quran with excellence, live mentorship, and a timeless curriculum.",
  openGraph: {
    title: "About Ruhulqudus Academy",
    description:
      "An elite digital institution for the Arabic language and Quran, combining classical pedagogy with modern technology.",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
  },
};

const features = [
  { key: "Methodology", icon: BookOpen },
  { key: "Teachers", icon: Users },
  { key: "Library", icon: Library },
  { key: "Gamified", icon: Gamepad2 },
  { key: "Community", icon: HeartHandshake },
  { key: "Certificates", icon: ShieldCheck },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ========== Header ========== */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/3 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
          <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 text-center md:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold">
            <Sparkles className="h-3.5 w-3.5" />
            <T>About Badge</T>
          </div>

          <h1 className="mt-6 font-serif text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
            <T>About Heading</T>
          </h1>

          <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            <T>About Intro</T>
          </p>
        </div>
      </section>

      {/* ========== Vision & Mission ========== */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="group glass rounded-3xl border border-border/50 bg-card p-8 shadow-elegant transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 group-hover:scale-110 transition-transform">
              <Globe className="h-6 w-6" />
            </div>
            <h2 className="mt-5 font-serif text-2xl font-semibold text-foreground">
              <T>Vision Title</T>
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              <T>Vision Content</T>
            </p>
          </div>

          <div className="group glass rounded-3xl border border-border/50 bg-card p-8 shadow-elegant transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 group-hover:scale-110 transition-transform">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h2 className="mt-5 font-serif text-2xl font-semibold text-foreground">
              <T>Mission Title</T>
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              <T>Mission Content</T>
            </p>
          </div>
        </div>
      </section>

      {/* ========== What Makes Us Special ========== */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-gold ornament">
            <T>Features Title</T>
          </div>
          <h2 className="mt-3 font-serif text-4xl">
            <T>Features Subtitle</T>
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className="group glass rounded-3xl border border-border/50 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 group-hover:scale-110 transition-transform">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-serif text-xl font-semibold text-foreground">
                <T>{`${key} Feature`}</T>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                <T>{`${key} Desc`}</T>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ========== Founder ========== */}
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-8">
        <div className="glass relative overflow-hidden rounded-3xl border border-border/50 bg-card p-8 md:p-12 shadow-elegant">
          <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="relative z-10">
            <Award className="h-12 w-12 text-gold" />
            <h2 className="mt-4 font-serif text-3xl font-semibold text-foreground">
              <T>Founder Name</T>
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
              <T>Founder Description</T>
            </p>
          </div>
        </div>
      </section>

      {/* ========== CTA ========== */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center md:px-8">
        <div className="glass rounded-3xl border border-border/50 bg-card p-8 md:p-12 shadow-elegant">
          <GraduationCap className="mx-auto h-12 w-12 text-gold" />
          <h2 className="mt-4 font-serif text-3xl font-semibold text-foreground">
            <T>CTA Join Title</T>
          </h2>
          <p className="mt-3 max-w-xl mx-auto text-muted-foreground">
            <T>CTA Join Desc</T>
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup?role=student"
              className="inline-flex items-center gap-2 rounded-full gradient-emerald px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:scale-[1.02]"
            >
              <T>CTA Student</T>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/signup?role=teacher"
              className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-black shadow-gold transition hover:scale-[1.02]"
            >
              <T>CTA Teacher</T>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}