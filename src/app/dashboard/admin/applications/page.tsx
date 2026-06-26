"use client";

import { useEffect, useState } from "react";
import {
  Loader2, CheckCircle, XCircle, FileSearch, ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";
import { T } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Application {
  id: string;
  course_title: string;
  level: string;
  category: string | null;
  teacher_name: string;
  teacher_email: string;
  applied_at: string;
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchApplications = async () => {
    try {
      const res = await fetch("/api/admin/applications", {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setApplications(data);
      } else {
        toast.error("فشل جلب الطلبات");
      }
    } catch {
      toast.error("خطأ في الشبكة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleApprove = async (applicationId: string) => {
    setApprovingId(applicationId);
    try {
      const res = await fetch("/api/admin/applications/approve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: applicationId }),
      });

      if (res.ok) {
        toast.success("تمت الموافقة وإنشاء الكورس الحي");
        fetchApplications(); // إعادة تحميل القائمة
      } else {
        const err = await res.json();
        toast.error(err.error || "فشلت الموافقة");
      }
    } catch {
      toast.error("خطأ في الشبكة");
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-foreground">
          <T>طلبات التدريس المعلقة</T>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          <T>مراجعة طلبات المعلمين لتدريس الكورسات النموذجية واعتمادها</T>
        </p>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileSearch className="mx-auto h-16 w-16 mb-4 text-accent-foreground/50" />
          <p className="text-lg font-serif"><T>لا توجد طلبات معلقة</T></p>
          <p className="text-sm mt-2"><T>عندما يتقدم المعلمون بطلبات تدريس، ستظهر هنا للمراجعة.</T></p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-3xl border border-border shadow-lg overflow-hidden"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T>المعلم</T></TableHead>
                <TableHead><T>الكورس</T></TableHead>
                <TableHead><T>المستوى</T></TableHead>
                <TableHead><T>التصنيف</T></TableHead>
                <TableHead><T>تاريخ الطلب</T></TableHead>
                <TableHead className="text-center"><T>الإجراء</T></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <span className="font-medium text-foreground">{app.teacher_name}</span>
                    <br />
                    <span className="text-xs text-muted-foreground">{app.teacher_email}</span>
                  </TableCell>
                  <TableCell className="font-medium">{app.course_title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{app.level}</Badge>
                  </TableCell>
                  <TableCell>
                    {app.category ? (
                      <Badge variant="outline" className="text-xs">{app.category}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(app.applied_at).toLocaleDateString("ar-EG")}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      onClick={() => handleApprove(app.id)}
                      disabled={approvingId === app.id}
                      size="sm"
                      className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
                    >
                      {approvingId === app.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle size={14} />
                      )}
                      <T>موافقة</T>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      )}
    </div>
  );
}