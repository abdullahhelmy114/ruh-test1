"use client";

import { useEffect, useState } from "react";
import { T } from "@/components/TranslatedText";
import { Award, BookOpen, Users, Globe } from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import Link from "next/link";

export default function AboutPage() {
  const { user } = useAuth();
  const [page, setPage] = useState<any>(null);

  useEffect(() => {
    fetch('/api/pages/about')
      .then(r => r.json())
      .then(d => setPage(d.page))
      .catch(() => setPage({
        title: "About Ruhulqudus Academy",
        content: "Founded by Dr. Gehan Ali Ahmed, we are devoted to teaching Arabic with excellence and reverence."
      }));
  }, []);

  if (!page) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 md:px-8">
      <div className="text-center mb-10">
        <Award className="mx-auto h-12 w-12 text-secondary-foreground mb-4" />
        <h1 className="font-serif text-4xl">{page.title}</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl mx-auto">
          {page.content}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {[
          { icon: BookOpen, title: "Our Mission", text: "To make elite Arabic education accessible worldwide." },
          { icon: Users, title: "Our Students", text: "Thousands of learners from over 30 countries." },
          { icon: Globe, title: "Our Reach", text: "Live classes, recorded courses, and one-on-one mentoring." },
        ].map((item) => (
          <div key={item.title} className="glass rounded-3xl p-6 text-center">
            <item.icon className="mx-auto h-10 w-10 text-secondary-foreground mb-3" />
            <h3 className="font-serif text-xl"><T>{item.title}</T></h3>
            <p className="text-sm text-muted-foreground mt-2"><T>{item.text}</T></p>
          </div>
        ))}
      </div>

      <div className="glass rounded-3xl p-8 md:p-10">
        <h2 className="font-serif text-2xl text-accent-foreground mb-4"><T>Dr. Gehan Ali Ahmed</T></h2>
        <p className="text-muted-foreground leading-relaxed">
          <T>With over 20 years of experience teaching Arabic, Dr. Gehan has dedicated her life to helping students master the language of the Quran. Her methodology combines classical pedagogy with modern technology.</T>
        </p>
      </div>

      {!user && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-3"><T>Ready to start?</T></p>
          <div className="flex justify-center gap-3">
            <Link href="/signup?role=student" className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
              <T>Join as Student</T>
            </Link>
            <Link href="/signup?role=teacher" className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400">
              <T>Join as Teacher</T>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}