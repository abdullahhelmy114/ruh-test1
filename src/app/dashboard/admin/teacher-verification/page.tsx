"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Loader2, ShieldCheck, ExternalLink, Video } from "lucide-react";

export default function TeacherVerificationPage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((token) =>
      fetch("/api/admin/teacher-applications", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          setApps(Array.isArray(d) ? d : d.applications || []);
          setLoading(false);
        })
    );
  }, [user]);

  const handleApprove = async (uid: string) => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/admin/approve-teacher", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ uid }), // uid هو firebase_uid للمعلم
    });
    if (res.ok) {
      setApps((prev) => prev.filter((a) => a.uid !== uid));
    } else {
      const data = await res.json();
      alert(data.message || "Failed to approve");
    }
  };

  const handleReject = async (uid: string) => {
    setApps((prev) => prev.filter((a) => a.uid !== uid));
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl">Pending Teacher Applications</h2>
      {apps.length === 0 ? (
        <div className="rounded-3xl border bg-card p-12 text-center text-muted-foreground">
          No pending applications
        </div>
      ) : (
        apps.map((app) => (
          <div
            key={app.uid}
            className="rounded-3xl border bg-card p-5 shadow-elegant space-y-3"
          >
            <div>
              <h3 className="font-serif text-lg">
                {app.first_name} {app.last_name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {app.email} · {app.country_of_residence} · {app.nationality}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <span>
                <strong>WhatsApp:</strong> {app.whatsapp}
              </span>
              <span>
                <strong>Telegram:</strong> {app.telegram}
              </span>
              <span>
                <strong>Gender:</strong> {app.gender}
              </span>
              <span>
                <strong>Languages:</strong>{" "}
                {Array.isArray(app.languages)
                  ? app.languages.map((l: any) => (typeof l === 'string' ? l : l.code)).join(', ')
                  : (typeof app.languages === 'string'
                    ? (() => { try { return JSON.parse(app.languages).map((l: any) => (typeof l === 'string' ? l : l.code)).join(', '); } catch { return app.languages; } })()
                    : '—')}
              </span>
            </div>
            {app.bio && (
              <p className="text-xs text-muted-foreground italic">
                &quot;{app.bio}&quot;
              </p>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              {app.cv_url && (
                <a
                  href={app.cv_url}
                  target="_blank"
                  className="text-accent-foreground underline inline-flex items-center gap-1"
                >
                  <ExternalLink size={12} /> View CV
                </a>
              )}
              {app.intro_video_url && (
                <a
                  href={app.intro_video_url}
                  target="_blank"
                  className="text-accent-foreground underline inline-flex items-center gap-1"
                >
                  <Video size={12} /> Intro Video
                </a>
              )}
              {app.social_links?.map((s: any, i: number) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  className="text-secondary-foreground underline inline-flex items-center gap-1"
                >
                  <ExternalLink size={12} /> {s.platform}
                </a>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleReject(app.uid)}
                className="px-3 py-1 rounded-full border border-destructive/30 text-destructive text-xs"
              >
                Reject
              </button>
              <button
                onClick={() => handleApprove(app.uid)}
                className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs"
              >
                Approve
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}