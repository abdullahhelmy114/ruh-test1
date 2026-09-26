"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { cn } from "@/lib/utils";
import { useApi, type ApiState } from "./api";
import { useWorkspace } from "./context";
import { academyHome, api, pages } from "./paths";

/** The shell's unread-notifications request, shared so pages never repeat it. */
const UnreadContext = createContext<{ readonly state: ApiState<{ unreadCount: number }>; readonly reload: () => void } | null>(null);

export function useUnreadNotifications() {
  return useContext(UnreadContext);
}

interface NavItem {
  readonly href: string;
  readonly label: string;
}

/**
 * Workspace frame: a skip link, the section navigation for the signed-in
 * role and the page. Navigation is a convenience only; every page and API
 * enforces access on the server.
 */
export function WorkspaceShell({ children }: { readonly children: ReactNode }) {
  const { t, fmt, number } = useWorkspace();
  const { role, status, user, isLoading } = useAuth();
  const pathname = usePathname() ?? "";
  const router = useRouter();

  // A teacher account that is not active has only its application page. One that
  // opens another workspace screen (a bookmark from before a deactivation, an
  // old link) is taken there instead of meeting a refusal from every API.
  const applicant = role === "teacher" && status !== "active";
  const elsewhere = applicant && !isLoading && pathname !== pages.teacherApplication;
  useEffect(() => {
    if (elsewhere) router.replace(pages.teacherApplication);
  }, [elsewhere, router]);
  const homeLabel = role === "admin" ? t.nav.manage : applicant ? t.nav.application : role === "teacher" ? t.nav.teach : t.nav.learn;
  const items: NavItem[] = applicant
    ? [{ href: academyHome(role, status), label: homeLabel }]
    : [
        { href: academyHome(role, status), label: homeLabel },
        { href: "/academy/messages", label: t.nav.messages },
        { href: "/academy/notifications", label: t.nav.notifications },
        { href: "/academy/announcements", label: t.nav.announcements },
        ...(role === "admin" || role === "teacher" ? [{ href: "/academy/approvals", label: t.nav.approvals }] : []),
        ...(role === "student" ? [{ href: "/academy/certificates", label: t.nav.certificates }] : []),
      ];

  const unread = useApi<{ unreadCount: number }>(user && !applicant ? api.notifications(true) : null);
  const unreadCount = unread.state.status === "ready" ? unread.state.data.unreadCount : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16">
      <a
        href="#workspace-main"
        className="sr-only rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50"
      >
        {t.nav.skip}
      </a>
      <nav aria-label={t.nav.label} className="-mx-4 mb-6 border-b px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-1 overflow-x-auto py-2">
          {items.map((item) => {
            const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const showBadge = item.href === "/academy/notifications" && unreadCount > 0;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    current ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                  {showBadge && (
                    <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                      <span aria-hidden="true">{number(unreadCount)}</span>
                      <span className="sr-only">{fmt(t.nav.unread, { count: unreadCount })}</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div id="workspace-main" tabIndex={-1} className="outline-none">
        <UnreadContext.Provider value={unread}>{elsewhere ? null : children}</UnreadContext.Provider>
      </div>
    </div>
  );
}
