"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Loader2 } from "lucide-react";

export default function DashboardRedirect() {
  const { user, isLoading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    // توجيه الأدمن مباشرة بناءً على الدور (بدون الحاجة إلى جلب /api/user)
    if (role === "admin") {
      router.replace("/dashboard/admin");
      return;
    }

    // للمعلمين والطلاب: جلب بيانات الملف الشخصي للتحقق من الحالة والبريد الإلكتروني
    fetch(`/api/user?uid=${user.uid}`)
      .then(r => r.json())
      .then(d => {
        const profile = d?.profile;
        if (!profile) {
          router.replace("/login");
          return;
        }

        // إذا لم يتم التحقق، أرسله إلى صفحة التحقق مع البريد
        if (!profile.email_verified) {
          router.replace(`/verify-email?email=${encodeURIComponent(profile.email)}`);
          return;
        }

        // توجيه حسب الدور من الملف الشخصي
        if (profile.role === "teacher") {
          router.replace("/dashboard/teacher");
        } else {
          router.replace("/dashboard/student");
        }
      })
      .catch(() => {
        // في حالة الفشل، الاعتماد على الدور المخزن محليًا
        const fallbackRole = localStorage.getItem("userRole");
        if (fallbackRole === "teacher") {
          router.replace("/dashboard/teacher");
        } else {
          router.replace("/dashboard/student");
        }
      });
  }, [user, isLoading, role, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
}