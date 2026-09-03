"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, Award, Clock3, Loader2 } from "lucide-react";
import type { ReadingAbility, Goal, QuizResultData } from "@/types/student-features";

interface QuizResultProps {
  reading: ReadingAbility;
  goal: Goal;
  onClose: () => void;
}

const RESULTS: Record<ReadingAbility, Record<Goal, QuizResultData>> = {
  yes: {
    quranic: {
      level: "B1",
      title: "Quranic Arabic Intermediate",
      description: "You read confidently. Build advanced Quranic vocabulary and tafsir comprehension.",
      path: ["Quranic Vocabulary Builder", "Classical Grammar Essentials", "Tafsir Reading Circles"],
      duration: "16 weeks",
    },
    modern: {
      level: "B1",
      title: "Modern Standard Intermediate",
      description: "Strong reading foundation. Focus on formal writing and media Arabic.",
      path: ["Media Arabic Analysis", "Formal Writing Workshop", "Grammar Deep Dive"],
      duration: "14 weeks",
    },
    conversational: {
      level: "B1",
      title: "Conversational Accelerator",
      description: "Reading is solid. Shift to speaking fluency and active listening.",
      path: ["Dialogue Practice Sessions", "Listening Labs", "Pronunciation Coaching"],
      duration: "12 weeks",
    },
  },
  little: {
    quranic: {
      level: "A2",
      title: "Quranic Arabic Bridge Program",
      description: "Partial reading ability. Strengthen script recognition through Quranic text.",
      path: ["Script Reinforcement", "Quranic Root System", "Guided Reading Practice"],
      duration: "14 weeks",
    },
    modern: {
      level: "A2",
      title: "Modern Standard Bridge Program",
      description: "Build on partial reading with structured grammar and vocabulary.",
      path: ["Grammar Foundations", "Vocabulary Expansion", "Reading Practice"],
      duration: "12 weeks",
    },
    conversational: {
      level: "A2",
      title: "Conversational Bridge Program",
      description: "Improve reading while practicing real-life conversations.",
      path: ["Script Review", "Daily Phrases", "Listening Practice"],
      duration: "10 weeks",
    },
  },
  no: {
    quranic: {
      level: "A1",
      title: "Quranic Arabic Foundations",
      description: "Start from the beginning. Learn the Arabic script through Quranic verses.",
      path: ["Arabic Script Mastery", "Basic Recitation", "Essential Vocabulary"],
      duration: "12 weeks",
    },
    modern: {
      level: "A1",
      title: "Modern Standard Foundations",
      description: "Begin with the alphabet and build toward simple sentence reading.",
      path: ["Alphabet & Sound System", "Basic Sentences", "Reading Comprehension"],
      duration: "10 weeks",
    },
    conversational: {
      level: "A1",
      title: "Conversational Foundations",
      description: "Learn the script and essential phrases for everyday life.",
      path: ["Alphabet Basics", "Greetings & Introductions", "Essential Phrases"],
      duration: "10 weeks",
    },
  },
};

export default function QuizResult({ reading, goal, onClose }: QuizResultProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const result = RESULTS[reading][goal];

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
    }, 1400);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-emerald-100 px-5 py-2 text-sm font-bold text-emerald-800">
          <Award className="h-4 w-4" />
          Estimated Level: {result.level}
        </div>
        <h3 className="mt-4 font-serif text-2xl font-bold text-charcoal">
          {result.title}
        </h3>
        <p className="mx-auto mt-3 max-w-md text-sm text-charcoal/70">
          {result.description}
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6">
        <div className="flex items-center justify-between">
          <h4 className="font-serif text-lg font-semibold text-charcoal">
            Recommended Curriculum Path
          </h4>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
            <Clock3 className="h-4 w-4" />
            {result.duration}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {result.path.map((item, i) => (
            <div key={item} className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="font-medium text-charcoal">{item}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving || saved}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-emerald-800 disabled:opacity-70"
      >
        {saved ? (
          <>
            <Check className="h-5 w-5" />
            Results Saved to Waitlist
          </>
        ) : isSaving ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Saving Results...
          </>
        ) : (
          <>
            Save Results & Join Waitlist
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>

      {saved && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-sm font-medium text-emerald-700"
        >
          You are on the list. We will contact you soon.
        </motion.p>
      )}
    </motion.div>
  );
}