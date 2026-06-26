"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { T } from "@/components/TranslatedText";
import { ResendVerificationButton } from "@/components/ResendVerificationButton";
import Link from "next/link";

// المكون الداخلي الذي يستخدم useSearchParams
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

      if (!res.ok) {
        throw new Error(data.error || "Verification failed.");
      }

      const role = data.role as string;
      localStorage.setItem("userRole", role);

      setSuccess(true);

      setTimeout(() => {
        if (
          email === "abdullahhelmy114@gmail.com" ||
          email === "info@ruhulqudus.com"
        ) {
          router.push("/dashboard/admin");
        } else if (role === "teacher") {
          router.push("/dashboard/teacher");
        } else {
          router.push("/dashboard/student");
        }
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
    const pastedData = e.clipboardData
      .getData("text")
      .replace(/[^0-9]/g, "")
      .slice(0, 6);
    if (pastedData.length > 0) {
      handleInputChange(pastedData);
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center bg-background px-4 py-12">
      <div className="relative w-full max-w-xl">
        <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-amber-500/20 blur-3xl" />
        <div className="glass rounded-3xl p-8 md:p-10 shadow-elegant text-center">
          {success ? (
            <>
              <ShieldCheck className="mx-auto h-12 w-12 text-emerald-500 mb-4" />
              <h1 className="font-serif text-2xl">
                <T>Email Verified!</T>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                <T>Redirecting to your dashboard...</T>
              </p>
            </>
          ) : (
            <>
              <Mail className="mx-auto h-12 w-12 text-secondary-foreground mb-4" />
              <h1 className="font-serif text-2xl">
                <T>Enter Verification Code</T>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                <T>We sent a 6-digit code to your email.</T>
              </p>

              <div className="flex justify-center mt-6" onPaste={handlePaste}>
                <input
                  ref={hiddenInputRef}
                  type="text"
                  inputMode="numeric"
                  value={digits.join("")}
                  onChange={(e) => handleInputChange(e.target.value)}
                  maxLength={6}
                  className="absolute opacity-0 w-0 h-0"
                  autoFocus
                />
                <div className="flex gap-3">
                  {digits.map((digit, idx) => (
                    <div
                      key={idx}
                      onClick={() => hiddenInputRef.current?.focus()}
                      className={`h-14 w-11 rounded-xl border bg-background text-center text-xl font-semibold outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 cursor-text flex items-center justify-center transition-all ${
                        digit ? "border-amber-500" : "border-border"
                      }`}
                    >
                      {digit}
                    </div>
                  ))}
                </div>
              </div>

              {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={loading || digits.some((d) => d === "")}
                className="mt-6 w-full rounded-full bg-amber-500 py-3 text-sm font-semibold text-black shadow-lg hover:bg-amber-400 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  <T>Verify</T>
                )}
              </button>

              <div className="mt-4">
                <ResendVerificationButton />
              </div>
              <Link
                href="/login"
                className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline"
              >
                <ArrowLeft className="h-4 w-4" /> <T>Back to Sign In</T>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// الصفحة المصدرة مع Suspense
export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}