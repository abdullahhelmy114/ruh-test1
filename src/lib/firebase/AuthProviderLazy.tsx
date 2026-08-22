"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { AuthProvider as FirebaseAuthProvider } from "./AuthProvider";

// مكوّن خفيف يبدأ بتحميل AuthProvider بعد التركيب
export default function AuthProviderLazy({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // على الخادم أو قبل التحميل، نعرض الأطفال مباشرة بدون أي حجب
    return <>{children}</>;
  }

  // الآن عميل، نحمّل AuthProvider الفعلي
  const AuthProviderComponent = dynamic(
    () => import("./AuthProvider").then((mod) => mod.AuthProvider),
    {
      ssr: false,
      loading: () => null, // لا سبينر يغطي الصفحة
    }
  );

  return <AuthProviderComponent>{children}</AuthProviderComponent>;
}