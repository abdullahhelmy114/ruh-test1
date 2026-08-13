"use client";

/**
 * CourseCard v7 — Ruh-Ul-Qudus Academy
 * كارت رفيع وأنيق: حافة ذهبية شعرية + توهج ذهبي ناعم عند المرور
 * بدون إطار أخضر/برتقالي — يعتمد التوكنز الدلالية فقط (globals.css)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Clock,
  GraduationCap,
  Play,
  Timer,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ types */

export interface Course {
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

/* ---------------------------------------------------------------- helpers */

function getYouTubeEmbedUrl(url: string): string {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2]?.length === 11
    ? `https://www.youtube.com/embed/${match[2]}`
    : "";
}

function useCountdown(target?: string) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!target || now === null) return null;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

/* -------------------------------------------------------------- countdown */

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const t = useCountdown(targetDate);

  const units = [
    { v: t?.days ?? 0, l: "يوم" },
    { v: t?.hours ?? 0, l: "ساعة" },
    { v: t?.minutes ?? 0, l: "دقيقة" },
    { v: t?.seconds ?? 0, l: "ثانية" },
  ];

  return (
    <div className="grid grid-cols-4 gap-1.5" dir="rtl">
      {units.map((u) => (
        <div
          key={u.l}
          className="rounded-lg border border-gold/25 bg-gold/[0.07] px-1 py-2 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,.06)]"
        >
          <div className="font-serif text-lg leading-none tabular-nums text-gold">
            {String(u.v).padStart(2, "0")}
          </div>
          <div className="mt-1 text-[10px] tracking-wide text-muted-foreground">
            {u.l}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- thumbnail */

function Thumbnail({ seed }: { seed: number }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-gradient-primary">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 30%, rgba(255,255,255,.25), transparent 60%)",
          transform: `rotate(${(seed % 6) * 12}deg)`,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-full border border-gold/40 bg-gold/15 p-4">
          <GraduationCap className="h-7 w-7 text-gold" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ course card */

export function CourseCard({ course }: { course: Course }) {
  const [showVideo, setShowVideo] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const launchDate = course.launch_date ? new Date(course.launch_date) : null;
  const isLaunched = !launchDate || (mounted && launchDate <= new Date());
  const embedUrl = course.intro_video_url
    ? getYouTubeEmbedUrl(course.intro_video_url)
    : "";
  const seed = Number(course.id.replace(/\D/g, "") || 1);

  return (
    <>
      <div
        dir="rtl"
        role={embedUrl ? "button" : undefined}
        tabIndex={embedUrl ? 0 : undefined}
        onClick={() => embedUrl && setShowVideo(true)}
        onKeyDown={(e) => {
          if (embedUrl && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setShowVideo(true);
          }
        }}
        className={`group relative mx-auto flex min-h-[610px] w-[80%] flex-col gap-4 overflow-hidden rounded-2xl border border-gold/20 bg-card/90 p-4 shadow-[0_1px_0_0_rgba(255,255,255,.06)_inset,0_18px_45px_-28px_rgba(0,0,0,.45)] backdrop-blur-md transition-all duration-500 hover:-translate-y-1.5 hover:border-gold/45 hover:shadow-[0_1px_0_0_rgba(255,255,255,.08)_inset,0_28px_60px_-26px_rgba(0,0,0,.5)]${
          embedUrl ? " cursor-pointer" : ""
        }`}
      >
        {/* توهج ذهبي علوي ناعم */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 h-40 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(60% 100% at 50% 100%, var(--gold, #C9A84C), transparent 70%)",
            filter: "blur(28px)",
          }}
        />
        {/* خط ذهبي رفيع أعلى الكارت */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-l from-transparent via-gold/60 to-transparent"
        />

        {/* ─── Thumbnail ─── */}
        <div className="relative mx-auto h-36 w-[98%] overflow-hidden rounded-xl ring-1 ring-gold/15">
          {course.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="h-full w-full rounded-xl object-cover transition-transform duration-700 group-hover:scale-[1.07]"
            />
          ) : (
            <Thumbnail seed={seed} />
          )}

          {/* تدرّج سفلي لعمق الصورة */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-background/45 via-transparent to-transparent"
          />

          {embedUrl && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowVideo(true);
              }}
              aria-label="مشاهدة الفيديو التعريفي"
              className="absolute inset-0 flex items-center justify-center rounded-xl bg-primary/45 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100"
            >
              <span className="rounded-full border border-gold/50 bg-gold/20 p-3 shadow-lg">
                <Play className="h-5 w-5 text-gold" />
              </span>
            </button>
          )}
        </div>

        {/* ─── Instructor & Level ─── */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <BadgeCheck className="h-3.5 w-3.5 text-gold" />
            تقدمه {course.instructor_name || "د. جيهان علي زياد"}
          </span>
          {course.level && (
            <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] tracking-wide text-gold">
              {course.level}
            </span>
          )}
        </div>

        {/* ─── Title & description ─── */}
        <div className="space-y-2">
          <h3 className="font-serif text-xl leading-snug text-foreground transition-colors duration-300 group-hover:text-gold">
            {course.title}
          </h3>
          <div className="h-px w-10 bg-gold/40 transition-all duration-500 group-hover:w-20" />
          {course.description && (
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {course.description}
            </p>
          )}
        </div>

        {/* ─── Meta ─── */}
        <div className="flex flex-wrap items-center gap-2">
          {course.course_duration && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-3 py-1 text-[11px] text-secondary-foreground">
              <Clock className="h-3.5 w-3.5 text-gold" />
              {course.course_duration}
            </span>
          )}
          {course.lesson_duration && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-3 py-1 text-[11px] text-secondary-foreground">
              <Timer className="h-3.5 w-3.5 text-gold" />
              {course.lesson_duration}
            </span>
          )}
        </div>

        {/* ─── يبدأ خلال + العد التنازلي ─── */}
        {course.launch_date && (
          <div className="rounded-xl border border-border/50 bg-muted/40 p-3">
            <div className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Timer className="h-3.5 w-3.5 text-gold" />
              {isLaunched ? "الدورة متاحة الآن" : "يبدأ خلال"}
            </div>
            {!isLaunched && <CountdownTimer targetDate={course.launch_date} />}
          </div>
        )}

        {/* ─── Price & CTA ─── */}
        <div className="mt-auto space-y-3">
          <div className="flex items-baseline gap-2 border-t border-border/40 pt-3">
            <span className="font-serif text-2xl text-gold">
              ${Number(course.price).toFixed(2)}
            </span>
            {course.old_price ? (
              <span className="text-sm text-muted-foreground line-through">
                ${Number(course.old_price).toFixed(2)}
              </span>
            ) : null}
          </div>

          {/* عرض التفاصيل — فوق */}
          <Link
            href={`/courses/${course.id}`}
            onClick={(e) => e.stopPropagation()}
            className="block w-full rounded-full border border-gold/35 bg-transparent px-6 py-3 text-center font-arabic text-sm text-gold transition-all duration-300 hover:border-gold/60 hover:bg-gold/10"
          >
            عرض التفاصيل
          </Link>

          {/* اشترك الآن — آخر الكارت */}
          <Link
            href={`/courses/${course.id}`}
            onClick={(e) => e.stopPropagation()}
            className="block w-full rounded-full bg-primary px-6 py-3 text-center font-arabic text-sm text-primary-foreground shadow-[0_10px_25px_-12px_rgba(0,0,0,.6)] transition-all duration-300 hover:opacity-95 hover:shadow-[0_14px_30px_-12px_rgba(0,0,0,.65)]"
          >
            اشترك الآن
          </Link>
        </div>
      </div>

      {/* ─── Video Modal ─── */}
      {showVideo && embedUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 p-4 backdrop-blur-sm"
          onClick={() => setShowVideo(false)}
        >
          <div
            className="relative w-full max-w-3xl rounded-2xl border border-gold/30 bg-card p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowVideo(false)}
              aria-label="إغلاق"
              className="absolute left-4 top-4 z-10 rounded-full border border-gold/40 bg-gold/20 p-1.5 text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="aspect-video w-full overflow-hidden rounded-xl">
              <iframe
                src={embedUrl}
                title={course.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
