"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clock, Calendar, User, Play } from "lucide-react";
import { T } from "@/components/TranslatedText";

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

// تحويل رابط يوتيوب إلى embed
function getYouTubeEmbedUrl(url: string): string {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : "";
}

// عداد تنازلي
function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const launch = new Date(targetDate);
    const update = () => {
      const diff = launch.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${days}ي ${hours}س ${minutes}د`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) return null;
  return (
    <span className="text-xs text-[#D4742B] font-bold bg-[#D4742B]/10 px-2 py-0.5 rounded-full">
      {timeLeft}
    </span>
  );
}

export function CourseCard({ course }: { course: Course }) {
  const launchDate = course.launch_date ? new Date(course.launch_date) : null;
  const isLaunched = !launchDate || launchDate <= new Date();
  const embedUrl = course.intro_video_url ? getYouTubeEmbedUrl(course.intro_video_url) : "";

  return (
    <Link href={`/courses/${course.id}`} className="block group h-full">
      <div className="glass rounded-2xl overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer border border-border/50 h-full flex flex-col">
        {/* صورة مصغرة أو فيديو */}
        <div className="relative w-full h-48 bg-gradient-to-br from-primary/20 to-accent/20">
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              className="object-cover"
              unoptimized
            />
          ) : embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allowFullScreen
              title={course.title}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-primary/50">
              <Play size={48} />
            </div>
          )}
          {/* شارة المستوى */}
          {course.level && (
            <span className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs font-bold">
              {course.level}
            </span>
          )}
          {/* شارة "قادم" إذا لم ينطلق بعد */}
          {!isLaunched && launchDate && (
            <span className="absolute top-2 right-2 bg-[#D4742B]/90 text-white px-2 py-0.5 rounded-full text-xs font-bold">
              <T>قادم</T>
            </span>
          )}
        </div>

        {/* محتوى البطاقة */}
        <div className="p-5 flex flex-col flex-1 space-y-3">
          {/* اسم الكورس والمقدم */}
          <div>
            <h3 className="font-bold text-xl leading-tight text-foreground line-clamp-2">
              {course.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <User size={14} />
              {course.instructor_name || "د. جيهان علي زياد"}
            </p>
          </div>

          {/* وصف مختصر */}
          {course.description && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {course.description}
            </p>
          )}

          {/* مدة الكورس والدرس */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
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

          {/* تاريخ الإطلاق وعداد تنازلي */}
          {launchDate && !isLaunched && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">
                {launchDate.toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })}
              </span>
              <CountdownTimer targetDate={course.launch_date!} />
            </div>
          )}

          {/* السعر وزر الشراء */}
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-[#D4742B]">
                ${course.price}
              </span>
              {course.old_price && (
                <span className="text-sm text-muted-foreground line-through">
                  ${course.old_price}
                </span>
              )}
            </div>
            <button
              className="rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-xs font-semibold hover:bg-primary/90 transition"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {isLaunched ? <T>شراء</T> : <T>تفاصيل</T>}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}