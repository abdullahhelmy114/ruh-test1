"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  Loader2, Play, FileText, Download, CheckCircle,
  BookOpen, ArrowLeft, HelpCircle, Award,
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
  course: { id: string; title: string; level: string; teacher_name: string };
  lessons: Lesson[];
}

/* ─────────────────────────────────────────────
   مكون الشهادة / الاختبار النهائي للكورس
   ───────────────────────────────────────────── */
function CourseCompletionSection({
  courseId,
  courseTitle,
  teacherName,
  studentName,
  user,
}: {
  courseId: string;
  courseTitle: string;
  teacherName: string;
  studentName: string;
  user: any;
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
      <div className="glass rounded-2xl p-6 text-center">
        <Loader2 className="animate-spin mx-auto h-6 w-6" />
      </div>
    );
  }

  // إذا كان هناك امتحان، اعرض زر "Take Final Exam"
  if (hasExam) {
    return (
      <div className="glass rounded-2xl p-6 text-center space-y-4">
        <HelpCircle className="mx-auto h-10 w-10 text-secondary-foreground" />
        <h3 className="font-serif text-xl"><T>Final Exam Required</T></h3>
        <p className="text-muted-foreground"><T>You must pass the final exam to earn your certificate.</T></p>
        <Link
          href={`/dashboard/student/exam/${courseId}`}
          className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-black hover:bg-amber-400"
        >
          <T>Take Final Exam</T>
        </Link>
      </div>
    );
  }

  // لا يوجد امتحان → شهادة مباشرة
  return (
    <div className="glass rounded-2xl p-6 text-center space-y-4">
      <CheckCircle className="mx-auto h-10 w-10 text-emerald-500" />
      <h3 className="font-serif text-xl"><T>Congratulations!</T></h3>
      <p className="text-muted-foreground"><T>You have completed all lessons.</T></p>
      <CertificateButton
        studentName={studentName}
        courseName={courseTitle}
        teacherName={teacherName}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   مكون الاختبار للدرس الواحد (QuizSection)
   ───────────────────────────────────────────── */
function QuizSection({ lessonId }: { lessonId: string }) {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/quizzes/${lessonId}`)
      .then(r => r.json())
      .then(d => setQuizzes(d.quizzes || []))
      .finally(() => setLoading(false));
  }, [lessonId]);

  if (loading) return null;
  if (quizzes.length === 0) return null;

  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <h3 className="font-serif text-lg flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-secondary-foreground" />
        <T>Lesson Quiz</T>
      </h3>
      <QuizPlayer quizzes={quizzes} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   الصفحة الرئيسية
   ───────────────────────────────────────────── */
export default function CoursePlayerPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<CourseData | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  const allCompleted = data?.lessons?.every(l => l.completed) ?? false;

  useEffect(() => {
    if (!user) return;
    fetch(`/api/student/courses/${courseId}?uid=${user.uid}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { router.push("/dashboard/student"); return; }
        setData(d);
        setCurrentLesson(d.lessons?.[0] || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [courseId, user, router]);

  const handleComplete = async () => {
    if (!currentLesson || !user) return;
    setCompleting(true);
    await fetch("/api/lessons/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: currentLesson.id, uid: user.uid }),
    });
    setCurrentLesson(prev => prev ? { ...prev, completed: true } : prev);
    setCompleting(false);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  if (!data) return <div className="flex min-h-screen items-center justify-center text-muted-foreground"><T>Course not found</T></div>;

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-8 min-h-screen">
      {/* Sidebar */}
      <aside className="w-full lg:w-80 shrink-0 glass rounded-3xl p-5 shadow-elegant max-h-[85vh] overflow-y-auto">
        <Link href="/dashboard/student" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={16} /> <T>Back to Dashboard</T>
        </Link>
        <h2 className="font-serif text-xl flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-secondary-foreground" /> {data.course.title}
        </h2>
        <p className="text-xs text-muted-foreground mt-1"><T>Level</T> {data.course.level}</p>
        <div className="mt-4 space-y-2">
          {data.lessons.map((lesson, i) => (
            <button
              key={lesson.id}
              onClick={() => setCurrentLesson(lesson)}
              className={`w-full text-left p-3 rounded-xl text-sm transition flex items-center gap-3 ${
                currentLesson?.id === lesson.id
                  ? "bg-emerald-600 text-white"
                  : lesson.completed
                  ? "bg-emerald-50 dark:bg-emerald-900/20"
                  : "hover:bg-accent"
              }`}
            >
              <span className="shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs">
                {lesson.completed ? <CheckCircle size={14} className="text-emerald-500" /> : i + 1}
              </span>
              <span className="truncate">{lesson.title}</span>
            </button>
          ))}
        </div>

        {/* ✅ Final Exam – داخل الشريط الجانبي */}
        <div className="mt-4 pt-4 border-t border-border/50">
          {allCompleted ? (
            <Link
              href={`/dashboard/student/exam/${courseId}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition w-full"
            >
              <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-xs text-black font-bold">?</span>
              <span className="text-sm font-medium text-accent-foreground"><T>Final Exam</T></span>
            </Link>
          ) : (
            <button
              onClick={() => alert("Please complete all lessons before taking the exam.")}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50 opacity-60 cursor-not-allowed w-full"
            >
              <span className="shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs">!</span>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-serif text-2xl md:text-3xl">{currentLesson.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentLesson.type === "zoom" ? <T>Live Session</T> : <T>Recorded Lesson</T>}
                </p>
              </div>
              <button
                onClick={handleComplete}
                disabled={currentLesson.completed || completing}
                className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ${
                  currentLesson.completed ? "bg-emerald-100 text-emerald-600 cursor-default" : "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                }`}
              >
                {currentLesson.completed ? <><CheckCircle size={18} /> <T>Completed</T></> : <><Play size={18} /> <T>Mark as Complete</T></>}
              </button>
            </div>
            {currentLesson.files && currentLesson.files.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h3 className="font-serif text-lg mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-secondary-foreground" /> <T>Lesson Resources</T>
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {currentLesson.files.map((file, i) => (
                    <a key={i} href={file.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl border bg-background p-3 hover:bg-accent transition">
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
            user={user}
          />
        )}
      </main>
    </div>
  );
}