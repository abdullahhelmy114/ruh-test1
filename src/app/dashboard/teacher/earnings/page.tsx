"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { T } from "@/components/TranslatedText";

interface Earning {
  id: string;
  course_title: string;
  amount: number;
  status: "pending" | "confirmed" | "paid";
}

export default function TeacherEarningsPage() {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPending, setTotalPending] = useState(0);
  const [totalConfirmed, setTotalConfirmed] = useState(0);

  useEffect(() => {
    fetch("/api/teacher/earnings", { credentials: "include" })
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
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground mb-8"><T>أرباحي</T></h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-card p-6 rounded-xl border border-border">
          <p className="text-muted-foreground"><T>الأرباح المؤكدة</T></p>
          <p className="text-3xl font-bold text-primary">${totalConfirmed.toFixed(2)}</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border">
          <p className="text-muted-foreground"><T>قيد الانتظار</T></p>
          <p className="text-3xl font-bold text-accent-foreground">${totalPending.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              <th className="p-3 text-left text-foreground"><T>الكورس</T></th>
              <th className="p-3 text-left text-foreground"><T>العمولة</T></th>
              <th className="p-3 text-left text-foreground"><T>الحالة</T></th>
            </tr>
          </thead>
          <tbody>
            {earnings.map((earning) => (
              <tr key={earning.id} className="border-t border-border">
                <td className="p-3">{earning.course_title}</td>
                <td className="p-3">${Number(earning.amount).toFixed(2)}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      earning.status === "confirmed"
                        ? "bg-primary/20 text-primary"
                        : "bg-accent/20 text-accent-foreground"
                    }`}
                  >
                    <T>{earning.status === "confirmed" ? "مؤكد" : "معلق"}</T>
                  </span>
                </td>
              </tr>
            ))}
            {earnings.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-muted-foreground">
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