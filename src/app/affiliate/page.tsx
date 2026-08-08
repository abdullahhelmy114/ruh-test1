import type { Metadata } from "next";
import { AffiliateContent } from "./AffiliateContent";

export const metadata: Metadata = {
  title: "Affiliate Program – Earn 20% Commission – Ruhulqudus Academy",
  description:
    "Join the Ruhulqudus Academy affiliate program and earn 20% commission on every referral. Share your unique link and start earning today.",
  openGraph: {
    title: "Affiliate Program – Ruhulqudus Academy",
    description:
      "Earn 20% commission for every student or teacher you refer to Ruhulqudus Academy. Start your earning journey now.",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
  },
};

export default function AffiliatePage() {
  return <AffiliateContent />;
}