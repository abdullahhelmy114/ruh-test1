"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRouter } from "next/navigation";
import { T } from "@/components/TranslatedText";
import { Loader2, Users, Filter, Eye, Mail } from "lucide-react";
import Link from "next/link";

interface Student {
  uid: string;
  full_name: string;
  email: string;
  nationality: string;
  residence: string;
  native_language: string;
  other_languages: string[];
  age: string;
  gender: string;
}

export default function TeacherStudentsPage() {
  const { user, isLoading, role } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [certLevel, setCertLevel] = useState("B1");

  useEffect(() => {
    if (!isLoading && (!user || role !== "teacher")) {
      router.push("/login");
      return;
    }
  }, [user, isLoading, role, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const params = new URLSearchParams({ teacherUid: user.uid, filter });
    if (filter === "certificate-level") params.append("level", certLevel);
    fetch(`/api/teacher/students?${params.toString()}`)
      .then(r => r.json())
      .then(d => setStudents(d.students || []))
      .finally(() => setLoading(false));
  }, [user, filter, certLevel]);

  if (isLoading || loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/dashboard/teacher" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
        ← <T>Back to Dashboard</T>
      </Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl"><T>My Students</T></h1>
        <Link href="/dashboard/teacher/marketing" className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black">
          <Filter size={16} className="inline mr-1" /> <T>Advanced Filters</T>
        </Link>
      </div>

      {/* أزرار فلترة سريعة */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: "all", label: "All Students" },
          { key: "never-enrolled", label: "Never Enrolled" },
          { key: "one-course", label: "One Course Only" },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === f.key ? "bg-emerald-600 text-white" : "bg-card border hover:bg-accent"
            }`}
          >
            <T>{f.label}</T>
          </button>
        ))}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("certificate-level")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === "certificate-level" ? "bg-emerald-600 text-white" : "bg-card border hover:bg-accent"
            }`}
          >
            <T>Certificate Level</T>
          </button>
          {filter === "certificate-level" && (
            <select value={certLevel} onChange={e => setCertLevel(e.target.value)} className="rounded-full border bg-card px-3 py-1.5 text-sm">
              {["A1","A2","B1","B2","C1","C2"].map(l => <option key={l}>{l}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* قائمة الطلاب */}
      {students.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="mx-auto h-12 w-12 mb-4 text-secondary-foreground/50" />
          <p><T>No students found.</T></p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {students.map(s => (
            <div key={s.uid} className="glass rounded-2xl p-4 flex items-start justify-between">
              <div>
                <h3 className="font-medium">{s.full_name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{s.email}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {s.nationality && <span className="text-[10px] bg-amber-500/10 text-accent-foreground px-2 py-0.5 rounded-full">{s.nationality}</span>}
                  {s.residence && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">{s.residence}</span>}
                  {s.native_language && <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full">{s.native_language}</span>}
                </div>
              </div>
              <Link href={`/dashboard/teacher/student/${s.uid}`} className="p-2 rounded-full hover:bg-accent" title="View Profile">
                <Eye className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}