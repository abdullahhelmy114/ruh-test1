"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Loader2, User, MapPin, BookOpen, Globe, ArrowRight } from "lucide-react";
import { T } from "@/components/TranslatedText";

export default function OnboardingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [interests, setInterests] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>;

  const handleComplete = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/user/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          bio,
          country,
          interests,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to save");
      } else {
        // التوجيه إلى الداشبورد
        const role = localStorage.getItem("userRole");
        router.push(role === "teacher" ? "/dashboard/teacher" : "/dashboard/student");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass rounded-3xl p-8 max-w-lg w-full shadow-elegant text-center">
        {step === 1 && (
          <>
            <Globe className="mx-auto h-12 w-12 text-secondary-foreground mb-4" />
            <h1 className="font-serif text-2xl"><T>Welcome to Ruhulqudus Academy!</T></h1>
            <p className="mt-2 text-sm text-muted-foreground">
              <T>Let's set up your profile to get started.</T>
            </p>
            <button
              onClick={() => setStep(2)}
              className="mt-6 w-full rounded-full bg-amber-500 py-3 text-sm font-semibold text-black"
            >
              <T>Get Started</T> <ArrowRight className="inline h-4 w-4" />
            </button>
          </>
        )}

        {step === 2 && (
          <div className="space-y-5 text-left">
            <h2 className="font-serif text-xl text-center"><T>Tell us about yourself</T></h2>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground"><User className="inline h-3.5 w-3.5" /> <T>Bio</T></label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short introduction..." className="w-full mt-1 rounded-2xl border bg-background px-4 py-3 text-sm" rows={3} />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground"><MapPin className="inline h-3.5 w-3.5" /> <T>Country</T></label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Your country" className="w-full mt-1 rounded-2xl border bg-background px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground"><BookOpen className="inline h-3.5 w-3.5" /> <T>Interests</T></label>
              <input value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="e.g., Quran, Grammar, Conversation" className="w-full mt-1 rounded-2xl border bg-background px-4 py-3 text-sm" />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={handleComplete} disabled={saving} className="w-full rounded-full bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : <T>Complete Profile</T>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}