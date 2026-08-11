"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Award, Copy, GraduationCap, Trophy, ChevronRight,
  BookOpen, Loader2, Video, Clock, Play,
  Users, TrendingUp, Wallet, Calendar,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { YouTubeEmbed } from "@/components/ui/YouTubeEmbed";
import { T } from "@/components/TranslatedText";

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
        .then((d) => setData(d))
        .catch(console.error)
        .finally(() => setLoading(false))
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
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user || !data) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 md:px-8 min-h-screen bg-background">
      {/* Banner */}
      <div className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-elegant md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-amber-500">
            As-salāmu ʿalaykum
          </div>
          <h1 className="font-serif text-3xl text-gray-900">
            Welcome back, {data.firstName}
          </h1>
          <p className="text-sm text-gray-500">
            Continue where you left off — every word is a victory.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-background px-4 py-2 text-sm">
          <Trophy className="h-4 w-4 text-amber-500" /> {data.streak}-day streak
        </div>
      </div>

      {/* In Progress */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-amber-500">
              Continue your studies
            </div>
            <h2 className="font-serif text-2xl text-gray-900">In Progress</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {data.inProgress.map((c) => (
            <div
              key={c.courseId}
              className="rounded-3xl border border-gray-200 bg-white p-5 shadow-elegant"
            >
              <h3 className="font-serif text-lg text-gray-900">{c.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{c.next}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-gradient-gold"
                  style={{ width: `${c.progress}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-gray-500">{c.progress}% complete</span>
                <Link
                  href={`/dashboard/student/courses/${c.courseId}`}
                  className="font-semibold text-amber-500 hover:underline"
                >
                  Resume →
                </Link>
              </div>
            </div>
          ))}
          {data.inProgress.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
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
              <div className="text-xs uppercase tracking-widest text-amber-500">
                Your achievements
              </div>
              <h2 className="font-serif text-2xl text-gray-900">Completed</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {data.completed.map((c) => (
              <div
                key={c.title}
                className="flex items-center gap-3 rounded-3xl border border-gray-200 bg-white p-5"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-gold text-black">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-serif text-base text-gray-900">{c.title}</div>
                  <div className="text-xs text-gray-500">Completed {c.date}</div>
                  {c.recording_url && (
                    <button
                      onClick={() =>
                        setSelectedRecording({ url: c.recording_url!, title: c.title })
                      }
                      className="mt-1 text-xs font-medium text-amber-500 hover:underline inline-flex items-center gap-1"
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
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-elegant">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-amber-500">
                  <Calendar className="h-4 w-4" /> Live Sessions
                </div>
                <h3 className="mt-1 font-serif text-2xl text-gray-900">Upcoming Zoom Calendar</h3>
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
                    className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-background p-4 transition hover:border-amber-500/40"
                  >
                    <div className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-gradient-emerald text-white">
                      <div className="text-center leading-tight">
                        <div className="text-[10px] uppercase tracking-wider opacity-70">
                          {sessionDate.toLocaleDateString("en-US", {
                            weekday: "short",
                          })}
                        </div>
                        <div className="font-serif text-xl">{sessionDate.getDate()}</div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-900">{s.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />{" "}
                          {sessionDate.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="rounded-full bg-amber-100 text-emerald-700 px-2 py-0.5">
                          {s.course_title || "Course"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-amber-500">
                          <BookOpen className="h-3 w-3" /> {s.teacher_name || "Teacher"}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/live/${s.id}`}
                      className={`inline-flex flex-none items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                        joinable
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-gray-200 text-gray-500 pointer-events-none"
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
                <div className="text-center py-8 text-gray-500">
                  No upcoming sessions.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Stats */}
          <div className="rounded-4xl border border-gray-200 bg-white p-6 shadow-elegant">
            <div className="text-xs font-semibold uppercase tracking-widest text-amber-500">Stats</div>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Enrolled</span>
                <span className="font-semibold text-gray-900">{data.inProgress.length + data.completed.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Completed</span>
                <span className="font-semibold text-gray-900">{data.completed.length}</span>
              </div>
            </div>
          </div>

          {/* Referral */}
          <div className="rounded-4xl border border-gray-200 bg-white p-6 shadow-elegant">
            <div className="text-xs font-semibold uppercase tracking-widest text-amber-500">Referral Center</div>
            <h3 className="mt-2 font-serif text-xl text-gray-900">Share the Academy</h3>
            <p className="mt-2 text-xs text-gray-500">Earn credits for every friend who joins.</p>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-gray-200 bg-background p-2 text-xs">
              <code className="flex-1 truncate px-2">{data.referral.code}</code>
              <button className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-white">
                <Copy size={14} />
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 text-center">
              <div className="rounded-2xl border border-gray-200 bg-background p-4">
                <div className="font-serif text-2xl text-gray-900">{data.referral.count}</div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Referrals</div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-background p-4">
                <div className="font-serif text-2xl text-emerald-600">${data.referral.credits}</div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Credits</div>
              </div>
            </div>
          </div>

          <Link
            href="/marketplace"
            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-500/40 bg-amber-100/30 p-4 text-sm font-bold text-emerald-700 hover:bg-amber-100/50"
          >
            Explore Marketplace →
          </Link>
        </div>
      </div>

      {/* Recording Modal */}
      {selectedRecording && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto p-4 shadow-elegant"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-lg text-gray-900">{selectedRecording.title}</h3>
              <button
                onClick={() => setSelectedRecording(null)}
                className="text-sm text-gray-500 hover:underline"
              >
                Close
              </button>
            </div>
            <YouTubeEmbed url={selectedRecording.url} title={selectedRecording.title} />
          </motion.div>
        </div>
      )}
    </div>
  );
}