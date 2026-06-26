"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { T } from "@/components/TranslatedText";
import { Lock, Loader2, CheckCircle, AlertCircle } from "lucide-react";

// مكون فرعي يستخدم useSearchParams – يجب تغليفه بـ Suspense
function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  useEffect(() => {
    if (!oobCode) {
      setError("Invalid reset link.");
      setValidating(false);
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then(() => setValidating(false))
      .catch(() => {
        setError("This link has expired or is invalid.");
        setValidating(false);
      });
  }, [oobCode]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: any) {
      setError(err.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="grid min-h-[calc(100vh-4rem)] place-items-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !oobCode) {
    return (
      <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-4">
        <div className="glass rounded-3xl p-8 text-center max-w-md">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <p className="text-muted-foreground"><T>{error}</T></p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-4">
        <div className="glass rounded-3xl p-8 md:p-10 shadow-elegant text-center max-w-md">
          <CheckCircle className="mx-auto h-12 w-12 text-emerald-500 mb-4" />
          <h1 className="font-serif text-2xl"><T>Password Reset!</T></h1>
          <p className="mt-2 text-muted-foreground"><T>Redirecting to login...</T></p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center bg-background px-4 py-12">
      <div className="relative w-full max-w-md">
        <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-amber-500/20 blur-3xl" />
        <div className="glass rounded-3xl p-8 md:p-10 shadow-elegant text-center">
          <Lock className="mx-auto h-12 w-12 text-secondary-foreground mb-4" />
          <h1 className="font-serif text-2xl"><T>New Password</T></h1>
          <p className="mt-2 text-sm text-muted-foreground"><T>Enter your new password below.</T></p>
          <form onSubmit={handleReset} className="mt-6 space-y-5">
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gold"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full rounded-full bg-amber-500 py-3 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
            >
              {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : <T>Reset Password</T>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// الصفحة الأساسية – تغليف المكون بـ Suspense
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[calc(100vh-4rem)] place-items-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}