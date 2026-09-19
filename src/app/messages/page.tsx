import { redirect } from "next/navigation";

// Retired: legacy direct messages read and wrote the `messages` and
// `notifications` tables, which are not part of the academy schema.
// Conversations live in the academy workspace (academy message threads).
export default function LegacyMessagesPage() {
  redirect("/academy/messages");
}
