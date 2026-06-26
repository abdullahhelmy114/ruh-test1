"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import LessonCreationDialog from "@/components/dashboard/LessonCreationDialog";
import { CalendarDays, Video, MonitorPlay } from "lucide-react";
import { toast } from "sonner";

type Lesson = {
  id: string;
  type: "zoom" | "recorded";
  scheduled_at: string;
  scenario: string;
  teacher_notes: string;
  status: string;
};

type LiveCourseDetail = {
  id: string;
  title: string;
  category: string;
  level: string;
  base_price: number;
  model_scenario: string;
  scenario: string;
  lessons: Lesson[];
};

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<LiveCourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchCourse = () => {
    setLoading(true);
    fetch(`/api/teacher/live-courses/${courseId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.id) {
          setCourse(data);
        } else {
          toast.error("الكورس غير موجود");
        }
      })
      .catch(() => toast.error("تعذر تحميل بيانات الكورس"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (courseId) fetchCourse();
  }, [courseId]);

  if (loading) {
    return (
      <div className="container p-6 text-center text-muted-foreground">
        جارٍ تحميل الكورس...
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container p-6 text-center text-muted-foreground">
        الكورس غير موجود أو ليس لديك صلاحية الوصول إليه.
      </div>
    );
  }

  return (
    <div className="container p-6 space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{course.title}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="secondary">{course.category}</Badge>
            <Badge variant="outline">{course.level}</Badge>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              إضافة حصة جديدة
            </Button>
          </DialogTrigger>
          {dialogOpen && (
            <LessonCreationDialog
              liveCourseId={course.id}
              onSuccess={() => {
                setDialogOpen(false);
                fetchCourse();
              }}
            />
          )}
        </Dialog>
      </div>

      {/* بطاقة السيناريو التعليمي */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl">السيناريو التعليمي</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {course.scenario || course.model_scenario || "لا يوجد سيناريو مرفق بعد."}
          </div>
        </CardContent>
      </Card>

      {/* بطاقة الحصص */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl">
            الحصص ({course.lessons?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!course.lessons || course.lessons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لم تُضف أي حصص بعد. ابدأ بإضافة أول حصة.
            </div>
          ) : (
            <div className="space-y-3">
              {course.lessons.map((lesson, idx) => (
                <div
                  key={lesson.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-secondary/20 border border-border hover:bg-secondary/30 transition-colors"
                >
                  <div className="shrink-0">
                    {lesson.type === "zoom" ? (
                      <Video className="h-6 w-6 text-primary" />
                    ) : (
                      <MonitorPlay className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">
                      حصة {idx + 1}: {lesson.type === "zoom" ? "زوم مباشر" : "مسجلة"}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <CalendarDays className="h-4 w-4" />
                      {new Date(lesson.scheduled_at).toLocaleString("ar", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {lesson.scenario && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        السيناريو: {lesson.scenario.substring(0, 100)}
                        {lesson.scenario.length > 100 ? "..." : ""}
                      </p>
                    )}
                    {lesson.teacher_notes && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                        ملاحظات: {lesson.teacher_notes.substring(0, 80)}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={lesson.status === "completed" ? "default" : "outline"}
                    className={
                      lesson.status === "completed"
                        ? "bg-primary/80 text-primary-foreground"
                        : ""
                    }
                  >
                    {lesson.status === "completed" ? "مكتملة" : "قادمة"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}