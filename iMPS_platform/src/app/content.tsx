"use client";

import React from "react";
import routes from "@/routes";
import { Cog6ToothIcon } from "@heroicons/react/24/solid";
import { IconButton } from "@material-tailwind/react";
import { DashboardNavbar, Configurator, Footer } from "@/widgets/layout";
import Sidenav from "@/widgets/layout/sidenav";
import { usePathname } from "next/navigation";
import { useMaterialTailwindController, setOpenConfigurator } from "@/context";

export default function InnerContent({ children }: { children: React.ReactNode }) {
  const [, dispatch] = useMaterialTailwindController();
  const pathname = usePathname();

  // ซ่อน Sidenav ที่กลุ่มพาธเหล่านี้
  const HIDE_SIDENAV = ["/pages/*", "/mainpages/*", "/auth/*"];

  // ซ่อน Topbar/Configurator/Footer ที่กลุ่มพาธเหล่านี้
  const SIMPLE_PAGES = ["/pages/*", "/mainpages/*", "/auth/*"];

  // helper: exact หรือ prefix ด้วย "/*"
  function match(path: string, pattern: string) {
    if (pattern.endsWith("/*")) return path.startsWith(pattern.slice(0, -2));
    return path === pattern;
  }

  const showSidenav = !HIDE_SIDENAV.some((p) => match(pathname, p));
  const isSimpleLayout = SIMPLE_PAGES.some((p) => match(pathname, p));

  return (
    <div className="!tw-min-h-screen tw-bg-blue-gray-50/50">
      {showSidenav && <Sidenav routes={routes} />}

      <div className={showSidenav ? "tw-p-4 xl:tw-ml-80" : "m-0"}>
        {!isSimpleLayout && (
          <>
            <DashboardNavbar />
            <Configurator />
            <IconButton
              size="lg"
              color="white"
              className="!tw-fixed tw-bottom-8 tw-right-8 tw-z-40 tw-rounded-full tw-shadow-blue-gray-900/10"
              ripple={false}
              onClick={() => setOpenConfigurator(dispatch, true)}
            >
              <Cog6ToothIcon className="tw-h-5 tw-w-5" />
            </IconButton>
          </>
        )}

        {children}

        {!isSimpleLayout && (
          <div className="tw-text-blue-gray-600">
            <Footer />
          </div>
        )}
      </div>
    </div>
  );
}


// "use client";

// import React from "react";

// import routes from "@/routes";

// import { Cog6ToothIcon } from "@heroicons/react/24/solid";
// import { IconButton } from "@material-tailwind/react";
// import { DashboardNavbar, Configurator, Footer } from "@/widgets/layout";

// import Sidenav from "@/widgets/layout/sidenav";
// import { usePathname } from "next/navigation";

// import { useMaterialTailwindController, setOpenConfigurator } from "@/context";

// export default function InnerContent({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   const [controller, dispatch] = useMaterialTailwindController();
//   const { sidenavType } = controller;
//   const pathname = usePathname();

//   const isAuthPages = pathname.startsWith("/auth");
//   const isPricingPage = pathname === "/pages/pricing-page";
//   const isPagesGroup = pathname.startsWith("/pages");
//   const isMainPagesGroup = pathname.startsWith("/mainpages");

//   const isSimpleLayout = isAuthPages || isPricingPage || isPagesGroup || isMainPagesGroup;
//   const hideSidenav = isAuthPages || isPricingPage || isPagesGroup || isMainPagesGroup;


//   return (

//     <div className={`${hideSidenav ? "m-0" : "tw-p-4 xl:tw-ml-80"}`}>
//       {!isSimpleLayout && (
//         <>
//           <DashboardNavbar />
//           <Configurator />
//           <IconButton
//             size="lg"
//             color="white"
//             className="!tw-fixed tw-bottom-8 tw-right-8 tw-z-40 tw-rounded-full tw-shadow-blue-gray-900/10"
//             ripple={false}
//             onClick={() => setOpenConfigurator(dispatch, true)}
//           >
//             <Cog6ToothIcon className="tw-h-5 tw-w-5" />
//           </IconButton>
//         </>
//       )}

//       {children}

//       {!isSimpleLayout && (
//         <div className="tw-text-blue-gray-600">
//           <Footer />
//         </div>
//       )}
//     </div>

//     // <div className="!tw-min-h-screen tw-bg-blue-gray-50/50">
//     //   {!isSimpleLayout && (
//     //     <Sidenav
//     //       routes={routes}
//     //     // brandImg={
//     //     //   sidenavType === "dark"
//     //     //     ? "/img/logo-ct.png"
//     //     //     : "/img/logo-ct-dark.png"
//     //     // }
//     //     />
//     //   )}
//     //   <div className={`${isSimpleLayout ? "m-0" : "tw-p-4 xl:tw-ml-80"}`}>
//     //     {!isSimpleLayout && (
//     //       <>
//     //         <DashboardNavbar />
//     //         <Configurator />
//     //         <IconButton
//     //           size="lg"
//     //           color="white"
//     //           className="!tw-fixed tw-bottom-8 tw-right-8 tw-z-40 tw-rounded-full tw-shadow-blue-gray-900/10"
//     //           ripple={false}
//     //           onClick={() => setOpenConfigurator(dispatch, true)}
//     //         >
//     //           <Cog6ToothIcon className="tw-h-5 tw-w-5" />
//     //         </IconButton>
//     //       </>
//     //     )}
//     //     {children}
//     //     {!isSimpleLayout && (
//     //       <div className="tw-text-blue-gray-600">
//     //         <Footer />
//     //       </div>
//     //     )}
//     //   </div>
//     // </div>
//   );
// }


