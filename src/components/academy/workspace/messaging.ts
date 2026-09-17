"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useAction } from "./api";
import { api, pages } from "./paths";

/**
 * Opens (or reuses) a conversation and navigates to it. The server decides
 * whether the caller may message this person in this class group.
 */
export function useOpenConversation() {
  const router = useRouter();
  const action = useAction();
  const open = useCallback(
    async (recipientUid: string, classGroupId: string | null) => {
      const result = await action.run<{ id: string }>(api.threads, "POST", { recipientUid, classGroupId });
      if (result.ok) router.push(pages.thread(result.data.id));
    },
    [action, router],
  );
  return { open, busy: action.busy, failure: action.failure };
}
