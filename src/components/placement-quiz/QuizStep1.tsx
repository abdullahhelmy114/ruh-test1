"use client";

import { motion } from "framer-motion";
import { BookOpen, Mic, FileText } from "lucide-react";
import type { ReadingAbility } from "@/types/student-features";

interface QuizStep1Props {
  selected: ReadingAbility | null;
  onSelect: (value: ReadingAbility) => void;
}

const options: { value: ReadingAbility; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    value: "yes",
    label: "Yes, comfortably",
    description: "I can read Arabic script without difficulty.",
    icon: BookOpen,
  },
  {
    value: "little",
    label: "A little",
    description: "I recognize some letters but need more practice.",
    icon: Mic,
  },
  {
    value: "no",
    label: "Not yet",
    description: "I am starting from the very beginning.",
    icon: FileText,
  },
];

export default function QuizStep1({ selected, onSelect }: QuizStep1Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <h3 className="font-serif text-xl font-bold text-charcoal">
        Can you read Arabic script?
      </h3>
      <p className="text-sm text-charcoal/70">
        This helps us understand your starting level.
      </p>

      <div className="grid gap-3">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
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
    </motion.div>
  );
}