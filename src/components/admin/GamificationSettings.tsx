"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Trash2,
  Plus,
  BadgeCheck,
  Settings2,
  Coins,
  TicketPercent,
  BrainCircuit,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface PointsConfig {
  daily_streak_2: number;
  daily_streak_3: number;
  daily_streak_5: number;
  exam_pass_points: number;
}

interface Offer {
  id: string;
  points_cost: number;
  discount_percent: number;
  description: string | null;
  is_active: boolean;
}

interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  condition_type: string;
  condition_value: number;
  is_custom: boolean;
}

interface NewBadge {
  name: string;
  description: string;
  icon_url: string;
  condition_type: string;
  condition_value: number;
}

const CONDITION_OPTIONS = [
  { value: "course_completed", label: "Course Completed" },
  { value: "level_mastered", label: "Level Mastered" },
  { value: "points_reached", label: "Points Reached" },
  { value: "streak_days", label: "Streak Days" },
  { value: "questions_completed", label: "Questions Completed" },
  { value: "game_won", label: "Game Won" },
];

export default function GamificationSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Points config
  const [pointsConfig, setPointsConfig] = useState<PointsConfig>({
    daily_streak_2: 2,
    daily_streak_3: 3,
    daily_streak_5: 5,
    exam_pass_points: 100,
  });

  // Offers
  const [offers, setOffers] = useState<Offer[]>([]);
  const [newOffer, setNewOffer] = useState({
    points_cost: 0,
    discount_percent: 10,
    description: "",
  });

  // Badges
  const [badges, setBadges] = useState<Badge[]>([]);
  const [newBadge, setNewBadge] = useState<NewBadge>({
    name: "",
    description: "",
    icon_url: "",
    condition_type: "points_reached",
    condition_value: 100,
  });

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const token = await user.getIdToken();
    try {
      const [configRes, offersRes, badgesRes] = await Promise.all([
        fetch("/api/admin/gamification/points-config", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/admin/gamification/offers", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/admin/gamification/badges", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const configData = await configRes.json();
      const offersData = await offersRes.json();
      const badgesData = await badgesRes.json();

      if (configData.config) {
        setPointsConfig({
          daily_streak_2: Number(configData.config.daily_streak_2 || 2),
          daily_streak_3: Number(configData.config.daily_streak_3 || 3),
          daily_streak_5: Number(configData.config.daily_streak_5 || 5),
          exam_pass_points: Number(configData.config.exam_pass_points || 100),
        });
      }
      if (Array.isArray(offersData.offers)) {
        setOffers(offersData.offers);
      }
      if (Array.isArray(badgesData.badges)) {
        setBadges(badgesData.badges);
      }
    } catch (error) {
      console.error("Failed to fetch gamification data:", error);
      toast.error("Failed to load gamification settings");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSavePoints = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/gamification/points-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(pointsConfig),
      });
      if (res.ok) {
        toast.success("Points configuration saved");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save");
      }
    } catch (error) {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddOffer = async () => {
    if (!user) return;
    if (newOffer.points_cost <= 0 || newOffer.discount_percent <= 0) {
      toast.error("Invalid values");
      return;
    }
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/gamification/offers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newOffer),
      });
      if (res.ok) {
        toast.success("Offer created");
        setNewOffer({ points_cost: 0, discount_percent: 10, description: "" });
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create offer");
      }
    } catch (error) {
      toast.error("Network error");
    }
  };

  const handleToggleOfferActive = async (offerId: string, isActive: boolean) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/gamification/offers`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ offerId, is_active: !isActive }),
      });
      if (res.ok) {
        setOffers((prev) =>
          prev.map((o) => (o.id === offerId ? { ...o, is_active: !isActive } : o))
        );
      }
    } catch (error) {
      toast.error("Failed to update offer");
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    if (!user) return;
    if (!confirm("Delete this offer?")) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/gamification/offers`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ offerId }),
      });
      if (res.ok) {
        setOffers((prev) => prev.filter((o) => o.id !== offerId));
        toast.success("Offer deleted");
      }
    } catch (error) {
      toast.error("Failed to delete offer");
    }
  };

  const handleAddBadge = async () => {
    if (!user) return;
    if (!newBadge.name.trim() || newBadge.condition_value <= 0) {
      toast.error("Invalid badge details");
      return;
    }
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/gamification/badges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newBadge),
      });
      if (res.ok) {
        toast.success("Badge created");
        setNewBadge({
          name: "",
          description: "",
          icon_url: "",
          condition_type: "points_reached",
          condition_value: 100,
        });
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create badge");
      }
    } catch (error) {
      toast.error("Network error");
    }
  };

  const handleDeleteBadge = async (badgeId: string) => {
    if (!user) return;
    if (!confirm("Delete this badge?")) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/gamification/badges", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ badgeId }),
      });
      if (res.ok) {
        setBadges((prev) => prev.filter((b) => b.id !== badgeId));
        toast.success("Badge deleted");
      }
    } catch (error) {
      toast.error("Failed to delete badge");
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
      {/* Points Configuration */}
      <section className="rounded-3xl border bg-card p-6 shadow-elegant">
        <h2 className="flex items-center gap-2 font-serif text-xl">
          <Coins className="h-5 w-5 text-primary" />
          <T>Points Configuration</T>
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-sm font-medium">
              <T>Daily Streak (1-2 days)</T>
            </label>
            <input
              type="number"
              value={pointsConfig.daily_streak_2}
              onChange={(e) =>
                setPointsConfig((prev) => ({
                  ...prev,
                  daily_streak_2: Number(e.target.value),
                }))
              }
              className="w-full rounded-xl border bg-background px-4 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              <T>Daily Streak (3-6 days)</T>
            </label>
            <input
              type="number"
              value={pointsConfig.daily_streak_3}
              onChange={(e) =>
                setPointsConfig((prev) => ({
                  ...prev,
                  daily_streak_3: Number(e.target.value),
                }))
              }
              className="w-full rounded-xl border bg-background px-4 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              <T>Daily Streak (7+ days)</T>
            </label>
            <input
              type="number"
              value={pointsConfig.daily_streak_5}
              onChange={(e) =>
                setPointsConfig((prev) => ({
                  ...prev,
                  daily_streak_5: Number(e.target.value),
                }))
              }
              className="w-full rounded-xl border bg-background px-4 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              <T>Exam Pass Points</T>
            </label>
            <input
              type="number"
              value={pointsConfig.exam_pass_points}
              onChange={(e) =>
                setPointsConfig((prev) => ({
                  ...prev,
                  exam_pass_points: Number(e.target.value),
                }))
              }
              className="w-full rounded-xl border bg-background px-4 py-2 text-sm mt-1"
            />
          </div>
        </div>
        <button
          onClick={handleSavePoints}
          disabled={saving}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <T>Save Points</T>
        </button>
      </section>

      {/* Redemption Offers */}
      <section className="rounded-3xl border bg-card p-6 shadow-elegant">
        <h2 className="flex items-center gap-2 font-serif text-xl">
          <TicketPercent className="h-5 w-5 text-primary" />
          <T>Redemption Offers</T>
        </h2>
        <div className="mt-4 space-y-2">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="flex items-center justify-between rounded-2xl border bg-background px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold">
                  {offer.points_cost} <T>points</T>
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="font-semibold text-primary">
                  {offer.discount_percent}% <T>discount</T>
                </span>
                {offer.description && (
                  <span className="text-sm text-muted-foreground">
                    {offer.description}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleOfferActive(offer.id, offer.is_active)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    offer.is_active
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {offer.is_active ? <T>Active</T> : <T>Inactive</T>}
                </button>
                <button
                  onClick={() => handleDeleteOffer(offer.id)}
                  className="p-1.5 rounded-full text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-sm font-medium">
              <T>Points Cost</T>
            </label>
            <input
              type="number"
              value={newOffer.points_cost}
              onChange={(e) =>
                setNewOffer((prev) => ({ ...prev, points_cost: Number(e.target.value) }))
              }
              className="w-32 rounded-xl border bg-background px-3 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              <T>Discount %</T>
            </label>
            <input
              type="number"
              value={newOffer.discount_percent}
              onChange={(e) =>
                setNewOffer((prev) => ({ ...prev, discount_percent: Number(e.target.value) }))
              }
              className="w-32 rounded-xl border bg-background px-3 py-2 text-sm mt-1"
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium">
              <T>Description (optional)</T>
            </label>
            <input
              value={newOffer.description}
              onChange={(e) =>
                setNewOffer((prev) => ({ ...prev, description: e.target.value }))
              }
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm mt-1"
            />
          </div>
          <button
            onClick={handleAddOffer}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <T>Add Offer</T>
          </button>
        </div>
      </section>

      {/* Badges Management */}
      <section className="rounded-3xl border bg-card p-6 shadow-elegant">
        <h2 className="flex items-center gap-2 font-serif text-xl">
          <BadgeCheck className="h-5 w-5 text-primary" />
          <T>Badges Management</T>
        </h2>
        <div className="mt-4 space-y-2">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className="flex items-center justify-between rounded-2xl border bg-background px-4 py-3"
            >
              <div>
                <p className="font-medium">{badge.name}</p>
                <p className="text-xs text-muted-foreground">
                  {badge.condition_type} ≥ {badge.condition_value}
                  {badge.is_custom && (
                    <span className="ml-2 text-xs text-primary">
                      <T>Custom</T>
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => handleDeleteBadge(badge.id)}
                className="p-1.5 rounded-full text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">
              <T>Badge Name</T>
            </label>
            <input
              value={newBadge.name}
              onChange={(e) => setNewBadge((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              <T>Condition Type</T>
            </label>
            <select
              value={newBadge.condition_type}
              onChange={(e) =>
                setNewBadge((prev) => ({ ...prev, condition_type: e.target.value }))
              }
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm mt-1"
            >
              {CONDITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  <T>{opt.label}</T>
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">
              <T>Condition Value</T>
            </label>
            <input
              type="number"
              value={newBadge.condition_value}
              onChange={(e) =>
                setNewBadge((prev) => ({
                  ...prev,
                  condition_value: Number(e.target.value),
                }))
              }
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              <T>Description (optional)</T>
            </label>
            <input
              value={newBadge.description}
              onChange={(e) =>
                setNewBadge((prev) => ({ ...prev, description: e.target.value }))
              }
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              <T>Icon URL (optional)</T>
            </label>
            <input
              value={newBadge.icon_url}
              onChange={(e) =>
                setNewBadge((prev) => ({ ...prev, icon_url: e.target.value }))
              }
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm mt-1"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddBadge}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              <T>Add Badge</T>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}