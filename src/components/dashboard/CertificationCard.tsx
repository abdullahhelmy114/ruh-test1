"use client";

import { motion } from "framer-motion";
import { Award, PlayCircle, ArrowRight } from "lucide-react";

export function CertificationCard({ progress = 62 }: { progress?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl p-8 shadow-elegant border border-hero-border gradient-hero"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative z-10 grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] hero-accent">
            <Award className="h-4 w-4" />
            <span className="font-bold">Certification Course</span>
          </div>

          <h3 className="hero-text mt-3 font-serif text-3xl tracking-tight md:text-4xl">
            How to Teach Arabic
          </h3>

          <p className="hero-text-muted mt-2 max-w-md text-sm">
            A flagship program by Dr. Jehan Ali Ahmed. Master pedagogy, curriculum design, and advanced methodology.
          </p>

          <div className="mt-5 max-w-md">
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="hero-text-muted">Your progress</span>
              <span className="hero-accent font-bold">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full hero-row-bg">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full gradient-gold"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-full gradient-gold px-5 py-2.5 text-sm font-semibold text-gold-foreground shadow-gold transition-transform hover:scale-105">
              <PlayCircle className="h-4 w-4" /> Continue Learning
            </button>
            <button className="group hero-row-bg hero-text inline-flex items-center gap-2 rounded-full border border-hero-border px-5 py-2.5 text-sm font-medium transition-colors hover:opacity-80">
              View Curriculum
              <ArrowRight className="h-4 w-4 transform transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        <div className="hidden flex-col items-center md:flex">
          <div className="hero-accent text-xs uppercase tracking-widest">Investment</div>
          <div className="hero-text my-1 font-serif text-6xl">$49</div>
          <div className="hero-text-muted text-xs">lifetime access</div>
        </div>
      </div>
    </motion.div>
  );
}