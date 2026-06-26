"use client";

import { T } from "@/components/TranslatedText";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Users, Plus, Loader2, ArrowRight,
  Star, BookOpen, TrendingUp, AlertCircle, Settings, DollarSign
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

interface LiveCourse {
  id: string;
  title: string;
  level: string;
  price: number;
  status: string;
  students_count?: number;
}

interface TeacherStats {
  fullName: string;
  initial: string;
  students: number;
  activeCourses: number;
  revenue: number;
  commissionRate: number;
  averageRating: number;
  completedLessons: number;
}

export default function TeacherDashboard() {
  const { user, isLoading, role } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [courses, setCourses] = useState<LiveCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !user.uid) return;

    const fetchData = async () => {
      try {
        setError("");
        const [statsRes, coursesRes] = await Promise.all([
          fetch(`/api/teacher/dashboard?uid=${user.uid}`, { credentials: "include" }),
          fetch("/api/teacher/courses", { credentials: "include" }),
        ]);

        if (!statsRes.ok) throw new Error("Failed to load dashboard");
        if (!coursesRes.ok) throw new Error("Failed to load courses");

        const statsData = await statsRes.json();
        const coursesData = await coursesRes.json();

        setStats({
          fullName: statsData.fullName || user.displayName || "Teacher",
          initial: (statsData.fullName || user.displayName || "T")[0].toUpperCase(),
          students: statsData.students || 0,
          activeCourses: statsData.activeCourses || 0,
          revenue: statsData.revenue || 0,
          commissionRate: statsData.commissionRate || 20,
          averageRating: statsData.averageRating || 0,
          completedLessons: statsData.completedLessons || 0,
        });
        setCourses(coursesData.courses || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Could not load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4">
        <div className="rounded-3xl border bg-card p-8 text-center shadow-lg">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-4" />
          <h2 className="font-serif text-xl text-destructive">
            <T>خطأ في تحميل لوحة التحكم</T>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-accent px-6 py-2 text-sm font-semibold text-accent-foreground"
          >
            <T>إعادة المحاولة</T>
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 md:px-8 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-6 rounded-4xl border border-border bg-card p-8 shadow-lg md:flex-row md:items-center">
        <div className="flex items-center gap-5">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-primary font-serif text-3xl text-primary-foreground ring-4 ring-accent/20 shadow-lg">
            {stats.initial}
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-foreground">
              <T>بوابة المعلم</T>
            </div>
            <h1 className="mt-1 font-serif text-3xl text-foreground">{stats.fullName}</h1>
            <p className="mt-1 text-sm italic text-muted-foreground">
              <T>"علمكم الله ما ينفعكم"</T>
            </p>
          </div>
        </div>
        <div className="flex w-full gap-3 md:w-auto">
          <Link
            href="/dashboard/teacher/courses"
            className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2.5 text-sm font-medium hover:bg-secondary transition"
          >
            <BookOpen className="h-4 w-4 text-accent-foreground" />
            <T>كورساتي</T>
          </Link>
          <Link
            href="/dashboard/teacher/courses/new"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 shadow-md transition"
          >
            <Plus className="h-4 w-4" /> <T>طلب تدريس جديد</T>
          </Link>
          <Link
            href="/dashboard/teacher/earnings"
            className="inline-flex items-center gap-2 rounded-full border bg-background px-6 py-3 text-sm font-medium hover:bg-secondary transition"
          >
            <DollarSign className="h-4 w-4 text-accent-foreground" /> <T>أرباحي</T>
          </Link>
        </div>
      </div>

      {/* Commission Card */}
      {stats.averageRating > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-4xl border bg-card p-6 shadow-lg"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-white">
                <Star className="h-6 w-6 fill-white" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-accent-foreground">
                  <T>تقييمك</T>
                </div>
                <div className="font-serif text-3xl text-foreground">
                  {stats.averageRating.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stats.completedLessons} <T>درس مكتمل</T>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-widest text-accent-foreground">
                <T>نسبة العمولة</T>
              </div>
              <div className="font-serif text-3xl text-primary">
                {stats.commissionRate}%
              </div>
              <div className="text-xs text-muted-foreground">
                <T>+5% كل 50 درس بتقييم 4.5+ (حد أقصى 50%)</T>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Courses List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-serif text-2xl text-foreground">
            <T>كورساتي الحية</T>
          </h2>
          {courses.length === 0 ? (
            <div className="rounded-3xl border bg-card p-8 text-center text-muted-foreground">
              <BookOpen className="mx-auto h-8 w-8 text-accent-foreground/50 mb-3" />
              <p><T>لا توجد كورسات حية بعد. اطلب تدريس نموذج للبدء.</T></p>
              <Link
                href="/dashboard/teacher/courses/new"
                className="mt-3 inline-block rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground"
              >
                <T>طلب تدريس</T>
              </Link>
            </div>
          ) : (
            courses.map((course) => (
              <div
                key={course.id}
                className="rounded-3xl border bg-card p-5 shadow-lg flex justify-between items-center"
              >
                <div>
                  <h3 className="font-serif text-lg text-foreground">{course.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    <T>المستوى</T> {course.level} · ${course.price}
                  </p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {course.status}
                  </span>
                </div>
                <Link
                  href={`/dashboard/teacher/courses/${course.id}/lessons`}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition"
                >
                  <Settings size={14} /> <T>إدارة الدروس</T>
                </Link>
              </div>
            ))
          )}
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-4">
          <div className="rounded-3xl border bg-card p-6 shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-widest text-accent-foreground">
              <T>إحصائيات</T>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground"><T>الطلاب</T></span>
                <span className="font-semibold text-foreground">{stats.students}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground"><T>كورسات نشطة</T></span>
                <span className="font-semibold text-foreground">{stats.activeCourses}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground"><T>الإيرادات</T></span>
                <span className="font-semibold text-foreground">${stats.revenue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground"><T>العمولة</T></span>
                <span className="font-semibold text-primary">{stats.commissionRate}%</span>
              </div>
            </div>
          </div>

          {stats.averageRating > 0 && (
            <div className="rounded-3xl border bg-card p-6 shadow-lg">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 fill-accent text-accent" />
                <span className="font-serif text-xl text-foreground">
                  {stats.averageRating.toFixed(1)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <T>{String(stats.completedLessons) + ' درس مكتمل'}</T>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}