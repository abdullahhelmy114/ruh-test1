import type { Metadata } from "next";
import { AffiliateContent } from "./AffiliateContent";

export const metadata: Metadata = {
  title: "Affiliate Program – Earn 20% Commission – Ruh-Ul-Qudus Academy",
  description:
    "Join the Ruh-Ul-Qudus Academy affiliate program and earn 20% commission on every referral. Share your unique link and start earning today.",
  openGraph: {
    title: "Affiliate Program – Ruh-Ul-Qudus Academy",
    description:
      "Earn 20% commission for every student or teacher you refer to Ruh-Ul-Qudus Academy. Start your earning journey now.",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
  },
};

export default function AffiliatePage() {
  return <AffiliateContent />;
}