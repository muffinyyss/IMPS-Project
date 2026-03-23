"use client";
import React, { useState, useEffect } from "react";
import { getRoutes } from "@/routes";
import { DashboardNavbar, Configurator } from "@/widgets/layout";
import Sidenav from "@/widgets/layout/sidenav";
import { usePathname } from "next/navigation";
import { useMaterialTailwindController } from "@/context";

export default function InnerContent({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]);

  // ✅ ย้าย hooks ทั้งหมดขึ้นมาก่อน early return
  const [controller] = useMaterialTailwindController();

  useEffect(() => {
    setIsMounted(true);
    setRoutes(getRoutes());
  }, []);

  if (!isMounted) return null;

  const { openSidenav } = controller;
  const pathname = usePathname();    // ← usePathname ใช้ได้หลัง mount

  const HIDE_SIDENAV = ["/pages/*", "/mainpages/*", "/auth/*"];
  const SIMPLE_PAGES = ["/pages/*", "/mainpages/*", "/auth/*"];

  const isAiPage = pathname === "/dashboard/ai" || pathname.startsWith("/dashboard/ai/");

  function match(path: string, pattern: string) {
    if (pattern.endsWith("/*")) return path.startsWith(pattern.slice(0, -2));
    return path === pattern;
  }

  const showSidenav = !HIDE_SIDENAV.some((p) => match(pathname, p));
  const isSimpleLayout = SIMPLE_PAGES.some((p) => match(pathname, p));

  return (
    <div className="!tw-min-h-screen tw-bg-blue-gray-50/50">
      {showSidenav && <Sidenav routes={routes} />}
      <div
        className={
          showSidenav
            ? isAiPage
              ? "xl:tw-ml-[var(--content-ml)] tw-min-h-screen tw-overflow-y-auto"
              : "tw-p-4 xl:tw-ml-[var(--content-ml)]"
            : "m-0"
        }
      >
        {!isSimpleLayout && !isAiPage && (
          <>
            <DashboardNavbar />
            <Configurator />
          </>
        )}
        {children}
      </div>
    </div>
  );
}