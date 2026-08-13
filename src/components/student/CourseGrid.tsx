"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, Clock, Video, BookOpen, Loader2, CheckCircle, ShieldCheck, CreditCard } from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRouter } from "next/navigation";
import { T } from "@/components/TranslatedText";
import { PaymentModal } from "@/components/PaymentModal";

interface Course {
  id: string;
  title: string;
  type: "Recorded" | "Live Online";
  price: number;
  level: string;
  rating: number;
  duration: string;
  image_url?: string;
}

interface Subscription {
  id: string;
  max_course: number;
  course_used: number;
  expires_at: string;
}

export function CourseGrid() {
  const { user } = useAuth();
  const router = useRouter();

  const [course, setcourse] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [selectedcourse, setSelectedcourse] = useState<string[]>([]);
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [selectedCourseForPayment, setSelectedCourseForPayment] = useState<Course | null>(null);

  // Fetch course
  useEffect(() => {
    fetch("/api/course")
      .then((r) => r.json())
      .then((data) => {
        if (data.course?.length) {
          setcourse(data.course);
        } else {
          setcourse([
            { id: "1", title: "Foundations of Arabic — A1", type: "Recorded", price: 49, level: "A1", rating: 4.9, duration: "12h" },
            { id: "2", title: "Conversational Mastery — B1", type: "Live Online", price: 100, level: "B1", rating: 5.0, duration: "8 weeks" },
            { id: "3", title: "Quranic Arabic Essentials", type: "Recorded", price: 49, level: "A2", rating: 4.8, duration: "16h" },
            { id: "4", title: "Advanced Iʿrāb & Grammar", type: "Live Online", price: 100, level: "C1", rating: 4.9, duration: "10 weeks" },
            { id: "5", title: "Media & Modern Standard", type: "Recorded", price: 49, level: "B2", rating: 4.7, duration: "14h" },
            { id: "6", title: "Classical Texts Reading", type: "Live Online", price: 100, level: "C2", rating: 5.0, duration: "12 weeks" },
          ]);
        }
      })
      .catch(() => {
        setcourse([
          { id: "1", title: "Foundations of Arabic — A1", type: "Recorded", price: 49, level: "A1", rating: 4.9, duration: "12h" },
          { id: "2", title: "Conversational Mastery — B1", type: "Live Online", price: 100, level: "B1", rating: 5.0, duration: "8 weeks" },
          { id: "3", title: "Quranic Arabic Essentials", type: "Recorded", price: 49, level: "A2", rating: 4.8, duration: "16h" },
          { id: "4", title: "Advanced Iʿrāb & Grammar", type: "Live Online", price: 100, level: "C1", rating: 4.9, duration: "10 weeks" },
          { id: "5", title: "Media & Modern Standard", type: "Recorded", price: 49, level: "B2", rating: 4.7, duration: "14h" },
          { id: "6", title: "Classical Texts Reading", type: "Live Online", price: 100, level: "C2", rating: 5.0, duration: "12 weeks" },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch active subscription
  useEffect(() => {
    if (!user) return;
    fetch("/api/subscriptions")
      .then((r) => r.json())
      .then((data) => {
        if (data.subscription) {
          setSubscription(data.subscription);
          setSelectedcourse(data.subscription.course_ids || []);
        }
      })
      .catch(() => {});
  }, [user]);

  const isSubscriber = subscription !== null && new Date(subscription.expires_at) > new Date();
  const remainingSlots = subscription ? subscription.max_course - (subscription.course_used || 0) : 0;

  const handleChooseCourse = async (courseId: string) => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!isSubscriber) return;
    if (selectedcourse.includes(courseId)) return;

    setChoosingId(courseId);
    setMessage("");

    try {
      const res = await fetch("/api/subscriptions/choose-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: courseId }),
      });
      const data = await res.json();

      if (data.success) {
        setSelectedcourse((prev) => [...prev, courseId]);
        setSubscription((prev) =>
          prev ? { ...prev, course_used: (prev.course_used || 0) + 1 } : prev
        );
        setMessage("Course added successfully!");
      } else {
        setMessage(data.error || "An error occurred");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setChoosingId(null);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // Open the manual payment modal
  const handleBuy = (course: Course) => {
    if (!user) return;
    setSelectedCourseForPayment(course);
    setShowPayment(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Message for subscribers */}
      {isSubscriber && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-4 text-center"
        >
          <ShieldCheck className="inline h-5 w-5 text-primary mr-2" />
          <span className="text-foreground font-medium">
            <T>{`You are subscribed! You can choose ${remainingSlots} courses for free`}</T>
          </span>
          {subscription && (
            <span className="text-muted-foreground text-sm ml-2">
              <T>{`(Expires on ${new Date(subscription.expires_at).toLocaleDateString("en-US")})`}</T>
            </span>
          )}
        </motion.div>
      )}

      {/* Success message */}
      {message && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-sm font-medium text-primary"
        >
          <T>{message}</T>
        </motion.div>
      )}

      {/* Course grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {course.map((c, i) => {
          const alreadyChosen = selectedcourse.includes(c.id);
          const canChoose = isSubscriber && !alreadyChosen && remainingSlots > 0;
          const isChoosing = choosingId === c.id;

          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group overflow-hidden rounded-3xl border border-border bg-card shadow-elegant transition hover:-translate-y-1"
            >
              {/* Header with gradient */}
              <div className="relative h-32 bg-gradient-primary">
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    background: "radial-gradient(circle at 30% 30%, white, transparent 60%)",
                  }}
                />
                {/* Course type */}
                <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs text-primary-foreground backdrop-blur">
                  {c.type === "Live Online" ? (
                    <Video className="h-3 w-3" />
                  ) : (
                    <BookOpen className="h-3 w-3" />
                  )}
                  {c.type}
                </div>
                {/* Level */}
                <div className="absolute right-4 top-4 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
                  {c.level}
                </div>
                {/* Price */}
                <div className="absolute bottom-3 left-4 font-serif text-3xl text-primary-foreground">
                  ${c.price}
                </div>
              </div>

              {/* Card content */}
              <div className="p-5 space-y-3">
                <h3 className="font-serif text-lg leading-snug text-foreground">{c.title}</h3>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3 fill-accent text-accent" /> {c.rating}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {c.duration}
                  </span>
                </div>

                {/* Buttons: buy / subscribe */}
                {alreadyChosen ? (
                  <button
                    disabled
                    className="mt-4 w-full rounded-full bg-secondary text-secondary-foreground py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={14} />
                    <T>Added</T>
                  </button>
                ) : canChoose ? (
                  <button
                    onClick={() => handleChooseCourse(c.id)}
                    disabled={isChoosing}
                    className="mt-4 w-full rounded-full bg-accent text-accent-foreground py-2.5 text-xs font-semibold hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isChoosing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : null}
                    <T>Free for Subscribers</T>
                  </button>
                ) : c.price > 0 ? (
                  <div className="mt-4">
                    {user ? (
                      <button
                        onClick={() => handleBuy(c)}
                        className="w-full rounded-full bg-accent py-2.5 text-xs font-semibold text-accent-foreground transition hover:bg-accent/90 flex items-center justify-center gap-2"
                      >
                        <CreditCard size={14} />
                        <T>Buy Now</T>
                      </button>
                    ) : (
                      <button
                        onClick={() => router.push("/login")}
                        className="w-full rounded-full bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition"
                      >
                        <T>Login to Purchase</T>
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => router.push(`/course/${c.id}`)}
                    className="mt-4 w-full rounded-full bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition"
                  >
                    <T>Enroll for Free</T>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Payment Modal */}
      {selectedCourseForPayment && (
        <PaymentModal
          isOpen={showPayment}
          onClose={() => setShowPayment(false)}
          courseTitle={selectedCourseForPayment.title}
          userEmail={user?.email ?? undefined}
        />
      )}
    </div>
  );
}