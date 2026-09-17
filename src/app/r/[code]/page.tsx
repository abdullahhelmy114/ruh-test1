import { redirect } from "next/navigation";
import { parseReferralCode } from "@/lib/referral";

// An invitation link: /r/CODE opens student signup with the code in the address.
// Only a well-formed code is carried; the server decides, when the account is
// created, whether it belongs to anyone. Nothing is kept in browser storage.
export default async function ReferralRedirectPage({ params }: { params: Promise<{ code: string }> }) {
  const code = parseReferralCode((await params).code);
  redirect(code ? `/signup/student?ref=${code}` : "/signup");
}
