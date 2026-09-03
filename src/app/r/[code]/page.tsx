"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function ReferralRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;

  useEffect(() => {
    if (code) {
      // حفظ كود الإحالة في localStorage ليستخدمه التسجيل لاحقاً
      localStorage.setItem("referral_code", code);
      // توجيه المستخدم لصفحة التسجيل
      router.push("/signup");
    }
  }, [code, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Redirecting to signup...</p>
    </div>
  );
}