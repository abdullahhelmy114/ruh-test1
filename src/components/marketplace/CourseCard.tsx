"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clock, Calendar, User, BadgeCheck, Timer, CreditCard, Play, X } from "lucide-react";
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

/* ------------------------------------------------------------------ */
/*  Advanced Countdown Timer (لإظهار العد التنازلي)                   */
/* ------------------------------------------------------------------ */
function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [now, setNow] = useState(Date.now());

  useState(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  });

  const diff = new Date(targetDate).getTime() - now;
  if (diff <= 0) return null;

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 1000) / 1000);

  const units = [
    { value: days, label: <T>Days</T> },
    { value: hours, label: <T>Hrs</T> },
    { value: minutes, label: <T>Min</T> },
    { value: seconds, label: <T>Sec</T> },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {units.map((unit) => (
        <div
          key={unit.label?.toString()}
          className="rounded-xl border border-accent/30 bg-accent/10 px-1 py-2 text-center"
        >
          <div className="font-serif font-semibold tabular-nums text-accent text-lg">
            {String(unit.value).padStart(2, "0")}
          </div>
          <div className="text-[10px] text-muted-foreground">{unit.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main CourseCard Component                                          */
/* ------------------------------------------------------------------ */
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
        <article
          className="flex min-h-[450px] cursor-pointer flex-col gap-4 rounded-2xl border border-border/50 bg-card/60 p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/60 hover:shadow-[0_28px_70px_-30px_rgba(45,90,62,0.2)] group"
        >
          {/* ─── Thumbnail ─── */}
          <div className="relative h-40 w-full overflow-hidden rounded-xl bg-gradient-to-br from-primary/30 to-accent/20">
            {course.thumbnail_url ? (
              <Image
                src={course.thumbnail_url}
                alt={course.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                unoptimized
              />
            ) : (
              <>
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_30%,var(--gold),transparent_70%)]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex size-14 rotate-45 items-center justify-center border border-accent/40">
                    <Play className="size-6 -rotate-45 text-accent" />
                  </div>
                </div>
              </>
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
          </div>

          {/* ─── Instructor & Level ─── */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <span className="truncate">{course.instructor_name || "Dr. Jehan Ali Ziad"}</span>
              <BadgeCheck className="size-4 shrink-0 text-accent" />
            </div>
            {course.level && (
              <span className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] text-accent">
                {course.level}
              </span>
            )}
          </div>

          {/* ─── Title ─── */}
          <h3 className="font-serif text-2xl font-semibold leading-snug text-foreground line-clamp-2">
            {course.title}
          </h3>

          {/* ─── Description ─── */}
          {course.description && (
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {course.description}
            </p>
          )}

          {/* ─── Meta ─── */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {course.course_duration && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-4 text-accent" /> {course.course_duration}
              </span>
            )}
            {course.lesson_duration && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4 text-accent" /> {course.lesson_duration}
              </span>
            )}
          </div>

          {/* ─── Countdown ─── */}
          {launchDate && !isLaunched && (
            <div className="space-y-2">
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Timer className="size-3.5 text-accent" /> <T>Starts in</T>
              </p>
              <CountdownTimer targetDate={course.launch_date!} />
            </div>
          )}

          {/* ─── Price & CTA ─── */}
          <div className="mt-auto space-y-4 pt-2">
            <div className="font-serif text-3xl font-semibold text-accent">
              ${Number(course.price).toFixed(2)}
            </div>
            <button
              onClick={handleBuy}
              className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors py-2.5 text-sm font-semibold"
            >
              {isLaunched ? <T>Buy Now</T> : <T>View Details</T>}
            </button>
          </div>
        </article>
      </Link>

      {/* Video Modal */}
      {showVideo && embedUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-black rounded-2xl overflow-hidden">
            <button onClick={() => setShowVideo(false)} className="absolute top-3 right-3 z-10 bg-white/20 hover:bg-white/40 text-white rounded-full p-1.5">
              <X size={20} />
            </button>
            <div className="aspect-video">
              <iframe src={embedUrl} className="w-full h-full" allowFullScreen title={course.title} />
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        courseTitle={course.title}
        userEmail={user?.email ?? undefined}
      />
    </>
  );
}