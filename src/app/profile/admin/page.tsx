"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { AdminProfile } from "@/components/profile/AdminProfile";
import { Loader2 } from "lucide-react";
import { OnboardingTour } from "@/components/OnboardingTour";

export default function AdminProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // الحماية: توجيه غير المسجلين أو من ليسوا أدمن
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login");
        return;
      }

      // السماح فقط للإيميلات المخصصة للأدمن
      const isAdmin =
        user.email === "abdullahhelmy114@gmail.com" ||
        user.email === "info@ruhulqudus.com";

      if (!isAdmin) {
        const storedRole = localStorage.getItem("userRole");
        if (storedRole === "teacher") {
          router.push("/profile/teacher");
        } else {
          router.push("/profile/student");
        }
      }
    }
  }, [user, isLoading, router]);

  // شاشة التحميل
  if (isLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  // التحقق من صلاحية الأدمن (منع الوميض)
  const isAdmin =
    user.email === "abdullahhelmy114@gmail.com" ||
    user.email === "info@ruhulqudus.com";

  if (!isAdmin) return null;

  // خطوات الجولة الإرشادية (اختيارية – قليلة لأن الإعدادات بسيطة)
  const steps = [
    {
      target: ".profile-name",
      title: "👤 الاسم",
      content: "أدخل اسمك الكامل.",
      placement: "bottom" as const,
      disableBeacon: true,
    },
    {
      target: ".profile-save-btn",
      title: "💾 حفظ",
      content: "اضغط هنا لحفظ التغييرات.",
      placement: "top" as const,
    },
  ];

  // لا تعرض الجولة على الشاشات الصغيرة
  const isMobile =
    typeof window !== "undefined" ? window.innerWidth < 768 : false;

  return (
    <>
      {/* غلاف متجاوب يمنع التمدد الأفقي */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-hidden pb-20">
        <AdminProfile />
      </div>

      {/* الجولة الإرشادية تظهر فقط على الشاشات الكبيرة */}
      {!isMobile &&
        typeof window !== "undefined" &&
        !localStorage.getItem("profile_tour_admin") && (
          <OnboardingTour
            steps={steps}
            tourKey="profile_tour_admin"
          />
        )}
    </>
  );
}