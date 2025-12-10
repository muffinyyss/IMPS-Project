"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

type NavItem = { label: string; href: string; requireAuth?: boolean };
type User = { username: string; role?: string; company?: string };

const navItems: NavItem[] = [
  { label: "Home", href: "/pages/mainpages/home", requireAuth: false },
  { label: "About", href: "/pages/mainpages/about", requireAuth: false },
  { label: "Contact", href: "/pages/mainpages/contact", requireAuth: false },
  { label: "Dashboard", href: "/dashboard/chargers", requireAuth: true },
];

export default function SiteNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const loadUserFromStorage = () => {
    try {
      const token = localStorage.getItem("access_token");
      const rawUser = localStorage.getItem("user");
      const parsed =
        rawUser && rawUser !== "undefined" ? JSON.parse(rawUser) : null;
      setUser(token && parsed ? parsed as User : null);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const load = () => {
      try {
        const token = localStorage.getItem("access_token");
        const rawUser = localStorage.getItem("user");
        console.log("[Navbar] token=", token, "rawUser=", rawUser);
        setUser(token && rawUser ? JSON.parse(rawUser) : null);
      } catch {
        setUser(null);
      }
    };

    load();

    const onStorage = () => load();                     // ข้ามแท็บ
    const onAuth = () => load();                        // แท็บเดียวกัน
    const onVisibility = () => {
      if (document.visibilityState === "visible") load(); // กลับมาเห็นแท็บ
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("auth", onAuth);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth", onAuth);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // ปิดเมนูเมื่อเปลี่ยนหน้า หรือกด ESC
  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    if (mobileOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/pages/mainpages/home") return pathname === "/pages/mainpages/home";
    return pathname.startsWith(href);
  };

  const linkClass = (href: string) =>
    `tw-font-medium hover:tw-text-black ${isActive(href) ? "tw-text-black tw-font-semibold" : "tw-text-gray-700"
    }`;

  // เลือก href ของแต่ละเมนูตาม role
  const resolveHref = (item: NavItem) => {
    if (item.label === "Dashboard" && user) {
      const role = user.role?.toLowerCase() ?? "";
      // รองรับทั้ง technician และ tecnician
      if (role === "technician" || role === "tecnician") {
        return "/dashboard/pm-report";
      }
    }
    return item.href;
  };

  const handleLogout = async () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    setUser(null);
    window.dispatchEvent(new Event("auth"));
    router.push("/auth/signin/basic");
  };

  return (
    <nav className="tw-sticky tw-top-0 tw-z-40 tw-bg-white">
      {/* ====== Header container ====== */}
      {/* จอเล็ก: ใช้ flex; จอใหญ่ (md+): ใช้ layout แบบเดิม grid 3 คอลัมน์ */}
      <div className="
        tw-mx-auto tw-max-w-7xl tw-h-16 md:tw-h-20 tw-px-4
        tw-flex tw-items-center tw-justify-between
        md:tw-grid md:tw-grid-cols-[1fr_auto_1fr] md:tw-items-center
      ">
        {/* Brand */}
        <Link href="/" className="tw-flex tw-items-center tw-space-x-2" aria-label="IMPS Home">
          <span className="tw-text-3xl md:tw-text-4xl tw-font-extrabold">
            <span className="tw-text-yellow-500">i</span>
            <span className="tw-text-gray-900">MPS</span>
          </span>
        </Link>

        {/* Center nav — แสดงเฉพาะจอใหญ่ */}
        <ul className="tw-hidden md:tw-flex tw-items-center tw-space-x-10">
          {/* {navItems.map((item) => (
            <li key={item.href}>
              {!item.requireAuth || user ? (
                <Link href={item.href} className={linkClass(item.href)} prefetch={false}>
                  {item.label}
                </Link>
              ) : (
                <span
                  role="link"
                  aria-disabled="true"
                  className="tw-text-gray-400 tw-cursor-not-allowed tw-select-none tw-pointer-events-none"
                  title="Please login first"
                >
                  {item.label}
                </span>
              )}
            </li>
          ))} */}
          {navItems.map((item) => {
            const href = resolveHref(item);
            return (
              <li key={item.href}>
                {!item.requireAuth || user ? (
                  <Link href={href} className={linkClass(href)} prefetch={false}>
                    {item.label}
                  </Link>
                ) : (
                  <span
                    role="link"
                    aria-disabled="true"
                    className="tw-text-gray-400 tw-cursor-not-allowed tw-select-none tw-pointer-events-none"
                    title="Please login first"
                  >
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {/* Right actions — แสดงเฉพาะจอใหญ่ */}
        <div className="tw-hidden md:tw-flex tw-justify-end tw-items-center tw-space-x-3">
          {user ? (
            <>
              <span className="tw-text-sm tw-text-gray-700">
                Hi, <span className="tw-font-semibold">{user.username}</span>
              </span>
              <button
                onClick={handleLogout}
                className="tw-rounded-full tw-bg-white tw-border tw-border-gray-300 tw-px-5 tw-h-10 
                           tw-shadow-sm tw-inline-flex tw-items-center tw-justify-center tw-text-sm
                           hover:tw-bg-black hover:tw-text-white hover:tw-border-black"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/auth/signin/basic"
              className="tw-rounded-full tw-bg-white tw-border tw-border-gray-300 tw-px-5 tw-h-10 
                         tw-shadow-sm tw-inline-flex tw-items-center tw-justify-center tw-text-sm
                         hover:tw-bg-black hover:tw-text-white hover:tw-border-black"
            >
              Login
            </Link>
          )}
        </div>

        {/* Hamburger — แสดงเฉพาะจอเล็ก */}
        <div className="md:tw-hidden tw-flex tw-items-center">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-controls="mobile-menu"
            aria-expanded={mobileOpen}
            className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-md tw-p-2 tw-border tw-border-gray-200 hover:tw-bg-gray-50"
          >
            <span className="tw-sr-only">Open main menu</span>
            {!mobileOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="tw-h-6 tw-w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="tw-h-6 tw-w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ====== Mobile menu ====== */}
      {/* Overlay */}
      <div
        className={`md:tw-hidden tw-fixed tw-inset-0 tw-bg-black/30 tw-transition-opacity ${mobileOpen ? "tw-opacity-100 tw-pointer-events-auto" : "tw-opacity-0 tw-pointer-events-none"
          }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      {/* Slide-down panel */}
      <div
        id="mobile-menu"
        className={`md:tw-hidden tw-absolute tw-left-0 tw-right-0 tw-top-16 tw-bg-white tw-shadow-lg tw-border-t tw-border-gray-100
                    tw-origin-top tw-transition-transform tw-duration-200 ${mobileOpen ? "tw-translate-y-0" : "-tw-translate-y-2 tw-pointer-events-none tw-opacity-0"
          }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="tw-px-4 tw-pt-3 tw-pb-4">
          <ul className="tw-space-y-2">
           
            {navItems.map((item) => {
              const href = resolveHref(item);
              return (
                <li key={item.href}>
                  {!item.requireAuth || user ? (
                    <Link
                      href={href}
                      className={`tw-block tw-py-2 ${linkClass(href)}`}
                      prefetch={false}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      role="link"
                      aria-disabled="true"
                      className="tw-block tw-py-2 tw-text-gray-400 tw-cursor-not-allowed tw-select-none tw-pointer-events-none"
                      title="Please login first"
                    >
                      {item.label}
                    </span>
                  )}
                </li>
              );
            })}

          </ul>

          <div className="tw-mt-3 tw-border-t tw-border-gray-100 tw-pt-3 tw-flex tw-items-center tw-justify-between">
            {user ? (
              <>
                <span className="tw-text-sm tw-text-gray-700">
                  Hi, <span className="tw-font-semibold">{user.username}</span>
                </span>
                <button
                  onClick={handleLogout}
                  className="tw-rounded-full tw-bg-white tw-border tw-border-gray-300 tw-px-4 tw-h-9 
                             tw-shadow-sm tw-inline-flex tw-items-center tw-justify-center tw-text-sm
                             hover:tw-bg-black hover:tw-text-white hover:tw-border-black"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/auth/signin/basic"
                className="tw-w-full tw-text-center tw-rounded-full tw-bg-white tw-border tw-border-gray-300 tw-px-4 tw-h-10 
                           tw-shadow-sm tw-inline-flex tw-items-center tw-justify-center tw-text-sm
                           hover:tw-bg-black hover:tw-text-white hover:tw-border-black"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
