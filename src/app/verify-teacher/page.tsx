"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, AlertCircle, CheckCircle } from "lucide-react";
import { T } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// مكون داخلي يستخدم useSearchParams بأمان
function VerifyTeacherContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const router = useRouter();

  const [emailCode, setEmailCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!email) {
      router.replace("/signup/teacher");
    }
  }, [email, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/verify-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, emailCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Verification failed");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="relative w-full max-w-md">
        <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-amber-500/20 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="glass overflow-hidden rounded-3xl bg-card p-8 shadow-elegant md:p-10"
        >
          {!success ? (
            <>
              <div className="mb-8 text-center">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-foreground">
                  <T>Ruhulqudus Academy</T>
                </div>
                <h1 className="mt-3 font-serif text-3xl md:text-4xl">
                  <T>Verify Your Account</T>
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  <T>We sent a verification code to your email</T>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="emailCode">
                    <Mail className="inline h-4 w-4 mr-1 text-gold" />{" "}
                    <T>Email Code</T>
                  </Label>
                  <Input
                    id="emailCode"
                    type="text"
                    required
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    placeholder="123456"
                    className="mt-1"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" /> {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-linear-to-r from-amber-500 to-amber-600 py-3.5 text-sm font-semibold tracking-wide text-white shadow-elegant hover:scale-[1.01] transition-transform"
                >
                  {loading ? <T>Verifying...</T> : <T>Verify</T>}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-6">
              <CheckCircle className="mx-auto h-16 w-16 text-emerald-500" />
              <h2 className="text-2xl font-bold"><T>Application Submitted!</T></h2>
              <p className="text-muted-foreground">
                <T>Your application has been received and will be reviewed shortly. We will contact you soon.</T>
              </p>
              <Button
                onClick={() => router.push("/")}
                className="rounded-full bg-amber-500 hover:bg-amber-600 text-white"
              >
                <T>Back to Home</T>
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// مكون الصفحة الرئيسي مع Suspense
export default function VerifyTeacherPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center">Loading...</div>}>
      <VerifyTeacherContent />
    </Suspense>
  );
}