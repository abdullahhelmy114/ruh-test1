"use client";

import { useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import Link from "next/link";
import { T } from "@/components/TranslatedText";
import {
  DollarSign,
  Users,
  Gift,
  Copy,
  CheckCircle,
  ArrowRight,
  Share2,
  BarChart3,
  Wallet,
  PiggyBank,
  HelpCircle,
} from "lucide-react";

export function AffiliateContent() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const referralCode = user?.uid?.slice(0, 8) || "signup";

  const referralLink = `https://ruhulqudus.net/r/${referralCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <DollarSign className="h-3.5 w-3.5" />
            <T>Affiliate Badge</T>
          </div>

          <h1 className="mt-6 font-serif text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
            <T>Affiliate Heading</T>
          </h1>

          <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            <T>Affiliate Subtitle</T>
          </p>
        </div>
      </section>

      {/* ========== How It Works ========== */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="text-center mb-12">
          <h2 className="font-serif text-3xl font-semibold text-foreground">
            <T>How It Works</T>
          </h2>
          <p className="mt-2 text-muted-foreground">
            <T>How It Works Desc</T>
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {[
            { step: "1", icon: Share2, key: "Affiliate Step 1 Title", descKey: "Affiliate Step 1 Desc" },
            { step: "2", icon: Gift, key: "Affiliate Step 2 Title", descKey: "Affiliate Step 2 Desc" },
            { step: "3", icon: Wallet, key: "Affiliate Step 3 Title", descKey: "Affiliate Step 3 Desc" },
          ].map((item) => (
            <div
              key={item.step}
              className="glass rounded-3xl border border-border/50 bg-card p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
                <item.icon className="h-7 w-7" />
              </div>
              <h3 className="mt-5 font-serif text-xl font-semibold text-foreground">
                <T>{item.key}</T>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                <T>{item.descKey}</T>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ========== Why Join ========== */}
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-8">
        <div className="glass relative overflow-hidden rounded-3xl border border-border/50 bg-card p-8 md:p-12 shadow-elegant">
          <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 shrink-0">
                <PiggyBank className="h-6 w-6" />
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-semibold text-foreground">
                <T>Why Join Affiliate Title</T>
              </h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-6">
              <T>Why Join Affiliate Desc</T>
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { key: "High Commission Rate", desc: "Earn 20% on every successful referral." },
                { key: "Real-Time Tracking", desc: "Monitor your referrals and earnings in your dashboard." },
                { key: "Easy Withdrawals", desc: "Request payouts via PayPal or bank transfer." },
                { key: "Dedicated Support", desc: "Our team helps you succeed as an affiliate partner." },
              ].map((item) => (
                <div key={item.key} className="flex items-start gap-3 bg-background/50 rounded-2xl p-4 border border-border/50">
                  <CheckCircle size={20} className="text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground"><T>{item.key}</T></h4>
                    <p className="text-xs text-muted-foreground"><T>{item.desc}</T></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========== Referral Link (للمستخدمين المسجلين) ========== */}
      {user ? (
        <section className="mx-auto max-w-3xl px-4 py-16 md:px-8">
          <div className="glass rounded-3xl border border-border/50 bg-card p-8 text-center shadow-elegant">
            <Share2 className="mx-auto h-12 w-12 text-gold" />
            <h2 className="mt-4 font-serif text-2xl font-semibold text-foreground">
              <T>Your Referral Link</T>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <T>Share this link with your friends and earn!</T>
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <code className="rounded-full border border-border bg-background px-5 py-2.5 text-sm font-mono">
                {referralLink}
              </code>
              <button
                onClick={copyLink}
                className="inline-flex items-center justify-center rounded-full bg-gold p-2.5 text-black hover:bg-gold/90 transition"
                title="Copy link"
              >
                {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
              </button>
            </div>
            {copied && (
              <p className="mt-2 text-xs text-emerald-600 font-medium">
                <T>Link Copied!</T>
              </p>
            )}
          </div>
        </section>
      ) : (
        /* ========== CTA for non‑authenticated users ========== */
        <section className="mx-auto max-w-4xl px-4 pb-20 text-center md:px-8">
          <div className="glass rounded-3xl border border-border/50 bg-card p-8 md:p-12 shadow-elegant">
            <DollarSign className="mx-auto h-12 w-12 text-gold" />
            <h2 className="mt-4 font-serif text-2xl font-semibold text-foreground">
              <T>Start Earning Today</T>
            </h2>
            <p className="mt-3 max-w-xl mx-auto text-muted-foreground">
              <T>Join our affiliate program and earn 20% on every referral.</T>
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/signup?role=student"
                className="inline-flex items-center gap-2 rounded-full gradient-emerald px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:scale-[1.02]"
              >
                <T>Join as Student</T>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/signup?role=teacher"
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-black shadow-gold transition hover:scale-[1.02]"
              >
                <T>Join as Teacher</T>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ========== FAQ (أسئلة متكررة) ========== */}
      <section className="mx-auto max-w-5xl px-4 pb-20 md:px-8">
        <div className="glass rounded-3xl border border-border/50 bg-card p-8 md:p-12 shadow-elegant">
          <div className="flex items-center gap-3 mb-6">
            <HelpCircle className="h-6 w-6 text-gold" />
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              <T>Affiliate FAQ Title</T>
            </h2>
          </div>

          <div className="space-y-4">
            {[
              { q: "FAQ 1 Question", a: "FAQ 1 Answer" },
              { q: "FAQ 2 Question", a: "FAQ 2 Answer" },
              { q: "FAQ 3 Question", a: "FAQ 3 Answer" },
            ].map((faq, i) => (
              <details key={i} className="group">
                <summary className="flex cursor-pointer items-center justify-between rounded-2xl bg-background/50 px-5 py-4 text-sm font-medium text-foreground">
                  <T>{faq.q}</T>
                  <ArrowRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                </summary>
                <p className="px-5 py-3 text-sm text-muted-foreground">
                  <T>{faq.a}</T>
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}