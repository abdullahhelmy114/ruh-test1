"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Coins } from "lucide-react";
import { T } from "@/components/TranslatedText";
import PointsBadgesDashboard from "@/components/student/PointsBadgesDashboard";
import DailyActivityWidget from "@/components/student/DailyActivityWidget";

export default function PointsPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <div className="flex items-center gap-2 mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
          <T>Back</T>
        </button>
        <h1 className="font-serif text-3xl flex items-center gap-2">
          <Coins className="h-6 w-6 text-yellow-500" />
          <T>My Points & Badges</T>
        </h1>
      </div>

      <div className="space-y-8">
        <DailyActivityWidget />
        <PointsBadgesDashboard />
      </div>
    </div>
  );
}