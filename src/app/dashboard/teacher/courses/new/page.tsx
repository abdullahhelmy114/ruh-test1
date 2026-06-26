"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Loader2, Send } from "lucide-react";
import { motion } from "framer-motion";
import { T } from "@/components/TranslatedText";

interface ModelCourse {
  id: string;
  title: string;
  level: string;
  price: number;
}

export default function ApplyTeachingPage() {
  const { user, isLoading, role } = useAuth();
  const router = useRouter();
  const [models, setModels] = useState<ModelCourse[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div>;
  if (!user) { router.push("/login"); return null; }
  if (role !== "teacher") { router.push("/"); return null; }

  useEffect(() => {
    fetch("/api/teacher/available-courses", { credentials: "include" })
      .then(r => r.json())
      .then(data => setModels(data || []))
      .catch(() => setError("Failed to load available courses"));
  }, []);

  const handleSubmit = async () => {
    if (!selectedModelId) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/teacher/apply", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_course_id: selectedModelId }),
    });

    const data = await res.json();
    if (res.ok) {
      setSuccess("تم تقديم الطلب بنجاح. سيتم مراجعته من قبل الأدمن.");
    } else {
      setError(data.error || "فشل تقديم الطلب");
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 md:p-8 space-y-6"
      >
        <div>
          <h1 className="font-serif text-2xl"><T>طلب تدريس كورس</T></h1>
          <p className="text-sm text-muted-foreground mt-1">
            <T>اختر أحد الكورسات النموذجية المعتمدة لتقديم طلب تدريسها.</T>
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <T>الكورس النموذجي</T>
          </label>
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="mt-1 w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">-- <T>اختر كورساً</T> --</option>
            {models.map(m => (
              <option key={m.id} value={m.id}>
                {m.title} ({m.level}) - ${m.price}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            <T>{error}</T>
          </div>
        )}
        {success && (
          <div className="rounded-xl bg-primary/10 p-3 text-sm text-primary">
            <T>{success}</T>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !selectedModelId}
          className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          <T>تقديم الطلب</T>
        </button>
      </motion.div>
    </div>
  );
}