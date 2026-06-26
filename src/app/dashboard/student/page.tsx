"use client";

import { T } from "@/components/TranslatedText";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Award, Copy, GraduationCap, Trophy, ChevronRight,
  BookOpen, Loader2, Video, Clock, Play,
  Users, BarChart3, DollarSign,
} from "lucide-react";
import { motion } from "framer-motion";
import { YouTubeEmbed } from "@/components/ui/YouTubeEmbed";

interface EnrolledCourse {
  id: string; // live_course_id
  title: string;
  level: string;
  total_lessons: number;
  completed_lessons: number;
  teacher_name: string;
}

interface LiveSession {
  id: string;
  title: string;
  scheduled_at: string;
  course_title: string;
  teacher_name: string;
}

interface DashboardData {
  firstName: string;
  streak: number;
  enrolledCourses: EnrolledCourse[];
  completedCourses: { title: string; date: string; recording_url?: string }[];
  sessions: LiveSession[];
  referral: { code: string; count: number; credits: number };
}

export default function StudentDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/student/dashboard", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        setData(d);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !data) return null;

  const isJoinable = (scheduledAt: string) => {
    const now = new Date();
    const t = new Date(scheduledAt);
    return now >= new Date(t.getTime() - 10 * 60 * 1000) && now <= new Date(t.getTime() + 60 * 60 * 1000);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 md:px-8 min-h-screen bg-background">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-4xl border border-border bg-card p-8 shadow-lg flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative z-10">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-foreground">
            <T>السلام عليكم</T>
          </div>
          <h1 className="mt-1 font-serif text-3xl md:text-4xl text-foreground">
            <T>مرحباً بعودتك،</T> {data.firstName}
          </h1>
          <p className="mt-2 text-sm italic text-muted-foreground">
            <T>واصل من حيث توقفت — كل كلمة انتصار.</T>
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-accent/20 bg-background/50 px-5 py-2.5 text-sm font-semibold">
          <Trophy className="h-5 w-5 text-accent" />
          {data.streak}
          <T>-أيام متتالية</T>
        </div>
      </div>

      {/* Live Sessions */}
      {data.sessions?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="live-sessions glass rounded-3xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Video className="h-5 w-5 text-accent-foreground" />
            <h2 className="font-serif text-xl text-foreground">
              <T>جلسات مباشرة قادمة</T>
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {data.sessions.map(s => {
              const joinable = isJoinable(s.scheduled_at);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-background/50 rounded-2xl p-4 border"
                >
                  <div>
                    <h3 className="font-serif text-sm font-semibold text-foreground">{s.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {s.course_title} · {s.teacher_name}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                      <Clock size={12} />
                      {new Date(s.scheduled_at).toLocaleString("ar-EG", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                  <Link
                    href={`/live/${s.id}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                      joinable
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-muted-foreground pointer-events-none"
                    }`}
                  >
                    {joinable ? (
                      <>
                        <ChevronRight size={14} /> <T>انضم الآن</T>
                      </>
                    ) : (
                      <>
                        <Clock size={14} /> <T>انتظار</T>
                      </>
                    )}
                  </Link>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          {/* My Courses */}
          <section className="your-courses">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-accent-foreground">
              <T>كورساتي</T>
            </div>
            <h2 className="font-serif text-2xl text-foreground">
              <T>الكورسات المسجل بها</T>
            </h2>
            <div className="mt-4 space-y-4">
              {data.enrolledCourses.length === 0 ? (
                <div className="rounded-4xl border bg-card p-8 text-center text-muted-foreground">
                  <BookOpen className="mx-auto h-8 w-8 text-accent-foreground/50 mb-3" />
                  <p>
                    <T>لم تلتحق بأي كورس بعد.</T>
                  </p>
                  <Link
                    href="/marketplace"
                    className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    <T>تصفح السوق ←</T>
                  </Link>
                </div>
              ) : (
                data.enrolledCourses.map(c => (
                  <div key={c.id} className="rounded-3xl border bg-card p-5 shadow-lg">
                    <h3 className="font-serif text-lg text-foreground">{c.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      <T>المستوى</T> {c.level} · <T>المعلم</T>: {c.teacher_name}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${(c.completed_lessons / c.total_lessons) * 100 || 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {c.completed_lessons}/{c.total_lessons}
                      </span>
                    </div>
                    <Link
                      href={`/dashboard/student/courses/${c.id}`}
                      className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
                    >
                      <T>عرض الكورس ←</T>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Completed Courses */}
          {data.completedCourses?.length > 0 && (
            <section>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-accent-foreground">
                <T>إنجازاتك</T>
              </div>
              <h2 className="font-serif text-2xl text-foreground">
                <T>مكتملة</T>
              </h2>
              <div className="mt-4 space-y-3">
                {data.completedCourses.map(c => (
                  <div
                    key={c.title}
                    className="flex items-center gap-3 rounded-2xl border bg-card p-4"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/20 text-accent-foreground">
                      <Award className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-serif text-sm">{c.title}</div>
                      <div className="text-xs text-muted-foreground">
                        <T>أكملت</T> {c.date}
                      </div>
                    </div>
                    {c.recording_url && (
                      <button
                        onClick={() =>
                          setSelectedRecording({ url: c.recording_url!, title: c.title })
                        }
                        className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground flex items-center gap-1"
                      >
                        <Play size={12} /> <T>مشاهدة</T>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Stats */}
          <div className="rounded-4xl border bg-card p-6 shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-widest text-accent-foreground">
              <T>إحصائيات</T>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground"><T>الكورسات</T></span>
                <span className="font-semibold text-foreground">{data.enrolledCourses.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground"><T>مكتملة</T></span>
                <span className="font-semibold text-foreground">{data.completedCourses.length}</span>
              </div>
            </div>
          </div>

          {/* Referral */}
          <div className="rounded-4xl border bg-card p-6 shadow-lg">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-foreground">
              <T>الإحالات</T>
            </div>
            <h3 className="mt-2 font-serif text-xl text-foreground">
              <T>شارك الأكاديمية</T>
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              <T>اربح أرصدة عن كل صديق ينضم.</T>
            </p>
            <div className="mt-5 flex items-center gap-2 rounded-xl border bg-background p-2 text-xs">
              <code className="flex-1 truncate px-2">{data.referral.code}</code>
              <button className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Copy size={14} />
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 text-center">
              <div className="rounded-2xl border bg-background p-4">
                <div className="font-serif text-2xl">{data.referral.count}</div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <T>إحالات</T>
                </div>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <div className="font-serif text-2xl text-primary">
                  ${data.referral.credits}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <T>أرصدة</T>
                </div>
              </div>
            </div>
          </div>

          <Link
            href="/marketplace"
            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-4 text-sm font-bold text-accent-foreground hover:bg-accent/10"
          >
            <T>استكشف السوق ←</T>
          </Link>
        </div>
      </div>

      {/* Recording Modal */}
      {selectedRecording && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-lg">{selectedRecording.title}</h3>
              <button
                onClick={() => setSelectedRecording(null)}
                className="text-sm text-muted-foreground hover:underline"
              >
                <T>إغلاق</T>
              </button>
            </div>
            <YouTubeEmbed url={selectedRecording.url} title={selectedRecording.title} />
          </motion.div>
        </div>
      )}
    </div>
  );
}