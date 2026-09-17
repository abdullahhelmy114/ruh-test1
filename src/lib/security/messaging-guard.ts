/**
 * Authorization for the legacy direct-message route (/api/messages).
 *
 * The legacy route used to let any signed-in user message any account. It now
 * applies the same who-may-talk-to-whom rule as the academy
 * (academy/communication/messaging.ts):
 *
 *   - nobody messages themselves;
 *   - administrators may message anyone, and anyone may message an administrator;
 *   - a learner and a teacher may message each other only inside an active
 *     academic relationship;
 *   - learner-to-learner and teacher-to-teacher direct messages are refused.
 *
 * Every refusal, including an unknown recipient, gives the same answer, so the
 * route cannot be used to discover which accounts exist.
 */
import type { SessionRole } from "../auth/core.ts";
import { messagingRequirement } from "../academy/communication/messaging.ts";

export interface LegacyMessagingFacts {
  /** The role the recipient currently acts as (see SessionRole), or null when there is no such account. */
  roleOf(uid: string): Promise<SessionRole | null>;
  /** The teacher currently teaches the learner (legacy enrollment or academy class group). */
  hasTeachingRelationship(teacherUid: string, learnerUid: string): Promise<boolean>;
}

export async function mayDirectMessage(
  sender: { readonly uid: string; readonly role: SessionRole },
  receiverUid: string,
  facts: LegacyMessagingFacts,
): Promise<boolean> {
  if (receiverUid === sender.uid) return false;
  const receiverRole = await facts.roleOf(receiverUid);
  if (receiverRole === null) return false;
  let need: "none" | "class_group";
  try {
    need = messagingRequirement(sender, { uid: receiverUid, role: receiverRole });
  } catch {
    return false;
  }
  if (need === "none") return true;
  const teacherUid = sender.role === "teacher" ? sender.uid : receiverUid;
  const learnerUid = sender.role === "student" ? sender.uid : receiverUid;
  return facts.hasTeachingRelationship(teacherUid, learnerUid);
}
