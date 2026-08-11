"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clock, Calendar, User, Play, X, CreditCard, Hourglass } from "lucide-react";
import { T } from "@/components/TranslatedText";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { PaymentModal } from "@/components/PaymentModal";

interface Course {
  id: string;
  title: string;
  description?: string;
  instructor_name?: string;
  thumbnail_url?: string;
  intro_video_url?: string;
  price: number;
  old_price?: number;
  launch_date?: string;
  course_duration?: string;
  lesson_duration?: string;
  level?: string;
}

function getYouTubeEmbedUrl(url: string): string {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : "";
}

// ──────────────────────────────────────────────
//  Advanced Countdown Timer with progress bar
// ──────────────────────────────────────────────
function AdvancedCountdown({ targetDate }: { targetDate: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const launch = useMemo(() => new Date(targetDate), [targetDate]);
  const diff = launch.getTime() - now;

  if (diff <= 0) return null;

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // An imaginary progress:  100%  –  (remaining / total) * 100
  const totalLaunchWindow = 30 * 24 * 60 * 60 * 1000; // 30 days reference
  const progress = Math.max(0, Math.min(100, ((totalLaunchWindow - diff) / totalLaunchWindow) * 100));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
        <Hourglass size={14} className="animate-pulse" />
        <T>Launching in</T>
      </div>

      {/* Countdown digits */}
      <div className="flex items-center justify-center gap-3 text-2xl font-bold tabular-nums text-gray-900">
        <div className="flex flex-col items-center">
          <span className="bg-accent/10 text-accent px-2 py-1 rounded-lg min-w-[3rem] text-center">{days.toString().padStart(2, "0")}</span>
          <span className="text-[10px] text-gray-500 mt-1">Days</span>
        </div>
        <span className="text-gray-500">:</span>
        <div className="flex flex-col items-center">
          <span className="bg-accent/10 text-accent px-2 py-1 rounded-lg min-w-[3rem] text-center">{hours.toString().padStart(2, "0")}</span>
          <span className="text-[10px] text-gray-500 mt-1">Hrs</span>
        </div>
        <span className="text-gray-500">:</span>
        <div className="flex flex-col items-center">
          <span className="bg-accent/10 text-accent px-2 py-1 rounded-lg min-w-[3rem] text-center">{minutes.toString().padStart(2, "0")}</span>
          <span className="text-[10px] text-gray-500 mt-1">Min</span>
        </div>
        <span className="text-gray-500">:</span>
        <div className="flex flex-col items-center">
          <span className="bg-accent/10 text-accent px-2 py-1 rounded-lg min-w-[3rem] text-center">{seconds.toString().padStart(2, "0")}</span>
          <span className="text-[10px] text-gray-500 mt-1">Sec</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent to-primary transition-all duration-1000 ease-linear rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-500 text-center">
        {launch.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────
//  Main CourseCard component
// ──────────────────────────────────────────────
export function CourseCard({ course }: { course: Course }) {
  const { user } = useAuth();
  const [showVideo, setShowVideo] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const launchDate = course.launch_date ? new Date(course.launch_date) : null;
  const isLaunched = !launchDate || launchDate <= new Date();
  const embedUrl = course.intro_video_url ? getYouTubeEmbedUrl(course.intro_video_url) : "";

  const handleBuy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPayment(true);
  };

  return (
    <>
      <Link href={`/courses/${course.id}`} className="block group h-full">
        <div className="glass rounded-2xl overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer border border-gray-200/50 h-full flex flex-col">

          {/* ─── Thumbnail / Video Section ─── */}
          <div className="relative w-full h-48 bg-gradient-to-br from-primary/20 to-accent/20">
            {course.thumbnail_url ? (
              <Image
                src={course.thumbnail_url}
                alt={course.title}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex items-center justify-center h-full text-primary/50">
                <Play size={48} />
              </div>
            )}
            {embedUrl && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowVideo(true);
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <div className="bg-white/90 rounded-full p-3 shadow-lg">
                  <Play size={28} className="text-primary" />
                </div>
              </button>
            )}
            {/* Level badge */}
            {course.level && (
              <span className="absolute top-2 left-2 bg-emerald-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                {course.level}
              </span>
            )}
            {/* Upcoming badge */}
            {!isLaunched && launchDate && (
              <span className="absolute top-2 right-2 bg-amber-100text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">
                <T>Upcoming</T>
              </span>
            )}
          </div>

          {/* ─── Card Body ─── */}
          <div className="p-5 flex flex-col flex-1 space-y-4">
            {/* Title & Instructor */}
            <div>
              <h3 className="font-bold text-xl leading-tight text-gray-900 line-clamp-2">{course.title}</h3>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <User size={14} />
                {course.instructor_name || "Dr. Jehan Ali Ziad"}
              </p>
            </div>

            {/* Description */}
            {course.description && (
              <p className="text-sm text-gray-500 line-clamp-3">{course.description}</p>
            )}

            {/* Meta info */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              {course.course_duration && (
                <span className="flex items-center gap-1">
                  <Calendar size={14} /> {course.course_duration}
                </span>
              )}
              {course.lesson_duration && (
                <span className="flex items-center gap-1">
                  <Clock size={14} /> {course.lesson_duration}
                </span>
              )}
            </div>

            {/* Countdown (if not launched) */}
            {launchDate && !isLaunched && (
              <AdvancedCountdown targetDate={course.launch_date!} />
            )}

            {/* Footer: Price & Action */}
            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-200/50">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-primary">
                  ${course.price}
                </span>
                {course.old_price && (
                  <span className="text-sm text-gray-500 line-through">
                    ${course.old_price}
                  </span>
                )}
              </div>
              <button
                onClick={handleBuy}
                className="rounded-full bg-emerald-600 text-white px-4 py-1.5 text-xs font-semibold hover:bg-emerald-700 transition flex items-center gap-1"
              >
                <CreditCard size={14} />
                {isLaunched ? <T>Buy Now</T> : <T>Details</T>}
              </button>
            </div>
          </div>
        </div>
      </Link>

      {/* ─── Video Popup ─── */}
      {showVideo && embedUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-black rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowVideo(false)}
              className="absolute top-3 right-3 z-10 bg-white/20 hover:bg-white/40 text-white rounded-full p-1.5"
            >
              <X size={20} />
            </button>
            <div className="aspect-video">
              <iframe src={embedUrl} className="w-full h-full" allowFullScreen title={course.title} />
            </div>
          </div>
        </div>
      )}

      {/* ─── Payment Modal ─── */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        courseTitle={course.title}
        userEmail={user?.email ?? undefined}
      />
    </>
  );
}