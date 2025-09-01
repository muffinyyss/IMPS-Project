// import React from "react";
// import Link from "next/link";
// import { usePathname } from "next/navigation";

// // @material-tailwind/react
// import {
//   Navbar,
//   Typography,
//   IconButton,
//   Breadcrumbs,
//   Input,
//   Menu,
//   MenuHandler,
//   MenuList,
//   MenuItem,
//   Badge,
// } from "@material-tailwind/react";

// // @heroicons/react

// import {
//   UserCircleIcon,
//   Cog6ToothIcon,
//   BellIcon,
//   Bars3Icon,
//   HomeIcon,
//   Bars3CenterLeftIcon,
//   EnvelopeIcon,
//   MicrophoneIcon,
//   ShoppingCartIcon,
// } from "@heroicons/react/24/solid";

// // @context
// import {
//   useMaterialTailwindController,
//   setOpenConfigurator,
//   setOpenSidenav,
// } from "@/context";

// export function DashboardNavbar() {
//   const [controller, dispatch] = useMaterialTailwindController();
//   const { fixedNavbar, openSidenav } = controller;
//   const pathname = usePathname();
//   const [layout, page] = pathname.split("/").filter((el) => el !== "");
//   return (
//     <Navbar
//       color={fixedNavbar ? "white" : "transparent"}
//       className={`tw-rounded-xl !tw-transition-all !tw-max-w-full ${
//         fixedNavbar
//           ? "!tw-sticky tw-top-4 tw-z-40 !tw-py-3 tw-shadow-md tw-shadow-blue-gray-500/5"
//           : "!tw-px-0 !tw-py-1"
//       }`}
//       fullWidth
//       blurred={fixedNavbar}
//     >
//       <div className="!tw-flex tw-flex-col !tw-justify-between tw-gap-2 md:!tw-flex-row md:tw-items-center">
//         <div className="tw-capitalize">
//           <Breadcrumbs
//             className={`tw-bg-transparent !tw-p-0 tw-transition-all ${
//               fixedNavbar ? "tw-mt-1" : ""
//             }`}
//           >
//             <Link href="/dashboard/analytics">
//               <IconButton size="sm" variant="text">
//                 <HomeIcon className="tw-h-4 tw-w-4 tw-text-gray-900" />
//               </IconButton>
//             </Link>
//             <Typography
//               variant="small"
//               color="blue-gray"
//               className="!tw-font-normal tw-opacity-50 tw-transition-all hover:!tw-text-blue-gray-700 hover:tw-opacity-100"
//             >
//               {layout}
//             </Typography>
//             <Typography
//               variant="small"
//               color="blue-gray"
//               className="!tw-font-normal"
//             >
//               {page?.split("-").join(" ")}
//             </Typography>
//           </Breadcrumbs>
//           <Typography variant="h6" color="blue-gray">
//             {page?.split("-").join(" ")}
//           </Typography>
//         </div>
//         <div className="!tw-flex tw-items-center">
//           <div className="tw-mr-auto md:tw-mr-4 md:tw-w-56">
//             <Input label="Search" />
//           </div>
//           <Link href="/auth/signin/basic">
//             <IconButton variant="text">
//               <UserCircleIcon className="tw-h-5 tw-w-5 tw-text-blue-gray-900" />
//             </IconButton>
//           </Link>
//           <IconButton
//             variant="text"
//             color="blue-gray"
//             className="tw-grid xl:tw-hidden"
//             onClick={() => setOpenSidenav(dispatch, !openSidenav)}
//           >
//             {openSidenav ? (
//               <Bars3Icon
//                 strokeWidth={3}
//                 className="tw-h-6 tw-w-6 tw-text-gray-900"
//               />
//             ) : (
//               <Bars3CenterLeftIcon
//                 strokeWidth={3}
//                 className="tw-h-6 tw-w-6 tw-text-gray-900"
//               />
//             )}
//           </IconButton>
//           <IconButton
//             variant="text"
//             color="gray"
//             onClick={() => setOpenConfigurator(dispatch, true)}
//           >
//             <Cog6ToothIcon className="tw-h-5 tw-w-5 tw-text-gray-900" />
//           </IconButton>
//           {/* <Menu>
//             <MenuHandler>
//               <span>
//                 <Badge>
//                   <IconButton variant="text">
//                     <BellIcon className="tw-h-5 tw-w-5 tw-text-gray-900" />
//                   </IconButton>
//                 </Badge>
//               </span>
//             </MenuHandler>
//             <MenuList className="!tw-w-max tw-border tw-border-blue-gray-100">
//               <MenuItem className="tw-flex tw-items-center tw-gap-2">
//                 <EnvelopeIcon className="tw-h-5 tw-w-5 tw-text-gray-900" />
//                 <Typography variant="small" className="!tw-font-normal">
//                   Check new messages
//                 </Typography>
//               </MenuItem>
//               <MenuItem className="tw-flex tw-items-center tw-gap-2">
//                 <MicrophoneIcon className="tw-h-5 tw-w-5 tw-text-gray-900" />
//                 <Typography variant="small" className="!tw-font-normal">
//                   Manage Podcast sessions
//                 </Typography>
//               </MenuItem>
//               <MenuItem className="tw-flex tw-items-center tw-gap-2">
//                 <ShoppingCartIcon className="tw-h-5 tw-w-5 tw-text-gray-900" />
//                 <Typography variant="small" className="!tw-font-normal">
//                   Payment successfully completed
//                 </Typography>
//               </MenuItem>
//             </MenuList>
//           </Menu> */}
//         </div>
//       </div>
//     </Navbar>
//   );
// }

// export default DashboardNavbar;
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Navbar,
  Typography,
  IconButton,
  Breadcrumbs,
  Input,
} from "@material-tailwind/react";
import {
  UserCircleIcon,
  Cog6ToothIcon,
  Bars3Icon,
  Bars3CenterLeftIcon,
  HomeIcon,
} from "@heroicons/react/24/solid";
import {
  useMaterialTailwindController,
  setOpenConfigurator,
  setOpenSidenav,
} from "@/context";

export function DashboardNavbar() {
  const [controller, dispatch] = useMaterialTailwindController();
  const { fixedNavbar, openSidenav } = controller;
  const pathname = usePathname();

  // ---------- NEW: กำหนดหน้าที่ "ไม่แสดง" Breadcrumbs/Title ----------
  const HIDE_TOPBAR = ["/pages", "/mainpages"]; // ใส่ path prefix เพิ่มได้
  const hideTopbar = HIDE_TOPBAR.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  // ---------------------------------------------------------------

  // ทำ title จาก segment สุดท้าย (อ่านง่ายกว่าเดิม)
  const segs = pathname.split("/").filter(Boolean);
  let title = segs[segs.length - 1]?.replace(/-/g, " ");

  // ถ้าอยู่ใน path ที่ขึ้นต้นด้วย "mdb" ให้ title เป็นตัวใหญ่หมด
  if (segs[1] === "mdb") {
    title = title.toUpperCase();
  }

  return (
    <Navbar
      color={fixedNavbar ? "white" : "transparent"}
      className={`tw-rounded-xl !tw-transition-all !tw-max-w-full ${fixedNavbar
        ? "!tw-sticky tw-top-4 tw-z-40 !tw-py-3 tw-shadow-md tw-shadow-blue-gray-500/5"
        : "!tw-px-0 !tw-py-1"
        }`}
      fullWidth
      blurred={fixedNavbar}
    >
      <div className="!tw-flex tw-flex-col !tw-justify-between tw-gap-2 md:!tw-flex-row md:tw-items-center">
        <div className="tw-capitalize">
          {/* ---------- NEW: ซ่อน Breadcrumbs ตามเงื่อนไข ---------- */}
          {!hideTopbar && (
            <Breadcrumbs
              className={`tw-bg-transparent !tw-p-0 tw-transition-all ${fixedNavbar ? "tw-mt-1" : ""
                }`}
            >
              <Link href="/">
                <IconButton size="sm" variant="text">
                  <HomeIcon className="tw-h-4 tw-w-4 tw-text-gray-900" />
                </IconButton>
              </Link>
              {segs.slice(0, -1).map((seg, i) => (
                <Typography
                  key={i}
                  variant="small"
                  color="blue-gray"
                  className="!tw-font-normal tw-opacity-50 hover:!tw-text-blue-gray-700 hover:tw-opacity-100"
                >
                  {seg.replace(/-/g, " ")}
                </Typography>
              ))}
              <Typography variant="small" color="blue-gray" className="!tw-font-normal">
                {title}
              </Typography>
            </Breadcrumbs>
          )}
          {/* ---------- NEW: ซ่อน Title ด้วย ---------- */}
          {!hideTopbar && (
            <Typography variant="h6" color="blue-gray">
              {title}
            </Typography>
          )}
          {/* <Typography variant="small" color="red">
            Debug segs: {JSON.stringify(segs)}
          </Typography> */}
        </div>

        <div className="!tw-flex tw-items-center">
          <div className="tw-mr-auto md:tw-mr-4 md:tw-w-56">
            <Input label="Search" />
          </div>
          <Link href="/auth/signin/basic">
            <IconButton variant="text">
              <UserCircleIcon className="tw-h-5 tw-w-5 tw-text-blue-gray-900" />
            </IconButton>
          </Link>
          <IconButton
            variant="text"
            color="blue-gray"
            className="tw-grid xl:tw-hidden"
            onClick={() => setOpenSidenav(dispatch, !openSidenav)}
          >
            {openSidenav ? (
              <Bars3Icon className="tw-h-6 tw-w-6 tw-text-gray-900" />
            ) : (
              <Bars3CenterLeftIcon className="tw-h-6 tw-w-6 tw-text-gray-900" />
            )}
          </IconButton>
          <IconButton
            variant="text"
            color="gray"
            onClick={() => setOpenConfigurator(dispatch, true)}
          >
            <Cog6ToothIcon className="tw-h-5 tw-w-5 tw-text-gray-900" />
          </IconButton>
        </div>


      </div>
    </Navbar>
  );
}

export default DashboardNavbar;
