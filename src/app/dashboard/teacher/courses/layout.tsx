import { ReactNode } from "react";
import Link from "next/link";
import { BookOpen, Clock, Layers } from "lucide-react";

export default function TeacherDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* شريط جانبي بسيط مع الألوان الجديدة */}
      <aside className="w-64 bg-card border-l border-border p-4 space-y-6">
        <h2 className="text-lg font-bold text-foreground">لوحة المعلم</h2>
        <nav className="space-y-2">
          <Link
            href="/dashboard/teacher"
            className="flex items-center gap-2 p-2 rounded-md text-foreground hover:bg-secondary transition-colors"
          >
            <Layers className="h-5 w-5" />
            الرئيسية
          </Link>
          <Link
            href="/dashboard/teacher/available-courses"
            className="flex items-center gap-2 p-2 rounded-md text-foreground hover:bg-secondary transition-colors"
          >
            <BookOpen className="h-5 w-5" />
            الكورسات المتاحة
          </Link>
          <Link
            href="/dashboard/teacher/courses"
            className="flex items-center gap-2 p-2 rounded-md text-foreground hover:bg-secondary transition-colors"
          >
            <Clock className="h-5 w-5" />
            كورساتي النشطة
          </Link>
          {/* يمكن إضافة تحليلات وطلاب لاحقاً */}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}