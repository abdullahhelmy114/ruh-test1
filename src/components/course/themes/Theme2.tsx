"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Loader2, CreditCard, Clock, BookOpen, Calendar, Sparkles } from "lucide-react";
import { T } from "@/components/TranslatedText";
import { PaymentModal } from "@/components/PaymentModal";

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
    launch_date?: string;
    course_duration?: string;
    lesson_duration?: string;
    theme?: string;
  };
}

export default function Theme2({ variant, course }: ThemeProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [enrolling, setEnrolling] = useState(false);
  const [message, setMessage] = useState("");
  const [showPayment, setShowPayment] = useState(false);

  const isKids = variant === "kids";

  const colors = {
    primary: isKids ? "#FF6F00" : "#FF8A65",
    accent: isKids ? "#FFAB40" : "#FF7043",
    bg: isKids
      ? "linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)"
      : "linear-gradient(135deg, #FDFBF7 0%, #FBE9E7 100%)",
    card: "rgba(255,255,255,0.9)",
    text: isKids ? "#4E342E" : "#3E2723",
    muted: isKids ? "#8D6E63" : "#6D4C41",
    font: isKids ? '"Comic Neue", cursive' : '"Inter", sans-serif',
    radius: "2.5rem",
    shadow: "0 8px 32px rgba(255,138,101,0.15)",
  };

  const openPaymentModal = () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setShowPayment(true);
  };

  const launchDate = course.launch_date ? new Date(course.launch_date) : null;
  const isLaunched = !launchDate || launchDate <= new Date();
  const [timeLeft, setTimeLeft] = useState("");
  if (launchDate && !isLaunched) {
    const updateTimer = () => {
      const diff = launchDate.getTime() - Date.now();
      if (diff <= 0) { setTimeLeft(""); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${d}d ${h}h ${m}m`);
    };
    useState(() => {
      updateTimer();
      const i = setInterval(updateTimer, 60000);
      return () => clearInterval(i);
    });
  }

  return (
    <div
      style={{
        background: colors.bg,
        fontFamily: colors.font,
        color: colors.text,
      }}
      className="min-h-screen"
    >
      <div className="max-w-6xl mx-auto px-4 py-10 md:px-8 space-y-12">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* صورة أو فيديو */}
            <div
              className="rounded-3xl overflow-hidden relative"
              style={{ borderRadius: colors.radius, boxShadow: colors.shadow }}
            >
              {course.intro_video_url ? (
                <iframe
                  src={course.intro_video_url.replace("watch?v=", "embed/")}
                  className="w-full h-64 md:h-80"
                  allowFullScreen
                />
              ) : course.image_url ? (
                <Image
                  src={course.image_url}
                  alt={course.title}
                  width={800}
                  height={400}
                  className="object-cover w-full h-64 md:h-80"
                />
              ) : (
                <div className="w-full h-64 md:h-80 flex items-center justify-center bg-gradient-to-br from-orange-200 to-orange-400 text-white/60">
                  <Sparkles className="h-24 w-24" />
                </div>
              )}
              {!isLaunched && launchDate && (
                <div className="absolute top-4 left-4 bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                  <T>Coming Soon</T>
                </div>
              )}
            </div>

            {/* العنوان والمُقدم */}
            <div>
              <h1 className="text-3xl md:text-5xl font-extrabold" style={{ color: colors.primary }}>
                {course.title}
              </h1>
              <p className="text-lg mt-2 flex items-center gap-2" style={{ color: colors.muted }}>
                <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
                <T>Instructor</T> {course.instructor_name || "Dr. Jehan Ali Ziad"}
              </p>
              <div className="flex flex-wrap gap-6 mt-4 text-base" style={{ color: colors.muted }}>
                {course.course_duration && (
                  <span className="flex items-center gap-2 bg-white/40 rounded-full px-4 py-1.5">
                    <Calendar size={18} /> {course.course_duration}
                  </span>
                )}
                {course.lesson_duration && (
                  <span className="flex items-center gap-2 bg-white/40 rounded-full px-4 py-1.5">
                    <Clock size={18} /> {course.lesson_duration}
                  </span>
                )}
              </div>
            </div>

            {/* وصف الكورس */}
            <div
              className="p-8 rounded-3xl"
              style={{
                backgroundColor: colors.card,
                borderRadius: colors.radius,
                boxShadow: colors.shadow,
              }}
            >
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: colors.primary }}>
                <Sparkles size={24} /> <T>What You Will Learn</T>
              </h2>
              <div className="prose max-w-none leading-relaxed text-lg" style={{ color: colors.text }}>
                {course.description || <T>No description yet.</T>}
              </div>
            </div>
          </div>

          {/* الشريط الجانبي */}
          <div className="space-y-4">
            <div
              className="p-8 sticky top-24"
              style={{
                backgroundColor: colors.card,
                borderRadius: colors.radius,
                boxShadow: colors.shadow,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <div className="text-4xl font-extrabold" style={{ color: colors.accent }}>
                ${course.price}
              </div>
              <div className="mt-4 space-y-3 text-base">
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
                  className="mt-6 rounded-2xl p-4 text-center text-lg font-bold"
                  style={{ backgroundColor: colors.accent + "20", color: colors.accent }}
                >
                  <T>Starts in</T> {timeLeft}
                </div>
              )}

              {message && (
                <div className="mt-3 text-sm text-center font-medium text-red-500">{message}</div>
              )}

              {course.price > 0 && (
                <div className="mt-6">
                  {isLaunched ? (
                    user ? (
                      <button
                        onClick={openPaymentModal}
                        disabled={enrolling}
                        className="w-full rounded-full py-4 text-lg font-bold text-white transition transform hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl"
                        style={{ backgroundColor: colors.accent }}
                      >
                        <CreditCard size={20} />
                        <T>Buy Now</T>
                      </button>
                    ) : (
                      <button
                        onClick={() => router.push("/login")}
                        className="w-full rounded-full py-4 text-lg font-bold text-white shadow-xl"
                        style={{ backgroundColor: colors.accent }}
                      >
                        <T>Login to Purchase</T>
                      </button>
                    )
                  ) : (
                    <button
                      disabled
                      className="w-full rounded-full py-4 text-lg font-bold text-white opacity-70 cursor-not-allowed"
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

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        courseTitle={course.title}
        userEmail={user?.email ?? undefined}
      />
    </div>
  );
}