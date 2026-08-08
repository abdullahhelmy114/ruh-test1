"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ReferralPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  useEffect(() => {
    if (params.code && typeof window !== "undefined") {
      localStorage.setItem("referral_code", params.code);
    }
    router.push("/signup");
  }, [params.code, router]);

  return null;
}