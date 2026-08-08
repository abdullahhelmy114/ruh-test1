"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { T } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";

function VerifyTeacherContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const router = useRouter();

  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!email) router.replace("/signup/teacher");
    hiddenInputRef.current?.focus();
  }, [email, router]);

  const handleInputChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, "").slice(0, 6);
    const newDigits = Array(6).fill("");
    numericValue.split("").forEach((char, index) => {
      if (index < 6) newDigits[index] = char;
    });
    setDigits(newDigits);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (pastedData.length > 0) handleInputChange(pastedData);
  };

  const handleSubmit = async () => {
    const emailCode = digits.join("");
    if (emailCode.length < 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/verify-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, emailCode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification failed");

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
      setDigits(Array(6).fill(""));
      hiddenInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-12 relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 -z-10 h-[500px] w-[500px] rounded-full bg-gold/10 blur-[120px]" />
      
      <div className="relative w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="rounded-3xl bg-card p-8 md:p-10 shadow-elegant text-center"
        >
          {!success ? (
            <>
              <Mail className="mx-auto h-14 w-14 text-gold mb-6" />
              <h1 className="font-serif text-3xl text-primary mb-2"><T>Verify Your Account</T></h1>
              <p className="text-sm text-muted-foreground mb-8">
                <T>We sent a verification code to</T> <strong className="text-foreground">{email}</strong>
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
                        digit ? "ring-gold shadow-sm" : "ring-primary/20"
                      } focus-within:ring-2 focus-within:ring-gold`}
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
                className="w-full rounded-full bg-gold hover:bg-gold/90 py-6 text-base font-semibold text-primary-foreground shadow-gold"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <T>Verify Application</T>}
              </Button>
            </>
          ) : (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-6">
              <CheckCircle className="mx-auto h-16 w-16 text-primary" />
              <h2 className="text-3xl font-serif text-primary"><T>Application Submitted!</T></h2>
              <p className="text-muted-foreground leading-relaxed">
                <T>Your application has been received and will be reviewed shortly. We will contact you soon.</T>
              </p>
              <Button onClick={() => router.push("/")} className="w-full rounded-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 font-semibold">
                <T>Back to Home</T>
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </main>
  );
}

export default function VerifyTeacherPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><Loader2 className="h-10 w-10 animate-spin text-gold" /></div>}>
      <VerifyTeacherContent />
    </Suspense>
  );
}