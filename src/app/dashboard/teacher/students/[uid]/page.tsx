"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { Loader2, ArrowLeft, Mail, MapPin, Globe, User, Calendar } from "lucide-react";
import Link from "next/link";

interface StudentData {
  full_name: string;
  email: string;
  nationality: string;
  residence: string;
  native_language: string;
  other_languages: string[];
  age: string;
  gender: string;
  created_at: string;
}

export default function StudentDetailPage() {
  const { user, isLoading: authLoading, role } = useAuth();
  const router = useRouter();
  const params = useParams<{ uid: string }>();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && (!user || role !== "teacher")) {
      router.push("/login");
      return;
    }
  }, [user, authLoading, role, router]);

  useEffect(() => {
    if (!user || !params.uid) return;
    setLoading(true);
    fetch(`/api/teacher/student/${params.uid}?teacherUid=${user.uid}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setError(d.error);
          setStudent(null);
        } else {
          setStudent(d.student);
        }
      })
      .catch(() => setError("Failed to load student"))
      .finally(() => setLoading(false));
  }, [user, params.uid]);

  if (authLoading || loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  if (error) return <div className="text-center py-20 text-red-500"><T>{error}</T></div>;
  if (!student) return <div className="text-center py-20"><T>Student not found</T></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/dashboard/teacher/students" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft size={16} /> <T>Back to Students</T>
      </Link>

      <div className="glass rounded-3xl p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full gradient-emerald text-white text-2xl font-bold">
            {student.full_name?.charAt(0) || "?"}
          </div>
          <div>
            <h1 className="font-serif text-2xl">{student.full_name}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail size={14} /> {student.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow icon={Calendar} label="Joined" value={new Date(student.created_at).toLocaleDateString()} />
          <InfoRow icon={Globe} label="Nationality" value={student.nationality || "—"} />
          <InfoRow icon={MapPin} label="Residence" value={student.residence || "—"} />
          <InfoRow icon={User} label="Gender" value={student.gender || "—"} />
          <InfoRow icon={Calendar} label="Age" value={student.age || "—"} />
          <InfoRow icon={Globe} label="Native Language" value={student.native_language || "—"} />
          <InfoRow icon={Globe} label="Other Languages" value={student.other_languages?.join(", ") || "—"} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-background/50">
      <Icon className="h-5 w-5 text-secondary-foreground mt-0.5" />
      <div>
        <div className="text-xs text-muted-foreground"><T>{label}</T></div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}