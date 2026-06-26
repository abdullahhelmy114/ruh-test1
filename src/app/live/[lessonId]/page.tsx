"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Loader2, Users, MessageSquare, Maximize2, Minimize2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { YouTubeEmbed } from "@/components/ui/YouTubeEmbed";
import { T } from "@/components/TranslatedText";

interface LessonInfo {
  id: string;
  title: string;
  meetingUrl: string;
  meetingId: string;
  teacherUid: string;
  courseId: string;
  recording_url?: string;
}

export default function LiveLessonPage() {
  const { user, isLoading: authLoading, role } = useAuth();
  const router = useRouter();
  const params = useParams<{ lessonId: string }>();
  const [lesson, setLesson] = useState<LessonInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    fetchLesson();
  }, [authLoading, user]);

  const fetchLesson = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/lessons/${params.lessonId}/zoom`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to load lesson");
        return;
      }
      const data = await res.json();
      setLesson(data);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const canJoin = lesson && user && (
    (role === "teacher" && user.uid === lesson.teacherUid) ||
    (role === "admin") ||
    (role === "student")
  );

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-gold" />
      </div>
    );
  }

  if (!user) return null;

  if (error || !lesson) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center glass rounded-3xl p-12 max-w-md">
          <h1 className="font-serif text-2xl mb-3"><T>Unavailable</T></h1>
          <p className="text-muted-foreground">{error || <T>The lesson does not exist</T>}</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 text-accent-foreground hover:underline">
            <ArrowLeft size={16} /> <T>Back to Home</T>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background ${fullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border glass">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/teacher" className="p-2 rounded-full hover:bg-accent">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-serif text-lg">{lesson.title}</h1>
            <p className="text-xs text-muted-foreground">
              {role === "teacher" || role === "admin" ? <T>Host</T> : <T>Attendee</T>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-full hover:bg-accent"
          >
            <MessageSquare size={18} />
          </button>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-2 rounded-full hover:bg-accent"
          >
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-57px)]">
        {/* Zoom iframe */}
        <div className={`flex-1 relative ${fullscreen ? 'fixed inset-0 z-50' : ''}`}>
          {canJoin ? (
            <iframe
              src={lesson.meetingUrl}
              className="w-full h-full border-0"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              title="Zoom Meeting"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center glass rounded-3xl p-12 max-w-md">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <h2 className="font-serif text-xl mb-2"><T>Unauthorized</T></h2>
                <p className="text-sm text-muted-foreground">
                  <T>You do not have permission to attend this lesson.</T>
                </p>
              </div>
            </div>
          )}

          {/* YouTube Recording after lecture */}
          {lesson.recording_url && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-0 left-0 right-0 bg-black/80 p-4"
            >
              <div className="max-w-4xl mx-auto">
                <h3 className="font-serif text-lg text-white mb-3"><T>📺 Lesson Recording</T></h3>
                <YouTubeEmbed url={lesson.recording_url} title={lesson.title} />
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        {sidebarOpen && !fullscreen && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 300 }}
            className="border-l border-border bg-card/50 backdrop-blur overflow-y-auto"
          >
            <div className="p-4">
              <h2 className="font-serif text-lg mb-3 flex items-center gap-2">
                <MessageSquare size={16} /> <T>Chat & Notes</T>
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                <T>Chat and notes will be activated later</T>
              </p>
              <div className="space-y-2">
                <div className="bg-accent/30 rounded-xl p-3 text-xs">
                  <span className="font-semibold"><T>System:</T></span> <T>Welcome to the live session.</T>
                </div>
                <div className="bg-accent/30 rounded-xl p-3 text-xs">
                  <span className="font-semibold"><T>System:</T></span> <T>You can use this space to jot down your notes.</T>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}