"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { T } from "@/components/TranslatedText";

interface AdminCourse {
  id: string;
  title: string;
  price: number;
  is_published: boolean;
  launch_date: string;
  category_name: string;
  created_at: string;
}

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCourses = () => {
    fetch("/api/admin/courses")
      .then(r => r.json())
      .then(d => setCourses(d.courses || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCourses(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("حذف الكورس؟")) return;
    await fetch(`/api/admin/courses/id`, { method: "DELETE" });
    fetchCourses();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-serif text-3xl"><T>الكورسات</T></h1>
        <Link href="/dashboard/admin/courses/new" className="bg-emerald-600 text-white rounded-full px-4 py-2 flex items-center gap-2"><Plus size={18} /> <T>كورس جديد</T></Link>
      </div>
      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-emerald-100/50">
            <tr>
              <th className="p-3 text-left"><T>العنوان</T></th>
              <th className="p-3"><T>الفئة</T></th>
              <th className="p-3"><T>السعر</T></th>
              <th className="p-3"><T>منشور</T></th>
              <th className="p-3"><T>تاريخ الإنشاء</T></th>
              <th className="p-3"><T>إجراءات</T></th>
            </tr>
          </thead>
          <tbody>
            {courses.map(c => (
              <tr key={c.id} className="border-t border-gray-200">
                <td className="p-3 font-medium">{c.title}</td>
                <td className="p-3">{c.category_name}</td>
                <td className="p-3">${c.price}</td>
                <td className="p-3">{c.is_published ? "✅" : "❌"}</td>
                <td className="p-3">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="p-3 flex gap-2">
                  <Link href={`/dashboard/admin/courses/${c.id}/edit`} className="p-1 rounded hover:bg-accent"><Pencil size={16} /></Link>
                  <button onClick={() => handleDelete(c.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}