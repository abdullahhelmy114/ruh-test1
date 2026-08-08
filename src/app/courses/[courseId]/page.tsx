"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Loader2, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { T } from "@/components/TranslatedText";
import ThemeDefault from "@/components/course/ThemeDefault";
import { StarRating } from "@/components/StarRating";

// ─── واجهات المراجعات ───────────────────────────
interface Review {
  id: string;
  user_name: string;
  rating: number;
  comment?: string;
  created_at: string;
}

// ─── المكون الرئيسي ─────────────────────────────
export default function CourseDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [variant, setVariant] = useState<"adult" | "kids">("adult");

  // جلب الكورس
  useEffect(() => {
    if (!params.courseId) return;
    fetch(`/api/courses/${params.courseId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setCourse(null);
        } else {
          // البيانات قد تأتي بصيغة { course: {...} } أو مباشرة
          setCourse(data.course || data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.courseId]);

  // تحديد variant (أطفال / كبار)
  useEffect(() => {
    if (!user) return;
    fetch(`/api/user?uid=${user.uid}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.profile?.age && data.profile.age <= 13) {
          setVariant("kids");
        }
      })
      .catch(console.error);
  }, [user]);

  // حالة التحميل
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // كورس غير موجود
  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <T>Course not found</T>
      </div>
    );
  }

  // عرض الصفحة
  return (
    <>
      {/* Breadcrumb (اختياري) */}
      <div className="mx-auto max-w-6xl px-4 md:px-8 pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground"><T>Home</T></Link>
          <ChevronRight size={14} />
          <Link href="/marketplace" className="hover:text-foreground"><T>Marketplace</T></Link>
          <ChevronRight size={14} />
          <span className="text-foreground">{course.title}</span>
        </div>
      </div>

      {/* المحتوى الرئيسي (ثيم + مراجعات) */}
      <ThemeDefault
        theme={course.theme || "theme-1"}
        variant={variant}
        course={course}
      />
      <div className="mx-auto max-w-6xl px-4 md:px-8 pb-12">
        <ReviewsSection courseId={params.courseId} />
      </div>
    </>
  );
}

// ─── مكون المراجعات (منقول من النسخة السابقة) ──
function ReviewsSection({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [myRating, setMyRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = () => {
    fetch(`/api/reviews?courseId=${courseId}`)
      .then((r) => r.json())
      .then((d) => {
        setReviews(d.reviews || []);
        setAverage(d.average || 0);
        setCount(d.count || 0);
      });
  };

  useEffect(() => {
    fetchReviews();
  }, [courseId]);

  const handleSubmitReview = async () => {
    if (!user || !myRating) return;
    setSubmitting(true);
    await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userUid: user.uid, courseId, rating: myRating, comment }),
    });
    setMyRating(0);
    setComment("");
    setSubmitting(false);
    fetchReviews();
  };

  return (
    <div className="space-y-6 mt-12">
      <div className="flex items-center gap-3">
        <h2 className="font-serif text-2xl text-foreground"><T>Reviews</T></h2>
        <StarRating rating={average} readonly size={18} />
        <span className="text-sm text-muted-foreground">({count})</span>
      </div>

      {user && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <p className="text-sm font-medium text-foreground"><T>Your Rating</T></p>
          <StarRating rating={myRating} onChange={setMyRating} size={24} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Add a comment (optional)"
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm resize-none text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSubmitReview}
            disabled={submitting || !myRating}
            className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin mx-auto" />
            ) : (
              <T>Submit Review</T>
            )}
          </button>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground"><T>No reviews yet.</T></p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{r.user_name}</span>
                <StarRating rating={r.rating} readonly size={14} />
              </div>
              {r.comment && (
                <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}