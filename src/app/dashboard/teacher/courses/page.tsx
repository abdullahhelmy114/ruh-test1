"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Loader2, Settings, Plus } from "lucide-react";
import { T } from "@/components/TranslatedText";

interface LiveCourse {
  id: string;
  title: string;
  level: string;
  price: number;
  status: string;
}

export default function TeacherCoursesPage() {
  const { user, isLoading } = useAuth();
  const [courses, setCourses] = useState<LiveCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(token =>
      fetch("/api/teacher/courses", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      })
        .then(res => res.json())
        .then(data => {
          if (data.courses) setCourses(data.courses);
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    );
  }, [user]);

  if (isLoading || loading) {
    return (
      <div className="p-10 text-center">
        <Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto p-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-gray-900">
          <T>كورساتي الحية</T>
        </h1>
        <Link
          href="/dashboard/teacher/courses/new"
          className="inline-flex items-center gap-2 rounded-full bg-amber-100px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-accent/90 transition"
        >
          <Plus size={14} />
          <T>طلب تدريس جديد</T>
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <T>لا توجد كورسات حية بعد.</T>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map(course => (
            <div
              key={course.id}
              className="glass rounded-2xl p-5 flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-gray-900">{course.title}</h3>
                <p className="text-xs text-gray-500">
                  {course.level} · ${course.price}
                </p>
                <p className="text-xs text-gray-500">
                  <T>الحالة:</T> {course.status}
                </p>
              </div>
              <Link
                href={`/dashboard/teacher/courses/${course.id}/lessons`}
                className="rounded-full bg-emerald-500/10 p-2 text-primary hover:bg-emerald-500/20 transition"
                title="إدارة الدروس"
              >
                <Settings size={18} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}