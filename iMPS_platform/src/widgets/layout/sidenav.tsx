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
  Bars3Icon,
  Bars3CenterLeftIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

import { useOnClickOutside, useMediaQuery } from "usehooks-ts";
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

export default function Sidenav({ }: PropTypes) {
  const pathname = usePathname();
  const [controller, dispatch] = useMaterialTailwindController();
  const { sidenavType, sidenavColor, openSidenav }: any = controller;

  const [collapsed, setCollapsed] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const miniMode = collapsed && isDesktop;

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

  React.useEffect(() => {
    document.documentElement.style.setProperty("--sidenav-w", miniMode ? "4.5rem" : "18rem");
  }, [miniMode]);

  // ===== helper: แสดงปุ่มไอคอนสี่เหลี่ยมแบบ mini =====
  const MiniItem = ({
    href,
    icon,
    active = false,
    external = false,
    title,
  }: {
    href: string;
    icon: React.ReactNode;
    active?: boolean;
    external?: boolean;
    title?: string;
  }) => {
    const Wrapper: any = external ? "a" : Link;
    return (
      <Wrapper
        href={href}
        target={external ? "_blank" : undefined}
        title={title}
        className={`
          tw-block tw-w-[3.5rem] tw-h-11 tw-mx-auto tw-rounded-lg
          tw-flex tw-items-center tw-justify-center
          ${active ? COLORS[sidenavColor] + " tw-text-white" : "hover:tw-bg-gray-200"}
        `}
      >
        {/* ขนาดไอคอนให้เห็นชัด */}
        <span className="tw-h-6 tw-w-6 tw-grid tw-place-items-center">{icon}</span>
      </Wrapper>
    );
  };

  // ป้องกัน href ว่างเวลาใช้ <Link>
  const safeHref = (v?: string) => (typeof v === "string" && v.length > 0 ? v : "#");

  // ใช้สร้าง MiniItem จาก node ใด ๆ ที่มี path
  const buildMiniItem = (item: any, key: string) => (
    <MiniItem
      key={key}
      href={safeHref(item.path)}
      icon={item.icon}
      title={item.name}
      active={pathname === item.path}
      external={item.external}
    />
  );

  // ไล่ tree ของ routes เพื่อดึงทุกระดับออกมาเป็นไอคอน (parent/child/grandchild)
  const renderMiniTree = (node: any, keyPrefix = ""): React.ReactNode[] => {
    const out: React.ReactNode[] = [];

    // 1) ถ้า node เองมี path แสดงปุ่มให้ node นั้น (เช่น group ที่คลิกได้)
    if (node?.path) out.push(buildMiniItem(node, `${keyPrefix}-self`));

    // 2) ถ้ามี children ไล่ต่อ
    if (Array.isArray(node?.pages)) {
      node.pages.forEach((child: any, idx: number) => {
        const k = `${keyPrefix}-c${idx}`;

        // leaf
        if (!Array.isArray(child?.pages) || child.pages.length === 0) {
          if (child?.path) out.push(buildMiniItem(child, k));
          return;
        }

        // group ซ้อน: แสดงของตัวเอง (ถ้ามี path) และลูกทั้งหมด
        out.push(...renderMiniTree(child, k));
      });
    }

    return out;
  };


  return (
    <Card
      ref={sidenavRef}
      color={sidenavType === "dark" ? "gray" : sidenavType === "transparent" ? "transparent" : "white"}
      shadow={sidenavType !== "transparent"}
      variant="gradient"
      className={`
        !tw-fixed tw-top-4 !tw-z-50 tw-h-[calc(100vh-2rem)] tw-shadow-blue-gray-900/5 tw-relative
        ${openSidenav ? "tw-left-4" : "-tw-left-72"} xl:tw-left-4
        ${sidenavType === "transparent" ? "shadow-none" : "shadow-xl"}
        ${sidenavType === "dark" ? "!tw-text-white" : "tw-text-gray-900"}
        ${miniMode ? "tw-w-[4.5rem]" : "tw-w-[18rem]"}
        ${miniMode ? "tw-px-0 tw-py-4" : "tw-p-4"}
        tw-transition-all tw-duration-300 tw-ease-in-out
        tw-overflow-y-auto
      `}
    >
      {/* ===== HEADER (logo + toggle) ===== */}
      <div
        className={`
          tw-sticky tw-top-0 tw-z-30 tw-mb-3 tw-flex tw-items-center
          ${collapsed ? "tw-justify-center" : "tw-justify-between"}
        `}
      >
        {!collapsed && (
          <Link href="/" className="tw-flex tw-items-center tw-gap-1">
            <Typography variant="h2" className="tw-font-bold tw-ml-3 tw-mt-2">
              <span className="tw-text-yellow-500">i</span>
              <span className="tw-text-black">MPS</span>
            </Typography>
          </Link>
        )}

        <div className="tw-hidden xl:tw-flex tw-items-center">
          <IconButton
            variant="text"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand" : "Collapse to mini"}
            aria-label={collapsed ? "Expand sidenav" : "Collapse sidenav"}
            className={`${collapsed ? "" : "!tw-ml-auto"}`}
          >
            {collapsed ? <Bars3Icon className="tw-h-8 tw-w-8" /> : <Bars3CenterLeftIcon className="tw-h-7 tw-w-7" />}
          </IconButton>
        </div>

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

      {/* ===== MENU ===== */}
      {/** ===================== MINI MODE (icons only) ===================== */}
      {collapsed ? (
        <div className="tw-space-y-2">
          {/* {routes.map((r: any, i: number) => {
            // ถ้าเป็น group (มี pages) ให้แสดงไอคอนของ group นั้นเป็นปุ่ม
            if (r.pages) {
              return (
                <MiniItem
                  key={`g-${i}`}
                  href={r.path || "#"}
                  icon={r.icon}
                  title={r.name}
                  active={pathname === r.path}
                  external={r.external}
                />
              );
            }
            // รายการเดี่ยว
            return (
              <MiniItem
                key={`s-${i}`}
                href={r.path}
                icon={r.icon}
                title={r.name}
                active={pathname === r.path}
                external={r.external}
              />
            );
          })} */}
          {routes.flatMap((r: any, i: number) => renderMiniTree(r, `r${i}`))}
        </div>
      ) : (
        /** ===================== FULL MODE (ของเดิม) ===================== */
        <List className="tw-text-inherit">
          {routes.map(({ name, icon, pages, title, divider, external, path }: any, key: number) =>
            pages ? (
              <React.Fragment key={key}>
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
                    <span className="tw-hidden xl:tw-inline">
                      <ChevronDownIcon
                        strokeWidth={2.5}
                        className={`tw-mx-auto tw-h-3 tw-w-3 tw-text-inherit tw-transition-transform ${openCollapse === name ? "tw-rotate-180" : ""
                          }`}
                      />
                    </span>
                  }
                >
                  <ListItem
                    className={`!tw-overflow-hidden ${openCollapse === name ? (sidenavType === "dark" ? "tw-bg-white/10" : "tw-bg-gray-200") : ""
                      } ${collapseItemClasses} !tw-w-full !tw-p-0`}
                    selected={openCollapse === name}
                  >
                    <AccordionHeader
                      onClick={() => handleOpenCollapse(name)}
                      className={`${collapseHeaderClasses} tw-min-w-0 max-xl:[&>svg]:tw-hidden max-xl:[&>i]:tw-hidden`}
                    >
                      <ListItemPrefix>
                        <span className="tw-grid tw-place-items-center tw-h-6 tw-w-6">{icon}</span>
                      </ListItemPrefix>
                      <Typography color="inherit" className="tw-mr-auto tw-font-normal tw-capitalize tw-truncate">
                        {name}
                      </Typography>
                    </AccordionHeader>
                  </ListItem>

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
                </Accordion>

                {divider && <hr className="tw-my-2 tw-border-blue-gray-50" />}
              </React.Fragment>
            ) : (
              <List className="!tw-p-0 tw-text-inherit" key={key}>
                {external ? (
                  <a key={key} href={path} target="_blank">
                    <ListItem className={`tw-capitalize`}>
                      <ListItemPrefix>{icon}</ListItemPrefix>
                      {name}
                    </ListItem>
                  </a>
                ) : (
                  <Link href={`${path}`} key={key}>
                    <ListItem
                      className={`tw-capitalize ${pathname === `${path}` ? activeRouteClasses : collapseItemClasses
                        }`}
                    >
                      <ListItemPrefix>{icon}</ListItemPrefix>
                      {name}
                    </ListItem>
                  </Link>
                )}
              </List>
            )
          )}
        </List>
      )}
    </Card>
  );
}
