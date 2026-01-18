"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  Bars3Icon,
  HomeIcon,
  Bars3CenterLeftIcon,
  LanguageIcon,
  MapPinIcon,
  ChevronRightIcon,
  BellIcon,
} from "@heroicons/react/24/solid";

import {
  useMaterialTailwindController,
  setOpenSidenav,
} from "@/context";

// Custom Charger Box Icon
const ChargerBoxIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M18 10a1 1 0 0 1-1-1a1 1 0 0 1 1-1a1 1 0 0 1 1 1a1 1 0 0 1-1 1m-3 7v-5h1V7a2 2 0 0 0-2-2h-1V3h-2v2H9V3H7v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2h1v-1h-2m-2 0H6V7h8v10m2-5h1v2h2v-4a2 2 0 0 0-2-2h-1v4m-5-5l-3 4.5h2V17l3-4.5h-2V9Z" />
  </svg>
);

type Lang = "th" | "en";

// ===== Consistent Icon Button Component =====
const NavIconButton = ({
  onClick,
  title,
  children,
  className = "",
  badge,
}: {
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  badge?: number;
}) => (
  <button
    type="button"
    onClick={(e) => onClick?.(e)}
    title={title}
    className={`
      tw-relative
      tw-flex tw-items-center tw-justify-center
      tw-w-9 tw-h-9
      tw-bg-gray-900
      hover:tw-bg-gray-700
      tw-rounded-full
      tw-shadow-sm
      tw-transition-all tw-duration-200
      active:tw-scale-95
      ${className}
    `}
  >
    {children}
    {badge !== undefined && badge > 0 && (
      <span className="
        tw-absolute tw--top-1 tw--right-1
        tw-flex tw-items-center tw-justify-center
        tw-min-w-[18px] tw-h-[18px]
        tw-bg-red-500 tw-text-white
        tw-text-[10px] tw-font-bold
        tw-rounded-full
        tw-border-2 tw-border-white
      ">
        {badge > 99 ? "99+" : badge}
      </span>
    )}
  </button>
);

export function DashboardNavbar() {
  const [controller, dispatch] = useMaterialTailwindController();
  const { fixedNavbar, openSidenav } = controller;

  const pathname = usePathname();
  const router = useRouter();

  const isStationsPage = pathname.startsWith("/dashboard/stations");

  const HIDE_TOPBAR = ["/pages", "/mainpages"];
  const hideTopbar = HIDE_TOPBAR.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isAuthPage = pathname.startsWith("/auth");

  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    const token = localStorage.getItem("access_token") || localStorage.getItem("accessToken") || "";
    if (token) {
      try {
        const payload = token.split(".")[1];
        const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
        const claims = JSON.parse(json);
        setUserRole(claims.role || "user");
      } catch {
        setUserRole("user");
      }
    }
  }, []);

  // tooltip
  const [showStationTooltip, setShowStationTooltip] = useState(false);

  // Title
  const segs = pathname.split("/").filter(Boolean);
  let title = segs[segs.length - 1]?.replace(/-/g, " ");
  if (segs[1] === "mdb") title = "Main Distribution Board (MDB)";
  else if (segs[1] === "chargers") title = "My Charger Station";
  else if (segs[1] === "device") title = "Device";
  else if (segs[1] === "setting") title = "Configuration";
  else if (segs[1] === "ai") title = "Ai Module";
  else if (segs[2] === "settings") title = "My Profile";
  else if (segs[1] === "pm-report") title = "PM Report";
  else if (segs[1] === "input_PMreport") title = "Add PM Report";
  else if (segs[1] === "cm-report") title = "CM Report";
  else if (segs[1] === "cbm") title = "Condition-base";
  else if (segs[1] === "stations") title = "Stations";

  // ===== Language State =====
  const [lang, setLang] = useState<Lang>("th");

  // ===== Notification State =====
  const [notificationCount, setNotificationCount] = useState<number>(0);

  useEffect(() => {
    const savedLang = localStorage.getItem("app_language") as Lang | null;
    if (savedLang === "th" || savedLang === "en") {
      setLang(savedLang);
    }
  }, []);

  const toggleLanguage = () => {
    const newLang: Lang = lang === "th" ? "en" : "th";
    setLang(newLang);
    localStorage.setItem("app_language", newLang);
    window.dispatchEvent(new CustomEvent("language:change", { detail: { lang: newLang } }));
  };

  // ===== Selected Station/Charger from localStorage =====
  const [selectedSN, setSelectedSN] = useState<string>("");
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [selectedStationName, setSelectedStationName] = useState<string>("");
  const [selectedChargerNo, setSelectedChargerNo] = useState<string>("");

  const hasChargerSelected = !!selectedSN;

  // useEffect สำหรับปิด tooltip เมื่อกดที่อื่น
  useEffect(() => {
    const handleClickOutside = () => setShowStationTooltip(false);
    if (showStationTooltip) {
      document.addEventListener("click", handleClickOutside);
      const timer = setTimeout(() => setShowStationTooltip(false), 3000);
      return () => {
        document.removeEventListener("click", handleClickOutside);
        clearTimeout(timer);
      };
    }
  }, [showStationTooltip]);

  // ===== Load selection function =====
  const loadSelection = useCallback(() => {
    const sn = localStorage.getItem("selected_sn") ?? "";
    const stationId = localStorage.getItem("selected_station_id") ?? "";
    const stationName = localStorage.getItem("selected_station_name") ?? stationId;
    const chargerNo = localStorage.getItem("selected_charger_no") ?? "";

    setSelectedSN(prev => prev !== sn ? sn : prev);
    setSelectedStationId(prev => prev !== stationId ? stationId : prev);
    setSelectedStationName(prev => prev !== stationName ? stationName : prev);
    setSelectedChargerNo(prev => prev !== chargerNo ? chargerNo : prev);
  }, []);

  // ===== Initial load =====
  useEffect(() => {
    if (isAuthPage) return;
    loadSelection();
  }, [isAuthPage, loadSelection]);

  // ===== Listen for selection changes =====
  useEffect(() => {
    const handleChargerEvent = () => {
      requestAnimationFrame(loadSelection);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "selected_sn" ||
        e.key === "selected_station_id" ||
        e.key === "selected_station_name" ||
        e.key === "selected_charger_no") {
        requestAnimationFrame(loadSelection);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("charger:selected", handleChargerEvent);
    window.addEventListener("charger:deselected", handleChargerEvent);
    window.addEventListener("station:selected", handleChargerEvent);

    const interval = setInterval(loadSelection, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("charger:selected", handleChargerEvent);
      window.removeEventListener("charger:deselected", handleChargerEvent);
      window.removeEventListener("station:selected", handleChargerEvent);
      clearInterval(interval);
    };
  }, [loadSelection]);

  // ===== Listen for localStorage changes within same tab =====
  useEffect(() => {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key: string, value: string) => {
      originalSetItem(key, value);

      if (key === "selected_sn" ||
        key === "selected_station_id" ||
        key === "selected_station_name" ||
        key === "selected_charger_no") {
        window.dispatchEvent(new CustomEvent("localStorageChange", {
          detail: { key, value }
        }));
      }
    };

    const handleLocalStorageChange = () => {
      requestAnimationFrame(loadSelection);
    };

    window.addEventListener("localStorageChange", handleLocalStorageChange);

    return () => {
      localStorage.setItem = originalSetItem;
      window.removeEventListener("localStorageChange", handleLocalStorageChange);
    };
  }, [loadSelection]);

  const t = {
    currentStation: lang === "th" ? "สถานี" : "Station",
    currentCharger: lang === "th" ? "ตู้ชาร์จ" : "Charger",
    goToStations: lang === "th" ? "เลือกตู้ชาร์จ" : "Select Charger",
    notifications: lang === "th" ? "การแจ้งเตือน" : "Notifications",
  };

  return (
    <div
      className={`
        tw-rounded-2xl tw-transition-all tw-duration-300 tw-w-full
        ${fixedNavbar
          ? "tw-sticky tw-top-4 tw-z-40 tw-backdrop-blur-xl tw-bg-white/80 tw-shadow-lg tw-shadow-gray-200/50 tw-border tw-border-gray-100"
          : "tw-bg-transparent"
        }
      `}
    >
      <div className="tw-px-4 sm:tw-px-6 tw-py-4">
        {/* ===== Single Row Layout ===== */}
        <div className="tw-flex tw-items-center tw-justify-between tw-gap-4">

          {/* Left: Title & Breadcrumbs */}
          <div className="tw-min-w-0 tw-flex-shrink-0">
            {!hideTopbar && (
              <>
                {/* Breadcrumbs - Hidden on mobile */}
                <div className="tw-hidden sm:tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-gray-400 tw-mb-1">
                  <Link href="/" className="hover:tw-text-gray-600 tw-transition-colors">
                    <HomeIcon className="tw-h-3.5 tw-w-3.5" />
                  </Link>
                  {segs.slice(0, -1).map((seg, i) => (
                    <React.Fragment key={i}>
                      <ChevronRightIcon className="tw-h-3 tw-w-3 tw-text-gray-300" />
                      <span className="tw-hidden lg:tw-inline hover:tw-text-gray-600 tw-transition-colors tw-cursor-default">
                        {seg.replace(/-/g, " ")}
                      </span>
                    </React.Fragment>
                  ))}
                  <ChevronRightIcon className="tw-h-3 tw-w-3 tw-text-gray-300" />
                  <span className="tw-text-gray-500 tw-truncate">{title}</span>
                </div>

                {/* Title */}
                <h1 className="tw-text-lg sm:tw-text-xl lg:tw-text-2xl tw-font-bold tw-text-gray-900 tw-tracking-tight tw-truncate tw-capitalize">
                  {title}
                </h1>
              </>
            )}
          </div>

          {/* Right: Station/Charger Info + Language + Menu */}
          <div className="tw-flex tw-items-center tw-gap-2 sm:tw-gap-3 tw-flex-shrink-0">

            {/* ===== Station & Charger Pills ===== */}
            {!isStationsPage && (
              <>
                {hasChargerSelected ? (
                  <>
                    {/* Desktop: Full Pills */}
                    <div className="tw-hidden sm:tw-flex tw-items-center tw-gap-2">
                      {/* Station Pill */}
                      <div className="
                        tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-1.5
                        tw-bg-gray-900
                        tw-rounded-full
                        tw-shadow-sm
                      ">
                        <MapPinIcon className="tw-h-4 tw-w-4 tw-text-white" />
                        <span className="tw-text-xs tw-font-medium tw-text-white tw-max-w-[100px] lg:tw-max-w-[150px] tw-truncate">
                          {selectedStationName || selectedStationId}
                        </span>
                      </div>

                      {/* Charger Pill */}
                      <div className="
                        tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-1.5
                        tw-bg-gray-900
                        tw-rounded-full
                        tw-shadow-sm
                      ">
                        <ChargerBoxIcon className="tw-h-4 tw-w-4 tw-text-white" />
                        <span className="tw-text-xs tw-font-medium tw-text-white tw-max-w-[80px] lg:tw-max-w-[120px] tw-truncate">
                          {selectedChargerNo ? `#${selectedChargerNo}` : ""} {selectedSN}
                        </span>
                      </div>
                    </div>

                    {/* Mobile: Consistent Icon Buttons with Tap Tooltip */}
                    <div className="tw-relative tw-flex sm:tw-hidden tw-items-center tw-gap-2">
                      <NavIconButton
                        onClick={(e) => {
                          e?.stopPropagation();
                          setShowStationTooltip(!showStationTooltip);
                        }}
                        title={t.currentStation}
                      >
                        <MapPinIcon className="tw-h-4 tw-w-4 tw-text-white" />
                      </NavIconButton>

                      <NavIconButton
                        onClick={(e) => {
                          e?.stopPropagation();
                          setShowStationTooltip(!showStationTooltip);
                        }}
                        title={t.currentCharger}
                      >
                        <ChargerBoxIcon className="tw-h-4 tw-w-4 tw-text-white" />
                      </NavIconButton>

                      {/* Tooltip Popup */}
                      {showStationTooltip && (
                        <div
                          className="
                            tw-absolute tw-top-full tw-right-0 tw-mt-2 tw-z-50
                            tw-bg-white tw-rounded-xl tw-shadow-xl tw-shadow-gray-200/50
                            tw-border tw-border-gray-100
                            tw-p-3 tw-min-w-[200px]
                            tw-animate-in tw-fade-in tw-slide-in-from-top-2 tw-duration-200
                          "
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Arrow */}
                          <div className="tw-absolute tw--top-2 tw-right-6 tw-w-4 tw-h-4 tw-bg-white tw-border-l tw-border-t tw-border-gray-100 tw-rotate-45" />

                          {/* Station Info */}
                          <div className="tw-flex tw-items-center tw-gap-3 tw-mb-3 tw-pb-3 tw-border-b tw-border-gray-100">
                            <div className="tw-p-2 tw-bg-gray-900 tw-rounded-lg">
                              <MapPinIcon className="tw-h-4 tw-w-4 tw-text-white" />
                            </div>
                            <div className="tw-min-w-0 tw-flex-1">
                              <p className="tw-text-[10px] tw-font-medium tw-text-gray-400 tw-uppercase tw-tracking-wider">
                                {t.currentStation}
                              </p>
                              <p className="tw-font-medium tw-text-gray-800 tw-text-sm tw-truncate">
                                {selectedStationName || selectedStationId}
                              </p>
                            </div>
                          </div>

                          {/* Charger Info */}
                          <div className="tw-flex tw-items-center tw-gap-3">
                            <div className="tw-p-2 tw-bg-gray-900 tw-rounded-lg">
                              <ChargerBoxIcon className="tw-h-4 tw-w-4 tw-text-white" />
                            </div>
                            <div className="tw-min-w-0 tw-flex-1">
                              <p className="tw-text-[10px] tw-font-medium tw-text-gray-400 tw-uppercase tw-tracking-wider">
                                {t.currentCharger}
                              </p>
                              <p className="tw-font-medium tw-text-gray-800 tw-text-sm tw-truncate">
                                {selectedChargerNo ? `${lang === "th" ? "ตู้" : "Box"} ${selectedChargerNo} • ` : ""}
                                {selectedSN}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* No charger selected */
                  <button
                    onClick={() => router.push("/dashboard/stations")}
                    className="
                      tw-flex tw-items-center tw-gap-2
                      tw-px-3 tw-py-1.5 tw-rounded-full
                      tw-bg-gray-900
                      hover:tw-bg-gray-800
                      tw-transition-all tw-duration-200
                      active:tw-scale-95
                    "
                  >
                    <ChargerBoxIcon className="tw-h-4 tw-w-4 tw-text-white" />
                    <span className="tw-text-xs tw-font-medium tw-text-white tw-hidden sm:tw-inline">
                      {t.goToStations}
                    </span>
                  </button>
                )}
              </>
            )}

            {/* Divider - Only show when has selection */}
            {!isStationsPage && hasChargerSelected && (
              <div className="tw-hidden sm:tw-block tw-w-px tw-h-8 tw-bg-gray-200" />
            )}

            {/* Notification Bell - Consistent Style */}
            {userRole !== "technician" && (
              <NavIconButton
                onClick={() => router.push("/dashboard/notifications")}
                title={t.notifications}
                badge={notificationCount}
              >
                <BellIcon className="tw-h-4 tw-w-4 tw-text-white" />
              </NavIconButton>
            )}

            {/* Language Toggle - Consistent Style */}
            <NavIconButton
              onClick={toggleLanguage}
              title={lang === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
            >
              <span className="tw-text-xs tw-font-bold tw-text-white">
                {lang === "th" ? "TH" : "EN"}
              </span>
            </NavIconButton>

            {/* Menu Toggle */}
            <button
              onClick={() => setOpenSidenav(dispatch, !openSidenav)}
              className="
                xl:tw-hidden
                tw-p-2 tw-rounded-full
                tw-bg-white hover:tw-bg-gray-50
                tw-border tw-border-gray-200
                tw-text-gray-600
                tw-shadow-sm
                tw-transition-all tw-duration-200
                active:tw-scale-95
              "
            >
              {openSidenav ? (
                <Bars3Icon className="tw-h-5 tw-w-5" />
              ) : (
                <Bars3CenterLeftIcon className="tw-h-5 tw-w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardNavbar;