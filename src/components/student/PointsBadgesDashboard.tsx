"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import {
  Loader2,
  Coins,
  BadgeCheck,
  TicketPercent,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

// Types
interface Badge {
  id: string;
  badge_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  awarded_at: string;
}

interface Offer {
  id: string;
  points_cost: number;
  discount_percent: number;
  description: string | null;
  is_active: boolean;
}

interface PointsHistoryEntry {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
}

export default function PointsBadgesDashboard() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [history, setHistory] = useState<PointsHistoryEntry[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();

      const [pointsRes, badgesRes, offersRes] = await Promise.all([
        fetch("/api/student/points", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/student/badges", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/student/redeem-points", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (pointsRes.ok) {
        const data = await pointsRes.json();
        setBalance(data.balance || 0);
        setHistory(data.history || []);
      }
      if (badgesRes.ok) {
        const data = await badgesRes.json();
        setBadges(data.badges || []);
      }
      if (offersRes.ok) {
        const data = await offersRes.json();
        setOffers(data.offers || []);
      }
    } catch (error) {
      console.error("Failed to fetch points/badges:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRedeem = async (offerId: string) => {
    if (!user) return;
    setRedeemingId(offerId);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/student/redeem-points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ offerId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Coupon ${data.coupon.code} generated!`);
        // Update balance and history by refetching
        await fetchData();
      } else {
        toast.error(data.error || "Failed to redeem points");
      }
    } catch (error) {
      toast.error("Network error");
    } finally {
      setRedeemingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Points Balance */}
      <section className="rounded-3xl border bg-card p-6 shadow-elegant">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-xl">
            <Coins className="h-5 w-5 text-yellow-500" />
            <T>Points Balance</T>
          </h2>
          <button
            onClick={fetchData}
            className="p-2 rounded-full hover:bg-accent transition"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <p className="mt-4 text-5xl font-bold text-foreground">{balance}</p>
        <p className="text-sm text-muted-foreground mt-1">
          <T>Points can be redeemed for discount coupons.</T>
        </p>
      </section>

      {/* Redemption Offers */}
      <section className="rounded-3xl border bg-card p-6 shadow-elegant">
        <h2 className="flex items-center gap-2 font-serif text-xl">
          <TicketPercent className="h-5 w-5 text-primary" />
          <T>Redeem Points</T>
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="flex flex-col justify-between rounded-2xl border bg-background p-4"
            >
              <div>
                <p className="font-semibold text-lg">
                  {offer.discount_percent}% <T>Discount</T>
                </p>
                <p className="text-sm text-muted-foreground">
                  {offer.points_cost} <T>points</T>
                </p>
              </div>
              <button
                onClick={() => handleRedeem(offer.id)}
                disabled={redeemingId === offer.id || balance < offer.points_cost}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {redeemingId === offer.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TicketPercent className="h-4 w-4" />
                )}
                <T>Redeem</T>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Badges */}
      <section className="rounded-3xl border bg-card p-6 shadow-elegant">
        <h2 className="flex items-center gap-2 font-serif text-xl">
          <BadgeCheck className="h-5 w-5 text-primary" />
          <T>My Badges</T>
        </h2>
        {badges.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            <T>No badges earned yet. Keep going!</T>
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className="flex items-start gap-3 rounded-2xl border bg-background p-4"
              >
                <div className="flex-shrink-0">
                  {badge.icon_url ? (
                    <img
                      src={badge.icon_url}
                      alt={badge.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                      <BadgeCheck className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium">{badge.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {badge.description || ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Points History */}
      <section className="rounded-3xl border bg-card p-6 shadow-elegant">
        <h2 className="flex items-center gap-2 font-serif text-xl">
          <Coins className="h-5 w-5 text-muted-foreground" />
          <T>Points History</T>
        </h2>
        {history.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            <T>No activity yet.</T>
          </p>
        ) : (
          <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl border bg-background px-4 py-2 text-sm"
              >
                <span>{entry.reason}</span>
                <span className="font-semibold">
                  {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}