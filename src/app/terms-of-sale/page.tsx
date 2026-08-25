import type { Metadata } from "next";
import { FileText, Users, ShoppingBag, Ban, ShieldCheck, Mail } from "lucide-react";
import { T } from "@/components/TranslatedText";

export const metadata: Metadata = {
  title: "Terms of Sale | Ruh-Ul-Qudus Academy",
  alternates: { canonical: "https://ruhulqudus.com" },
};

const saleSections = [
  { key: "Sale Parties", icon: Users },
  { key: "Sale Subject", icon: FileText },
  { key: "Sale Delivery", icon: ShoppingBag },
  { key: "Sale Cancellation", icon: Ban },
  { key: "Sale Law", icon: ShieldCheck },
  { key: "Sale Contact", icon: Mail },
];

export default function TermsOfSalePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 text-center md:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold">
            <FileText className="h-3.5 w-3.5" />
            <T>Sale Badge</T>
          </div>
          <h1 className="mt-6 font-serif text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
            <T>Sale Heading</T>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            <T>Sale Subtitle</T>
          </p>
        </div>
      </section>

      {/* Sections */}
      <section className="mx-auto max-w-5xl px-4 pb-24 md:px-8">
        <div className="space-y-8">
          {saleSections.map(({ key, icon: Icon }, index) => (
            <div key={key} className="glass rounded-3xl border border-border/50 bg-card p-6 md:p-8 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-semibold text-foreground">
                    {index + 1}. <T>{key}</T>
                  </h2>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    <T>{`${key} Content`}</T>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
