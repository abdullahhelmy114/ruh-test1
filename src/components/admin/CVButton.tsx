"use client";

import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface CVButtonProps {
  cvUrl?: string | null;
}

export default function CVButton({ cvUrl }: CVButtonProps) {
  const handleOpenCV = () => {
    if (cvUrl) {
      // فتح الرابط في نافذة جديدة بشكل آمن
      window.open(cvUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleOpenCV}
      // تعطيل الزر تماماً إذا لم يكن هناك رابط للـ CV
      disabled={!cvUrl}
      // الالتزام بألوان كريمي × كحلي الدلالية
      className="border-border text-foreground hover:bg-secondary transition-colors"
    >
      <FileText className="mr-2 h-4 w-4 text-primary" />
      {cvUrl ? "عرض السيرة الذاتية (CV)" : "السيرة الذاتية غير متوفرة"}
    </Button>
  );
}