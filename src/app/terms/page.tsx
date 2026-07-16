import type { Metadata } from "next";
import { FileText, ArrowRight, Shield, Users, CreditCard, FileCheck, AlertTriangle, Mail } from "lucide-react";
import { T } from "@/components/TranslatedText";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms and Conditions – Ruhulqudus Academy",
  description:
    "Read Ruhulqudus Academy's terms and conditions. Understand your rights, responsibilities, and our policies for using the platform.",
  openGraph: {
    title: "Terms and Conditions – Ruhulqudus Academy",
    description:
      "By using Ruhulqudus Academy, you agree to these terms. Learn about account rules, payments, refunds, and intellectual property.",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
  },
};

// أقسام الشروط مع الأيقونات
const sections = [
  { key: "Definitions", icon: FileText },
  { key: "Account Registration", icon: Users },
  { key: "Payments and Subscriptions", icon: CreditCard },
  { key: "Refund Policy", icon: FileCheck },
  { key: "User Conduct", icon: AlertTriangle },
  { key: "Intellectual Property", icon: Shield },
  { key: "Teacher and Third-Party Content", icon: Users },
  { key: "Limitation of Liability", icon: AlertTriangle },
  { key: "Termination", icon: FileText },
  { key: "Changes to Terms", icon: FileText },
  { key: "Governing Law", icon: Shield },
  { key: "Contact Terms", icon: Mail },
];

export default function TermsPage() {
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
            <FileText className="h-3.5 w-3.5" />
            <T>Terms Badge</T>
          </div>

          <h1 className="mt-6 font-serif text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
            <T>Terms Heading</T>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            <T>Terms Last Updated</T>
          </p>
        </div>
      </section>

      {/* ========== Intro Text ========== */}
      <section className="mx-auto max-w-5xl px-4 pb-8 md:px-8">
        <div className="glass rounded-3xl border border-border/50 bg-card p-8 shadow-elegant">
          <p className="leading-relaxed text-muted-foreground">
            <T>Terms Intro</T>
          </p>
        </div>
      </section>

      {/* ========== Terms Sections ========== */}
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-8">
        <div className="space-y-8">
          {sections.map(({ key, icon: Icon }, index) => (
            <div
              key={key}
              className="glass rounded-3xl border border-border/50 bg-card p-6 md:p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="flex items-start gap-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-semibold text-foreground">
                    {index + 1}. <T>{key}</T>
                  </h2>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    <T>{`${key} Content`}</T>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========== CTA ========== */}
      <section className="mx-auto max-w-4xl px-4 pb-20 text-center md:px-8">
        <div className="glass rounded-3xl border border-border/50 bg-card p-8 md:p-12 shadow-elegant">
          <Shield className="mx-auto h-12 w-12 text-gold" />
          <h2 className="mt-4 font-serif text-2xl font-semibold text-foreground">
            <T>Terms CTA Title</T>
          </h2>
          <p className="mt-3 max-w-xl mx-auto text-muted-foreground">
            <T>Terms CTA Text</T>
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