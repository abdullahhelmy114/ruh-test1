"use client";

import { T } from "@/components/TranslatedText";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Bell, BellOff, Mail, Moon, Sun, BookOpen, User, LayoutDashboard, LogOut, ChevronDown,
  Info, Phone, Library, Shield, Menu, X, GraduationCap,
} from "lucide-react";
import { academyHome, api as academyApi, pages as academyPages } from "@/components/academy/workspace/paths";
import { accountHome } from "@/lib/auth/home";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { authFetch } from "@/lib/authFetch";
import { signOut, getAuth } from "firebase/auth";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// روابط ثابتة
// The academy catalog is the one public list of programs and courses (the
// legacy /courses and /bundles pages read tables outside the academy schema).
const baseLinks = [
  { to: "/", label: "Home" },
  { to: "/academy", label: "Academy" },
  { to: "/certification", label: "Certification" },
  { to: "/dictionary", label: "Dictionary" },
];

const moreLinks = [
  { to: "/about", label: "About", icon: Info },
  { to: "/contact", label: "Contact", icon: Phone },
  { to: "/library", label: "Library", icon: Library },
];

/** An academy notification as GET /api/academy/notifications returns it. */
interface NavNotification {
  id: string;
  title: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

/** Total unread messages across the caller's academy conversations. */
function unreadAcross(threads: unknown): number {
  if (!Array.isArray(threads)) return 0;
  return threads.reduce((sum: number, thread) => sum + (typeof thread?.unread === "number" && thread.unread > 0 ? thread.unread : 0), 0);
}

export function Navbar() {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const { user, isLoading, role, status } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NavNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const links = baseLinks;
  // A teacher account that is not active is an applicant: the academy refuses it
  // conversations and notifications, so nothing is polled for it (as in the workspace shell).
  // Polling waits until the role and status have loaded, so an applicant is never polled by mistake.
  const applicant = role === "teacher" && status !== "active";

  // جلب الإشعارات كل 30 ثانية — academy notifications (academy_notifications).
  useEffect(() => {
    if (!user || isLoading || applicant) return;
    const fetchNotifications = () => {
      authFetch(academyApi.notifications(false))
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.data) return;
          setNotifications(Array.isArray(d.data.items) ? d.data.items : []);
          setUnreadNotifications(typeof d.data.unreadCount === "number" ? d.data.unreadCount : 0);
        })
        .catch(() => {});
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user, isLoading, applicant]);

  // تحديث عدد الرسائل — unread messages across the caller's academy conversations.
  useEffect(() => {
    if (!user || isLoading || applicant) return;
    const updateUnread = () =>
      authFetch(academyApi.threads)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setUnreadMessages(unreadAcross(d.data));
        })
        .catch(() => {});
    updateUnread();
    const interval = setInterval(updateUnread, 60000);
    return () => clearInterval(interval);
  }, [user, isLoading, applicant]);

  useEffect(() => {
    if (!user) return;
    authFetch("/api/user")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile?.fcm_token) setNotificationsEnabled(true);
      })
      .catch(() => {});
  }, [user]);

  const enableNotifications = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const { getMessaging, getToken } = await import("firebase/messaging");
      const messaging = getMessaging();
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!,
      });
      if (token) {
        await authFetch("/api/notifications/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        setNotificationsEnabled(true);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // The server session cookie is httpOnly: only the server can expire it, and
  // it must go first — Firebase sign-out alone left the browser signed in to
  // every page and API. Then reload from the home page so nothing rendered for
  // the signed-in account stays on screen.
  const handleLogout = async () => {
    setMenuOpen(false);
    setMobileOpen(false);
    await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" }).catch(() => null);
    await signOut(getAuth());
    window.location.assign("/");
  };

  // Destinations follow the stored role and status (navigation only): approved
  // teachers go to the teacher workspace, other teacher accounts to their
  // application page.
  const dashboardLink = accountHome(role, status);
  const profileLink = role === "admin" ? "/profile/admin" : role === "teacher" ? "/profile/teacher" : "/profile/student";
  const academyLink = academyHome(role, status);

  const initial = user?.email ? user.email.charAt(0).toUpperCase() : "U";

  return (
    <header className="sticky top-0 z-40 glass border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 xl:px-8">
        {/* Logo + Hamburger */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="xl:hidden grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-accent"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/" className="flex items-center gap-3">
            {/* أيقونة فاتحة تظهر في Light Mode */}
            <Image
              src="/light.png"
              alt="Ruh-Ul-Qudus"
              width={48}
              height={48}
              priority
              className="h-12 w-12 dark:hidden"
            />
            {/* أيقونة داكنة تظهر في Dark Mode */}
            <Image
              src="/dark.png"
              alt="Ruh-Ul-Qudus"
              width={48}
              height={48}
              className="h-12 w-12 hidden dark:block"
            />
            <div className="hidden xl:block leading-tight">
              <div className="font-serif text-lg font-semibold text-foreground">
                <T>Ruh-Ul-Qudus</T>
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-foreground">
                <T>Academy</T>
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation (desktop) */}
        <nav className="hidden xl:flex min-w-0 items-center gap-1 overflow-x-auto">
          {links.map((l) => (
            <Link
              key={l.to}
              href={l.to}
              className={cn(
                "rounded-full px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === l.to && "bg-accent text-accent-foreground"
              )}
            >
              <T>{l.label}</T>
            </Link>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "rounded-full px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground flex items-center gap-1",
                  "focus:outline-none"
                )}
              >
                <T>More</T>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl border bg-card p-2 shadow-elegant">
              {moreLinks.map((l) => {
                const Icon = l.icon;
                return (
                  <DropdownMenuItem key={l.to} asChild>
                    <Link
                      href={l.to}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      <Icon className="h-4 w-4" />
                      <T>{l.label}</T>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Right side (desktop) */}
        <div className="hidden xl:flex items-center gap-2">
          <LanguageSwitcher />

          {user && !notificationsEnabled && (
            <button
              onClick={enableNotifications}
              aria-label="Enable notifications"
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-accent"
              title="Enable Notifications"
            >
              <BellOff className="h-4 w-4 text-muted-foreground" />
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              aria-label="Notifications"
              className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-accent"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto rounded-2xl border bg-card p-2 shadow-elegant z-50">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <T>Notifications</T>
                </div>
                {notifications.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-center text-muted-foreground">
                    <T>No notifications yet</T>
                  </p>
                ) : (
                  notifications.map(n => (
                    <Link
                      key={n.id}
                      href={n.link || academyPages.notifications}
                      onClick={() => setNotifOpen(false)}
                      className={`block rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-accent ${
                        !n.readAt ? 'border-l-2 border-l-accent bg-accent/10' : ''
                      }`}
                    >
                      <p className={!n.readAt ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                        {n.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>

          <Link
            href={academyPages.messages}
            aria-label="Messages"
            className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-accent"
          >
            <Mail className="h-4 w-4" />
            {unreadMessages > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">
                {unreadMessages > 9 ? "9+" : unreadMessages}
              </span>
            )}
          </Link>

          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {isLoading ? (
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-full border border-border bg-card p-1 pr-3 transition hover:bg-accent hover:text-accent-foreground"
              >
                <div className="grid h-8 w-8 place-items-center rounded-full gradient-primary text-sm font-bold text-primary-foreground">
                  {initial}
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border bg-card p-2 shadow-elegant">
                  <div className="px-3 py-2 text-xs text-muted-foreground">{user.email}</div>
                  <hr className="my-1" />
                  <Link href={dashboardLink} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                    <LayoutDashboard className="h-4 w-4" /> <T>Dashboard</T>
                  </Link>
                  <Link href={academyLink} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                    <GraduationCap className="h-4 w-4" /> <T>My academy</T>
                  </Link>
                  <Link href={profileLink} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                    <User className="h-4 w-4" /> <T>Profile</T>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary hover:bg-accent"
                  >
                    <LogOut className="h-4 w-4" /> <T>Sign out</T>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-elegant transition-transform hover:scale-[1.02] xl:inline-flex"
              >
                <T>Sign in</T>
              </Link>
              <Link
                href="/signup"
                className="hidden rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-elegant transition-transform hover:scale-[1.02] xl:inline-flex"
              >
                <T>Sign up</T>
              </Link>
            </>
          )}
        </div>

        {/* Mobile right side */}
        <div className="flex xl:hidden items-center gap-1">
          <LanguageSwitcher />
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {user ? (
            <div className="grid h-8 w-8 place-items-center rounded-full gradient-primary text-sm font-bold text-primary-foreground">
              {initial}
            </div>
          ) : (
            <Link href="/login" className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
              <T>Sign in</T>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="xl:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-card shadow-elegant p-6 overflow-y-auto animate-slide-in-right">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-foreground"><T>Menu</T></h3>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="p-2 rounded-full hover:bg-accent"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="space-y-2">
              {links.map(l => (
                <Link key={l.to} href={l.to} onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-base font-medium hover:bg-accent">
                  <T>{l.label}</T>
                </Link>
              ))}
              {moreLinks.map(l => (
                <Link key={l.to} href={l.to} onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-base font-medium hover:bg-accent">
                  <T>{l.label}</T>
                </Link>
              ))}
            </nav>

            <hr className="my-4" />

            {user ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground px-4">{user.email}</p>
                <Link href={dashboardLink} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl px-4 py-3 hover:bg-accent">
                  <LayoutDashboard className="h-5 w-5" /> <T>Dashboard</T>
                </Link>
                <Link href={academyLink} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl px-4 py-3 hover:bg-accent">
                  <GraduationCap className="h-5 w-5" /> <T>My academy</T>
                </Link>
                <Link href={profileLink} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl px-4 py-3 hover:bg-accent">
                  <User className="h-5 w-5" /> <T>Profile</T>
                </Link>
                <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-primary hover:bg-accent">
                  <LogOut className="h-5 w-5" /> <T>Sign out</T>
                </button>
              </div>
            ) : (
              <div className="space-y-2 px-4">
                <Link href="/login" onClick={() => setMobileOpen(false)} className="block w-full rounded-full bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground">
                  <T>Sign in</T>
                </Link>
                <Link href="/signup" onClick={() => setMobileOpen(false)} className="block w-full rounded-full border px-4 py-2.5 text-center text-sm font-medium">
                  <T>Sign up</T>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}