"use client";

import React, { useEffect, useMemo, useState } from "react";
import routes from "@/routes";
import { DashboardNavbar, Configurator } from "@/widgets/layout";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useMaterialTailwindController } from "@/context";

// โหลด Sidenav แบบ client-only จะปลอดภัยต่อ SSR มากกว่า
const Sidenav = dynamic(() => import("@/widgets/layout/sidenav"), { ssr: false });

export default function InnerContent({ children }: { children: React.ReactNode }) {
  const [controller] = useMaterialTailwindController();
  const { openSidenav } = controller ?? {}; // กันกรณี undefined ตอนแรก
  const pathname = usePathname();

  // ให้มี state ว่า "mounted" เพื่อควบคุมเฉพาะเรื่องการซ่อน/แสดงด้วย CSS
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const HIDE_SIDENAV = ["/pages/*", "/mainpages/*", "/auth/*"];
  const SIMPLE_PAGES = ["/pages/*", "/mainpages/*", "/auth/*"];

  function match(path: string, pattern: string) {
    if (pattern.endsWith("/*")) return path.startsWith(pattern.slice(0, -2));
    return path === pattern;
  }

  // คำนวณตาม pathname “หลัง mount” เท่านั้น เพื่อลดต่าง SSR/Client
  const showSidenav = useMemo(() => {
    if (!mounted) return true; // <— ตอน SSR/ก่อน mount ให้โชว์โครง Sidenav ไว้ก่อน (แต่ซ่อนด้วย CSS ด้านล่าง)
    return !HIDE_SIDENAV.some((p) => match(pathname, p));
  }, [mounted, pathname]);

  const isSimpleLayout = useMemo(() => {
    if (!mounted) return false; // ให้โครง Navbar/Configurator อยู่ครบก่อน แล้วค่อยซ่อนหลัง mount
    return SIMPLE_PAGES.some((p) => match(pathname, p));
  }, [mounted, pathname]);

  // margin-left สำหรับพื้นที่ content:
  // - ตอน SSR/ก่อน mount: ใช้ค่าคงที่เพื่อตรงกันเสมอ
  // - หลัง mount ค่อยสลับตาม openSidenav
  const contentMarginClass = useMemo(() => {
    if (!mounted) return "xl:tw-ml-80"; // ค่า default เดียวกันทั้ง SSR/Client แรก
    // ปรับค่าตามของจริงหลัง mount
    return showSidenav ? (openSidenav ? "xl:tw-ml-80" : "xl:tw-ml-60") : "tw-ml-0";
  }, [mounted, showSidenav, openSidenav]);

  return (
    <div className="!tw-min-h-screen tw-bg-blue-gray-50/50">
      {/* รักษาโครงสร้าง DOM: Render Sidenav ตลอด แต่ซ่อนด้วย CSS แทน */}
      <div className={showSidenav ? "" : "tw-hidden"} aria-hidden={!showSidenav}>
        <Sidenav routes={routes} />
      </div>

      <div className={`tw-p-4 ${contentMarginClass}`}>
        {/* รักษาโครงสร้าง DOM: Render กล่อง Navbar/Configurator ตลอด แต่ซ่อนด้วย CSS ถ้า simple */}
        <div className={isSimpleLayout ? "tw-hidden" : ""} aria-hidden={isSimpleLayout}>
          <DashboardNavbar />
          <Configurator />
        </div>

        {children}
      </div>
    </div>
  );
}
