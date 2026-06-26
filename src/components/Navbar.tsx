"use client";

import { T } from "@/components/TranslatedText";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, BellOff, Mail, Moon, Sun, BookOpen, User, LayoutDashboard, LogOut, ChevronDown,
  Info, Phone, Shield, ShoppingCart, Heart, Menu, X, Users,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { signOut, getAuth } from "firebase/auth";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// روابط ثابتة (بدون Quran Study أو Blog)
const baseLinks = [
  { to: "/", label: "Home" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/bundles", label: "Bundles" },
  { to: "/certification", label: "Certification" },
];

const moreLinks = [
  { to: "/about", label: "About", icon: Info },
  { to: "/contact", label: "Contact", icon: Phone },
];

export function Navbar() {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const { user, isLoading, role } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const links = baseLinks;

  // جلب الإشعارات كل 30 ثانية
  useEffect(() => {
    if (!user) return;
    const fetchNotifications = () => {
      fetch(`/api/notifications?uid=${user.uid}`)
        .then(r => r.json())
        .then(d => setNotifications(d.notifications || []));
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // تحديث عدد الرسائل والسلة والإشعارات
  useEffect(() => {
    if (!user) return;
    const updateUnread = () =>
      fetch(`/api/messages/unread-count?uid=${user.uid}`)
        .then((r) => r.json())
        .then((d) => setUnreadMessages(d.count || 0));
    const updateCart = () =>
      fetch(`/api/cart?uid=${user.uid}`)
        .then(r => r.json())
        .then(d => setCartCount(d.items?.length || 0));
    const checkFcm = () =>
      fetch(`/api/user?uid=${user.uid}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.profile?.fcm_token) setNotificationsEnabled(true);
        });
    updateUnread();
    updateCart();
    checkFcm();
    const interval = setInterval(() => { updateUnread(); updateCart(); }, 60000);
    return () => clearInterval(interval);
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
        await fetch("/api/notifications/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: user!.uid, token }),
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

  const handleLogout = async () => {
    await signOut(getAuth());
    setMenuOpen(false);
    setMobileOpen(false);
  };

  const dashboardLink =
    role === "admin"
      ? "/dashboard/admin"
      : role === "teacher"
      ? "/dashboard/teacher"
      : "/dashboard/student";

  const profileLink =
    role === "admin"
      ? "/profile/admin"
      : role === "teacher"
      ? "/profile/teacher"
      : "/profile/student";

  const initial = user?.email ? user.email.charAt(0).toUpperCase() : "U";

  return (
    <header className="sticky top-0 z-40 glass border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        {/* Logo + Hamburger */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-accent"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full gradient-primary shadow-elegant">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="font-serif text-lg font-semibold text-foreground">
                <T>Ruhulqudus</T>
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-accent">
                <T>Academy</T>
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation (desktop) – هوية كريمي × كحلي */}
        <nav className="hidden md:flex items-center gap-1">
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

          {/* رابط المجتمع للطلاب فقط */}
          {role === "student" && (
            <Link
              href="/community"
              className={cn(
                "rounded-full px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === "/community" && "bg-accent text-accent-foreground"
              )}
            >
              <Users className="w-4 h-4 mr-1 inline" />
              <T>Community</T>
            </Link>
          )}

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
        <div className="hidden md:flex items-center gap-2">
          <LanguageSwitcher />

          {user && !notificationsEnabled && (
            <button
              onClick={enableNotifications}
              className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-accent"
              title="Enable Notifications"
            >
              <BellOff className="h-4 w-4 text-muted-foreground" />
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-accent"
            >
              <Bell className="h-4 w-4" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {notifications.filter(n => !n.read).length > 9 ? '9+' : notifications.filter(n => !n.read).length}
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
                      href={n.link || '#'}
                      onClick={() => setNotifOpen(false)}
                      className={`block rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-accent ${
                        !n.read ? 'border-l-2 border-l-accent bg-accent/10' : ''
                      }`}
                    >
                      <p className={!n.read ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                        {n.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>

          <Link
            href="/messages"
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
                  <Link href={profileLink} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                    <User className="h-4 w-4" /> <T>Profile</T>
                  </Link>
                  <Link href="/wishlist" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                    <Heart className="h-4 w-4" /> <T>Wishlist</T>
                  </Link>
                  <Link href="/cart" onClick={() => setMenuOpen(false)} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
                    <span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> <T>Cart</T></span>
                    {cartCount > 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{cartCount}</span>
                    )}
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
                className="hidden rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-elegant transition-transform hover:scale-[1.02] sm:inline-flex"
              >
                <T>Sign in</T>
              </Link>
              <Link
                href="/signup"
                className="hidden rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-elegant transition-transform hover:scale-[1.02] sm:inline-flex"
              >
                <T>Sign up</T>
              </Link>
            </>
          )}
        </div>

        {/* Mobile right side */}
        <div className="flex md:hidden items-center gap-1">
          <LanguageSwitcher />
          <button onClick={toggle} className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card">
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
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-card shadow-2xl p-6 overflow-y-auto animate-slide-in-right">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-foreground"><T>Menu</T></h3>
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-full hover:bg-accent">
                <X size={20} />
              </button>
            </div>

            <nav className="space-y-2">
              {links.map(l => (
                <Link key={l.to} href={l.to} onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-base font-medium hover:bg-accent">
                  <T>{l.label}</T>
                </Link>
              ))}
              {role === "student" && (
                <Link href="/community" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl px-4 py-3 text-base font-medium hover:bg-accent">
                  <Users className="h-5 w-5" />
                  <T>Community</T>
                </Link>
              )}
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
                <Link href={profileLink} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl px-4 py-3 hover:bg-accent">
                  <User className="h-5 w-5" /> <T>Profile</T>
                </Link>
                <Link href="/wishlist" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl px-4 py-3 hover:bg-accent">
                  <Heart className="h-5 w-5" /> <T>Wishlist</T>
                </Link>
                <Link href="/cart" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl px-4 py-3 hover:bg-accent">
                  <ShoppingCart className="h-5 w-5" /> <T>Cart</T>
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