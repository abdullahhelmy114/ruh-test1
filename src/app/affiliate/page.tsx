import type { Metadata } from "next";
import { AffiliateContent } from "./AffiliateContent";

export const metadata: Metadata = {
  title: "Affiliate Program | Ruh-Ul-Qudus Academy",
  description: "Earn commissions by referring students to Ruh-Ul-Qudus Academy's Arabic and Quran courses.",
  alternates: { canonical: "https://ruhulqudus.com/affiliate" },
  openGraph: {
    title: "Affiliate Program | Ruh-Ul-Qudus Academy",
    description: "Earn commissions by referring students to our courses.",
    url: "https://ruhulqudus.com/affiliate",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light.png", width: 1200, height: 630, alt: "Affiliate Program" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Affiliate Program | Ruh-Ul-Qudus Academy",
    description: "Earn commissions by referring students.",
    images: ["https://ruhulqudus.com/light.png"],
  },
};

export default function AffiliatePage() {
  return <AffiliateContent />;
}