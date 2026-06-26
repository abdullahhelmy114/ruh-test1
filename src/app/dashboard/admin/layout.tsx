"use client";

import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  if (user.email !== "abdullahhelmy114@gmail.com") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-600 mb-4">غير مصرح</h1>
          <p className="text-muted-foreground">
            هذا الحساب لا يمتلك صلاحية الوصول إلى لوحة التحكم.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}