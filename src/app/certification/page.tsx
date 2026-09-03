import type { Metadata } from "next";
import { CertificationContent } from "./CertificationContent";

export const metadata: Metadata = {
  title: "Certification | Ruh-Ul-Qudus Academy",
  description: "Earn accredited certificates in Arabic language and Quran studies upon completing our programs.",
  alternates: { canonical: "https://ruhulqudus.com/certification" },
  openGraph: {
    title: "Certification | Ruh-Ul-Qudus Academy",
    description: "Earn accredited certificates in Arabic and Quran.",
    url: "https://ruhulqudus.com/certification",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light.png", width: 1200, height: 630, alt: "Certification" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Certification | Ruh-Ul-Qudus Academy",
    description: "Earn accredited certificates in Arabic and Quran.",
    images: ["https://ruhulqudus.com/light.png"],
  },
};

export default function CertificationPage() {
  return <CertificationContent />;
}