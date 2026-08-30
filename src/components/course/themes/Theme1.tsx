"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  Loader2, CreditCard, Clock, BookOpen, Calendar,
  PlayCircle, FileVideo,
} from "lucide-react";
import { T } from "@/components/TranslatedText";
import { formatPrice } from "@/lib/utils";

interface ThemeProps {
  variant: "adult" | "kids";
  course: {
    id: string;
    title: string;
    description?: string;
    instructor_name?: string;
    intro_video_url?: string;
    image_url?: string;
    price: number;
    payment_url?: string | null;
    launch_date?: string;
    course_duration?: string;
    lesson_duration?: string;
    theme?: string;
  };
}

const isYouTubeUrl = (url: string) =>
  url.includes("youtube.com") || url.includes("youtu.be");

const isLocalVideo = (url: string) =>
  url.startsWith("/api/uploads/") || url.endsWith(".mp4") || url.endsWith(".webm");

export default function Theme1({ variant, course }: ThemeProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState("");
  const [videoError, setVideoError] = useState(false);

  const isKids = variant === "kids";

  const colors = {
    primary: isKids ? "#FFA726" : "#2D5A3E",
    accent: isKids ? "#FF7043" : "#D4742B",
    bg: isKids ? "#FFF8E1" : "#FDFBF7",
    card: isKids ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.7)",
    text: isKids ? "#4E342E" : "#1A3D2A",
    muted: isKids ? "#8D6E63" : "#5A6E5A",
    font: isKids ? '"Baloo 2", cursive' : '"Cormorant Garamond", serif',
    radius: isKids ? "2rem" : "1.5rem",
    shadow: "0 4px 30px rgba(0,0,0,0.05)",
  };

  const launchDate = course.launch_date ? new Date(course.launch_date) : null;
  const isLaunched = !launchDate || launchDate <= new Date();

  useEffect(() => {
    if (!launchDate || isLaunched) return;

    const updateTimer = () => {
      const diff = launchDate.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("");
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${d}d ${h}h ${m}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [launchDate, isLaunched]);

  const renderMedia = () => {
    if (course.intro_video_url && isYouTubeUrl(course.intro_video_url)) {
      return (
        <iframe
          src={course.intro_video_url.replace("watch?v=", "embed/")}
          className="w-full h-64 md:h-80"
          allowFullScreen
        />
      );
    }

    if (course.intro_video_url && isLocalVideo(course.intro_video_url)) {
      return (
        <video
          src={course.intro_video_url}
          className="w-full h-64 md:h-80 object-cover"
          controls
          onError={() => setVideoError(true)}
        />
      );
    }

    if (course.image_url) {
      return (
        <img
          src={course.image_url}
          alt={course.title}
          className="w-full h-64 md:h-80 object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      );
    }

    return (
      <div className="w-full h-64 md:h-80 flex items-center justify-center bg-gradient-to-br from-emerald-800 to-emerald-900 text-white/30">
        <BookOpen className="h-24 w-24" />
      </div>
    );
  };

  return (
    <div
      style={{
        backgroundColor: colors.bg,
        fontFamily: colors.font,
        color: colors.text,
      }}
      className="min-h-screen"
    >
      <div className="max-w-6xl mx-auto px-4 py-10 md:px-8 space-y-12">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div
              className="rounded-3xl overflow-hidden relative"
              style={{ borderRadius: colors.radius, boxShadow: colors.shadow }}
            >
              {renderMedia()}
            </div>

            <div>
              <h1 className="text-3xl md:text-4xl font-bold" style={{ color: colors.primary }}>
                {course.title}
              </h1>
              <p className="text-sm mt-2" style={{ color: colors.muted }}>
                <T>Instructor</T> {course.instructor_name || "Dr. Jehan Ali Ziad"}
              </p>
              <div className="flex flex-wrap gap-4 mt-4 text-sm" style={{ color: colors.muted }}>
                {course.course_duration && (
                  <span className="flex items-center gap-1">
                    <Calendar size={16} /> {course.course_duration}
                  </span>
                )}
                {course.lesson_duration && (
                  <span className="flex items-center gap-1">
                    <Clock size={16} /> {course.lesson_duration}
                  </span>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4" style={{ color: colors.primary }}>
                <T>What You Will Learn</T>
              </h2>
              <div className="prose max-w-none leading-relaxed" style={{ color: colors.text }}>
                {course.description || <T>No description yet.</T>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div
              className="p-6 sticky top-24"
              style={{
                backgroundColor: colors.card,
                borderRadius: colors.radius,
                boxShadow: colors.shadow,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <div className="text-3xl font-bold" style={{ color: colors.accent }}>
                {formatPrice(Number(course.price))}
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: colors.muted }}><T>Duration</T></span>
                  <span className="font-medium">{course.course_duration || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: colors.muted }}><T>Lesson Duration</T></span>
                  <span className="font-medium">{course.lesson_duration || "—"}</span>
                </div>
              </div>

              {!isLaunched && launchDate && (
                <div
                  className="mt-4 rounded-xl p-3 text-center text-sm font-medium"
                  style={{ backgroundColor: colors.accent + "20", color: colors.accent }}
                >
                  <T>Starts in</T> {timeLeft}
                </div>
              )}

              {course.price > 0 && (
                <div className="mt-6">
                  {isLaunched && course.payment_url ? (
                    <a
                      href={course.payment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full rounded-full py-3 text-sm font-semibold text-white transition hover:opacity-90 flex items-center justify-center gap-2"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <CreditCard size={16} />
                      <T>Buy Now</T>
                    </a>
                  ) : (
                    <button
                      disabled
                      className="w-full rounded-full py-3 text-sm font-semibold text-white opacity-70 cursor-not-allowed"
                      style={{ backgroundColor: colors.muted }}
                    >
                      <T>Coming Soon</T>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}