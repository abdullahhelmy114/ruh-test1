"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
// ✅ تمت إضافة AlertCircle هنا
import { Mail, ArrowLeft, Loader2, ShieldCheck, AlertCircle } from "lucide-react"; 
import { motion } from "framer-motion";
import { T } from "@/components/TranslatedText";
import { ResendVerificationButton } from "@/components/ResendVerificationButton";
import Link from "next/link";
// ✅ تمت إضافة استيراد زر Button هنا
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hiddenInputRef.current?.focus();
  }, []);

  const handleInputChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, "").slice(0, 6);
    const newDigits = Array(6).fill("");
    numericValue.split("").forEach((char, index) => {
      if (index < 6) newDigits[index] = char;
    });
    setDigits(newDigits);
  };

  const handleSubmit = async () => {
    const fullCode = digits.join("");
    if (fullCode.length < 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }
    if (!email) {
      setError("No email found. Please sign up again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/verify-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: fullCode }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Verification failed.");

      const role = data.role as string;
      localStorage.setItem("userRole", role);

      setSuccess(true);

      setTimeout(() => {
        if (role === "admin") router.push("/dashboard/admin");
        else if (role === "teacher") router.push("/dashboard/teacher");
        else router.push("/dashboard/student");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      setDigits(Array(6).fill(""));
      hiddenInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (pastedData.length > 0) handleInputChange(pastedData);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Ambient Lights */}
      <div aria-hidden="true" className="pointer-events-none absolute top-0 left-0 -z-10 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      
      <div className="relative w-full max-w-lg">
        <motion.div 
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="rounded-3xl bg-card p-8 md:p-10 shadow-elegant text-center"
        >
          {success ? (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4">
              <ShieldCheck className="mx-auto h-16 w-16 text-primary" />
              <h1 className="font-serif text-3xl text-primary"><T>Email Verified!</T></h1>
              <p className="text-muted-foreground"><T>Redirecting to your dashboard...</T></p>
            </motion.div>
          ) : (
            <>
              <Mail className="mx-auto h-14 w-14 text-primary/80 mb-6" />
              <h1 className="font-serif text-3xl text-primary mb-2"><T>Check Your Email</T></h1>
              <p className="text-sm text-muted-foreground mb-8">
                <T>We sent a 6-digit code to</T> <strong className="text-foreground">{email}</strong>
              </p>

              <div className="flex justify-center mb-8" onPaste={handlePaste}>
                <input
                  ref={hiddenInputRef} type="text" inputMode="numeric" value={digits.join("")}
                  onChange={(e) => handleInputChange(e.target.value)} maxLength={6}
                  className="absolute opacity-0 w-0 h-0" autoFocus
                />
                <div className="flex gap-2 sm:gap-3 direction-ltr" dir="ltr">
                  {digits.map((digit, idx) => (
                    <div
                      key={idx} onClick={() => hiddenInputRef.current?.focus()}
                      className={`h-14 w-10 sm:h-16 sm:w-12 rounded-xl bg-background text-center text-2xl font-bold text-foreground outline-none ring-1 transition-all cursor-text flex items-center justify-center ${
                        digit ? "ring-primary shadow-sm" : "ring-primary/20"
                      } focus-within:ring-2 focus-within:ring-primary`}
                    >
                      {digit}
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mb-6 flex items-center justify-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" /> {error}
                </div>
              )}

              <Button
                onClick={handleSubmit} disabled={loading || digits.some((d) => d === "")}
                className="w-full rounded-full bg-primary hover:bg-primary/90 py-6 text-base font-semibold text-primary-foreground shadow-elegant"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <T>Verify Account</T>}
              </Button>

              <div className="mt-6 flex flex-col items-center gap-4">
                <ResendVerificationButton />
                <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ArrowLeft className="h-4 w-4" /> <T>Back to Sign In</T>
                </Link>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}