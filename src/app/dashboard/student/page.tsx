"use client";

import { T } from "@/components/TranslatedText";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Award, Copy, GraduationCap, Trophy, ChevronRight,
  BookOpen, Loader2, Video, Clock, Play,
  Users, BarChart3, DollarSign, TrendingUp, Wallet, Calendar,
} from "lucide-react";
import { motion } from "framer-motion";
import { YouTubeEmbed } from "@/components/ui/YouTubeEmbed";

interface DashboardData {
  firstName: string;
  streak: number;
  inProgress: {
    title: string;
    next: string;
    progress: number;
    courseId: string;
  }[];
  completed: {
    title: string;
    date: string;
    recording_url?: string;
  }[];
  sessions: {
    id: string;
    title: string;
    scheduled_at: string;
    course_title: string;
    teacher_name: string;
    meeting_url?: string;
  }[];
  referral: {
    code: string;
    count: number;
    credits: number;
  };
}

export default function StudentDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<{
    url: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((token) =>
      fetch("/api/student/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          setData(d);
        })
        .catch(console.error)
        .finally(() => setLoading(false)),
    );
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

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 md:px-8 min-h-screen bg-background">
      {/* Banner */}
      <div className="flex flex-col gap-4 rounded-3xl border bg-card p-6 shadow-elegant md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-accent-foreground">
            As-salāmu ʿalaykum
          </div>
          <h1 className="font-serif text-3xl">
            Welcome back, {data.firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Continue where you left off — every word is a victory.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm">
          <Trophy className="h-4 w-4 text-accent-foreground" />{" "}
          {data.streak}-day streak
        </div>
      </div>

      {/* In Progress */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-accent-foreground">
              Continue your studies
            </div>
            <h2 className="font-serif text-2xl">In Progress</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {data.inProgress.map((c) => (
            <div
              key={c.courseId}
              className="rounded-3xl border bg-card p-5 shadow-elegant"
            >
              <h3 className="font-serif text-lg">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.next}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-primary"
                  style={{ width: `${c.progress}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {c.progress}% complete
                </span>
                <Link
                  href={`/dashboard/student/courses/${c.courseId}`}
                  className="font-semibold text-primary hover:underline"
                >
                  Resume →
                </Link>
              </div>
            </div>
          ))}
          {data.inProgress.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No courses in progress.
            </div>
          )}
        </div>
      </section>

      {/* Completed */}
      {data.completed.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-accent-foreground">
                Your achievements
              </div>
              <h2 className="font-serif text-2xl">Completed</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {data.completed.map((c) => (
              <div
                key={c.title}
                className="flex items-center gap-3 rounded-3xl border bg-card p-5"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-serif text-base">{c.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Completed {c.date}
                  </div>
                  {c.recording_url && (
                    <button
                      onClick={() =>
                        setSelectedRecording({
                          url: c.recording_url!,
                          title: c.title,
                        })
                      }
                      className="mt-1 text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Play size={12} /> Watch recording
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live sessions calendar */}
        <div className="lg:col-span-2">
          <div className="rounded-3xl border bg-card p-6 shadow-elegant">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent-foreground">
                  <Calendar className="h-4 w-4" /> Live Sessions
                </div>
                <h3 className="mt-1 font-serif text-2xl">
                  Upcoming Zoom Calendar
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              {data.sessions.map((s) => {
                const sessionDate = new Date(s.scheduled_at);
                const joinable =
                  new Date().getTime() >=
                  sessionDate.getTime() - 10 * 60 * 1000;
                return (
                  <div
                    key={s.id}
                    className="group flex items-center gap-4 rounded-2xl border bg-background p-4 transition hover:border-primary/40"
                  >
                    <div className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-gradient-primary text-primary-foreground">
                      <div className="text-center leading-tight">
                        <div className="text-[10px] uppercase tracking-wider opacity-70">
                          {sessionDate.toLocaleDateString("en-US", {
                            weekday: "short",
                          })}
                        </div>
                        <div className="font-serif text-xl">
                          {sessionDate.getDate()}
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{s.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />{" "}
                          {sessionDate.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-accent-foreground">
                          {s.course_title || "Course"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-primary">
                          <BookOpen className="h-3 w-3" />{" "}
                          {s.teacher_name || "Teacher"}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/live/${s.id}`}
                      className={`inline-flex flex-none items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                        joinable
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-muted text-muted-foreground pointer-events-none"
                      }`}
                    >
                      {joinable ? (
                        <>
                          <Video className="h-3.5 w-3.5" /> Join Zoom
                        </>
                      ) : (
                        <>
                          <Clock className="h-3.5 w-3.5" /> Wait
                        </>
                      )}
                    </Link>
                  </div>
                );
              })}
              {data.sessions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No upcoming sessions.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Stats */}
          <div className="rounded-4xl border bg-card p-6 shadow-elegant">
            <div className="text-xs font-semibold uppercase tracking-widest text-accent-foreground">
              Stats
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enrolled</span>
                <span className="font-semibold">
                  {data.inProgress.length + data.completed.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-semibold">
                  {data.completed.length}
                </span>
              </div>
            </div>
          </div>

          {/* Referral */}
          <div className="rounded-4xl border bg-card p-6 shadow-elegant">
            <div className="text-xs font-semibold uppercase tracking-widest text-accent-foreground">
              Referral Center
            </div>
            <h3 className="mt-2 font-serif text-xl">Share the Academy</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Earn credits for every friend who joins.
            </p>
            <div className="mt-5 flex items-center gap-2 rounded-xl border bg-background p-2 text-xs">
              <code className="flex-1 truncate px-2">
                {data.referral.code}
              </code>
              <button className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Copy size={14} />
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 text-center">
              <div className="rounded-2xl border bg-background p-4">
                <div className="font-serif text-2xl">
                  {data.referral.count}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Referrals
                </div>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <div className="font-serif text-2xl text-primary">
                  ${data.referral.credits}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Credits
                </div>
              </div>
            </div>
          </div>

          <Link
            href="/marketplace"
            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-accent-foreground/20 bg-accent/5 p-4 text-sm font-bold text-accent-foreground hover:bg-accent/10"
          >
            Explore Marketplace →
          </Link>
        </div>
      </div>

      {/* Recording Modal */}
      {selectedRecording && (
        <div className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-lg">
                {selectedRecording.title}
              </h3>
              <button
                onClick={() => setSelectedRecording(null)}
                className="text-sm text-muted-foreground hover:underline"
              >
                Close
              </button>
            </div>
            <YouTubeEmbed
              url={selectedRecording.url}
              title={selectedRecording.title}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}