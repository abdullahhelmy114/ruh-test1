"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { T } from "@/components/TranslatedText";
import { useAuth } from "@/lib/firebase/AuthProvider";

interface Earning {
  id: string;
  course_title: string;
  amount: number;
  status: "pending" | "confirmed" | "paid";
}

export default function TeacherEarningsPage() {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPending, setTotalPending] = useState(0);
  const [totalConfirmed, setTotalConfirmed] = useState(0);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(token =>
      fetch("/api/teacher/earnings", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      })
        .then((r) => r.json())
        .then((data) => {
          const rows = data || [];
          setEarnings(rows);
          setTotalPending(
            rows
              .filter((e: Earning) => e.status === "pending")
              .reduce((sum: number, e: Earning) => sum + Number(e.amount), 0)
          );
          setTotalConfirmed(
            rows
              .filter((e: Earning) => e.status === "confirmed")
              .reduce((sum: number, e: Earning) => sum + Number(e.amount), 0)
          );
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    );
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8"><T>أرباحي</T></h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-card p-6 rounded-xl border border-gray-200">
          <p className="text-gray-500"><T>الأرباح المؤكدة</T></p>
          <p className="text-3xl font-bold text-primary">${totalConfirmed.toFixed(2)}</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-gray-200">
          <p className="text-gray-500"><T>قيد الانتظار</T></p>
          <p className="text-3xl font-bold text-amber-700">${totalPending.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-emerald-100/50">
            <tr>
              <th className="p-3 text-left text-gray-900"><T>الكورس</T></th>
              <th className="p-3 text-left text-gray-900"><T>العمولة</T></th>
              <th className="p-3 text-left text-gray-900"><T>الحالة</T></th>
            </tr>
          </thead>
          <tbody>
            {earnings.map((earning) => (
              <tr key={earning.id} className="border-t border-gray-200">
                <td className="p-3">{earning.course_title}</td>
                <td className="p-3">${Number(earning.amount).toFixed(2)}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      earning.status === "confirmed"
                        ? "bg-emerald-500/20 text-primary"
                        : "bg-accent/20 text-amber-700"
                    }`}
                  >
                    <T>{earning.status === "confirmed" ? "مؤكد" : "معلق"}</T>
                  </span>
                </td>
              </tr>
            ))}
            {earnings.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-gray-500">
                  <T>لا توجد أرباح بعد</T>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}