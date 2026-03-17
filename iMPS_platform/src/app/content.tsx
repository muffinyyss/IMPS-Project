"use client";

import React, { useState, useEffect } from "react";
import { getRoutes }  from "@/routes";
import { DashboardNavbar, Configurator } from "@/widgets/layout";
import Sidenav from "@/widgets/layout/sidenav";
import { usePathname } from "next/navigation";
import { useMaterialTailwindController } from "@/context";


export default function InnerContent({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]); 

  useEffect(() => {
    setIsMounted(true);
    setRoutes(getRoutes());
  }, []);

  // ยังไม่ mount → return null
  if (!isMounted) return null;

  const [controller] = useMaterialTailwindController();
  const { openSidenav } = controller;
  const pathname = usePathname();

  const HIDE_SIDENAV = ["/pages/*", "/mainpages/*", "/auth/*"];
  const SIMPLE_PAGES = ["/pages/*", "/mainpages/*", "/auth/*"];

  function match(path: string, pattern: string) {
    if (pattern.endsWith("/*")) return path.startsWith(pattern.slice(0, -2));
    return path === pattern;
  }

  const showSidenav = !HIDE_SIDENAV.some((p) => match(pathname, p));
  const isSimpleLayout = SIMPLE_PAGES.some((p) => match(pathname, p));

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
