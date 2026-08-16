"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { Loader2, Flame, Coins, RefreshCw } from "lucide-react";

interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
}

export default function DailyActivityWidget() {
  const { user } = useAuth();
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const [streakRes, pointsRes] = await Promise.all([
        fetch("/api/student/streak", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/student/points", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const streakData = await streakRes.json();
      const pointsData = await pointsRes.json();

      if (streakRes.ok) {
        setStreak(streakData.streak || null);
      }
      if (pointsRes.ok) {
        setPoints(pointsData.balance || 0);
      }
    } catch (error) {
      console.error("Failed to fetch daily activity:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-3xl border bg-card p-6 shadow-elegant">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-3xl border bg-card p-6 shadow-elegant space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg">
          <T>Daily Activity</T>
        </h3>
        <button
          onClick={fetchData}
          className="p-2 rounded-full hover:bg-accent transition"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Streak */}
        <div className="rounded-2xl bg-background border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Flame className="h-4 w-4 text-orange-500" />
            <T>Current Streak</T>
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {streak ? streak.current_streak : 0}
          </p>
          <p className="text-xs text-muted-foreground">
            <T>Longest</T>: {streak?.longest_streak || 0}
          </p>
        </div>

        {/* Points */}
        <div className="rounded-2xl bg-background border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Coins className="h-4 w-4 text-yellow-500" />
            <T>Points Balance</T>
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {points}
          </p>
        </div>
      </div>

      {streak?.last_activity_date && (
        <p className="text-xs text-muted-foreground">
          <T>Last active</T>: {new Date(streak.last_activity_date).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}