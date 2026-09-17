import type { Metadata } from "next";
import { AffiliateContent } from "./AffiliateContent";

// Invitations only: no commission, reward or payout is offered (see lib/referral.ts).
export const metadata: Metadata = {
  title: "Invite Friends | Ruh-Ul-Qudus Academy",
  description: "Invite friends to learn Arabic and the Quran at Ruh-Ul-Qudus Academy with your personal link.",
  alternates: { canonical: "https://ruhulqudus.com/affiliate" },
  openGraph: {
    title: "Invite Friends | Ruh-Ul-Qudus Academy",
    description: "Invite friends to learn Arabic and the Quran at Ruh-Ul-Qudus Academy.",
    url: "https://ruhulqudus.com/affiliate",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light.png", width: 1200, height: 630, alt: "Invite friends" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Invite Friends | Ruh-Ul-Qudus Academy",
    description: "Invite friends to learn at Ruh-Ul-Qudus Academy.",
    images: ["https://ruhulqudus.com/light.png"],
  },
};

export default function AffiliatePage() {
  return <AffiliateContent />;
}
