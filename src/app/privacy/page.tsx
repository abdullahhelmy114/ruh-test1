import type { Metadata } from "next";
import { Shield, Lock, Cookie, Mail, ArrowRight } from "lucide-react";
import { T } from "@/components/TranslatedText";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy – Ruhulqudus Academy",
  description:
    "Read Ruhulqudus Academy's privacy policy. We protect your data, use secure payment gateways, and never sell your information to third parties.",
  openGraph: {
    title: "Privacy Policy – Ruhulqudus Academy",
    description:
      "Your privacy is important to us. Learn how we collect, use, and safeguard your personal information.",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
  },
};

// تعريف أقسام السياسة لتسهيل العرض
const sections = [
  { key: "Information We Collect", icon: Shield },
  { key: "How We Use Your Data", icon: Lock },
  { key: "Data Protection", icon: Shield },
  { key: "Information Sharing", icon: Lock },
  { key: "Cookies", icon: Cookie },
  { key: "Your Rights", icon: Shield },
  { key: "Children Privacy", icon: Lock },
  { key: "Policy Changes", icon: Shield },
  { key: "Contact Privacy", icon: Mail },
];

export default function PrivacyPage() {
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
            <Shield className="h-3.5 w-3.5" />
            <T>Privacy Badge</T>
          </div>

          <h1 className="mt-6 font-serif text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
            <T>Privacy Heading</T>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            <T>Privacy Last Updated</T>
          </p>
        </div>
      </section>

      {/* ========== Policy Sections ========== */}
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-8">
        <div className="space-y-8">
          {sections.map(({ key, icon: Icon }) => (
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
                    <T>{key}</T>
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

      {/* ========== Contact Info ========== */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center md:px-8">
        <div className="glass rounded-3xl border border-border/50 bg-card p-8 md:p-12 shadow-elegant">
          <Mail className="mx-auto h-12 w-12 text-gold" />
          <h2 className="mt-4 font-serif text-2xl font-semibold text-foreground">
            <T>Privacy Contact Title</T>
          </h2>
          <p className="mt-3 max-w-xl mx-auto text-muted-foreground">
            <T>Privacy Contact Text</T>
          </p>
          <a
            href="mailto:info@ruhulqudus.com"
            className="mt-4 inline-flex items-center gap-2 text-gold hover:text-gold/80 font-medium"
          >
            info@ruhulqudus.com <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* ========== CTA ========== */}
      <section className="mx-auto max-w-4xl px-4 pb-20 text-center md:px-8">
        <div className="glass rounded-3xl border border-border/50 bg-card p-8 md:p-12 shadow-elegant">
          <Shield className="mx-auto h-12 w-12 text-gold" />
          <h2 className="mt-4 font-serif text-2xl font-semibold text-foreground">
            <T>Privacy Trust Title</T>
          </h2>
          <p className="mt-3 max-w-xl mx-auto text-muted-foreground">
            <T>Privacy Trust Text</T>
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