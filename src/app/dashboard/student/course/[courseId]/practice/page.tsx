"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { T } from "@/components/TranslatedText";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  Loader2, ArrowRight, Gamepad2, FileQuestion, Mic, PenLine, Flame, Trophy,
} from "lucide-react";
import { motion } from "framer-motion";
import GamesSection from "@/components/student/GamesSection";
import ExamPlayer from "@/components/student/ExamPlayer";
import SpeakingQuestion from "@/components/student/SpeakingQuestion";
import WritingQuestion from "@/components/student/WritingQuestion";
import { cn } from "@/lib/utils";

type TabId = "games" | "exam" | "speaking" | "writing";

const TABS: { id: TabId; label: string; icon: typeof Gamepad2 }[] = [
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "exam", label: "Exam", icon: FileQuestion },
  { id: "speaking", label: "Speaking", icon: Mic },
  { id: "writing", label: "Writing", icon: PenLine },
];

interface PracticePrompt {
  id: string;
  type: "speaking" | "writing";
  question_text: string;
  expected_text?: string | null;
}

export default function PracticePage() {
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const courseId = params.courseId as string;
  const { user, isLoading: authLoading } = useAuth();

  const [courseTitle, setCourseTitle] = useState("");
  const [courseDifficulty, setCourseDifficulty] = useState("A1");
  const [stats, setStats] = useState<{ points: number; streak: number } | null>(null);
  const [prompts, setPrompts] = useState<PracticePrompt[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("games");

  useEffect(() => {
    if (!user || !courseId) return;
    const fetchCourse = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/student/course/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setCourseTitle(data.course?.title || "");
          setCourseDifficulty(data.course?.level || "A1");
        }
      } catch (error) {
        console.error("Failed to fetch course info:", error);
      }
    };
    fetchCourse();
  }, [user, courseId]);

  useEffect(() => {
    if (!user || !courseId) return;
    const fetchStats = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/student/course/${courseId}/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setStats({ points: data.points ?? 0, streak: data.streak ?? 0 });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    };
    fetchStats();
  }, [user, courseId]);

  useEffect(() => {
    if (!courseId) return;
    setLoadingPrompts(true);
    fetch(`/api/practice/${courseId}/prompts`)
      .then(r => (r.ok ? r.json() : { prompts: [] }))
      .then(d => setPrompts(d.prompts || []))
      .catch(() => setPrompts([]))
      .finally(() => setLoadingPrompts(false));
  }, [courseId]);

  const speakingPrompt = prompts.find(p => p.type === "speaking");
  const writingPrompt = prompts.find(p => p.type === "writing");

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">
          <T>Please log in to access practice.</T>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <button
          onClick={() => router.push(`/dashboard/student/course/${courseId}`)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
          <T>Back to Course</T>
        </button>

        <div className="glass mt-4 rounded-3xl p-6 shadow-elegant md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-foreground">
              <T>Level</T> {courseDifficulty}
            </span>
            {stats && (
              <>
                <span className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                  <Trophy className="h-3.5 w-3.5" /> {stats.points.toLocaleString("en-US")}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                  <Flame className="h-3.5 w-3.5" /> {stats.streak}
                </span>
              </>
            )}
          </div>
          <h1 className="mt-3 font-serif text-3xl text-foreground md:text-4xl">
            <T>Practice</T>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {courseTitle ? courseTitle : <T>Choose a practice track to keep your streak alive.</T>}
          </p>
        </div>

        <div className="glass mt-6 mb-8 flex gap-1 overflow-x-auto rounded-2xl p-1.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition",
                activeTab === id
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <T>{label}</T>
            </button>
          ))}
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {activeTab === "games" && <GamesSection courseId={courseId} difficulty={courseDifficulty} />}
          {activeTab === "exam" && <ExamPlayer courseId={courseId} />}
          {activeTab === "speaking" && (
            loadingPrompts ? (
              <div className="glass rounded-3xl p-10 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              </div>
            ) : speakingPrompt ? (
              <SpeakingQuestion
                questionText={speakingPrompt.question_text}
                expectedText={speakingPrompt.expected_text || speakingPrompt.question_text}
              />
            ) : (
              <div className="glass rounded-3xl p-10 text-center text-muted-foreground">
                <T>No speaking practice available for this course yet.</T>
              </div>
            )
          )}
          {activeTab === "writing" && (
            loadingPrompts ? (
              <div className="glass rounded-3xl p-10 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              </div>
            ) : writingPrompt ? (
              <WritingQuestion questionText={writingPrompt.question_text} />
            ) : (
              <div className="glass rounded-3xl p-10 text-center text-muted-foreground">
                <T>No writing practice available for this course yet.</T>
              </div>
            )
          )}
        </motion.div>
      </div>
    </div>
  );
}