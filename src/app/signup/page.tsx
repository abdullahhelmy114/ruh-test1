"use client";

import { motion } from "framer-motion";
import { BookOpen, GraduationCap, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { T } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";

export default function SignupRolePage() {
  const router = useRouter();

  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center bg-background px-4 py-12 relative overflow-hidden">
      
      {/* إضاءة محيطية فاخرة (Ambient Lighting) حسب نظام Creamy × Navy */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute inset-0 -z-20"
        style={{ background: "radial-gradient(900px 700px at 70% 40%, var(--gold) / 10%, transparent 70%)" }} 
      />
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl -z-20" 
      />

      <div className="w-full max-w-4xl relative z-10">
        <motion.header
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-12"
        >
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-gold mb-3">
            <T>Ruhulqudus Academy</T>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-primary">
            <T>Join Our Community</T>
          </h1>
          <p className="mt-3 sm:mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
            <T>Choose your path and start your journey with the best Arabic teachers and resources.</T>
          </p>
        </motion.header>

        <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
          
          {/* ----------------- بطاقة الطالب (Navy / Primary) ----------------- */}
          <motion.section
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="glass rounded-3xl p-6 sm:p-8 border border-primary/10 shadow-elegant flex flex-col hover:border-primary/30 transition-all duration-300 bg-card group"
          >
            <header className="flex items-center gap-4 mb-6">
              <div className="p-3.5 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <BookOpen className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-foreground">
                <T>Student</T>
              </h2>
            </header>

            <ul className="space-y-4 mb-8 text-muted-foreground flex-1">
              <li className="flex items-start gap-3">
                <span className="text-primary mt-0.5">✓</span>
                <span className="text-sm"><T>Access to hundreds of Arabic courses</T></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary mt-0.5">✓</span>
                <span className="text-sm"><T>Live sessions with certified teachers</T></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary mt-0.5">✓</span>
                <span className="text-sm"><T>Interactive quizzes & certificates</T></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary mt-0.5">✓</span>
                <span className="text-sm"><T>Community of learners worldwide</T></span>
              </li>
            </ul>

            <div className="space-y-3 mt-auto">
              <Button
                onClick={() => router.push("/signup/student")}
                className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-sm sm:text-base font-semibold shadow-elegant transition-transform hover:scale-[1.02]"
              >
                <T>Join as Student</T>
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </motion.section>

          {/* ----------------- بطاقة المعلم (Gold) ----------------- */}
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="glass rounded-3xl p-6 sm:p-8 border border-gold/10 shadow-elegant flex flex-col hover:border-gold/30 transition-all duration-300 bg-card group"
          >
            <header className="flex items-center gap-4 mb-6">
              <div className="p-3.5 rounded-2xl bg-gold/10 text-gold group-hover:bg-gold group-hover:text-primary-foreground transition-colors">
                <GraduationCap className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-foreground">
                <T>Teacher</T>
              </h2>
            </header>

            <ul className="space-y-4 mb-8 text-muted-foreground flex-1">
              <li className="flex items-start gap-3">
                <span className="text-gold mt-0.5">✓</span>
                <span className="text-sm"><T>Create and sell your courses</T></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-gold mt-0.5">✓</span>
                <span className="text-sm"><T>Earn competitive commissions</T></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-gold mt-0.5">✓</span>
                <span className="text-sm"><T>Access to teaching tools & analytics</T></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-gold mt-0.5">✓</span>
                <span className="text-sm"><T>Join a network of top Arabic instructors</T></span>
              </li>
            </ul>

            <div className="space-y-3 mt-auto">
              <Button
                onClick={() => router.push("/signup/teacher")}
                className="w-full rounded-full bg-gold text-primary-foreground hover:bg-gold/80 py-6 text-sm sm:text-base font-semibold shadow-gold transition-transform hover:scale-[1.02]"
              >
                <T>Join as Teacher</T>
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </motion.section>

        </div>

        {/* رابط تسجيل الدخول للمستخدمين الحاليين */}
        <motion.footer 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 sm:mt-10 text-center"
        >
          <p className="text-sm text-muted-foreground">
            <T>Already have an account?</T>{" "}
            <Link href="/login" className="font-semibold text-primary hover:text-gold hover:underline underline-offset-4 transition-colors">
              <T>Sign in</T>
            </Link>
          </p>
        </motion.footer>
      </div>
    </main>
  );
}