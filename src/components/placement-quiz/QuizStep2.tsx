"use client";

import { motion } from "framer-motion";
import { BookOpen, FileText, MessagesSquare, ArrowLeft, ArrowRight } from "lucide-react";
import type { Goal } from "@/types/student-features";

interface QuizStep2Props {
  selected: Goal | null;
  onBack: () => void;
  onComplete: (value: Goal) => void;
}

const options: { value: Goal; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    value: "quranic",
    label: "Quranic Arabic",
    description: "Understand the Quran, tafsir, and classical Islamic texts.",
    icon: BookOpen,
  },
  {
    value: "modern",
    label: "Modern Standard",
    description: "Read news, write formally, and engage with media Arabic.",
    icon: FileText,
  },
  {
    value: "conversational",
    label: "Conversational",
    description: "Speak confidently in everyday situations and travel.",
    icon: MessagesSquare,
  },
];

export default function QuizStep2({ selected, onBack, onComplete }: QuizStep2Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <h3 className="font-serif text-xl font-bold text-charcoal">
        What is your main goal?
      </h3>
      <p className="text-sm text-charcoal/70">
        Your answer will shape the recommended learning path.
      </p>

      <div className="grid gap-3">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onComplete(opt.value)}
              className={`flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all ${
                isSelected
                  ? "border-emerald-600 bg-emerald-50 shadow-md shadow-emerald-950/5"
                  : "border-emerald-100 bg-white hover:border-emerald-300 hover:bg-emerald-50/50"
              }`}
            >
              <div
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${
                  isSelected ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className={`font-semibold ${isSelected ? "text-emerald-800" : "text-charcoal"}`}>
                  {opt.label}
                </p>
                <p className="text-sm text-charcoal/60">{opt.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-5 py-2.5 text-sm font-medium text-charcoal/70 transition-colors hover:bg-emerald-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={() => selected && onComplete(selected)}
          disabled={!selected}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-800 disabled:opacity-50"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}