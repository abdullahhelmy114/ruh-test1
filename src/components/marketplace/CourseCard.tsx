"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clock, Calendar, User } from "lucide-react";
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

export function CourseCard({ course }: { course: Course }) {
  const launchDate = course.launch_date ? new Date(course.launch_date) : null;
  const isLaunched = !launchDate || launchDate <= new Date();
  const [timeLeft, setTimeLeft] = useState("");

  // تحديث العد التنازلي كل دقيقة
  useEffect(() => {
    if (!launchDate || isLaunched) return;
    const update = () => {
      const diff = launchDate.getTime() - Date.now();
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
  }, [launchDate, isLaunched]);

  return (
    <Link href={`/courses/${course.id}`} className="block group h-full">
      <div className="glass rounded-2xl overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer border border-border/50 h-full flex flex-col">
        {/* صورة مصغرة - عرض كامل وارتفاع 200px */}
        <div className="relative w-full h-48 bg-gradient-to-br from-primary/20 to-accent/20">
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-primary/50">
              <User size={48} />
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
            <span className="absolute top-2 right-2 bg-accent/90 text-white px-2 py-0.5 rounded-full text-xs font-bold">
              <T>قادم</T>
            </span>
          )}
        </div>

        {/* محتوى البطاقة - عمودي */}
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
              {timeLeft && (
                <span className="text-accent font-medium text-xs bg-accent/10 px-2 py-0.5 rounded-full">
                  {timeLeft}
                </span>
              )}
            </div>
          )}

          {/* السعر وزر الشراء */}
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-accent">
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
                // لو أردت إضافة سلوك مختلف لزر الشراء من البطاقة
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