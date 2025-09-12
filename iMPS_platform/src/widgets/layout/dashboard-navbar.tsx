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

  if (segs[1] === "mdb") {
    title = "Main Distribution Board (MDB)"
  } else if (segs[1] === "pm-report") {
    title = "PM Report"
  } else if (segs[1] === "input_PMreport") {
    title = "Add PM Report"
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
          {/* <Link href="/auth/signin/basic">
            <IconButton variant="text">
              <UserCircleIcon className="tw-h-5 tw-w-5 tw-text-blue-gray-900" />
            </IconButton>
          </Link> */}
          {/* <IconButton
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
          </IconButton> */}

          {/* <IconButton
            variant="text"
            color="gray"
            onClick={() => setOpenConfigurator(dispatch, true)}
          >
            <Cog6ToothIcon className="tw-h-5 tw-w-5 tw-text-gray-900" />
          </IconButton> */}
        </div>


      </div>
    </Navbar>
  );
}

export default DashboardNavbar;
