import type { Metadata } from "next";
import { CertificationContent } from "./CertificationContent";

export const metadata: Metadata = {
  title: "Certification – Ruhulqudus Academy",
  description:
    "Earn recognized teacher and student certifications at Ruhulqudus Academy. Learn how to get certified and verify certificates.",
  openGraph: {
    title: "Certification – Ruhulqudus Academy",
    description:
      "Become a certified Arabic teacher or earn course completion certificates. Start your journey today.",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
  },
};

export default function CertificationPage() {
  return <CertificationContent />;
}