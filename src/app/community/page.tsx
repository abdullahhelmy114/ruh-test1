import { redirect } from "next/navigation";

// Retired: the community (posts, forum questions, challenges) queried tables that
// exist in no schema this application has run on, so every request failed.
// Nothing replaces it yet; learners are sent to the academy.
export default function LegacyCommunityPage() {
  redirect("/academy");
}
