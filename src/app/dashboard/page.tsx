"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { authFetch } from "@/lib/authFetch";
import { accountHome } from "@/lib/auth/home";
import { Loader2 } from "lucide-react";

// Sends a signed-in account to its home: administrators to administration,
// approved teachers to the teacher workspace, every other teacher account to
// its application page, everyone else to the student dashboard. Unverified
// email addresses are verified first. Navigation only; pages and APIs
// authorize on the server.
export default function DashboardRedirect() {
  const { user, isLoading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (role === "admin") {
      router.replace(accountHome("admin", null));
      return;
    }

    authFetch("/api/user")
      .then((r) => r.json())
      .then((d) => {
        const profile = d?.profile;
        if (!profile) {
          router.replace("/login");
          return;
        }
        if (!profile.email_verified) {
          const verifyPage = profile.role === "teacher" ? "/verify-teacher" : "/verify-email";
          router.replace(`${verifyPage}?email=${encodeURIComponent(profile.email)}`);
          return;
        }
        router.replace(accountHome(profile.role, profile.status));
      })
      .catch(() => {
        // Without the profile the least-privileged destination is used; the server decides access there.
        router.replace("/dashboard/student");
      });
  }, [user, isLoading, role, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
}
