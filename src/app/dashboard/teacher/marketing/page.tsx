"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRouter } from "next/navigation";
import { T } from "@/components/TranslatedText";
import { Loader2, Filter, Download, Mail, Users, ArrowLeft } from "lucide-react";
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

const filters = [
  { key: "never-enrolled", label: "Never Enrolled" },
  { key: "one-course", label: "Completed One Course" },
  { key: "certificate-level", label: "Certificate Level" },
  { key: "all", label: "All Students" },
];

const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function MarketingPage() {
  const { user, isLoading, role } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("never-enrolled");
  const [level, setLevel] = useState("B1");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || role !== "teacher")) {
      router.push("/login");
      return;
    }
  }, [user, isLoading, role, router]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const params = new URLSearchParams({ teacherUid: user.uid, filter: selectedFilter });
    if (selectedFilter === "certificate-level") params.append("level", level);
    const res = await fetch(`/api/teacher/marketing?${params.toString()}`);
    const data = await res.json();
    setStudents(data.students || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user, selectedFilter, level]);

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    const params = new URLSearchParams({ teacherUid: user.uid, filter: selectedFilter, export: "true" });
    if (selectedFilter === "certificate-level") params.append("level", level);
    const res = await fetch(`/api/teacher/marketing?${params.toString()}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student-emails.txt";
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/dashboard/teacher" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft size={16} /> <T>Back to Dashboard</T>
      </Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl"><T>Marketing Tools</T></h1>
        <button onClick={handleExport} disabled={exporting || students.length === 0}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center gap-2">
          <Download size={16} /> {exporting ? <T>Exporting…</T> : <T>Export Emails</T>}
        </button>
      </div>

      {/* أزرار الفلاتر */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map(f => (
          <button key={f.key} onClick={() => setSelectedFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              selectedFilter === f.key ? "bg-emerald-600 text-white" : "bg-card border hover:bg-accent"
            }`}>
            <T>{f.label}</T>
          </button>
        ))}
        {selectedFilter === "certificate-level" && (
          <select value={level} onChange={e => setLevel(e.target.value)} className="rounded-full border bg-card px-3 py-1.5 text-sm">
            {levels.map(l => <option key={l}>{l}</option>)}
          </select>
        )}
      </div>

      {/* النتائج */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
      ) : students.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="mx-auto h-12 w-12 mb-4 text-secondary-foreground/50" />
          <p><T>No students match this filter.</T></p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{students.length} <T>students found</T></p>
          {students.map(s => (
            <div key={s.uid} className="glass rounded-2xl p-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium">{s.full_name}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail size={14} /> {s.email}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {s.nationality && <span className="text-[10px] bg-amber-500/10 text-accent-foreground px-2 py-0.5 rounded-full">{s.nationality}</span>}
                {s.residence && <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">{s.residence}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}