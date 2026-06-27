// app/verify/[id]/page.tsx
import { sql } from "@/lib/db/client";
import CertificateViewer from "@/components/CertificateViewer";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type Props = {
  params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Certificate Verification - ${params.id}`,
    description: "Verify your certificate authenticity",
  };
}

async function getCertificateData(certificateCode: string) {
  const result = await sql`
    SELECT 
      c.code AS certificate_id,
      u.full_name AS student_name,
      co.title AS course_name,
      t.full_name AS teacher_name,
      c.issued_at::text AS issue_date
    FROM certificates c
    JOIN users u ON c.user_id = u.id
    JOIN courses co ON c.course_id = co.id
    JOIN users t ON co.teacher_id = t.id
    WHERE c.code = ${certificateCode}
  `;

  if (result.length === 0) return null;
  return result[0];
}

function extractSignatureText(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(0, 2).join(' ');
}

export default async function VerifyCertificatePage({ params }: Props) {
  const { id } = params;
  const certificate = await getCertificateData(id);

  if (!certificate) {
    notFound();
  }

  const formattedDate = new Date(certificate.issue_date).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  const teacherSignatureText = extractSignatureText(certificate.teacher_name);

  return (
    <div className="container mx-auto py-12 px-4">
      <CertificateViewer
        studentName={certificate.student_name}
        courseName={certificate.course_name}
        date={formattedDate}
        teacherName={certificate.teacher_name}
        certificateId={certificate.certificate_id}
        teacherSignatureText={teacherSignatureText}
        // teacherSignature و headMasterSignature تُركت اختيارية (ستعرض التوقيع النصي)
      />
    </div>
  );
}