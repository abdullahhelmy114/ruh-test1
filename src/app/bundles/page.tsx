"use client";

import { useEffect, useState } from "react";
import { T } from "@/components/TranslatedText";
import { Package, Check, Sparkles, ArrowRight, UserPlus } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/AuthProvider";

const bundles = [
  { title: "Foundations Bundle", levels: "A1 + A2 + B1", price: 127, original: 147, discount: 15 },
  { title: "Mastery Path", levels: "B1 + B2 + C1", price: 229, original: 270, discount: 15 },
  { title: "Complete Journey", levels: "A1 → C2", price: 399, original: 600, discount: 33, featured: true },
];

export default function BundlesPage() {
  const { user } = useAuth();
  const [page, setPage] = useState<any>(null);

  useEffect(() => {
    fetch('/api/pages/bundles')
      .then(r => r.json())
      .then(d => setPage(d.page))
      .catch(() => setPage({ title: "Course Bundles", content: "Save up to 33% with our carefully curated bundles." }));
  }, []);

  if (!page) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 md:px-8">
      <div className="text-center mb-10">
        <Package className="mx-auto h-12 w-12 text-secondary-foreground mb-4" />
        <h1 className="font-serif text-4xl">{page.title}</h1>
        <p className="mt-2 text-muted-foreground">{page.content}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {bundles.map((b) => (
          <div key={b.title} className={`glass rounded-3xl p-6 text-center relative ${b.featured ? "ring-2 ring-amber-500" : ""}`}>
            {b.featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-xs font-bold px-4 py-1 rounded-full">
                <Sparkles size={12} className="inline mr-1" /> <T>Best Value</T>
              </span>
            )}
            <h3 className="font-serif text-xl mt-2"><T>{b.title}</T></h3>
            <p className="text-sm text-muted-foreground mt-1">{b.levels}</p>
            <div className="mt-4">
              <span className="font-serif text-3xl font-bold text-accent-foreground">${b.price}</span>
              <span className="text-sm line-through text-muted-foreground ml-2">${b.original}</span>
              <span className="ml-2 bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">-{b.discount}%</span>
            </div>
            <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
              {["Full access", "Certificates", "Live Q&A"].map((f) => (
                <li key={f} className="flex items-center justify-center gap-1"><Check size={14} className="text-emerald-500" /> <T>{f}</T></li>
              ))}
            </ul>
            <Link href="/marketplace" className="mt-5 inline-block w-full rounded-full bg-amber-500 py-2.5 text-sm font-semibold text-black hover:bg-amber-400">
              <T>Get Started</T>
            </Link>
          </div>
        ))}
      </div>

      {!user && (
        <div className="mt-12 text-center">
          <div className="glass rounded-3xl p-8 inline-block">
            <UserPlus className="mx-auto h-12 w-12 text-secondary-foreground mb-4" />
            <h2 className="font-serif text-2xl mb-2"><T>Ready to save?</T></h2>
            <p className="text-muted-foreground mb-6"><T>Join now and get access to exclusive bundles.</T></p>
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