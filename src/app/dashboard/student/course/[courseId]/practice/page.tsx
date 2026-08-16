"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { T } from "@/components/TranslatedText";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  Loader2,
  ArrowRight,
  Gamepad2,
  FileQuestion,
  Mic,
  PenLine,
} from "lucide-react";
import GamesSection from "@/components/student/GamesSection";
import ExamPlayer from "@/components/student/ExamPlayer";
import SpeakingQuestion from "@/components/student/SpeakingQuestion";
import WritingQuestion from "@/components/student/WritingQuestion";
import { cn } from "@/lib/utils";

export default function PracticePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const { user, isLoading: authLoading } = useAuth();

  const [courseTitle, setCourseTitle] = useState("");
  const [courseDifficulty, setCourseDifficulty] = useState("A1");
  const [activeTab, setActiveTab] = useState<"games" | "exam" | "speaking" | "writing">("games");

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
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <div className="flex items-center gap-2 mb-8">
        <button
          onClick={() => router.push(`/dashboard/student/course/${courseId}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
          <T>Back to Course</T>
        </button>
        <h1 className="font-serif text-3xl">
          {courseTitle ? courseTitle : <T>Practice</T>}
        </h1>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border bg-card p-1.5 mb-8">
        <button
          onClick={() => setActiveTab("games")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
            activeTab === "games"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Gamepad2 className="h-4 w-4" />
          <T>Games</T>
        </button>
        <button
          onClick={() => setActiveTab("exam")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
            activeTab === "exam"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <FileQuestion className="h-4 w-4" />
          <T>Exam</T>
        </button>
        <button
          onClick={() => setActiveTab("speaking")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
            activeTab === "speaking"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Mic className="h-4 w-4" />
          <T>Speaking</T>
        </button>
        <button
          onClick={() => setActiveTab("writing")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
            activeTab === "writing"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <PenLine className="h-4 w-4" />
          <T>Writing</T>
        </button>
      </div>

      <div className="space-y-6">
        {activeTab === "games" && <GamesSection courseId={courseId} difficulty={courseDifficulty} />}
        {activeTab === "exam" && <ExamPlayer courseId={courseId} />}
        {activeTab === "speaking" && (
          <SpeakingQuestion
            questionText="مرحباً كيف حالك؟"
            expectedText="مرحباً كيف حالك"
          />
        )}
        {activeTab === "writing" && (
          <WritingQuestion
            questionText="اكتب جملة تعرف فيها عن نفسك."
          />
        )}
      </div>
    </div>
  );
}