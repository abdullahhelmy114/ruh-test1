"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PlayCircle, GraduationCap, BadgeCheck } from "lucide-react";
import type { Instructor } from "@/types/student-features";

interface InstructorCardProps {
  instructor: Instructor;
}

export default function InstructorCard({ instructor }: InstructorCardProps) {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4 }}
      className="group overflow-hidden rounded-2xl border border-charcoal/10 bg-white/90 shadow-lg shadow-charcoal/5 transition-all hover:shadow-xl hover:shadow-charcoal/10"
    >
      {/* معاينة الفيديو */}
      <div
        className="relative aspect-video w-full overflow-hidden bg-charcoal/95"
        style={{ borderBottom: `3px solid ${instructor.accentColor}` }}
      >
        {/* صورة خلفية مؤقتة أو لون أكاديمي */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-charcoal/80 to-charcoal/95">
          <GraduationCap className="h-16 w-16 text-cream/20" />
        </div>

        {/* زر التشغيل */}
        {!isPlaying && (
          <button
            onClick={() => {
              setIsPlaying(true);
              setIsVideoReady(true);
            }}
            className="absolute inset-0 z-10 flex items-center justify-center transition-opacity group-hover:opacity-90"
            aria-label={`Play ${instructor.name} introduction video`}
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-cream/20 backdrop-blur-sm transition-transform group-hover:scale-105">
              <PlayCircle className="h-10 w-10 text-cream" />
            </span>
          </button>
        )}

        {/* شارة الفيديو */}
        <span className="absolute bottom-3 left-3 z-10 rounded-full bg-charcoal/70 px-3 py-1 text-xs font-medium text-cream backdrop-blur-sm">
          30-sec intro
        </span>
      </div>

      {/* بيانات المعلم */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold text-white"
            style={{ backgroundColor: instructor.accentColor }}
          >
            {instructor.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-serif text-xl font-bold text-charcoal">
              {instructor.name}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-emerald-700">
              <BadgeCheck className="h-4 w-4" />
              Verified Instructor
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-charcoal/80">
            {instructor.credentials}
          </p>
          <p className="text-sm text-charcoal/60">{instructor.specialty}</p>
        </div>
      </div>
    </motion.article>
  );
}