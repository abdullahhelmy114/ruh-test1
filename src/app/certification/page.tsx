import type { Metadata } from "next";
import { CertificationContent } from "./CertificationContent";

export const metadata: Metadata = {
  title: "Certification – Ruh-Ul-Qudus Academy",
  description:
    "Earn recognized teacher and student certifications at Ruh-Ul-Qudus Academy. Learn how to get certified and verify certificates.",
  openGraph: {
    title: "Certification – Ruh-Ul-Qudus Academy",
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