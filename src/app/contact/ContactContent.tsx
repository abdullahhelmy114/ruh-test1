"use client";

import { useState } from "react";
import Link from "next/link";
import { T } from "@/components/TranslatedText";
import { CustomCaptcha } from "@/components/CustomCaptcha";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  Send,
  HeartHandshake,
  Globe,
  User,
  MessageSquare,
  Loader2,
  LinkIcon,
} from "lucide-react";

export function ContactContent() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [showCaptcha, setShowCaptcha] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setShowCaptcha(true);
  };

  const handleCaptchaVerify = async (token: string) => {
    setSending(true);
    setShowCaptcha(false);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, captchaToken: token }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const err = await res.json();
        setError(err.error || "Failed to send message.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
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
            <Mail className="h-3.5 w-3.5" />
            <T>Contact Badge</T>
          </div>

          <h1 className="mt-6 font-serif text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
            <T>Contact Heading</T>
          </h1>

          <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            <T>Contact Subtitle</T>
          </p>
        </div>
      </section>

      {/* ========== Main Grid ========== */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column – Info Cards */}
          <div className="space-y-6 lg:col-span-1">
            {/* Contact Details */}
            <div className="glass rounded-3xl border border-border/50 bg-card p-6 shadow-sm">
              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 shrink-0">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      <T>Contact Address Title</T>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      <T>Contact Address</T>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 shrink-0">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      <T>Contact Email Title</T>
                    </h3>
                    <a
                      href="mailto:info@ruhulqudus.com"
                      className="text-sm text-gold hover:underline"
                    >
                      info@ruhulqudus.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 shrink-0">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      <T>Contact Phone Title</T>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      +90 551 899 87 16
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Working Hours */}
            <div className="glass rounded-3xl border border-border/50 bg-card p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    <T>Working Hours Title</T>
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <T>Working Hours Content</T>
                  </p>
                </div>
              </div>
            </div>

            {/* Follow Us */}
            <div className="glass rounded-3xl border border-border/50 bg-card p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Globe className="h-4 w-4 text-emerald-600" />
                <T>Follow Us Title</T>
              </h3>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href="https://youtube.com/@ruhulqudus"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-muted-foreground hover:text-red-500 hover:border-red-500 transition-colors"
                >
                  <LinkIcon className="h-4 w-4" />
                  <T>YouTube</T>
                </a>
                <a
                  href="https://instagram.com/ruhulqudus"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-muted-foreground hover:text-pink-500 hover:border-pink-500 transition-colors"
                >
                  <LinkIcon className="h-4 w-4" />
                  <T>Instagram</T>
                </a>
                <a
                  href="https://facebook.com/ruhulqudus"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-muted-foreground hover:text-blue-600 hover:border-blue-600 transition-colors"
                >
                  <LinkIcon className="h-4 w-4" />
                  <T>Facebook</T>
                </a>
              </div>
            </div>
          </div>

          {/* Right Column – Contact Form */}
          <div className="lg:col-span-2">
            <div className="glass rounded-3xl border border-border/50 bg-card p-8 shadow-elegant">
              <h2 className="font-serif text-2xl font-semibold text-foreground flex items-center gap-2">
                <Send className="h-5 w-5 text-gold" />
                <T>Contact Form Title</T>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                <T>Contact Form Subtitle</T>
              </p>

              <div className="mt-8">
                {sent ? (
                  <div className="text-center py-10">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 mb-4">
                      <Send className="h-8 w-8" />
                    </div>
                    <h3 className="font-serif text-2xl font-semibold text-foreground">
                      <T>Message Sent!</T>
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      <T>We'll get back to you shortly.</T>
                    </p>
                  </div>
                ) : showCaptcha ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <p className="text-sm text-muted-foreground mb-4">
                      <T>Human Verification</T>
                    </p>
                    <CustomCaptcha onVerify={handleCaptchaVerify} />
                    <button
                      type="button"
                      onClick={() => setShowCaptcha(false)}
                      className="mt-4 text-sm text-muted-foreground hover:text-foreground underline"
                    >
                      <T>Cancel</T>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <User size={14} /> <T>Name</T>
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <Mail size={14} /> <T>Email</T>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                        dir="ltr"
                        placeholder="you@example.com"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <MessageSquare size={14} /> <T>Message</T>
                      </label>
                      <textarea
                        rows={5}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                        placeholder="How can we help?"
                      />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <button
                      type="submit"
                      disabled={sending}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full gradient-emerald px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                      <T>Send Message</T>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== Partnerships ========== */}
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-8">
        <div className="glass relative overflow-hidden rounded-3xl border border-border/50 bg-card p-8 md:p-12 shadow-elegant">
          <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-start gap-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 shrink-0">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                <T>Partnerships Title</T>
              </h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                <T>Partnerships Content</T>
              </p>
              <a
                href="mailto:partners@ruhulqudus.com"
                className="mt-4 inline-flex items-center gap-2 text-gold hover:text-gold/80 font-medium"
              >
                partners@ruhulqudus.com <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ========== CTA ========== */}
      <section className="mx-auto max-w-4xl px-4 pb-20 text-center md:px-8">
        <div className="glass rounded-3xl border border-border/50 bg-card p-8 md:p-12 shadow-elegant">
          <Send className="mx-auto h-12 w-12 text-gold" />
          <h2 className="mt-4 font-serif text-2xl font-semibold text-foreground">
            <T>Contact CTA Title</T>
          </h2>
          <p className="mt-3 max-w-xl mx-auto text-muted-foreground">
            <T>Contact CTA Text</T>
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