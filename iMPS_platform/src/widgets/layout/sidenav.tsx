/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Card,
  Typography,
  List,
  ListItem,
  ListItemPrefix,
  Accordion,
  AccordionHeader,
  AccordionBody,
  IconButton,
} from "@material-tailwind/react";

import routes from "@/routes";
import {
  ChevronDownIcon,
  XMarkIcon,
  ChevronLeftIcon,
  Bars3Icon,
  Bars3CenterLeftIcon,
  PlusIcon,
  MinusIcon,
} from "@heroicons/react/24/outline";

import { useOnClickOutside } from "usehooks-ts";
import { useMaterialTailwindController, setOpenSidenav } from "@/context";

const COLORS: any = {
  dark: "tw-bg-gray-900 hover:tw-bg-gray-700 focus:tw-bg-gray-900 active:tw-bg-gray-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
  blue: "tw-bg-blue-500 hover:tw-bg-blue-700 focus:tw-bg-blue-700 active:tw-bg-blue-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
  "blue-gray":
    "tw-bg-blue-gray-900 hover:tw-bg-blue-gray-900 focus:tw-bg-blue-gray-900 active:tw-bg-blue-gray-900 hover:tw-bg-opacity-80 focus:tw-bg-opacity-80 active:tw-bg-opacity-80",
  green:
    "tw-bg-green-500 hover:tw-bg-green-700 focus:tw-bg-green-700 active:tw-bg-green-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
  orange:
    "tw-bg-orange-500 hover:tw-bg-orange-700 focus:tw-bg-orange-700 active:tw-bg-orange-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
  red: "tw-bg-red-500 hover:tw-bg-red-700 focus:tw-bg-red-700 active:tw-bg-red-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
  pink: "tw-bg-pink-500 hover:tw-bg-pink-700 focus:tw-bg-pink-700 active:tw-bg-pink-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
};

type PropTypes = {
  brandImg?: string;
  brandName?: string;
  routes?: {}[];
};

// ไอคอนสองขีด (ปุ่ม "ย่อเล็ก")
function MinimizeLinesIcon({ className = "tw-h-6 tw-w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      {/* ขีดบน */}
      <line x1="6" y1="8" x2="18" y2="8" />
      {/* ขีดล่าง (สั้นกว่าเล็กน้อย) */}
      <line x1="6" y1="14" x2="16" y2="14" />
    </svg>
  );
}


export default function Sidenav({ }: PropTypes) {
  const pathname = usePathname();
  const [controller, dispatch] = useMaterialTailwindController();
  const { sidenavType, sidenavColor, openSidenav }: any = controller;

  // collapsed state
  const [collapsed, setCollapsed] = React.useState(false);

  const [openCollapse, setOpenCollapse] = React.useState<string | null>(null);
  const [openSubCollapse, setOpenSubCollapse] = React.useState<string | null>(null);

  const handleOpenCollapse = (value: string) => {
    if (collapsed) return;
    setOpenCollapse((cur) => (cur === value ? null : value));
  };
  const handleOpenSubCollapse = (value: string) => {
    if (collapsed) return;
    setOpenSubCollapse((cur) => (cur === value ? null : value));
  };

  const sidenavRef = React.useRef<HTMLDivElement | null>(null);
  useOnClickOutside(sidenavRef, () => setOpenSidenav(dispatch, false));

  const collapseItemClasses =
    sidenavType === "dark"
      ? "tw-text-white hover:tw-bg-opacity-25 focus:tw-bg-opacity-100 active:tw-bg-opacity-10 hover:tw-text-white focus:tw-text-white active:tw-text-white"
      : "";
  const collapseHeaderClasses =
    "tw-border-b-0 !tw-p-3 tw-text-inherit hover:tw-text-inherit focus:tw-text-inherit active:tw-text-inherit";
  const activeRouteClasses = `${collapseItemClasses} ${COLORS[sidenavColor]} tw-text-white active:tw-text-white hover:tw-text-white focus:tw-text-white`;

  return (
    <Card
      ref={sidenavRef}
      color={
        sidenavType === "dark"
          ? "gray"
          : sidenavType === "transparent"
            ? "transparent"
            : "white"
      }
      shadow={sidenavType !== "transparent"}
      variant="gradient"
      className={`!tw-fixed tw-top-4 !tw-z-50 tw-h-[calc(100vh-2rem)]
        tw-w-full tw-shadow-blue-gray-900/5
        ${openSidenav ? "tw-left-4" : "-tw-left-72"}
        ${sidenavType === "transparent" ? "shadow-none" : "shadow-xl"}
        ${sidenavType === "dark" ? "!tw-text-white" : "tw-text-gray-900"}
        ${collapsed ? "tw-max-w-[4.5rem]" : "tw-max-w-[18rem]"}
        ${collapsed ? "tw-px-2 tw-py-4" : "tw-p-4"}
        tw-transition-all tw-duration-300 tw-ease-in-out xl:tw-left-4
        tw-overflow-y-auto tw-overflow-x-hidden`}
    >
      {/* ====== HEADER (logo + toggle) ====== */}
      <div className="tw-relative tw-mb-3 tw-flex tw-items-center tw-justify-between">

        {/* โลโก้: แสดงเฉพาะตอนขยาย */}
        {!collapsed && (
          <Link href="/" className="tw-flex tw-items-center tw-gap-1">
            <Typography variant="h2" className="tw-font-bold tw-ml-3 tw-mt-2">
              <span className="tw-text-yellow-500">i</span>
              <span className="tw-text-black">MPS</span>
            </Typography>
          </Link>
        )}

        {/* Desktop (xl↑): ปุ่มย่อ/ขยาย */}
        <div className="tw-hidden xl:tw-block">
          {collapsed ? (
            // ── สถานะ "ย่อเล็ก": แสดง 3 ขีด (ขยายกลับ) กลางบน
            <div className="tw-absolute tw-top-2 tw-inset-x-0 tw-flex tw-justify-center tw-z-20">
              <IconButton
                variant="text"
                onClick={() => setCollapsed(c => !c)}
                title="Expand"
                aria-label="Expand sidenav"
              >
                <Bars3Icon className="tw-h-8 tw-w-8" />
              </IconButton>
            </div>
          ) : (
            // ── สถานะ "ขยายปกติ": แสดง 2 ขีด (ย่อเล็ก) ขวาบน
            <IconButton
              variant="text"
              onClick={() => setCollapsed(c => !c)}
              title="Collapse to mini"
              aria-label="Collapse sidenav"
              className="!tw-ml-auto tw-absolute tw-top-2 tw-right-2 tw-z-20"
            >
              <Bars3CenterLeftIcon className="tw-h-7 tw-w-7" />
            </IconButton>
          )}
        </div>

        {/* Mobile (<xl): ปุ่ม X ปิดเมนู */}
        <IconButton
          ripple={false}
          size="sm"
          variant="text"
          className="!tw-absolute tw-top-2 tw-right-2 tw-block xl:tw-hidden tw-z-30"
          onClick={() => setOpenSidenav(dispatch, false)}
          title="Close"
          aria-label="Close sidenav"
        >
          <XMarkIcon className="tw-w-5 tw-h-5" />
        </IconButton>

      </div>


      {/* ====== MENU ====== */}
      <List className="tw-text-inherit">
        {routes.map(({ name, icon, pages, title, divider, external, path }: any, key: number) =>
          pages ? (
            <React.Fragment key={key}>
              {/* หมวดหัวข้อ: ไม่แสดงตอน collapsed */}
              {!collapsed && title && (
                <Typography
                  variant="small"
                  color="inherit"
                  className="tw-ml-2 tw-mt-4 tw-mb-1 tw-text-xs tw-font-bold tw-uppercase"
                >
                  {title}
                </Typography>
              )}

              <Accordion
                open={!collapsed && openCollapse === name}
                icon={
                  !collapsed ? (
                    <span className="tw-hidden xl:tw-inline">
                      <ChevronDownIcon
                        strokeWidth={2.5}
                        className={`tw-mx-auto tw-h-3 tw-w-3 tw-text-inherit tw-transition-transform ${openCollapse === name ? "tw-rotate-180" : ""
                          }`}
                      />
                    </span>
                  ) : null
                }
              >
                <ListItem
                  className={`!tw-overflow-hidden ${openCollapse === name && !collapsed
                    ? (sidenavType === "dark" ? "tw-bg-white/10" : "tw-bg-gray-200")
                    : ""
                    } ${collapseItemClasses} ${collapsed
                      ? "!tw-w-[3rem] !tw-h-11 tw-mx-auto !tw-p-0 tw-rounded-lg tw-flex tw-items-center tw-justify-center"
                      : "!tw-w-full !tw-p-0"
                    }`}
                  selected={!collapsed && openCollapse === name}
                >
                  <AccordionHeader
                    onClick={() => handleOpenCollapse(name)}
                    className={`${collapseHeaderClasses} ${collapsed ? "!tw-w-[3rem] !tw-h-11 !tw-p-0 tw-flex tw-items-center tw-justify-center" : ""} 
        max-xl:[&>svg]:tw-hidden max-xl:[&>i]:tw-hidden`}
                  >
                    <ListItemPrefix
                      className={`${collapsed
                        ? "!tw-m-0 !tw-w-[3rem] tw-grid tw-place-items-center"
                        : ""
                        }`}
                    >
                      <span className="tw-grid tw-place-items-center tw-h-6 tw-w-6">
                        {icon}
                      </span>
                    </ListItemPrefix>

                    {/* ชื่อเมนู: แสดงเฉพาะตอนขยาย */}
                    {!collapsed && (
                      <Typography color="inherit" className="tw-mr-auto tw-font-normal tw-capitalize">
                        {name}
                      </Typography>
                    )}
                  </AccordionHeader>
                </ListItem>


                {/* Sub menu: เฉพาะตอนขยาย */}
                {!collapsed && (
                  <AccordionBody className="!tw-py-1 tw-text-inherit">
                    <List className="!tw-p-0 tw-text-inherit">
                      {pages.map((page: any, idx: number) =>
                        page.pages ? (
                          <Accordion
                            key={idx}
                            open={openSubCollapse === page.name}
                            icon={
                              <span className="tw-hidden xl:tw-inline">
                                <ChevronDownIcon
                                  strokeWidth={2.5}
                                  className={`tw-mx-auto tw-h-3 tw-w-3 tw-text-inherit tw-transition-transform ${openSubCollapse === page.name ? "tw-rotate-180" : ""
                                    }`}
                                />
                              </span>
                            }

                          >
                            <ListItem
                              className={`!tw-p-0 ${openSubCollapse === page.name
                                ? sidenavType === "dark"
                                  ? "tw-bg-white/10"
                                  : "tw-bg-gray-200"
                                : ""
                                } ${collapseItemClasses}`}
                              selected={openSubCollapse === page.name}
                            >
                              <AccordionHeader
                                onClick={() => handleOpenSubCollapse(page.name)}
                                className={`${collapseHeaderClasses} max-xl:[&>svg]:tw-hidden max-xl:[&>i]:tw-hidden`}
                              >
                                <ListItemPrefix>{page.icon}</ListItemPrefix>
                                <Typography color="inherit" className="tw-mr-auto tw-font-normal tw-capitalize">
                                  {page.name}
                                </Typography>
                              </AccordionHeader>
                            </ListItem>

                            <AccordionBody className="!tw-py-1 tw-text-inherit">
                              <List className="!tw-p-0 tw-ext-inherit">
                                {page.pages.map((subPage: any, k: number) =>
                                  subPage.external ? (
                                    <a href={subPage.path} target="_blank" key={k}>
                                      <ListItem className="tw-capitalize">
                                        <ListItemPrefix>{subPage.icon}</ListItemPrefix>
                                        {subPage.name}
                                      </ListItem>
                                    </a>
                                  ) : (
                                    <Link href={`${subPage.path}`} key={k}>
                                      <ListItem
                                        className={`tw-capitalize ${pathname === `${subPage.path}` ? activeRouteClasses : collapseItemClasses
                                          }`}
                                      >
                                        <ListItemPrefix>{subPage.icon}</ListItemPrefix>
                                        {subPage.name}
                                      </ListItem>
                                    </Link>
                                  )
                                )}
                              </List>
                            </AccordionBody>
                          </Accordion>
                        ) : page.external ? (
                          <a key={idx} href={page.path} target="_blank">
                            <ListItem className="tw-capitalize">
                              <ListItemPrefix>{page.icon}</ListItemPrefix>
                              {page.name}
                            </ListItem>
                          </a>
                        ) : (
                          <Link href={page.path} key={idx}>
                            <ListItem
                              className={`tw-capitalize ${pathname === `${page.path}` ? activeRouteClasses : collapseItemClasses
                                }`}
                            >
                              <ListItemPrefix>{page.icon}</ListItemPrefix>
                              {page.name}
                            </ListItem>
                          </Link>
                        )
                      )}
                    </List>
                  </AccordionBody>
                )}
              </Accordion>

              {divider && <hr className="tw-my-2 tw-border-blue-gray-50" />}
            </React.Fragment>
          ) : (
            <List className="!tw-p-0 tw-text-inherit" key={key}>
              {external ? (
                <a key={key} href={path} target="_blank">
                  <ListItem
                    className={`tw-capitalize ${collapsed ? "!tw-justify-center" : ""}`}
                  >
                    <ListItemPrefix
                      className={`${collapsed ? "tw-w-full tw-flex tw-justify-center" : ""}`}
                    >
                      {icon}
                    </ListItemPrefix>
                    {!collapsed && name}
                  </ListItem>
                </a>
              ) : (
                <Link href={`${path}`} key={key}>
                  <ListItem
                    className={`tw-capitalize ${pathname === `${path}` ? activeRouteClasses : collapseItemClasses
                      } ${collapsed ? "!tw-justify-center" : ""}`}
                  >
                    <ListItemPrefix
                      className={`${collapsed ? "tw-w-full tw-flex tw-justify-center" : ""}`}
                    >
                      {icon}
                    </ListItemPrefix>
                    {!collapsed && name}
                  </ListItem>
                </Link>
              )}
            </List>
          )
        )}
      </List>
    </Card>
  );
}
