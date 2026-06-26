"use client";

import { useEffect, useState } from "react";
import { T } from "@/components/TranslatedText";
import { GraduationCap, ArrowRight, UserPlus } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/AuthProvider";

export default function AssessmentsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState<any>(null);

  useEffect(() => {
    fetch('/api/pages/assessments')
      .then(r => r.json())
      .then(d => setPage(d.page))
      .catch(() => setPage({
        title: "Placement Tests",
        content: "Find your perfect starting point."
      }));
  }, []);

  if (!page) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 md:px-8">
      <div className="text-center mb-10">
        <GraduationCap className="mx-auto h-12 w-12 text-secondary-foreground mb-4" />
        <h1 className="font-serif text-4xl">{page.title}</h1>
        <p className="mt-2 text-muted-foreground">{page.content}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {[
          { title: "Beginner (A1-A2)", desc: "For those new to Arabic." },
          { title: "Intermediate (B1-B2)", desc: "You can read and hold basic conversations." },
          { title: "Advanced (C1-C2)", desc: "You aim for fluency and classical texts." },
          { title: "Quranic Arabic", desc: "Focus on Quranic vocabulary and grammar." },
        ].map((test) => (
          <div key={test.title} className="glass rounded-3xl p-6 text-center">
            <h3 className="font-serif text-xl"><T>{test.title}</T></h3>
            <p className="text-sm text-muted-foreground mt-2"><T>{test.desc}</T></p>
            <Link href="#" className="mt-4 inline-flex items-center gap-2 text-accent-foreground hover:underline text-sm font-medium">
              <T>Start Test</T> <ArrowRight size={16} />
            </Link>
          </div>
        ))}
      </div>

      {!user && (
        <div className="mt-12 text-center">
          <div className="glass rounded-3xl p-8 inline-block">
            <UserPlus className="mx-auto h-12 w-12 text-secondary-foreground mb-4" />
            <h2 className="font-serif text-2xl mb-2"><T>Ready to start learning?</T></h2>
            <p className="text-muted-foreground mb-6"><T>Join now and take the placement test.</T></p>
            <div className="flex justify-center gap-3">
              <Link href="/signup?role=student" className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 inline-flex items-center gap-2">
                <T>Join as Student</T> <ArrowRight size={16} />
              </Link>
              <Link href="/signup?role=teacher" className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 inline-flex items-center gap-2">
                <T>Join as Teacher</T> <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}