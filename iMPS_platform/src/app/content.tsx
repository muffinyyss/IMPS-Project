"use client";

import React, { useState, useEffect } from "react";
import { getRoutes }  from "@/routes";
import { DashboardNavbar } from "@/widgets/layout";
import Sidenav from "@/widgets/layout/sidenav";
import { usePathname } from "next/navigation";
import { installDomSafetyPatch } from "@/utils/dom-safety";
import { installUploadSafetyPatch } from "@/utils/upload-safety";


export default function InnerContent({ children }: { children: React.ReactNode }) {
  // Ce composant enveloppe TOUTES les pages. Il attendait le montage client avant
  // de rendre quoi que ce soit (`if (!isMounted) return null`), donc le HTML servi
  // était vide et rien ne s'affichait avant que React ait téléchargé, hydraté puis
  // relancé un rendu — c'était le coût dominant du délai d'affichage.
  //
  // Un seul enfant impose réellement cette attente : Sidenav lit matchMedia et
  // navigator.userAgent dès son premier rendu (usehooks-ts), et monte un portail
  // sur document.body — le serveur ne peut pas produire le même balisage. La barre
  // du haut et les pages, elles, partent d'un état déterministe (leurs lectures de
  // localStorage sont toutes dans des effets). Le garde-fou ne porte donc plus que
  // sur le Sidenav : le reste est rendu côté serveur.
  const [sidenavReady, setSidenavReady] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]);

  const pathname = usePathname();

  useEffect(() => {
    installDomSafetyPatch();
    installUploadSafetyPatch();
    setSidenavReady(true);
    setRoutes(getRoutes());
  }, []);

  const HIDE_SIDENAV = ["/pages/*", "/mainpages/*", "/auth/*"];
  const SIMPLE_PAGES = ["/pages/*", "/mainpages/*", "/auth/*"];

  function match(path: string, pattern: string) {
    if (pattern.endsWith("/*")) return path.startsWith(pattern.slice(0, -2));
    return path === pattern;
  }

  const showSidenav = !HIDE_SIDENAV.some((p) => match(pathname, p));
  const isSimpleLayout = SIMPLE_PAGES.some((p) => match(pathname, p));

  return (
    <div className="!tw-min-h-screen tw-bg-blue-gray-50/50">
      {/* --content-ml a une valeur par défaut dans globals.css identique à celle que
          Sidenav calcule sur grand écran : le contenu est donc déjà à sa place dans
          le HTML, et son arrivée ne décale rien. */}
      {showSidenav && sidenavReady && <Sidenav routes={routes} />}

      <div className={showSidenav ? "tw-p-4 xl:tw-ml-[var(--content-ml)]" : "m-0"}>
        {/* Configurator (แผงตั้งค่าของเทมเพลต) ถูกถอดออก — ไม่มีปุ่มไหนเปิดมันแล้ว
            และมันยิง fetch ไป api.github.com ทุกครั้งที่โหลดหน้า dashboard */}
        {!isSimpleLayout && <DashboardNavbar />}

        {children}
      </div>
    </div>
  );
}
