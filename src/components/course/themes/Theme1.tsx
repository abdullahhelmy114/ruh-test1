"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  CreditCard, Clock, BookOpen, Calendar,
  PlayCircle, FileVideo, Sparkles, ShieldCheck, BadgeCheck,
  Undo2, Headset, CheckCircle2,
} from "lucide-react";
import { T } from "@/components/TranslatedText";
import { formatPrice } from "@/lib/utils";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";

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

// ─── Framer Motion Variants ───
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
};

const scaleOnHover = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
};

export default function Theme1({ variant, course }: ThemeProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState("");
  const [videoError, setVideoError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const isKids = variant === "kids";

  const launchDate = course.launch_date ? new Date(course.launch_date) : null;
  const isLaunched = !launchDate || launchDate <= new Date();

  // Parallax refs
  const pageRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const smooth = useSpring(scrollY, { stiffness: 120, damping: 30, mass: 0.4 });
  const yBlobA = useTransform(smooth, [0, 800], [0, -80]);
  const yBlobB = useTransform(smooth, [0, 800], [0, 100]);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

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

  // ─── Media Renderer ───
  const renderMedia = () => {
    if (course.intro_video_url && isYouTubeUrl(course.intro_video_url)) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative aspect-video overflow-hidden rounded-3xl border border-border/40 shadow-2xl"
        >
          <iframe
            src={course.intro_video_url.replace("watch?v=", "embed/")}
            className="h-full w-full"
            allowFullScreen
          />
        </motion.div>
      );
    }

    if (course.intro_video_url && isLocalVideo(course.intro_video_url)) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="relative aspect-video overflow-hidden rounded-3xl border border-border/40 bg-black shadow-2xl"
        >
          <video
            src={course.intro_video_url}
            className="h-full w-full object-cover"
            controls
            onError={() => setVideoError(true)}
          />
        </motion.div>
      );
    }

    if (course.image_url) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 1.05 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative aspect-video overflow-hidden rounded-3xl border border-border/40 shadow-2xl"
        >
          <Image
            src={course.image_url}
            alt={course.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 50vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </motion.div>
      );
    }

    return (
      <div className="relative aspect-video overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 shadow-2xl">
        <div className="flex h-full w-full items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
            className="absolute h-40 w-40 rounded-full border border-dashed border-primary/30"
          />
          <BookOpen className="relative h-16 w-16 text-primary/60" />
        </div>
      </div>
    );
  };

  return (
    <div ref={pageRef} className="min-h-screen bg-background transition-colors duration-300">
      {/* ─── Decorative Background ─── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          style={{ y: yBlobA }}
          animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.2, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute -top-32 -right-32 h-96 w-96 rounded-full blur-[120px] ${
            isKids ? "bg-amber-400/20" : "bg-primary/20"
          }`}
        />
        <motion.div
          style={{ y: yBlobB }}
          animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.1, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-0 -left-32 h-80 w-80 rounded-full bg-gold/10 blur-[100px]"
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-10 md:px-8">
        <div className="grid gap-10 lg:grid-cols-3">
          {/* ─── Main Content ─── */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="space-y-8 lg:col-span-2"
          >
            {/* Media */}
            {renderMedia()}

            {/* Title & Instructor */}
            <motion.div variants={fadeUp} className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  <T>Featured Course</T>
                </span>
              </div>

              <h1 className="text-4xl font-serif font-bold leading-tight text-foreground md:text-5xl">
                {course.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-gold" />
                  <T>Instructor</T>: {course.instructor_name || "Dr. Jehan Ali Ziad"}
                </span>
                {course.course_duration && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-gold" />
                    {course.course_duration}
                  </span>
                )}
                {course.lesson_duration && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-gold" />
                    {course.lesson_duration}
                  </span>
                )}
              </div>
            </motion.div>

            {/* Description */}
            <motion.div variants={fadeUp} className="glass rounded-3xl p-6 md:p-8">
              <h2 className="mb-3 text-2xl font-serif font-semibold text-foreground">
                <T>What You Will Learn</T>
              </h2>
              <p className="leading-relaxed text-muted-foreground">
                {course.description || <T>No description yet.</T>}
              </p>
            </motion.div>
          </motion.div>

          {/* ─── Sidebar ─── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4 lg:sticky lg:top-24 lg:self-start"
          >
            <div className="glass rounded-3xl p-6 shadow-elegant md:p-8 relative overflow-hidden group">
              {/* حدود ذهبية متحركة */}
              <div className="absolute inset-0 rounded-3xl border-2 border-transparent [background:linear-gradient(white,white)_padding-box,linear-gradient(120deg,#D4AF37,#C9A84C,#D4AF37)_border-box] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                {/* Price */}
                <motion.div
                  initial={{ scale: 0.9 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="text-center"
                >
                  <span className="text-sm text-muted-foreground">Price</span>
                  <div className="mt-1 text-4xl font-serif font-bold text-gold">
                    {formatPrice(Number(course.price))}
                  </div>
                </motion.div>

                {/* Countdown */}
                {!isLaunched && launchDate && timeLeft && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    whileInView={{ opacity: 1, height: "auto" }}
                    viewport={{ once: true }}
                    className="mt-6 rounded-2xl border border-gold/30 bg-gold/10 p-4 text-center"
                  >
                    <p className="text-sm font-semibold text-gold">
                      <T>Starts in</T> {timeLeft}
                    </p>
                  </motion.div>
                )}

                {/* CTA */}
                {course.price > 0 && (
                  <div className="mt-6 space-y-3">
                    {isLaunched && course.payment_url ? (
                      <motion.a
                        {...scaleOnHover}
                        href={course.payment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
                        aria-label="Buy Now"
                      >
                        <CreditCard size={16} />
                        <T>Buy Now</T>
                      </motion.a>
                    ) : (
                      <motion.button
                        disabled
                        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-muted px-6 py-3.5 text-sm font-semibold text-muted-foreground opacity-70"
                        aria-label="Coming Soon"
                      >
                        <Clock size={16} />
                        <T>Coming Soon</T>
                      </motion.button>
                    )}
                  </div>
                )}

                {/* Trust badges */}
                <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <T>Secure Payment</T>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <PlayCircle className="h-4 w-4 text-gold" />
                    <T>Lifetime Access</T>
                  </span>
                </div>

                {/* Additional guarantees */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Undo2 className="h-3.5 w-3.5 text-gold" />
                    <T>7-Day Refund</T>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Headset className="h-3.5 w-3.5 text-gold" />
                    <T>Support</T>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
                    <T>Certificate</T>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BadgeCheck className="h-3.5 w-3.5 text-gold" />
                    <T>Accredited</T>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}