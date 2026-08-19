"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  Loader2, Play, FileText, Download, CheckCircle, BookOpen, ArrowLeft,
  HelpCircle, Gamepad2, Flame, Trophy, Lock, Radio, Video,
} from "lucide-react";
import { motion } from "framer-motion";
import { T } from "@/components/TranslatedText";
import { YouTubeEmbed } from "@/components/ui/YouTubeEmbed";
import { QuizPlayer } from "@/components/QuizPlayer";
import Link from "next/link";
import { CertificateButton } from "@/components/CertificateButton";

interface Lesson {
  id: string;
  title: string;
  type: string;
  recording_url: string | null;
  files: { file_name: string; file_url: string; file_type: string }[];
  completed: boolean;
}

interface CourseData {
  course: { id: string; title: string; level: string; teacher_name: string; description?: string };
  lessons: Lesson[];
}

interface GamificationStats {
  points: number;
  streak: number;
  badges: { id: string; name: string; icon?: string; earned: boolean }[];
}

function CourseCompletionSection({
  courseId,
  courseTitle,
  teacherName,
  studentName,
}: {
  courseId: string;
  courseTitle: string;
  teacherName: string;
  studentName: string;
}) {
  const [hasExam, setHasExam] = useState(false);
  const [loadingExam, setLoadingExam] = useState(true);

  useEffect(() => {
    fetch(`/api/exam/${courseId}/questions`)
      .then(r => r.json())
      .then(d => setHasExam(d.questions && d.questions.length > 0))
      .finally(() => setLoadingExam(false));
  }, [courseId]);

  if (loadingExam) {
    return (
      <div className="glass rounded-3xl p-6 text-center">
        <Loader2 className="animate-spin mx-auto h-6 w-6 text-primary" />
      </div>
    );
  }

  if (hasExam) {
    return (
      <div className="glass rounded-3xl p-8 text-center space-y-4 shadow-elegant">
        <HelpCircle className="mx-auto h-10 w-10 text-accent-foreground" />
        <h3 className="font-serif text-xl text-foreground">
          <T>Final Exam Required</T>
        </h3>
        <p className="text-muted-foreground text-sm">
          <T>You must pass the final exam to earn your certificate.</T>
        </p>
        <Link
          href={`/dashboard/student/exam/${courseId}`}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent/80 transition"
        >
          <T>Take Final Exam</T>
        </Link>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-8 text-center space-y-4 shadow-elegant">
      <CheckCircle className="mx-auto h-10 w-10 text-primary" />
      <h3 className="font-serif text-xl text-foreground">
        <T>Congratulations!</T>
      </h3>
      <p className="text-muted-foreground text-sm">
        <T>You have completed all lessons.</T>
      </p>
      <CertificateButton
        studentName={studentName}
        courseName={courseTitle}
        teacherName={teacherName}
      />
    </div>
  );
}

function QuizSection({ lessonId }: { lessonId: string }) {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/quizzes/${lessonId}`)
      .then(r => r.json())
      .then(d => setQuizzes(d.quizzes || []))
      .finally(() => setLoading(false));
  }, [lessonId]);

  if (loading) return null;
  if (quizzes.length === 0) return null;

  return (
    <div className="glass rounded-3xl p-6 space-y-3 shadow-elegant">
      <h3 className="font-serif text-lg flex items-center gap-2 text-foreground">
        <HelpCircle className="h-5 w-5 text-accent-foreground" />
        <T>Lesson Quiz</T>
      </h3>
      <QuizPlayer quizzes={quizzes} />
    </div>
  );
}

export default function CoursePlayerPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId as string;
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<CourseData | null>(null);
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  const lessons = data?.lessons ?? [];
  const completedCount = lessons.filter(l => l.completed).length;
  const allCompleted = lessons.length > 0 && completedCount === lessons.length;
  const progress = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((token) =>
      fetch(`/api/student/course/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(d => {
          if (d.error) { router.push("/dashboard/student"); return; }
          setData(d);
          setCurrentLesson(d.lessons?.find((l: Lesson) => !l.completed) || d.lessons?.[0] || null);
          setLoading(false);
        })
    ).catch(() => setLoading(false));
  }, [courseId, user, router]);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((token) =>
      fetch(`/api/student/course/${courseId}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (!d || d.error) return;
          setStats({
            points: d.points ?? 0,
            streak: d.streak ?? 0,
            badges: d.badges ?? [],
          });
        })
    ).catch(() => undefined);
  }, [courseId, user]);

  const handleComplete = async () => {
    if (!currentLesson || !user) return;
    setCompleting(true);
    await fetch("/api/lessons/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: currentLesson.id, uid: user.uid }),
    });
    setCurrentLesson(prev => (prev ? { ...prev, completed: true } : prev));
    setData(prev =>
      prev
        ? {
            ...prev,
            lessons: prev.lessons.map(l =>
              l.id === currentLesson.id ? { ...l, completed: true } : l,
            ),
          }
        : prev,
    );
    setCompleting(false);
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
  if (!data) return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      <T>Course not found</T>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-8 min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-full lg:w-80 shrink-0 glass rounded-3xl p-5 shadow-elegant lg:max-h-[85vh] lg:sticky lg:top-6 overflow-y-auto">
        <Link href="/dashboard/student" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition">
          <ArrowLeft size={16} /> <T>Back to Dashboard</T>
        </Link>

        <h2 className="font-serif text-xl flex items-center gap-2 text-foreground">
          <BookOpen className="h-5 w-5 text-accent-foreground" /> {data.course.title}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-foreground">
            <T>Level</T> {data.course.level}
          </span>
          <span className="text-xs text-muted-foreground">{data.course.teacher_name}</span>
        </div>

        {/* Progress */}
        <div className="mt-5 rounded-2xl border border-border/60 bg-background/60 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span><T>Course Progress</T></span>
            <span className="font-semibold text-foreground">{completedCount}/{lessons.length}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Gamification */}
        {stats && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Trophy className="h-3.5 w-3.5 text-accent-foreground" /> <T>Points</T>
              </p>
              <p className="mt-1 font-serif text-lg text-foreground">{stats.points.toLocaleString("en-US")}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Flame className="h-3.5 w-3.5 text-accent-foreground" /> <T>Streak</T>
              </p>
              <p className="mt-1 font-serif text-lg text-foreground">{stats.streak}</p>
            </div>
          </div>
        )}

        {stats && stats.badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.badges.map(badge => (
              <span
                key={badge.id}
                title={badge.name}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm ${
                  badge.earned
                    ? "border-accent/40 bg-accent/15 text-accent-foreground"
                    : "border-border/60 bg-muted/40 opacity-50"
                }`}
              >
                {badge.icon || badge.name.charAt(0)}
              </span>
            ))}
          </div>
        )}

        <Link
          href={`/dashboard/student/course/${courseId}/practice`}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
        >
          <Gamepad2 size={16} /> <T>Start Practice</T>
        </Link>

        <div className="mt-5 space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <T>Lessons</T>
          </p>
          {lessons.map((lesson, i) => (
            <button
              key={lesson.id}
              onClick={() => setCurrentLesson(lesson)}
              className={`w-full text-left p-3 rounded-xl text-sm transition flex items-center gap-3 ${
                currentLesson?.id === lesson.id
                  ? "bg-primary text-primary-foreground"
                  : lesson.completed
                  ? "bg-secondary text-secondary-foreground"
                  : "hover:bg-accent text-foreground"
              }`}
            >
              <span className="shrink-0 w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">
                {lesson.completed ? <CheckCircle size={14} /> : i + 1}
              </span>
              <span className="truncate">{lesson.title}</span>
              {lesson.type === "zoom" ? (
                <Radio size={14} className="ml-auto shrink-0 opacity-70" />
              ) : (
                <Video size={14} className="ml-auto shrink-0 opacity-70" />
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border/50">
          {allCompleted ? (
            <Link
              href={`/dashboard/student/exam/${courseId}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 border border-accent/30 hover:bg-accent/20 transition w-full"
            >
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent flex items-center justify-center text-xs text-accent-foreground font-bold">?</span>
              <span className="text-sm font-medium text-accent-foreground"><T>Final Exam</T></span>
            </Link>
          ) : (
            <button
              onClick={() => alert("Please complete all lessons before taking the exam.")}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50 opacity-60 cursor-not-allowed w-full"
            >
              <span className="shrink-0 w-6 h-6 rounded-full border border-border flex items-center justify-center text-xs">
                <Lock size={12} />
              </span>
              <span className="text-sm text-muted-foreground"><T>Final Exam</T></span>
              <span className="ml-auto text-[10px] text-muted-foreground"><T>Locked</T></span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Player */}
      <main className="flex-1 space-y-6">
        {currentLesson ? (
          <motion.div key={currentLesson.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {currentLesson.recording_url && (
              <div className="rounded-3xl overflow-hidden shadow-elegant">
                <YouTubeEmbed url={currentLesson.recording_url} title={currentLesson.title} />
              </div>
            )}
            <div className="glass rounded-3xl p-6 shadow-elegant flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-serif text-2xl md:text-3xl text-foreground">{currentLesson.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentLesson.type === "zoom" ? <T>Live Session</T> : <T>Recorded Lesson</T>}
                </p>
              </div>
              <button
                onClick={handleComplete}
                disabled={currentLesson.completed || completing}
                className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ${
                  currentLesson.completed
                    ? "bg-secondary text-secondary-foreground cursor-default"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                }`}
              >
                {completing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : currentLesson.completed ? (
                  <><CheckCircle size={18} /> <T>Completed</T></>
                ) : (
                  <><Play size={18} /> <T>Mark as Complete</T></>
                )}
              </button>
            </div>
            {data.course.description && (
              <div className="glass rounded-3xl p-6">
                <h3 className="font-serif text-lg text-foreground"><T>About this course</T></h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{data.course.description}</p>
              </div>
            )}
            {currentLesson.files && currentLesson.files.length > 0 && (
              <div className="glass rounded-3xl p-6">
                <h3 className="font-serif text-lg mb-3 flex items-center gap-2 text-foreground">
                  <FileText className="h-5 w-5 text-accent-foreground" /> <T>Lesson Resources</T>
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {currentLesson.files.map((file, i) => (
                    <a
                      key={i}
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-xl border border-border bg-background p-3 hover:bg-accent transition"
                    >
                      <span className="text-sm truncate">{file.file_name}</span>
                      <Download size={16} className="text-muted-foreground shrink-0 ml-2" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            <QuizSection lessonId={currentLesson.id} />
          </motion.div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <T>Select a lesson to start learning</T>
          </div>
        )}
        {allCompleted && (
          <CourseCompletionSection
            courseId={courseId}
            courseTitle={data.course.title}
            teacherName={data.course.teacher_name || "Instructor"}
            studentName={user?.displayName || user?.email?.split("@")[0] || "Student"}
          />
        )}
      </main>
    </div>
  );
}