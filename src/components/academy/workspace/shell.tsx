"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { cn } from "@/lib/utils";
import { useApi } from "./api";
import { useWorkspace } from "./context";

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
  const { t, fmt } = useWorkspace();
  const { role, user } = useAuth();
  const pathname = usePathname() ?? "";

  const home: NavItem[] =
    role === "admin"
      ? [{ href: "/academy/manage", label: t.nav.manage }]
      : role === "teacher"
        ? [{ href: "/academy/teach", label: t.nav.teach }]
        : [{ href: "/academy/learn", label: t.nav.learn }];
  const items: NavItem[] = [
    ...home,
    { href: "/academy/messages", label: t.nav.messages },
    { href: "/academy/notifications", label: t.nav.notifications },
    { href: "/academy/announcements", label: t.nav.announcements },
    ...(role === "admin" || role === "teacher" ? [{ href: "/academy/approvals", label: t.nav.approvals }] : []),
    ...(role === "student" ? [{ href: "/academy/certificates", label: t.nav.certificates }] : []),
  ];

  const unread = useApi<{ unreadCount: number }>(user ? "/api/academy/notifications?unreadOnly=true" : null);
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
                      <span aria-hidden="true">{unreadCount}</span>
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
        {children}
      </div>
    </div>
  );
}
