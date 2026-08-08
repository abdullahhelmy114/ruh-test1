"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { StudentProfile } from "@/components/profile/StudentProfile";
import { Loader2 } from "lucide-react";

export default function StudentProfilePage() {
  const { user, isLoading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login");
        return;
      }
      if (role !== "student" && role !== "admin" && role !== "teacher") {
        router.push("/profile/teacher");
      }
    }
  }, [user, isLoading, role, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (role !== "student" && role !== "admin" && role !== "teacher") return null;

  const isTeacherView = role === "teacher";

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-10 overflow-x-hidden">
      <StudentProfile readOnly={isTeacherView} />
    </div>
  );
}