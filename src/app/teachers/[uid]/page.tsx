"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { T } from "@/components/TranslatedText";
import {
  Loader2, BookOpen, User, MapPin, Globe, Mail, Calendar, ArrowLeft,
} from "lucide-react";

interface TeacherProfile {
  full_name: string;
  email: string;
  nationality: string;
  residence: string;
  native_language: string;
  other_languages: string[];
  age: string;
  gender: string;
  bio: string;
  avatar_url: string | null;
}

interface Course {
  id: string;
  title: string;
  level: string;
  price: number;
  description: string | null;
  image_url: string | null;
}

export default function PublicTeacherPage() {
  const router = useRouter();
  const params = useParams<{ uid: string }>();
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.uid) return;
    setLoading(true);
    fetch(`/api/teacher/public/${params.uid}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setError(d.error);
          setTeacher(null);
        } else {
          setTeacher(d.teacher);
          setCourses(d.courses || []);
        }
      })
      .catch(() => setError("Failed to load teacher"))
      .finally(() => setLoading(false));
  }, [params.uid]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  if (error || !teacher) return <div className="text-center py-20 text-muted-foreground"><T>Teacher not found</T></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:px-8">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft size={16} /> <T>Back</T>
      </button>

      {/* بطاقة المعلم */}
      <div className="glass rounded-3xl p-6 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="grid h-24 w-24 place-items-center rounded-full gradient-emerald text-white text-3xl font-bold shrink-0">
            {teacher.avatar_url ? (
              <Image src={teacher.avatar_url} alt={teacher.full_name} width={96} height={96} className="rounded-full object-cover" />
            ) : (
              teacher.full_name?.charAt(0) || "?"
            )}
          </div>
          <div className="space-y-3 flex-1">
            <div>
              <h1 className="font-serif text-3xl">{teacher.full_name}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Mail size={14} /> {teacher.email}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {teacher.nationality && <InfoBadge label={teacher.nationality} icon={<Globe size={12} />} />}
              {teacher.residence && <InfoBadge label={teacher.residence} icon={<MapPin size={12} />} />}
              {teacher.native_language && <InfoBadge label={teacher.native_language} />}
              {teacher.gender && <InfoBadge label={teacher.gender} icon={<User size={12} />} />}
              {teacher.age && <InfoBadge label={`${teacher.age} yrs`} icon={<Calendar size={12} />} />}
            </div>
            {teacher.bio && (
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">{teacher.bio}</p>
            )}
          </div>
        </div>
      </div>

      {/* كورسات المعلم */}
      <div>
        <h2 className="font-serif text-2xl mb-4">
          <T>Courses by this teacher</T> ({courses.length})
        </h2>
        {courses.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <BookOpen className="mx-auto h-12 w-12 mb-3 text-secondary-foreground/50" />
            <p><T>No courses published yet.</T></p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map(course => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="glass rounded-2xl p-4 hover:shadow-elegant transition-shadow block"
              >
                <div className="h-32 bg-linear-to-br from-emerald-600 to-emerald-800 rounded-xl flex items-center justify-center mb-3 overflow-hidden">
                  {course.image_url ? (
                    <Image src={course.image_url} alt={course.title} width={200} height={128} className="object-cover w-full h-full" />
                  ) : (
                    <BookOpen className="h-10 w-10 text-white/30" />
                  )}
                </div>
                <h3 className="font-serif text-lg">{course.title}</h3>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs bg-amber-500/10 text-accent-foreground px-2 py-0.5 rounded-full">{course.level}</span>
                  <span className="font-bold text-accent-foreground">{course.price === 0 ? <T>Free</T> : `$${course.price}`}</span>
                </div>
                {course.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{course.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoBadge({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-background/50 px-2 py-1 rounded-full">
      {icon}
      {label}
    </span>
  );
}