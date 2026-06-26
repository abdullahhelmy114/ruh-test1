"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type ModelCourse = {
  id: string;
  title: string;
  category: string;
  level: string;
  base_price: number;
  steps_count?: number;
  teacher_status: "pending" | "active" | null;
};

type Application = {
  id: string;
  model_course_id: string;
  course_title: string;
  category: string;
  level: string;
  applied_at: string;
};

export default function AvailableCoursesPage() {
  const [courses, setCourses] = useState<ModelCourse[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    Promise.all([
      fetch("/api/teacher/available-courses").then((res) => res.json()),
      fetch("/api/teacher/applications").then((res) => res.json()),
    ])
      .then(([coursesData, appsData]) => {
        if (Array.isArray(coursesData)) setCourses(coursesData);
        if (Array.isArray(appsData)) setApplications(appsData);
      })
      .catch(() => toast.error("تعذر تحميل البيانات"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApply = async (courseId: string) => {
    try {
      const res = await fetch("/api/teacher/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_course_id: courseId }),
      });

      if (res.ok) {
        setCourses((prev) =>
          prev.map((c) =>
            c.id === courseId ? { ...c, teacher_status: "pending" } : c
          )
        );
        // إعادة جلب التطبيقات المعلقة
        const newApps = await fetch("/api/teacher/applications").then((r) => r.json());
        setApplications(newApps);
        toast.success("تم التقديم", {
          description: "طلبك قيد المراجعة من قبل الإدارة",
        });
      } else {
        const data = await res.json();
        toast.error(data.error || "فشل إرسال الطلب");
      }
    } catch {
      toast.error("حدث خطأ أثناء التقديم");
    }
  };

  if (loading) {
    return (
      <div className="container p-6 text-center text-muted-foreground">
        جارٍ تحميل الكورسات المتاحة...
      </div>
    );
  }

  return (
    <div className="container p-6 space-y-10">
      {/* عنوان الصفحة */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">الكورسات المتاحة للتدريس</h1>
        <p className="mt-1 text-muted-foreground">
          تصفح الكورسات النموذجية المعتمدة وقدّم طلباً لتدريس ما يناسبك
        </p>
      </div>

      {/* شبكة الكورسات المتاحة */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-5">
          الكورسات المتاحة ({courses.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="bg-card border-border transition-shadow hover:shadow-md"
            >
              <CardHeader>
                <CardTitle className="text-lg font-bold text-foreground">
                  {course.title}
                </CardTitle>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">{course.category}</Badge>
                  <Badge variant="outline">{course.level}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  السعر الأساسي:{" "}
                  <span className="font-medium text-foreground">
                    ${course.base_price}
                  </span>
                </p>
                {course.steps_count != null && (
                  <p className="text-sm text-muted-foreground">
                    عدد خطوات السيناريو: {course.steps_count}
                  </p>
                )}

                {course.teacher_status === "active" ? (
                  <Badge
                    variant="default"
                    className="bg-primary/80 text-primary-foreground text-sm"
                  >
                    تقوم بتدريسه حالياً
                  </Badge>
                ) : course.teacher_status === "pending" ? (
                  <Badge variant="secondary" className="text-sm">
                    بانتظار الموافقة
                  </Badge>
                ) : (
                  <Button
                    onClick={() => handleApply(course.id)}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    طلب تدريس هذا الكورس
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}

          {courses.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              لا توجد كورسات متاحة حالياً للتدريس
            </div>
          )}
        </div>
      </section>

      {/* قسم الطلبات المعلقة */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-5">
          طلباتي المعلقة ({applications.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {applications.map((app) => (
            <Card
              key={app.id}
              className="bg-secondary/30 border-border backdrop-blur-sm"
            >
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  {app.course_title}
                </CardTitle>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline">{app.category}</Badge>
                  <Badge variant="outline">{app.level}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="mb-2">
                  بانتظار الموافقة
                </Badge>
                <p className="text-xs text-muted-foreground">
                  قُدِّم في{" "}
                  {new Date(app.applied_at).toLocaleDateString("ar", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </CardContent>
            </Card>
          ))}

          {applications.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              ليس لديك أي طلبات معلقة حالياً
            </div>
          )}
        </div>
      </section>
    </div>
  );
}