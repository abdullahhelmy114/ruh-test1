"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Loader2, CreditCard, Clock, BookOpen, Calendar, Play } from "lucide-react";
import { T } from "@/components/TranslatedText";

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

export default function Theme1({ variant, course }: ThemeProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [enrolling, setEnrolling] = useState(false);
  const [message, setMessage] = useState("");

  const isKids = variant === "kids";

  // الألوان المتغيرة حسب الفئة العمرية
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

  const handleBuy = async () => {
    if (!user) { router.push("/login"); return; }
    setEnrolling(true);
    setMessage("");
    try {
      const res = await fetch("/api/shopier/create-payment-link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveCourseId: course.id }),
      });
      const data = await res.json();
      if (data.paymentUrl) {
        window.open(data.paymentUrl, "_blank");
      } else {
        setMessage(data.error || "حدث خطأ");
      }
    } catch {
      setMessage("خطأ في الشبكة");
    } finally {
      setEnrolling(false);
    }
  };

  // حساب الوقت المتبقي للإطلاق
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
      setTimeLeft(`${d}ي ${h}س ${m}د`);
    };
    useState(() => { updateTimer(); const i = setInterval(updateTimer, 60000); return () => clearInterval(i); });
  }

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
        {/* Hero Section */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* صورة الكورس أو الفيديو التعريفي */}
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
                <div className="w-full h-64 md:h-80 flex items-center justify-center bg-gradient-to-br from-emerald-800 to-emerald-900 text-white/30">
                  <BookOpen className="h-24 w-24" />
                </div>
              )}
            </div>

            {/* العنوان والمُقدم */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold" style={{ color: colors.primary }}>
                {course.title}
              </h1>
              <p className="text-sm mt-2" style={{ color: colors.muted }}>
                <T>يقدمه</T> {course.instructor_name || "د. جيهان علي زياد"}
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

            {/* وصف الكورس */}
            <div>
              <h2 className="text-2xl font-bold mb-4" style={{ color: colors.primary }}>
                <T>ماذا ستتعلم</T>
              </h2>
              <div className="prose max-w-none leading-relaxed" style={{ color: colors.text }}>
                {course.description || <T>لا يوجد وصف بعد.</T>}
              </div>
            </div>
          </div>

          {/* الشريط الجانبي (السعر، الشراء، العد التنازلي) */}
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
              {/* السعر */}
              <div className="text-3xl font-bold" style={{ color: colors.accent }}>
                ${course.price}
              </div>

              {/* تفاصيل إضافية */}
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: colors.muted }}><T>المدة</T></span>
                  <span className="font-medium">{course.course_duration || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: colors.muted }}><T>مدة الدرس</T></span>
                  <span className="font-medium">{course.lesson_duration || "—"}</span>
                </div>
              </div>

              {/* حالة الإطلاق / العد التنازلي */}
              {!isLaunched && launchDate && (
                <div
                  className="mt-4 rounded-xl p-3 text-center text-sm font-medium"
                  style={{ backgroundColor: colors.accent + "20", color: colors.accent }}
                >
                  <T>ينطلق خلال</T> {timeLeft}
                </div>
              )}

              {/* رسالة خطأ/نجاح */}
              {message && (
                <div className="mt-3 text-xs text-center font-medium text-red-500">
                  {message}
                </div>
              )}

              {/* زر الشراء */}
              {course.price > 0 && (
                <div className="mt-6">
                  {isLaunched ? (
                    user ? (
                      <button
                        onClick={handleBuy}
                        disabled={enrolling}
                        className="w-full rounded-full py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ backgroundColor: colors.primary }}
                      >
                        {enrolling ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                        <T>اشتر الآن</T>
                      </button>
                    ) : (
                      <button
                        onClick={() => router.push("/login")}
                        className="w-full rounded-full py-3 text-sm font-semibold text-white"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <T>سجل الدخول للشراء</T>
                      </button>
                    )
                  ) : (
                    <button
                      disabled
                      className="w-full rounded-full py-3 text-sm font-semibold text-white opacity-70 cursor-not-allowed"
                      style={{ backgroundColor: colors.muted }}
                    >
                      <T>قريباً</T>
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