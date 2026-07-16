"use client";

import { useState } from "react";
import Link from "next/link";
import { T } from "@/components/TranslatedText";
import {
  Shield,
  CheckCircle,
  ArrowRight,
  Award,
  GraduationCap,
  UserPlus,
  BadgeCheck,
  Download,
  ExternalLink,
} from "lucide-react";

export function CertificationContent() {
  // محاكاة للتحقق من شهادة (يمكن تطويره لاحقاً)
  const [certId, setCertId] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "loading" | "valid" | "invalid">("idle");

  const handleVerify = () => {
    if (!certId.trim()) return;
    setVerifyStatus("loading");
    // هنا يتم استبداله بطلب API حقيقي فيما بعد
    setTimeout(() => {
      setVerifyStatus("valid"); // أو "invalid" حسب النتيجة
    }, 1500);
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
            <BadgeCheck className="h-3.5 w-3.5" />
            <T>Certification Badge</T>
          </div>

          <h1 className="mt-6 font-serif text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
            <T>Certification Heading</T>
          </h1>

          <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            <T>Certification Intro</T>
          </p>
        </div>
      </section>

      {/* ========== Teacher Certification ========== */}
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-8">
        <div className="glass relative overflow-hidden rounded-3xl border border-border/50 bg-card p-8 md:p-12 shadow-elegant">
          <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 shrink-0">
                <Shield className="h-6 w-6" />
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-semibold text-foreground">
                <T>Teacher Certification Title</T>
              </h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-8">
              <T>Teacher Certification Desc</T>
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "Complete the 'How to Teach Arabic' course.",
                "Submit a sample lesson for review.",
                "Pass an interview with Dr. Jehan.",
                "Receive your official certification.",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 bg-background/50 rounded-2xl p-4 border border-border/50">
                  <CheckCircle size={20} className="text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground"><T>{step}</T></span>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center sm:text-left">
              <Link
                href="/signup?role=teacher"
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-black shadow-gold transition hover:scale-[1.02]"
              >
                <T>Apply Now</T>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========== Student Certificate ========== */}
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-8">
        <div className="glass relative overflow-hidden rounded-3xl border border-border/50 bg-card p-8 md:p-12 shadow-elegant">
          <div className="absolute -left-16 -bottom-16 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 shrink-0">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-semibold text-foreground">
                <T>Student Certificate Title</T>
              </h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-8">
              <T>Student Certificate Desc</T>
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "Enroll in any course and complete all lessons.",
                "Pass the course quizzes and final assessment.",
                "Download your personalized certificate with your name and the instructor's signature.",
                "Share your achievement on social media or add it to your CV.",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 bg-background/50 rounded-2xl p-4 border border-border/50">
                  <CheckCircle size={20} className="text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground"><T>{step}</T></span>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center sm:text-left">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 rounded-full gradient-emerald px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:scale-[1.02]"
              >
                <T>Browse Courses</T>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========== Why Our Certificates ========== */}
<section className="mx-auto max-w-3xl px-4 py-16 md:px-8">
  <div className="glass relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/5 to-transparent p-8 shadow-elegant">
    <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gold/20 blur-2xl" />
    <div className="relative z-10 flex flex-col sm:flex-row items-start gap-5">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gold/20 text-gold shrink-0">
        <Award className="h-6 w-6" />
      </div>
      <div>
        <h3 className="font-serif text-xl font-semibold text-foreground">
          <T>Certificate Value Title</T>
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          <T>Certificate Value Desc</T>
        </p>
      </div>
    </div>
  </div>
</section>

      {/* ========== Verify Certificate ========== */}
      <section className="mx-auto max-w-3xl px-4 py-16 md:px-8">
        <div className="glass rounded-3xl border border-border/50 bg-card p-8 md:p-12 shadow-elegant">
          <div className="flex items-center gap-3 mb-4">
            <Download className="h-6 w-6 text-gold" />
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              <T>Verify Certificate Title</T>
            </h2>
          </div>
          <p className="text-muted-foreground text-sm mb-6">
            <T>Verify Certificate Desc</T>
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={certId}
              onChange={(e) => setCertId(e.target.value)}
              placeholder="Enter certificate ID"
              className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
            <button
              onClick={handleVerify}
              disabled={verifyStatus === "loading"}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-black shadow-gold transition hover:scale-[1.02] disabled:opacity-50"
            >
              {verifyStatus === "loading" ? (
                <span className="animate-pulse">Verifying...</span>
              ) : (
                <>
                  <T>Verify</T> <ExternalLink className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {verifyStatus === "valid" && (
            <div className="mt-4 flex items-center gap-2 text-emerald-600 text-sm font-medium">
              <CheckCircle size={18} />
              <T>Certificate Valid</T>
            </div>
          )}
          {verifyStatus === "invalid" && (
            <div className="mt-4 flex items-center gap-2 text-red-500 text-sm font-medium">
              <CheckCircle size={18} />
              <T>Certificate Invalid</T>
            </div>
          )}
        </div>
      </section>

      {/* ========== CTA ========== */}
      <section className="mx-auto max-w-4xl px-4 pb-20 text-center md:px-8">
        <div className="glass rounded-3xl border border-border/50 bg-card p-8 md:p-12 shadow-elegant">
          <Award className="mx-auto h-12 w-12 text-gold" />
          <h2 className="mt-4 font-serif text-2xl font-semibold text-foreground">
            <T>Join and Get Certified</T>
          </h2>
          <p className="mt-3 max-w-xl mx-auto text-muted-foreground">
            <T>Start your journey today and earn your first certificate.</T>
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
    </div>
  );
}