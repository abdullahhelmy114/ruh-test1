"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Loader2, CheckCircle2, XCircle, Clock, Video, FileText, ArrowLeft, Play } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { YouTubeEmbed } from "@/components/ui/YouTubeEmbed";

interface PendingLesson {
  id: string;
  title: string;
  type: "zoom" | "recorded";
  status: "pending" | "approved" | "rejected";
  scheduled_at: string | null;
  teacher_uid: string;
  course_id: string;
  course_title: string;
  created_at: string;
  meeting_url: string | null;
  meeting_id: string | null;
  recording_url?: string;
}

export default function PendingLessonsPage() {
  const { user, role, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [lessons, setLessons] = useState<PendingLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (role !== "admin") { router.push("/"); return; }
    fetchLessons();
  }, [authLoading, user, router]);

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lessons?status=pending");
      if (res.ok) {
        const data = await res.json();
        setLessons(data.lessons || []);
      }
    } catch (err) {
      console.error("Failed to fetch pending lessons:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (lessonId: string, status: "approved" | "rejected") => {
    setActionId(lessonId);
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          meetingUrl: status === "approved" ? `https://zoom.us/j/${Date.now()}` : null,
          meetingId: status === "approved" ? `${Date.now()}` : null,
        }),
      });
      if (res.ok) {
        setLessons((prev) => prev.filter((l) => l.id !== lessonId));
      }
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setActionId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/admin" className="p-2 rounded-full hover:bg-accent transition">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-serif text-2xl">Pending Lessons</h1>
          <p className="text-sm text-muted-foreground">{lessons.length} lessons awaiting review</p>
        </div>
      </div>

      {lessons.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No pending lessons</p>
        </div>
      ) : (
        <div className="space-y-4">
          {lessons.map((lesson) => (
            <motion.div
              key={lesson.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-3xl p-6 shadow-elegant"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {lesson.type === "zoom" ? (
                      <Video className="h-5 w-5 text-secondary-foreground" />
                    ) : (
                      <FileText className="h-5 w-5 text-emerald" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-serif text-lg">{lesson.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Course: {lesson.course_title} · Type: {lesson.type === "zoom" ? "Live Zoom" : "Recorded"}
                    </p>
                    {lesson.scheduled_at && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Scheduled: {new Date(lesson.scheduled_at).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Submitted: {new Date(lesson.created_at).toLocaleString()}
                    </p>
                    {lesson.recording_url && (
                      <div className="mt-2">
                        <YouTubeEmbed url={lesson.recording_url} title={lesson.title} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 self-end">
                  <button
                    onClick={() => handleAction(lesson.id, "rejected")}
                    disabled={actionId === lesson.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                  <button
                    onClick={() => handleAction(lesson.id, "approved")}
                    disabled={actionId === lesson.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-emerald-600 to-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {actionId === lesson.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Approve
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}