// app/signup/page.tsx
"use client";

import { motion } from "framer-motion";
import { BookOpen, GraduationCap, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { T } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";

export default function SignupRolePage() {
  const router = useRouter();

  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-serif text-foreground">
            <T>Join Ruhulqudus Academy</T>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            <T>Choose your path and start your journey with the best Arabic teachers and resources.</T>
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* بطاقة الطالب */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="glass rounded-3xl p-8 border border-border/40 shadow-elegant flex flex-col"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <BookOpen className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold font-serif">
                <T>Student</T>
              </h2>
            </div>

            <ul className="space-y-3 mb-8 text-muted-foreground flex-1">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-1">✓</span>
                <span><T>Access to hundreds of Arabic courses</T></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-1">✓</span>
                <span><T>Live sessions with certified teachers</T></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-1">✓</span>
                <span><T>Interactive quizzes & certificates</T></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-1">✓</span>
                <span><T>Community of learners worldwide</T></span>
              </li>
            </ul>

            <div className="space-y-3">
              <Button
                onClick={() => router.push("/signup/student")}
                className="w-full rounded-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-sm font-semibold"
              >
                <T>Join as Student</T>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push("/learn-more-student")} // صفحة مستقبلية
                className="w-full rounded-full text-xs"
              >
                <T>Learn more about student experience</T>
              </Button>
            </div>
          </motion.div>

          {/* بطاقة المعلم */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="glass rounded-3xl p-8 border border-border/40 shadow-elegant flex flex-col"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <GraduationCap className="h-6 w-6 text-accent-foreground" />
              </div>
              <h2 className="text-2xl font-bold font-serif">
                <T>Teacher</T>
              </h2>
            </div>

            <ul className="space-y-3 mb-8 text-muted-foreground flex-1">
              <li className="flex items-start gap-2">
                <span className="text-secondary-foreground mt-1">✓</span>
                <span><T>Create and sell your courses</T></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-secondary-foreground mt-1">✓</span>
                <span><T>Earn competitive commissions</T></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-secondary-foreground mt-1">✓</span>
                <span><T>Access to teaching tools & analytics</T></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-secondary-foreground mt-1">✓</span>
                <span><T>Join a network of top Arabic instructors</T></span>
              </li>
            </ul>

            <div className="space-y-3">
              <Button
                onClick={() => router.push("/signup/teacher")}
                className="w-full rounded-full bg-amber-500 hover:bg-amber-600 text-white py-3 text-sm font-semibold"
              >
                <T>Join as Teacher</T>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push("/learn-more-teacher")} // صفحة مستقبلية
                className="w-full rounded-full text-xs"
              >
                <T>Learn more about teaching</T>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}