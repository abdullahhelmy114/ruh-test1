"use client";

import { jsPDF } from "jspdf";
import { T } from "@/components/TranslatedText";
import { Award } from "lucide-react";

interface CertificateButtonProps {
  studentName: string;
  courseName: string;
  teacherName: string;
}

export function CertificateButton({ studentName, courseName, teacherName }: CertificateButtonProps) {
  const generateCertificate = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [800, 600] });

    // خلفية كريمية
    doc.setFillColor("#FDF8F0");
    doc.rect(0, 0, 800, 600, "F");

    // إطار ذهبي خارجي
    doc.setDrawColor("#D4AF37");
    doc.setLineWidth(4);
    doc.rect(20, 20, 760, 560);

    // إطار داخلي
    doc.setLineWidth(1);
    doc.rect(30, 30, 740, 540);

    // شعار الأكاديمية (نص بدلاً من صورة)
    doc.setFontSize(16);
    doc.setTextColor("#059669");
    doc.text("Ruhulqudus Academy", 400, 70, { align: "center" });

    // عنوان الشهادة
    doc.setFontSize(38);
    doc.setTextColor("#1A3C34");
    doc.text("Certificate of Completion", 400, 140, { align: "center" });

    // خط فاصل
    doc.setDrawColor("#D4AF37");
    doc.setLineWidth(1.5);
    doc.line(200, 165, 600, 165);

    // نص الشهادة
    doc.setFontSize(20);
    doc.setTextColor("#333333");
    doc.text("This is to certify that", 400, 210, { align: "center" });

    // اسم الطالب
    doc.setFontSize(32);
    doc.setTextColor("#1A3C34");
    doc.text(studentName, 400, 255, { align: "center" });

    // وصف
    doc.setFontSize(18);
    doc.setTextColor("#555555");
    doc.text("has successfully completed the course", 400, 295, { align: "center" });

    // اسم الكورس
    doc.setFontSize(24);
    doc.setTextColor("#059669");
    doc.text(courseName, 400, 335, { align: "center" });

    // تاريخ الإصدار
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.setFontSize(14);
    doc.setTextColor("#777777");
    doc.text(`Issued on ${today}`, 400, 380, { align: "center" });

    // توقيع المعلم (يمين)
    doc.setFontSize(16);
    doc.setTextColor("#1A3C34");
    doc.text(teacherName, 250, 470, { align: "center" });
    doc.setDrawColor("#D4AF37");
    doc.line(180, 480, 320, 480);
    doc.setFontSize(12);
    doc.setTextColor("#777777");
    doc.text("Instructor", 250, 495, { align: "center" });

    // توقيع د. جيهان (يسار)
    doc.setFontSize(16);
    doc.setTextColor("#1A3C34");
    doc.text("Dr. Jehan Ali Ahmed", 550, 470, { align: "center" });
    doc.setDrawColor("#D4AF37");
    doc.line(480, 480, 620, 480);
    doc.setFontSize(12);
    doc.setTextColor("#777777");
    doc.text("Founder & Academic Director", 550, 495, { align: "center" });

    // تحميل
    doc.save(`Certificate-${courseName.replace(/\s+/g, "-")}.pdf`);
  };

  return (
    <button
      onClick={generateCertificate}
      className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-black hover:bg-amber-400 transition"
    >
      <Award size={18} />
      <T>Download Certificate</T>
    </button>
  );
}