"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const bundles = [
  {
    title: "Foundations Bundle",
    levels: "A1 · A2 · B1",
    price: 132,
    oldPrice: 147,
    discount: "-10%",
    features: ["Lifetime access", "Live Q&A with Dr. Jehan", "Certificate of completion"],
    isSpecial: false,
  },
  {
    title: "Mastery Path",
    levels: "B1 · B2 · C1",
    price: 255,
    oldPrice: 300,
    discount: "-15%",
    features: ["Lifetime access", "Live Q&A with Dr. Jehan", "Certificate of completion"],
    isSpecial: false,
  },
  {
    title: "Complete Journey",
    levels: "A1 → C2",
    price: 449,
    oldPrice: 600,
    discount: "-25%",
    features: ["Lifetime access", "Live Q&A with Dr. Jehan", "Certificate of completion"],
    isSpecial: true,
  },
];

export function SpecialBundles() {
  return (
    <section className="py-16 px-4 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* العنوان الرئيسي يستخدم text-foreground ليتغير تلقائياً */}
        <h2 className="text-4xl font-serif text-foreground mb-12 ornament">Special Bundles</h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {bundles.map((bundle, index) => (
            <div 
              key={index}
              className={cn(
                "relative rounded-4xl p-8 border transition-all duration-300",
                "bg-card border-border hover:shadow-elegant", // استخدام bg-card يضمن اللون الأسود في الدارك والأبيض في اللايت
                bundle.isSpecial && "border-gold/50 ring-1 ring-gold/20"
              )}
            >
              {bundle.isSpecial && (
                <div className="absolute top-0 right-0 bg-gold text-black px-4 py-1 rounded-bl-2xl rounded-tr-4xl text-[10px] font-bold uppercase tracking-wider">
                  Best Value
                </div>
              )}

              <div className="space-y-4">
                <span className="text-gold font-bold uppercase tracking-widest text-[11px]">
                  ✨ Special Bundle
                </span>
                
                {/* العنوان يستخدم text-foreground ليكون واضحاً دائماً */}
                <h3 className="text-2xl font-serif text-foreground leading-tight">
                  {bundle.title}
                </h3>
                
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                  {bundle.levels}
                </p>

                <div className="flex items-baseline gap-2 py-4">
                  {/* السعر الرئيسي */}
                  <span className="text-4xl font-bold text-foreground">${bundle.price}</span>
                  {/* السعر المشطوب يستخدم muted-foreground ليظهر رمادياً في الحالتين */}
                  <span className="text-sm text-muted-foreground line-through">${bundle.oldPrice}</span>
                </div>

                <ul className="space-y-3 py-6 border-t border-border/50">
                  {bundle.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-center gap-3 text-sm text-foreground/80">
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button className={cn(
                  "w-full py-4 rounded-full font-bold transition-all active:scale-95 shadow-md",
                  bundle.isSpecial 
                    ? "bg-gold text-black hover:bg-gold/90" // البطاقة المميزة تظل بلمسة ذهبية ونصوص واضحة
                    : "bg-emerald-700 text-white hover:bg-emerald-800"
                )}>
                  Choose Bundle
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}