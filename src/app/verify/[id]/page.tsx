import { sql } from "@/lib/db/client";
import CertificateViewer from "@/components/CertificateViewer";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = {
  params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Certificate Verification - ${params.id} | Ruhulqudus Academy`,
    description: "Verify the authenticity of a Ruhulqudus Academy certificate.",
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
    JOIN profiles u ON c.user_uid = u.firebase_uid
    JOIN courses co ON c.course_id = co.id
    JOIN profiles t ON co.teacher_uid = t.firebase_uid
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
    <main className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
      <CertificateViewer
        studentName={certificate.student_name}
        courseName={certificate.course_name}
        date={formattedDate}
        teacherName={certificate.teacher_name}
        certificateId={certificate.certificate_id}
        teacherSignatureText={teacherSignatureText}
      />
    </main>
  );
}