"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2, BookOpen, Video, FileText, ChevronRight,
  User, ArrowLeft, CreditCard,
} from "lucide-react";
import { YouTubeEmbed } from "@/components/ui/YouTubeEmbed";
import { StarRating } from "@/components/StarRating";
import { T } from "@/components/TranslatedText";

interface Lesson {
  id: string;
  title: string;
  type: string;
  recording_url?: string;
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  level: string;
  price: number;
  image_url: string | null;
  trailer_url?: string | null;
  teacher_name: string;
  teacher_uid: string;
  lessons: Lesson[];
}

export default function CourseDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!params.courseId) return;
    fetch(`/api/courses/${params.courseId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setCourse(null);
        } else {
          setCourse(data.course);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.courseId]);

  // الشراء عبر Shopier
  const handleBuy = async () => {
  if (!user) {
    router.push("/login");
    return;
  }
  if (!course) return;

  setEnrolling(true);
  setMessage("");

  try {
    const res = await fetch("/api/shopier/create-payment-link", {
      method: "POST",
      credentials: "include", // <-- أضف هذا
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liveCourseId: course.id }),
    });

    const data = await res.json();

    if (data.paymentUrl) {
      window.open(data.paymentUrl, "_blank");
    } else {
      setMessage(data.error || "حدث خطأ أثناء إنشاء رابط الدفع");
    }
  } catch {
    setMessage("خطأ في الشبكة");
  } finally {
    setEnrolling(false);
  }
};

  // التسجيل المجاني (للكورسات بدون سعر)
  const handleFreeEnroll = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (course!.price > 0) {
      return;
    }

    setEnrolling(true);
    setMessage("");
    try {
      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, courseId: params.courseId }),
      });
      if (res.ok) {
        setMessage("Enrolled successfully!");
        setTimeout(() => router.push(`/dashboard/student/courses/${params.courseId}`), 1500);
      } else {
        const err = await res.json();
        setMessage(err.error || "Enrollment failed");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <T>Course not found</T>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          <T>Home</T>
        </Link>
        <ChevronRight size={14} />
        <Link href="/marketplace" className="hover:text-foreground">
          <T>Marketplace</T>
        </Link>
        <ChevronRight size={14} />
        <span className="text-foreground">{course.title}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* صورة الكورس */}
          <div className="rounded-3xl overflow-hidden bg-gradient-primary h-64 md:h-80 flex items-center justify-center">
            {course.image_url ? (
              <Image src={course.image_url} alt={course.title} width={800} height={400} className="object-cover w-full h-full" />
            ) : (
              <BookOpen className="h-24 w-24 text-primary-foreground/20" />
            )}
          </div>

          {/* فيديو التشويق */}
          {course.trailer_url && (
            <div className="rounded-3xl overflow-hidden shadow-lg">
              <YouTubeEmbed url={course.trailer_url} title={course.title} />
            </div>
          )}

          {/* مستوى الكورس والعنوان */}
          <div>
            <span className="inline-block rounded-full bg-secondary dark:bg-secondary/30 text-secondary-foreground px-3 py-1 text-xs font-semibold">
              {course.level}
            </span>
            <h1 className="font-serif text-3xl md:text-4xl mt-3 text-foreground">{course.title}</h1>
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <User size={16} /> <T>by</T>{" "}
              <Link href={`/teachers/${course.teacher_uid}`} className="font-medium text-foreground hover:text-accent-foreground transition-colors">
                {course.teacher_name}
              </Link>
            </div>
          </div>

          {/* وصف الكورس */}
          <div className="prose dark:prose-invert max-w-none">
            <h2 className="font-serif text-2xl text-foreground"><T>About This Course</T></h2>
            <p className="text-muted-foreground">{course.description || <T>No description available.</T>}</p>
          </div>

          {/* الدروس */}
          <div>
            <h2 className="font-serif text-2xl mb-4 text-foreground">
              <T>Lessons</T> ({course.lessons?.length || 0})
            </h2>
            {course.lessons?.length === 0 ? (
              <p className="text-muted-foreground"><T>No lessons yet.</T></p>
            ) : (
              course.lessons?.map((lesson) => (
                <div key={lesson.id} className="border border-border rounded-2xl p-4 bg-card mb-3">
                  <div className="flex items-center gap-2">
                    {lesson.type === "zoom" ? (
                      <Video size={16} className="text-accent-foreground" />
                    ) : (
                      <FileText size={16} className="text-primary" />
                    )}
                    <h3 className="font-serif text-lg text-foreground">{lesson.title}</h3>
                  </div>
                  {lesson.recording_url && (
                    <div className="mt-3 rounded-xl overflow-hidden">
                      <YouTubeEmbed url={lesson.recording_url} title={lesson.title} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* بطاقة الشراء الجانبية */}
        <div className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-lg sticky top-24">
            <div className="text-3xl font-serif text-primary">${course.price}</div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground"><T>Level</T></span>
                <span className="font-medium text-foreground">{course.level}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground"><T>Lessons</T></span>
                <span className="font-medium text-foreground">{course.lessons?.length || 0}</span>
              </div>
            </div>

            {message && (
              <div className={`mt-3 text-xs text-center font-medium ${
                message.includes("success") ? "text-primary" : "text-destructive"
              }`}>
                <T>{message}</T>
              </div>
            )}

            {/* زر الشراء - Shopier */}
            {course.price > 0 ? (
              <div className="mt-4">
                {user ? (
                  <button
                    onClick={handleBuy}
                    disabled={enrolling}
                    className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {enrolling ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <CreditCard size={16} />
                        <T>Buy Now</T>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => router.push("/login")}
                    className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
                  >
                    <T>Login to Enroll</T>
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleFreeEnroll}
                disabled={enrolling}
                className="mt-4 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {enrolling ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <CreditCard size={16} />
                    <T>Enroll Now (Free)</T>
                  </>
                )}
              </button>
            )}

            <Link href="/marketplace" className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft size={16} /> <T>Back to Marketplace</T>
            </Link>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <ReviewsSection courseId={params.courseId} />
    </div>
  );
}

// ----------------------------------------------------------------
// ReviewsSection component (بألوان الهوية الجديدة)
// ----------------------------------------------------------------
function ReviewsSection({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [myRating, setMyRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = () => {
    fetch(`/api/reviews?courseId=${courseId}`)
      .then(r => r.json())
      .then(d => {
        setReviews(d.reviews || []);
        setAverage(d.average || 0);
        setCount(d.count || 0);
      });
  };

  useEffect(() => { fetchReviews(); }, [courseId]);

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
    <div className="space-y-6">
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
            onChange={e => setComment(e.target.value)}
            rows={2}
            placeholder="Add a comment (optional)"
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm resize-none text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSubmitReview}
            disabled={submitting || !myRating}
            className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : <T>Submit Review</T>}
          </button>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground"><T>No reviews yet.</T></p>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <div key={r.id} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{r.user_name}</span>
                <StarRating rating={r.rating} readonly size={14} />
              </div>
              {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}