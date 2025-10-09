"use client";

import React from "react";
import routes from "@/routes";
import { DashboardNavbar, Configurator } from "@/widgets/layout";
import Sidenav from "@/widgets/layout/sidenav";
import { usePathname } from "next/navigation";
import { useMaterialTailwindController } from "@/context";

export default function InnerContent({ children }: { children: React.ReactNode }) {
  const [controller] = useMaterialTailwindController();
  const { openSidenav } = controller; // <-- ดูคีย์ที่มีจริงในโปรเจกต์คุณ อาจเป็น sidenavOpen หรือ sidenavMini
  const pathname = usePathname();

  const HIDE_SIDENAV = ["/pages/*", "/mainpages/*", "/auth/*"];
  const SIMPLE_PAGES = ["/pages/*", "/mainpages/*", "/auth/*"];

  function match(path: string, pattern: string) {
    if (pattern.endsWith("/*")) return path.startsWith(pattern.slice(0, -2));
    return path === pattern;
  }

  const showSidenav = !HIDE_SIDENAV.some((p) => match(pathname, p));
  const isSimpleLayout = SIMPLE_PAGES.some((p) => match(pathname, p));

  // ถ้ามี sidenav: ให้ margin-left = 80 ตอนกาง และ 60 ตอนย่อ
  // ถ้าไม่โชว์ sidenav: margin = 0
  const mainClassName = showSidenav
    ? `tw-p-4 ${openSidenav ? "xl:tw-ml-80" : "xl:tw-ml-80"}`
    : "m-0";

  return (
    <div className="!tw-min-h-screen tw-bg-blue-gray-50/50">
      {showSidenav && <Sidenav routes={routes} />}

      <div className={showSidenav ? "tw-p-4 xl:tw-ml-[var(--content-ml)]" : "m-0"}>
        {!isSimpleLayout && (
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
