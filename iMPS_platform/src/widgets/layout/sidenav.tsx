/* eslint-disable @next/next/no-img-element */

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { createPortal } from "react-dom";

/* ---------- Styles / Const ---------- */
const COLORS: Record<string, string> = {
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

type RouteItem = {
  name?: string;
  path?: string;
  icon?: React.ReactNode;
  external?: boolean;
  pages?: RouteItem[];
  title?: string;
  divider?: boolean;
};

type PropTypes = {
  brandImg?: string;
  brandName?: string;
  routes?: RouteItem[];
};

/* ---------- Helpers ---------- */
const toKey = (v: string) => String(v || "").toLowerCase();
const safeHref = (v?: string) => (v && v.length > 0 ? v : "#");
const SKIP_MINI = new Set(["my profile", "logout"]); // ชื่อที่ไม่ต้องแสดงในคอลัมน์ไอคอนตอนย่อ

export default function Sidenav({ }: PropTypes) {
  const router = useRouter();
  const pathname = usePathname();
  const [controller, dispatch] = useMaterialTailwindController();
  const { sidenavType, sidenavColor, openSidenav } = controller as any;

  const [collapsed, setCollapsed] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const miniMode = collapsed && isDesktop;

  // flyout ของไอคอนผู้ใช้ (แสดงนอก Card)
  const [flyoutOpen, setFlyoutOpen] = React.useState(false);
  const [flyoutHold, setFlyoutHold] = React.useState(false);
  const [flyoutPos, setFlyoutPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const userBtnRef = React.useRef<HTMLButtonElement | null>(null);

  const [openCollapse, setOpenCollapse] = React.useState<string | null>(null);
  const [openSubCollapse, setOpenSubCollapse] = React.useState<string | null>(null);

  const sidenavRef = React.useRef<HTMLDivElement | null>(null);
  useOnClickOutside(sidenavRef, () => setOpenSidenav(dispatch, false));

  // React.useEffect(() => {
  //   document.documentElement.style.setProperty("--sidenav-w", miniMode ? "4.5rem" : "18rem");
  // }, [miniMode]);

  // // ใน Sidenav (ตรง useEffect ที่ตั้ง --sidenav-w)
  // React.useEffect(() => {
  //   document.documentElement.style.setProperty(
  //     "--sidenav-w",
  //     miniMode ? "4.5rem" : "20rem"   // 20rem = ml-80 เดิม
  //   );
  //   // ช่องไฟระหว่าง sidenav กับ content
  //   document.documentElement.style.setProperty(
  //     "--sidenav-gap",
  //     miniMode ? "0.75rem" : "1rem"   // ย่อ = 12px, ขยาย = 16px
  //   );
  // }, [miniMode]);

  // เดิมคุณมี useEffect ตั้ง --sidenav-w กับ --sidenav-gap อยู่แล้ว
  React.useEffect(() => {
    // ความกว้างจริงของ sidenav (แล้วแต่คุณจะใช้)
    document.documentElement.style.setProperty(
      "--sidenav-w",
      miniMode ? "4.5rem" : "20rem"
    );

    // ช่องไฟระหว่าง sidenav กับ content
    document.documentElement.style.setProperty(
      "--sidenav-gap",
      miniMode ? "0.75rem" : "1rem"
    );

    // >>> ค่า margin-left ของ content ที่ต้องการ
    // เปิดเต็ม = 20rem (tw-ml-80), ย่อ = 15rem (tw-ml-60)
    document.documentElement.style.setProperty(
      "--content-ml",
      miniMode ? "7rem" : "20rem"
    );
  }, [miniMode]);



  const collapseItemClasses =
    sidenavType === "dark"
      ? "tw-text-white hover:tw-bg-opacity-25 focus:tw-bg-opacity-100 active:tw-bg-opacity-10 hover:tw-text-white focus:tw-text-white active:tw-text-white"
      : "";
  const activeRouteClasses = `${collapseItemClasses} ${COLORS[sidenavColor]} tw-text-white active:tw-text-white hover:tw-text-white focus:tw-text-white`;
  const collapseHeaderClasses =
    "tw-border-b-0 !tw-p-3 tw-text-inherit hover:tw-text-inherit focus:tw-text-inherit active:tw-text-inherit";

  const handleOpenCollapse = (value: string) => !miniMode && setOpenCollapse((cur) => (cur === value ? null : value));
  const handleOpenSubCollapse = (value: string) =>
    !miniMode && setOpenSubCollapse((cur) => (cur === value ? null : value));

  /* ---------- หา My profile / logout จาก routes (case-insensitive) ---------- */
  const findByName = React.useCallback((list: RouteItem[] = [], name: string): RouteItem | undefined => {
    const target = toKey(name);
    for (const it of list) {
      if (toKey(it.name || "") === target) return it;
      if (Array.isArray(it.pages)) {
        const f = findByName(it.pages, name);
        if (f) return f;
      }
    }
    return undefined;
  }, []);

  const profileRoute = React.useMemo(() => findByName(routes as any, "My profile"), [findByName]);
  const logoutRoute = React.useMemo(() => findByName(routes as any, "logout"), [findByName]);

  /* ---------- Mini icon item ---------- */
  const MiniItem = ({
    href,
    icon,
    active,
    external,
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
        className={`tw-block tw-w-[3.5rem] tw-h-11 tw-mx-auto tw-rounded-lg tw-flex tw-items-center tw-justify-center ${active ? `${COLORS[sidenavColor]} tw-text-white` : "hover:tw-bg-gray-200"
          }`}
      >
        <span className="tw-h-6 tw-w-6 tw-grid tw-place-items-center">{icon}</span>
      </Wrapper>
    );
  };

  /* ---------- render mini icons (ข้าม profile/logout) ---------- */
  const buildMiniItem = (item: RouteItem, key: string) => (
    <MiniItem
      key={key}
      href={safeHref(item.path)}
      icon={item.icon as React.ReactNode}
      title={item.name}
      active={pathname === item.path}
      external={item.external}
    />
  );

  const renderMiniTree = (node?: RouteItem, keyPrefix = ""): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    if (!node) return out;
    if (SKIP_MINI.has(toKey(node.name || ""))) return out;

    if (node.path) out.push(buildMiniItem(node, `${keyPrefix}-self`));

    if (Array.isArray(node.pages)) {
      node.pages.forEach((child, idx) => {
        if (SKIP_MINI.has(toKey(child.name || ""))) return;
        if (Array.isArray(child.pages) && child.pages.length > 0) {
          out.push(...renderMiniTree(child, `${keyPrefix}-c${idx}`));
        } else if (child.path) {
          out.push(buildMiniItem(child, `${keyPrefix}-c${idx}`));
        }
      });
    }
    return out;
  };

  /* ---------- flyout handlers ---------- */
  const openUserFlyout = () => {
    const el = userBtnRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setFlyoutPos({ top: r.top, left: r.right + 8 });
    }
    setFlyoutOpen(true);
  };
  const closeUserFlyoutSoon = () => setTimeout(() => !flyoutHold && setFlyoutOpen(false), 120);

  return (
    <Card
      ref={sidenavRef}
      color={sidenavType === "dark" ? "gray" : sidenavType === "transparent" ? "transparent" : "white"}
      shadow={sidenavType !== "transparent"}
      variant="gradient"
      className={`!tw-fixed tw-top-4 !tw-z-50 tw-h-[calc(100vh-2rem)] tw-shadow-blue-gray-900/5 tw-relative ${openSidenav ? "tw-left-4" : "-tw-left-72"
        } xl:tw-left-4 ${sidenavType === "transparent" ? "shadow-none" : "shadow-xl"} ${sidenavType === "dark" ? "!tw-text-white" : "tw-text-gray-900"
        } ${miniMode ? "tw-w-[4.5rem] tw-px-0 tw-py-4" : "tw-w-[18rem] tw-p-4"} tw-transition-all tw-duration-300 tw-ease-in-out tw-overflow-y-auto`}
    >
      {/* Header */}
      <div
        className={`tw-sticky tw-top-0 tw-z-30 tw-mb-3 tw-flex tw-items-center ${miniMode ? "tw-justify-center" : "tw-justify-between"}`}
      >
        {!miniMode && (
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

      {/* Body */}
      {miniMode ? (
        <div className="tw-space-y-2">
          {/* user icon (hover -> flyout นอก card) */}
          <div className="tw-flex tw-justify-center">
            <button
              ref={userBtnRef}
              type="button"
              title="Account"
              className="tw-w-[3.5rem] tw-h-11 tw-rounded-lg tw-flex tw-items-center tw-justify-center hover:tw-bg-gray-200"
              onMouseEnter={openUserFlyout}
              onMouseLeave={closeUserFlyoutSoon}
            >
              <UserCircleIcon className="tw-h-6 tw-w-6" />
            </button>
          </div>

          {/* mini menu icons */}
          {(routes as RouteItem[]).flatMap((r, i) => renderMiniTree(r, `r${i}`))}

          {/* flyout (render to body) */}
          {flyoutOpen &&
            createPortal(
              <div
                style={{ position: "fixed", top: flyoutPos.top, left: flyoutPos.left }}
                className="tw-z-[9999] tw-pointer-events-auto"
                onMouseEnter={() => setFlyoutHold(true)}
                onMouseLeave={() => {
                  setFlyoutHold(false);
                  setFlyoutOpen(false);
                }}
              >
                <div className="tw-bg-white tw-border tw-rounded-xl tw-shadow-lg tw-w-44 tw-overflow-hidden">
                  <button
                    type="button"
                    className="tw-w-full tw-text-left tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2 hover:tw-bg-gray-100"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      router.push(safeHref(profileRoute?.path) || "/");
                      setFlyoutOpen(false);
                    }}
                  >
                    <span className="tw-inline-flex tw-items-center tw-justify-center tw-w-5">
                      {profileRoute?.icon ?? <i className="fa fa-user" />}
                    </span>
                    <span>{profileRoute?.name ?? "My profile"}</span>
                  </button>

                  <button
                    type="button"
                    className="tw-w-full tw-text-left tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2 hover:tw-bg-gray-100"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      router.push(safeHref(logoutRoute?.path) || "/auth/signin/basic");
                      setFlyoutOpen(false);
                    }}
                  >
                    <span className="tw-inline-flex tw-items-center tw-justify-center tw-w-5">
                      {logoutRoute?.icon ?? <i className="fa fa-sign-out" />}
                    </span>
                    <span>{logoutRoute?.name ?? "logout"}</span>
                  </button>
                </div>
              </div>,
              document.body
            )}
        </div>
      ) : (
        <List className="tw-text-inherit">
          {(routes as RouteItem[]).map(({ name, icon, pages, title, divider, external, path }, key) =>
            pages ? (
              <React.Fragment key={key}>
                {title && (
                  <Typography
                    variant="small"
                    color="inherit"
                    className="tw-ml-2 tw-mt-4 tw-mb-1 tw-text-xs tw-font-bold tw-uppercase"
                  >
                    {title}
                  </Typography>
                )}

                <Accordion
                  open={openCollapse === name}
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
                      onClick={() => handleOpenCollapse(name || "")}
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
                      {pages.map((page, idx) =>
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
                                onClick={() => handleOpenSubCollapse(page.name || "")}
                                className={`${collapseHeaderClasses} max-xl:[&>svg]:tw-hidden max-xl:[&>i]:tw-hidden`}
                              >
                                <ListItemPrefix>{page.icon}</ListItemPrefix>
                                <Typography color="inherit" className="tw-mr-auto tw-font-normal tw-capitalize">
                                  {page.name}
                                </Typography>
                              </AccordionHeader>
                            </ListItem>

                            <AccordionBody className="!tw-py-1 tw-text-inherit">
                              <List className="!tw-p-0 tw-text-inherit">
                                {page.pages.map((subPage, k) =>
                                  subPage.external ? (
                                    <a key={k} href={safeHref(subPage.path)} target="_blank" rel="noreferrer">
                                      <ListItem className="tw-capitalize">
                                        <ListItemPrefix>{subPage.icon}</ListItemPrefix>
                                        {subPage.name}
                                      </ListItem>
                                    </a>
                                  ) : (
                                    <Link key={k} href={safeHref(subPage.path)}>
                                      <ListItem
                                        className={`tw-capitalize ${pathname === subPage.path ? activeRouteClasses : collapseItemClasses
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
                          <a key={idx} href={safeHref(page.path)} target="_blank" rel="noreferrer">
                            <ListItem className="tw-capitalize">
                              <ListItemPrefix>{page.icon}</ListItemPrefix>
                              {page.name}
                            </ListItem>
                          </a>
                        ) : (
                          <Link key={idx} href={safeHref(page.path)}>
                            <ListItem
                              className={`tw-capitalize ${pathname === page.path ? activeRouteClasses : collapseItemClasses
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
                  <a href={safeHref(path)} target="_blank" rel="noreferrer">
                    <ListItem className="tw-capitalize">
                      <ListItemPrefix>{icon}</ListItemPrefix>
                      {name}
                    </ListItem>
                  </a>
                ) : (
                  <Link href={safeHref(path)}>
                    <ListItem
                      className={`tw-capitalize ${pathname === path ? activeRouteClasses : collapseItemClasses
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
