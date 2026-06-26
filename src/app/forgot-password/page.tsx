"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowLeft, Loader2, Send, CheckCircle } from "lucide-react";
import Link from "next/link";
import { T } from "@/components/TranslatedText";
import {AlertCircle} from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: false,
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center bg-background px-4 py-12">
      <div className="relative w-full max-w-md">
        <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-amber-500/20 blur-3xl" />

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass rounded-3xl p-8 md:p-10 shadow-elegant text-center"
            >
              <CheckCircle className="mx-auto h-14 w-14 text-emerald-500 mb-4" />
              <h1 className="font-serif text-2xl"><T>Check Your Email</T></h1>
              <p className="mt-3 text-sm text-muted-foreground">
                <T>We have sent a password reset link to your email address.</T>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                <T>Please check your inbox (and spam folder) and follow the link to reset your password.</T>
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-2 text-accent-foreground hover:underline font-medium"
              >
                <ArrowLeft size={16} /> <T>Back to Sign In</T>
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass overflow-hidden rounded-3xl bg-card p-8 shadow-elegant md:p-10"
            >
              <div className="mb-6 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 mb-4">
                  <Mail className="h-7 w-7 text-secondary-foreground" />
                </div>
                <h1 className="font-serif text-2xl md:text-3xl"><T>Forgot Password?</T></h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  <T>No worries! Enter your email and we'll send you a reset link.</T>
                </p>
              </div>

              <form onSubmit={handleReset} className="space-y-5">
                <div>
                  <label htmlFor="reset-email" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Mail className="mr-1 inline h-3.5 w-3.5 text-gold" /> <T>Email</T>
                  </label>
                  <input
                    id="reset-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none ring-ring/30 transition focus:ring-2 focus:ring-gold"
                    dir="ltr"
                    placeholder="you@example.com"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" /> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full rounded-full bg-amber-500 py-3.5 text-sm font-semibold text-black shadow-lg hover:bg-amber-400 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send size={16} />
                      <T>Send Reset Link</T>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft size={16} /> <T>Back to Sign In</T>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}