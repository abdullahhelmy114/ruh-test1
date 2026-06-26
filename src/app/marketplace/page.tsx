"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2, BookOpen, CreditCard, Tag, Search, Filter, X,
  User, Sparkles, Star, ShoppingCart, Heart,
} from "lucide-react";
import { motion } from "framer-motion";
import { T } from "@/components/TranslatedText";

interface Course {
  id: string;
  title: string;
  level: string;
  price: number;
  teacher_name: string;
  image_url: string | null;
  description: string | null;
}

const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function MarketplacePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  // بحث وفلترة
  const [search, setSearch] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  // كوبون
  const [couponCode, setCouponCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [couponError, setCouponError] = useState("");

  // تقييمات
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});

  const fetchCourses = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (selectedLevel) params.append("level", selectedLevel);
    if (minPrice) params.append("minPrice", minPrice);
    if (maxPrice) params.append("maxPrice", maxPrice);

    try {
      const res = await fetch(`/api/marketplace?${params.toString()}`);
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // جلب التقييمات لكل الكورسات
  useEffect(() => {
    if (courses.length === 0) return;
    courses.forEach(async (c) => {
      const res = await fetch(`/api/reviews?courseId=${c.id}`);
      const data = await res.json();
      setRatings(prev => ({ ...prev, [c.id]: { avg: data.average, count: data.count } }));
    });
  }, [courses]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCourses();
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedLevel("");
    setMinPrice("");
    setMaxPrice("");
    setTimeout(fetchCourses, 100);
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError("");
    const res = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode, userId: user?.uid }),
    });
    const data = await res.json();
    if (data.valid) {
      setDiscountPercent(data.discount_percent);
      setCouponError("");
    } else {
      setDiscountPercent(0);
      setCouponError(data.error || "Invalid coupon");
    }
  };

  // ✅ تسجيل مجاني (للكورسات بسعر 0)
  const handleFreeEnroll = async (course: Course) => {
    if (!user) {
      router.push("/login");
      return;
    }
    setEnrolling(course.id);
    setMessage("");
    try {
      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, courseId: course.id }),
      });
      if (res.ok) {
        setMessage("Enrolled successfully!");
        setMessageType("success");
        setTimeout(() => router.push(`/dashboard/student/courses/${course.id}`), 1000);
      } else {
        const err = await res.json();
        setMessage(err.error || "Enrollment failed");
        setMessageType("error");
      }
    } catch {
      setMessage("Network error");
      setMessageType("error");
    } finally {
      setEnrolling(null);
    }
  };

  // ✅ الشراء عبر Shopier (للكورسات المدفوعة)
  const handleBuy = async (course: Course) => {
    if (!user) return;
    setEnrolling(course.id);
    setMessage("");

    try {
      const res = await fetch("/api/shopier/create-payment-link", {
        method: "POST",
        credentials: "include", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liveCourseId: course.id,
        }),
      });

      const data = await res.json();

      if (data.paymentUrl) {
        window.open(data.paymentUrl, "_blank");
      } else {
        setMessage(data.error || "Failed to create payment link");
        setMessageType("error");
      }
    } catch {
      setMessage("Network error");
      setMessageType("error");
    } finally {
      setEnrolling(null);
    }
  };

  const hasActiveFilters = search || selectedLevel || minPrice || maxPrice;

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-accent-foreground">
          <T>Marketplace</T>
        </div>
        <h1 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
          <T>Explore Our Courses</T>
        </h1>
        <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
          <T>Master Arabic with the best instructors</T>
        </p>
      </div>

      {/* Search & Filters */}
      <form
        onSubmit={handleSearch}
        className="glass rounded-2xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses..."
            className="w-full rounded-full border border-border bg-background pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none"
        >
          <option value="">All Levels</option>
          {levels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
          <input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-full rounded-full border border-border bg-background pl-8 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
          <input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full rounded-full border border-border bg-background pl-8 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition flex items-center justify-center gap-2"
          >
            <Filter size={16} />
            <T>Filter</T>
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-border bg-background px-3 py-2.5 text-sm hover:bg-secondary transition"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </form>

      {/* Coupon */}
      <div className="mb-8 flex items-center justify-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 glass rounded-full px-4 py-2">
          <Tag size={16} className="text-accent-foreground" />
          <input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Coupon code"
            className="bg-transparent text-sm outline-none w-28"
          />
          <button
            onClick={validateCoupon}
            className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90 transition"
          >
            <T>Apply</T>
          </button>
        </div>
        {couponError && (
          <p className="text-red-500 text-sm">{couponError}</p>
        )}
        {discountPercent > 0 && (
          <div className="flex items-center gap-1 text-primary bg-secondary px-3 py-1 rounded-full text-sm">
            <Sparkles size={14} />
            <T>{`${discountPercent}% discount applied!`}</T>
          </div>
        )}
      </div>

      {message && (
        <div
          className={`mb-6 text-center text-sm font-medium p-3 rounded-full ${
            messageType === "success"
              ? "text-primary bg-secondary"
              : "text-destructive bg-destructive/10"
          }`}
        >
          <T>{message}</T>
        </div>
      )}

      {/* Course Grid */}
      {courses.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen className="mx-auto h-16 w-16 mb-4 text-accent-foreground/50" />
          <p className="text-lg font-serif"><T>No courses available yet.</T></p>
          <p className="text-sm mt-2">
            <T>Try adjusting your filters or check back later.</T>
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const finalPrice = Math.max(
              course.price - (course.price * discountPercent) / 100,
              0
            );
            const hasDiscount = discountPercent > 0;
            const rating = ratings[course.id];

            return (
              <motion.div
                key={course.id}
                whileHover={{ y: -6 }}
                className="group overflow-hidden rounded-3xl border border-border bg-card shadow-lg transition-shadow hover:shadow-2xl hover:shadow-primary/10"
              >
                {/* صورة الكورس */}
                <Link href={`/courses/${course.id}`}>
                  <div className="h-48 bg-gradient-primary flex items-center justify-center relative overflow-hidden">
                    {course.image_url ? (
                      <Image
                        src={course.image_url}
                        alt={course.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <BookOpen className="h-20 w-20 text-primary-foreground/20" />
                    )}
                    <span className="absolute top-3 right-3 rounded-full bg-black/30 backdrop-blur-md px-3 py-1 text-xs font-bold text-white">
                      {course.level}
                    </span>
                    {hasDiscount && (
                      <span className="absolute top-3 left-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                        -{discountPercent}%
                      </span>
                    )}
                  </div>
                </Link>

                {/* محتوى البطاقة */}
                <div className="p-5 flex flex-col h-55">
                  <Link href={`/courses/${course.id}`}>
                    <h3 className="font-serif text-lg leading-tight hover:text-accent-foreground transition-colors line-clamp-2 text-foreground">
                      {course.title}
                    </h3>
                  </Link>

                  {/* تقييم النجوم */}
                  {rating && rating.count > 0 && (
                    <div className="flex items-center gap-1 text-xs text-accent-foreground mt-1">
                      <Star size={12} className="fill-accent text-accent" />
                      <span>{rating.avg} ({rating.count})</span>
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <User size={14} /> <T>by</T> {course.teacher_name}
                  </p>
                  {course.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2 flex-1">
                      {course.description}
                    </p>
                  )}

                  {/* السعر وأزرار الإجراءات */}
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/50">
                    <div className="flex items-baseline gap-1">
                      {hasDiscount ? (
                        <>
                          <span className="font-serif text-xl font-bold text-primary">
                            ${finalPrice}
                          </span>
                          <span className="text-xs line-through text-muted-foreground">
                            ${course.price}
                          </span>
                        </>
                      ) : (
                        <span className="font-serif text-xl font-bold text-primary">
                          {course.price === 0 ? <T>Free</T> : `$${course.price}`}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={async () => {
                          if (!user) return router.push("/login");
                          await fetch("/api/wishlist", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ uid: user.uid, courseId: course.id }),
                          });
                          setMessage("Added to wishlist!");
                          setMessageType("success");
                        }}
                        className="rounded-full border border-border bg-background p-2 text-sm hover:bg-secondary"
                      >
                        <Heart size={16} className="text-accent" />
                      </button>

                      <button
                        onClick={async () => {
                          if (!user) return router.push("/login");
                          await fetch("/api/cart", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ uid: user.uid, courseId: course.id }),
                          });
                          setMessage("Added to cart!");
                          setMessageType("success");
                        }}
                        className="rounded-full border border-border bg-background p-2 text-sm hover:bg-secondary"
                      >
                        <ShoppingCart size={16} />
                      </button>
                    </div>

                    {/* ✅ زر الشراء أو التسجيل المجاني - Shopier */}
                    <div className="ml-2">
                      {course.price > 0 ? (
                        user ? (
                          <button
                            onClick={() => handleBuy(course)}
                            disabled={enrolling === course.id}
                            className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition inline-flex items-center gap-1"
                          >
                            {enrolling === course.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <CreditCard size={14} />
                                <T>Buy Now</T>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => router.push("/login")}
                            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition"
                          >
                            <T>Login to Buy</T>
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleFreeEnroll(course)}
                          disabled={enrolling === course.id}
                          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition inline-flex items-center gap-1"
                        >
                          {enrolling === course.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <CreditCard size={14} />
                              <T>Enroll for Free</T>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}