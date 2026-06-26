"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRouter } from "next/navigation";
import { Loader2, TrendingUp, Users, BookOpen, DollarSign, Star } from "lucide-react";
import { T } from "@/components/TranslatedText";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

interface TeacherAnalytics {
  totalStudents: number;
  totalCourses: number;
  totalRevenue: number;
  averageRating: number;
  studentsOverTime: { month: string; count: number }[];
  revenueByCourse: { name: string; value: number }[];
  completionRate: number;
}

const COLORS = ["#059669", "#d97706", "#7c3aed", "#db2777", "#2563eb"];

export default function TeacherAnalyticsPage() {
  const { user, isLoading, role } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<TeacherAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/teacher/analytics?uid=${user.uid}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!isLoading && (!user || (role !== "teacher" && role !== "admin"))) {
      router.push("/login");
    }
  }, [user, isLoading, role, router]);

  if (isLoading || loading)
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  if (!data) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 space-y-8">
      <div>
        <h1 className="font-serif text-3xl"><T>Analytics Dashboard</T></h1>
        <p className="text-muted-foreground text-sm mt-1"><T>Track your performance and earnings</T></p>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Students", value: data.totalStudents, icon: Users, color: "text-emerald-500" },
          { label: "Courses", value: data.totalCourses, icon: BookOpen, color: "text-secondary-foreground" },
          { label: "Revenue", value: `$${data.totalRevenue}`, icon: DollarSign, color: "text-emerald-500" },
          { label: "Avg Rating", value: data.averageRating.toFixed(1), icon: Star, color: "text-secondary-foreground" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="glass rounded-2xl p-4 flex items-center gap-4">
              <Icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <div className="text-xs text-muted-foreground"><T>{s.label}</T></div>
                <div className="font-serif text-2xl font-bold">{s.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* رسوم بيانية */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* الطلاب بمرور الوقت */}
        <div className="glass rounded-3xl p-6">
          <h3 className="font-serif text-xl mb-4"><T>Students Over Time</T></h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.studentsOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#059669" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* توزيع الإيرادات حسب الكورس */}
        <div className="glass rounded-3xl p-6">
          <h3 className="font-serif text-xl mb-4"><T>Revenue by Course</T></h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data.revenueByCourse} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {data.revenueByCourse.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* نسبة الإكمال */}
      <div className="glass rounded-3xl p-6 text-center">
        <h3 className="font-serif text-xl mb-2"><T>Overall Completion Rate</T></h3>
        <div className="text-5xl font-bold text-emerald-600">{data.completionRate}%</div>
        <p className="text-sm text-muted-foreground mt-1"><T>of your students finish courses</T></p>
      </div>
    </div>
  );
}