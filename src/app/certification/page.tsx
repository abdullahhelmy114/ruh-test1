"use client";

import { useEffect, useState } from "react";
import { T } from "@/components/TranslatedText";
import { Shield, CheckCircle, ArrowRight, Award, GraduationCap, UserPlus } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/AuthProvider";

export default function CertificationPage() {
  const { user } = useAuth();
  const [page, setPage] = useState<any>(null);

  useEffect(() => {
    fetch('/api/pages/certification')
      .then(r => r.json())
      .then(d => setPage(d.page))
      .catch(() => setPage({ title: "Certifications", content: "Earn recognized credentials at Ruhulqudus Academy." }));
  }, []);

  if (!page) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 md:px-8">
      <div className="text-center mb-10">
        <Shield className="mx-auto h-12 w-12 text-secondary-foreground mb-4" />
        <h1 className="font-serif text-4xl">{page.title}</h1>
        <p className="mt-2 text-muted-foreground">{page.content}</p>
      </div>

      <div className="glass rounded-3xl p-8 md:p-10 space-y-6 mb-8">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-secondary-foreground" />
          <h2 className="font-serif text-2xl text-accent-foreground"><T>Teacher Certification</T></h2>
        </div>
        <p className="text-muted-foreground"><T>Become a certified Ruhulqudus instructor and teach Arabic professionally.</T></p>
        <div className="space-y-3">
          {[
            "Complete the 'How to Teach Arabic' course.",
            "Submit a sample lesson for review.",
            "Pass an interview with Dr. Gehan.",
            "Receive your official certification.",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <CheckCircle size={18} className="text-emerald-500 mt-0.5" />
              <span className="text-muted-foreground"><T>{step}</T></span>
            </div>
          ))}
        </div>
        <div className="text-center pt-2">
          <Link href="/signup?role=teacher" className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-black hover:bg-amber-400">
            <T>Apply Now</T> <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <div className="glass rounded-3xl p-8 md:p-10 space-y-6 mb-8">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-emerald-500" />
          <h2 className="font-serif text-2xl text-emerald-600"><T>Student Certificate</T></h2>
        </div>
        <p className="text-muted-foreground"><T>Receive a Certificate of Completion for every course you finish.</T></p>
        <div className="space-y-3">
          {[
            "Enroll in any course and complete all lessons.",
            "Pass the course quizzes and final assessment.",
            "Download your personalized certificate with your name and the instructor's signature.",
            "Share your achievement on social media or add it to your CV.",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <CheckCircle size={18} className="text-emerald-500 mt-0.5" />
              <span className="text-muted-foreground"><T>{step}</T></span>
            </div>
          ))}
        </div>
        <div className="text-center pt-2">
          <Link href="/marketplace" className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
            <T>Browse Courses</T> <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {!user && (
        <div className="mt-8 text-center">
          <div className="glass rounded-3xl p-8 inline-block">
            <UserPlus className="mx-auto h-12 w-12 text-secondary-foreground mb-4" />
            <h2 className="font-serif text-2xl mb-2"><T>Join and Get Certified</T></h2>
            <p className="text-muted-foreground mb-6"><T>Start your journey today and earn your first certificate.</T></p>
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