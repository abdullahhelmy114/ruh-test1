"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import {
  Loader2, ArrowLeft, Mail, Phone, MapPin, Globe, User, Calendar, Award, BookOpen,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// ============= المحتوى الفعلي للصفحة =============
function AdminUserProfileContent() {
  const { user, isLoading: authLoading, role } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");

  const [profile, setProfile] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const approveTeacher = async () => {
    try {
      const res = await fetch("/api/admin/approve-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile((prev: any) => ({ ...prev, status: "active" }));
        alert("Teacher approved!");
      } else {
        alert(data.message || "Failed to approve");
      }
    } catch {
      alert("Error approving teacher");
    }
  };

  useEffect(() => {
    if (!user || role !== "admin" || !uid) {
      if (!user) router.push("/login");
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/users/${uid}`).then((r) => r.json()),
      fetch(`/api/admin/users/${uid}/enrollments`).then((r) => r.json()),
    ])
      .then(([userData, enrollmentsData]) => {
        if (userData.error || userData.message) {
          setError(userData.message || "User not found");
        } else {
          setProfile(userData);
          setEnrollments(enrollmentsData);
        }
      })
      .catch(() => setError("Failed to load user"))
      .finally(() => setLoading(false));
  }, [user, role, uid, router]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <T>{error || "User not found"}</T>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link
        href="/dashboard/admin"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={16} /> <T>Back to Users</T>
      </Link>

      <div className="glass rounded-3xl p-6 md:p-8 space-y-6">
        {/* الهيدر */}
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full gradient-emerald text-white text-2xl font-bold">
            {(profile.first_name || profile.full_name || "?").charAt(0)}
          </div>
          <div>
            <h1 className="font-serif text-2xl">
              {profile.first_name} {profile.last_name}
            </h1>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <span className="inline-block mt-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-0.5 text-xs font-semibold capitalize">
              {profile.role}
            </span>
          </div>
        </div>

        {/* المعلومات الأساسية */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow icon={Calendar} label="Joined" value={new Date(profile.created_at).toLocaleDateString()} />
          <InfoRow icon={Globe} label="Nationality" value={profile.nationality || "—"} />
          <InfoRow icon={MapPin} label="Country of Residence" value={profile.country_of_residence || "—"} />
          <InfoRow icon={Phone} label="WhatsApp" value={profile.whatsapp || "—"} />
          <InfoRow icon={Mail} label="Telegram" value={profile.telegram || "—"} />
          <InfoRow icon={User} label="Gender" value={profile.gender || "—"} />
          <InfoRow
            icon={Globe}
            label="Languages"
            value={
              (profile.languages || [])
                .map((l: any) => `${l.code} (${l.proficiency})`)
                .join(", ") || "—"
            }
          />
        </div>

        {/* الاهتمامات (للطالب) */}
        {profile.interests && (
          <div className="pt-4 border-t">
            <h3 className="font-serif text-lg mb-2">Interests</h3>
            <p className="text-sm text-muted-foreground">{profile.interests}</p>
          </div>
        )}

        {/* بيانات المعلم الإضافية */}
        {profile.role === "teacher" && (
          <>
            <div className="pt-4 border-t">
              <h3 className="font-serif text-lg flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-secondary-foreground" /> Teacher Info
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow icon={Mail} label="Telegram" value={profile.telegram || "—"} />
                <div className="flex items-start gap-3 p-3 rounded-xl bg-background/50">
                  <BookOpen className="h-5 w-5 text-secondary-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Social Links</div>
                    <div className="text-sm font-medium">
                      {(profile.social_links || []).map((s: any, i: number) => (
                        <div key={i}>
                          {s.platform}: {s.url}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {profile.bio && (
                  <div>
                    <span className="text-xs text-muted-foreground">Bio:</span>
                    <p className="text-sm">{profile.bio}</p>
                  </div>
                )}
                {profile.cv_url && (
                  <a href={profile.cv_url} target="_blank" className="text-blue-600 underline text-sm block">
                    Download CV
                  </a>
                )}
                {profile.intro_video_url && (
                  <a href={profile.intro_video_url} target="_blank" className="text-blue-600 underline text-sm block">
                    Watch Intro Video
                  </a>
                )}
              </div>
            </div>

            {profile.status === "pending" && (
              <div className="mt-6">
                <Button onClick={approveTeacher} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Approve Teacher
                </Button>
              </div>
            )}
          </>
        )}

        {/* الاشتراكات (للطالب) أو الدورات (للمعلم) */}
        <div className="pt-4 border-t">
          <h3 className="font-serif text-lg flex items-center gap-2 mb-2">
            <BookOpen className="h-5 w-5 text-secondary-foreground" />{" "}
            {profile.role === "student" ? "Enrollments" : "Courses"}
          </h3>
          {enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records yet.</p>
          ) : (
            <ul className="space-y-1">
              {enrollments.map((e: any) => (
                <li key={e.id} className="text-sm">
                  {e.course_title} – {new Date(e.enrolled_at).toLocaleDateString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ============= مكون الصف الإضافي =============
function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-background/50">
      <Icon className="h-5 w-5 text-secondary-foreground mt-0.5" />
      <div>
        <div className="text-xs text-muted-foreground">
          <T>{label}</T>
        </div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

// ============= تصدير الصفحة الرئيسي مع Suspense =============
export default function AdminUserProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" />
        </div>
      }
    >
      <AdminUserProfileContent />
    </Suspense>
  );
}