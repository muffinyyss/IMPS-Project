"use client";
import { jwtDecode } from "jwt-decode";
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Bars3Icon,
  HomeIcon,
  Bars3CenterLeftIcon,
  LanguageIcon,
  MapPinIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
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
    <path d="M18 10a1 1 0 0 1-1-1a1 1 0 0 1 1-1a1 1 0 0 1 1 1a1 1 0 0 1-1 1m-3 7v-5h1V7a2 2 0 0 0-2-2h-1V3h-2v2H9V3H7v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2h1v-1h-2m-2 0H6V7h8v10m2-5h1v2h2v-4a2 2 0 0 0-2-2h-1v4m-5-5l-3 4.5h2V17l3-4.5h-2V9Z"/>
  </svg>
);

type Station = { station_id: string; station_name: string };
type Charger = {
  id: string;
  chargeBoxID: string;
  SN: string;
  chargerNo?: number;
  status?: boolean;
};
type StationInfo = {
  station_id: string;
  station_name: string;
  SN?: string;
  WO?: string;
  model?: string;
  status?: boolean;
};

type Lang = "th" | "en";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function DashboardNavbar() {
  const [controller, dispatch] = useMaterialTailwindController();
  const { fixedNavbar, openSidenav } = controller;

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const view = searchParams.get("view") ?? "";
  const tab = searchParams.get("tab") ?? "";
  const isFormView = view === "form";

  const isChargerTab = tab === "charger";
  const isPmReportPage = pathname.startsWith("/dashboard/pm-report");
  const isStationsPage = pathname.startsWith("/dashboard/stations");

  const HIDE_TOPBAR = ["/pages", "/mainpages"];
  const hideTopbar = HIDE_TOPBAR.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isAuthPage = pathname.startsWith("/auth");

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

  const lockStationDropdown = isPmReportPage && isFormView;
  const hideChargerDropdown = isPmReportPage && !isChargerTab;

  // ===== Language State =====
  const [lang, setLang] = useState<Lang>("th");

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

  // ===== User Role State =====
  const [userRole, setUserRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const isAdmin = userRole === "admin";

  // ===== Admin: Selected Station/Charger from localStorage =====
  const [adminSelectedSN, setAdminSelectedSN] = useState<string>("");
  const [adminSelectedStationId, setAdminSelectedStationId] = useState<string>("");
  const [adminSelectedStationName, setAdminSelectedStationName] = useState<string>("");
  const [adminSelectedChargerNo, setAdminSelectedChargerNo] = useState<string>("");

  const adminHasChargerSelected = !!adminSelectedSN;

  // ===== Non-Admin: Station/Charger Dropdown State =====
  const [query, setQuery] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [searching, setSearching] = useState(false);
  const [stationInfo, setStationInfo] = useState<StationInfo | null>(null);

  const [chargerQuery, setChargerQuery] = useState("");
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [chargerOpen, setChargerOpen] = useState(false);
  const [chargerActive, setChargerActive] = useState(-1);
  const [selectedCharger, setSelectedCharger] = useState<Charger | null>(null);
  const chargerContainerRef = useRef<HTMLDivElement>(null);
  const [loadingChargers, setLoadingChargers] = useState(false);

  const initialStationRestoreRef = useRef(false);
  const initialChargerRestoreRef = useRef(false);

  const formatChargerDisplay = (c: Charger): string => {
    const chargerNo = c.chargerNo ? String(c.chargerNo) : c.chargeBoxID || "?";
    return lang === "th" ? `ตู้ที่ ${chargerNo} - ${c.SN}` : `Box ${chargerNo} - ${c.SN}`;
  };

  // useEffect สำหรับปิด tooltip เมื่อกดที่อื่น
  useEffect(() => {
    const handleClickOutside = () => setShowStationTooltip(false);
    if (showStationTooltip) {
      document.addEventListener("click", handleClickOutside);
      // Auto close after 3 seconds
      const timer = setTimeout(() => setShowStationTooltip(false), 3000);
      return () => {
        document.removeEventListener("click", handleClickOutside);
        clearTimeout(timer);
      };
    }
  }, [showStationTooltip]);

  // ===== FIXED: Load admin selection function with useCallback =====
  const loadAdminSelection = useCallback(() => {
    const sn = localStorage.getItem("selected_sn") ?? "";
    const stationId = localStorage.getItem("selected_station_id") ?? "";
    const stationName = localStorage.getItem("selected_station_name") ?? stationId;
    const chargerNo = localStorage.getItem("selected_charger_no") ?? "";
    
    // Only update if values changed to prevent unnecessary re-renders
    setAdminSelectedSN(prev => prev !== sn ? sn : prev);
    setAdminSelectedStationId(prev => prev !== stationId ? stationId : prev);
    setAdminSelectedStationName(prev => prev !== stationName ? stationName : prev);
    setAdminSelectedChargerNo(prev => prev !== chargerNo ? chargerNo : prev);
  }, []);

  // ===== FIXED: Combined JWT decode and initial admin load =====
  useEffect(() => {
    if (isAuthPage) return;
    try {
      const token = localStorage.getItem("access_token") ?? "";
      if (!token) return;
      const decoded: any = jwtDecode(token);
      const role = decoded?.role ?? "";
      setUserRole(role);
      setUserId(decoded?.user_id ?? "");
      
      // If admin, immediately load selection
      if (role === "admin") {
        loadAdminSelection();
      }
    } catch (e) {
      console.warn("[JWT] decode failed", e);
    }
  }, [isAuthPage, loadAdminSelection]);

  // ===== FIXED: Admin selection listener with proper cleanup =====
  useEffect(() => {
    if (!isAdmin) return;
    
    // Load immediately when becoming admin
    loadAdminSelection();
    
    // Custom event handler
    const handleChargerEvent = () => {
      // Use requestAnimationFrame for smoother updates
      requestAnimationFrame(loadAdminSelection);
    };
    
    // Storage event handler (for cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "selected_sn" || 
          e.key === "selected_station_id" || 
          e.key === "selected_station_name" || 
          e.key === "selected_charger_no") {
        requestAnimationFrame(loadAdminSelection);
      }
    };
    
    // Add event listeners
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("charger:selected", handleChargerEvent);
    window.addEventListener("charger:deselected", handleChargerEvent);
    window.addEventListener("station:selected", handleChargerEvent);
    
    // Use interval as fallback, but less frequently
    const interval = setInterval(loadAdminSelection, 1000);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("charger:selected", handleChargerEvent);
      window.removeEventListener("charger:deselected", handleChargerEvent);
      window.removeEventListener("station:selected", handleChargerEvent);
      clearInterval(interval);
    };
  }, [isAdmin, loadAdminSelection]);

  // ===== FIXED: Listen for localStorage changes within same tab =====
  useEffect(() => {
    if (!isAdmin) return;
    
    // Override localStorage.setItem to detect changes in same tab
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key: string, value: string) => {
      originalSetItem(key, value);
      
      if (key === "selected_sn" || 
          key === "selected_station_id" || 
          key === "selected_station_name" || 
          key === "selected_charger_no") {
        // Dispatch custom event for same-tab updates
        window.dispatchEvent(new CustomEvent("localStorageChange", { 
          detail: { key, value } 
        }));
      }
    };
    
    const handleLocalStorageChange = () => {
      requestAnimationFrame(loadAdminSelection);
    };
    
    window.addEventListener("localStorageChange", handleLocalStorageChange);
    
    return () => {
      localStorage.setItem = originalSetItem;
      window.removeEventListener("localStorageChange", handleLocalStorageChange);
    };
  }, [isAdmin, loadAdminSelection]);

  useEffect(() => {
    if (isAuthPage || isAdmin) return;
    (async () => {
      try {
        const token = localStorage.getItem("access_token") ?? "";
        if (!token) return;
        try {
          const decoded: any = jwtDecode(token);
          const nowSec = Math.floor(Date.now() / 1000);
          if (decoded?.exp && decoded.exp <= nowSec) {
            localStorage.removeItem("access_token");
            return;
          }
        } catch (e) {
          localStorage.removeItem("access_token");
          return;
        }
        let res = await fetch(`${API_BASE}/my-stations/detail`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          localStorage.removeItem("access_token");
          return;
        }
        if (res.status === 404) {
          res = await fetch(`${API_BASE}/my-stations`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        if (!res.ok) {
          setStations([]);
          return;
        }
        const data = await res.json();
        let list: Station[] = [];
        if (Array.isArray(data?.stations) && data.stations.length && typeof data.stations[0] === "object") {
          list = data.stations as Station[];
        } else if (Array.isArray(data?.stations)) {
          list = data.stations.map((id: string) => ({ station_id: id, station_name: id }));
        }
        setStations(list);
        if (list.length === 1) {
          setSelectedStation(list[0]);
          setQuery(list[0].station_name);
          localStorage.setItem("selected_station_id", list[0].station_id);
          localStorage.setItem("selected_station_name", list[0].station_name);
        } else {
          const sid = localStorage.getItem("selected_station_id");
          if (sid) {
            const found = list.find((s) => s.station_id === sid);
            if (found) {
              setSelectedStation(found);
              setQuery(found.station_name);
            }
          }
        }
      } catch (err) {
        setStations([]);
      }
    })();
  }, [isAuthPage, isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    if (!selectedStation) {
      setChargers([]);
      setSelectedCharger(null);
      setChargerQuery("");
      return;
    }
    (async () => {
      setLoadingChargers(true);
      try {
        const token = localStorage.getItem("access_token") ?? "";
        if (!token) return;
        const res = await fetch(`${API_BASE}/chargers/${selectedStation.station_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setChargers([]);
          return;
        }
        const data = await res.json();
        const list: Charger[] = Array.isArray(data?.chargers)
          ? data.chargers.map((c: any) => ({
            id: c.id,
            chargeBoxID: c.chargeBoxID,
            SN: c.SN || c.sn || "",
            chargerNo: c.chargerNo || "",
            status: c.status,
          }))
          : [];
        setChargers(list);
        if (list.length === 1) {
          setSelectedCharger(list[0]);
          setChargerQuery(formatChargerDisplay(list[0]));
          localStorage.setItem("selected_sn", list[0].SN);
        } else {
          const sn = localStorage.getItem("selected_sn");
          if (sn) {
            const found = list.find((c) => c.SN === sn);
            if (found) {
              setSelectedCharger(found);
              setChargerQuery(formatChargerDisplay(found));
            } else {
              setSelectedCharger(null);
              setChargerQuery("");
              localStorage.removeItem("selected_sn");
            }
          }
        }
      } catch (err) {
        setChargers([]);
      } finally {
        setLoadingChargers(false);
      }
    })();
  }, [selectedStation, isAdmin]);

  useEffect(() => {
    if (selectedCharger) {
      setChargerQuery(formatChargerDisplay(selectedCharger));
    }
  }, [lang, selectedCharger]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (s) => s.station_name.toLowerCase().includes(q) || s.station_id.toLowerCase().includes(q)
    );
  }, [stations, query]);

  const filteredChargers = useMemo(() => {
    const q = chargerQuery.trim().toLowerCase();
    if (!q) return chargers;
    return chargers.filter(
      (c) => c.chargeBoxID.toLowerCase().includes(q) ||
        c.SN.toLowerCase().includes(q) ||
        (c.chargerNo && String(c.chargerNo).toLowerCase().includes(q))
    );
  }, [chargers, chargerQuery]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!chargerContainerRef.current?.contains(e.target as Node)) {
        setChargerOpen(false);
        setChargerActive(-1);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const choose = (s: Station) => {
    setSelectedStation(s);
    setQuery(s.station_name);
    setOpen(false);
    localStorage.setItem("selected_station_id", s.station_id);
    localStorage.setItem("selected_station_name", s.station_name);
    setSelectedCharger(null);
    setChargerQuery("");
    localStorage.removeItem("selected_sn");
  };

  const chooseCharger = (c: Charger) => {
    setSelectedCharger(c);
    setChargerQuery(formatChargerDisplay(c));
    setChargerOpen(false);
    localStorage.setItem("selected_sn", c.SN);
  };

  const onSearch = async () => {
    if (!selectedStation) { setOpen(true); return; }
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("station_id", selectedStation.station_id);
    if (isChargerTab && selectedCharger && selectedCharger.SN) {
      params.set("sn", selectedCharger.SN);
      params.delete("charger_id");
      params.delete("chargeBoxID");
    } else {
      params.delete("sn");
      params.delete("charger_id");
      params.delete("chargeBoxID");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    await handleSearchClick();
  };

  const handleSearchClick = async () => {
    if (!selectedStation) { setOpen(true); return; }
    setSearching(true);
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return;
      const url = `${API_BASE}/station/info?station_id=${encodeURIComponent(selectedStation.station_id)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { localStorage.removeItem("access_token"); return; }
      if (res.status === 403) { return; }
      if (!res.ok) { return; }
      const data = await res.json();
      setStationInfo(data.station ?? data);
      window.dispatchEvent(new CustomEvent("station:info", {
        detail: {
          station: selectedStation,
          info: data.station ?? data,
          charger: selectedCharger,
          sn: selectedCharger?.SN,
        },
      }));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (isAdmin) return;
    if (initialStationRestoreRef.current || stations.length === 0) return;
    const sid = searchParams.get("station_id");
    if (sid) {
      const found = stations.find(s => s.station_id === sid);
      if (found) {
        setSelectedStation(found);
        setQuery(found.station_name);
      }
    }
    initialStationRestoreRef.current = true;
  }, [stations, searchParams, isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    if (initialChargerRestoreRef.current || chargers.length === 0) return;
    const sn = searchParams.get("sn");
    if (sn) {
      const foundCharger = chargers.find(c => c.SN === sn);
      if (foundCharger) {
        setSelectedCharger(foundCharger);
        setChargerQuery(formatChargerDisplay(foundCharger));
        localStorage.setItem("selected_sn", sn);
      }
    }
    initialChargerRestoreRef.current = true;
  }, [chargers, searchParams, isAdmin]);

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((p) => Math.min(p + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && active < filtered.length) choose(filtered[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const onChargerKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!chargerOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      setChargerOpen(true);
      return;
    }
    if (!chargerOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setChargerActive((p) => Math.min(p + 1, filteredChargers.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setChargerActive((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (chargerActive >= 0 && chargerActive < filteredChargers.length) chooseCharger(filteredChargers[chargerActive]);
    } else if (e.key === "Escape") {
      setChargerOpen(false);
      setChargerActive(-1);
    }
  };

  const t = {
    searchStation: lang === "th" ? "ค้นหาสถานี" : "Search station",
    selectCharger: lang === "th" ? "เลือกตู้ชาร์จ" : "Select Charger",
    loading: lang === "th" ? "กำลังโหลด..." : "Loading...",
    selectStationFirst: lang === "th" ? "เลือกสถานีก่อน" : "Select station first",
    noChargersFound: lang === "th" ? "ไม่พบตู้ชาร์จ" : "No chargers found",
    searchCharger: lang === "th" ? "ค้นหาตู้ชาร์จ" : "Search charger",
    noStationsFound: lang === "th" ? "ไม่พบสถานี" : "No stations found",
    noChargersInStation: lang === "th" ? "ไม่มีตู้ชาร์จในสถานีนี้" : "No chargers in this station",
    search: lang === "th" ? "ค้นหา" : "Search",
    currentStation: lang === "th" ? "สถานี" : "Station",
    currentCharger: lang === "th" ? "ตู้ชาร์จ" : "Charger",
    pleaseSelectCharger: lang === "th" ? "กรุณาเลือกตู้ชาร์จ" : "Please select charger",
    goToStations: lang === "th" ? "เลือกตู้ชาร์จ" : "Select Charger",
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

            {/* ===== ADMIN: Station & Charger Pills ===== */}
            {isAdmin && !isStationsPage && (
              <>
                {adminHasChargerSelected ? (
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
                        <div className="tw-p-1.5 tw-bg-white/20 tw-rounded-lg">
                          <MapPinIcon className="tw-h-3 tw-w-3 tw-text-white" />
                        </div>
                        <span className="tw-text-xs tw-font-medium tw-text-white tw-max-w-[100px] lg:tw-max-w-[150px] tw-truncate">
                          {adminSelectedStationName || adminSelectedStationId}
                        </span>
                      </div>

                      {/* Charger Pill */}
                      <div className="
            tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-1.5
            tw-bg-gray-900
            tw-border tw-border-gray-900
            tw-rounded-full
            tw-shadow-sm
          ">
                        <div className="tw-p-1.5 tw-bg-white/20 tw-rounded-lg">
                          <ChargerBoxIcon className="tw-h-3 tw-w-3 tw-text-white" />
                        </div>
                        <span className="tw-text-xs tw-font-medium tw-text-white tw-max-w-[80px] lg:tw-max-w-[120px] tw-truncate">
                          {adminSelectedChargerNo ? `#${adminSelectedChargerNo}` : ""} {adminSelectedSN}
                        </span>
                      </div>
                    </div>

                    {/* Mobile: Icons with Tap Tooltip */}
                    <div className="tw-relative tw-flex sm:tw-hidden tw-items-center tw-gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowStationTooltip(!showStationTooltip);
                        }}
                        className="
              tw-flex tw-items-center tw-gap-1
              tw-p-2 tw-rounded-lg
              tw-bg-gray-900
              active:tw-scale-95 tw-transition-transform
            "
                      >
                        <MapPinIcon className="tw-h-4 tw-w-4 tw-text-white" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowStationTooltip(!showStationTooltip);
                        }}
                        className="
              tw-p-2 tw-rounded-lg
              tw-bg-gray-900
              active:tw-scale-95 tw-transition-transform
            "
                      >
                        <ChargerBoxIcon className="tw-h-4 tw-w-4 tw-text-white" />
                      </button>

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
                                {adminSelectedStationName || adminSelectedStationId}
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
                                {adminSelectedChargerNo ? `${lang === "th" ? "ตู้" : "Box"} ${adminSelectedChargerNo} • ` : ""}
                                {adminSelectedSN}
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

            {/* Divider - Only show when admin has selection */}
            {isAdmin && !isStationsPage && adminHasChargerSelected && (
              <div className="tw-hidden sm:tw-block tw-w-px tw-h-8 tw-bg-gray-200" />
            )}

            {/* Language Toggle */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="
                tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-1.5
                tw-bg-gray-900
                hover:tw-bg-gray-700
                tw-rounded-full
                tw-shadow-sm
                tw-transition-all tw-duration-200
                active:tw-scale-95
              "
              title={lang === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
            >
              <div className="tw-p-1.5 tw-bg-white/20 tw-rounded-lg">
                <LanguageIcon className="tw-h-3 tw-w-3 tw-text-white" />
              </div>
              <span className="tw-text-xs tw-font-medium tw-text-white">
                {lang === "th" ? "TH" : "EN"}
              </span>
            </button>

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

        {/* ===== Row 2: NON-ADMIN Dropdowns (if needed) ===== */}
        {!isAdmin && (
          <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-stretch sm:tw-items-center tw-gap-2 sm:tw-gap-3 tw-mt-4">
            {/* Station Dropdown */}
            <div ref={containerRef} className="tw-relative tw-flex-1 sm:tw-max-w-[280px]">
              <div className="tw-relative">
                <MapPinIcon className="tw-absolute tw-left-3.5 tw-top-1/2 tw--translate-y-1/2 tw-h-4 tw-w-4 tw-text-gray-400 tw-pointer-events-none tw-z-10" />
                <input
                  type="text"
                  placeholder={t.searchStation}
                  className="
                    tw-w-full tw-pl-10 tw-pr-4 tw-py-2.5
                    tw-bg-white tw-border tw-border-gray-200
                    tw-rounded-xl tw-text-sm tw-text-gray-800
                    tw-placeholder-gray-400
                    tw-shadow-sm
                    focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-gray-200 focus:tw-border-gray-300
                    tw-transition-all tw-duration-200
                    disabled:tw-bg-gray-50 disabled:tw-cursor-not-allowed
                  "
                  value={query}
                  onChange={(e) => {
                    if (lockStationDropdown) return;
                    setQuery(e.target.value);
                    setOpen(true);
                  }}
                  onFocus={() => {
                    if (lockStationDropdown) return;
                    setOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (lockStationDropdown) return;
                    onKeyDown(e);
                  }}
                  disabled={lockStationDropdown}
                />
              </div>

              {open && !lockStationDropdown && (
                <div
                  className="
                    tw-absolute tw-z-50 tw-top-full tw-left-0 tw-right-0 tw-mt-2
                    tw-bg-white tw-border tw-border-gray-100
                    tw-rounded-xl tw-shadow-xl tw-shadow-gray-200/50
                    tw-max-h-64 tw-overflow-auto
                  "
                  role="listbox"
                  onMouseLeave={() => setActive(-1)}
                >
                  {filtered.length > 0 ? (
                    filtered.map((item, idx) => (
                      <button
                        type="button"
                        key={item.station_id}
                        role="option"
                        className={`
                          tw-w-full tw-text-left tw-px-4 tw-py-2.5
                          tw-flex tw-items-center tw-gap-3
                          tw-transition-colors tw-duration-150
                          ${idx === active ? "tw-bg-gray-50" : "hover:tw-bg-gray-50"}
                          ${idx !== filtered.length - 1 ? "tw-border-b tw-border-gray-50" : ""}
                        `}
                        onMouseEnter={() => setActive(idx)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(item)}
                      >
                        <div className="tw-p-1.5 tw-bg-gray-800 tw-rounded-lg">
                          <MapPinIcon className="tw-h-3 tw-w-3 tw-text-white" />
                        </div>
                        <div className="tw-min-w-0 tw-flex-1">
                          <p className="tw-font-medium tw-text-gray-800 tw-truncate tw-text-sm">
                            {item.station_name}
                          </p>
                          <p className="tw-text-xs tw-text-gray-400 tw-truncate">
                            {item.station_id}
                          </p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="tw-px-4 tw-py-6 tw-text-center tw-text-gray-400 tw-text-sm">
                      {t.noStationsFound}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Charger Dropdown */}
            {!hideChargerDropdown && (
              <div ref={chargerContainerRef} className="tw-relative tw-flex-1 sm:tw-max-w-[280px]">
                <div className="tw-relative">
                  <ChargerBoxIcon className="tw-absolute tw-left-3.5 tw-top-1/2 tw--translate-y-1/2 tw-h-4 tw-w-4 tw-text-gray-400 tw-pointer-events-none tw-z-10" />
                  <input
                    type="text"
                    placeholder={
                      loadingChargers
                        ? t.loading
                        : !selectedStation
                          ? t.selectStationFirst
                          : chargers.length === 0
                            ? t.noChargersFound
                            : t.searchCharger
                    }
                    className="
                      tw-w-full tw-pl-10 tw-pr-4 tw-py-2.5
                      tw-bg-white tw-border tw-border-gray-200
                      tw-rounded-xl tw-text-sm tw-text-gray-800
                      tw-placeholder-gray-400
                      tw-shadow-sm
                      focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-gray-200 focus:tw-border-gray-300
                      tw-transition-all tw-duration-200
                      disabled:tw-bg-gray-50 disabled:tw-cursor-not-allowed
                    "
                    value={chargerQuery}
                    onChange={(e) => {
                      if (lockStationDropdown || !selectedStation) return;
                      setChargerQuery(e.target.value);
                      setChargerOpen(true);
                    }}
                    onFocus={() => {
                      if (lockStationDropdown || !selectedStation) return;
                      setChargerOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (lockStationDropdown || !selectedStation) return;
                      onChargerKeyDown(e);
                    }}
                    disabled={lockStationDropdown || !selectedStation || loadingChargers}
                  />
                </div>

                {chargerOpen && !lockStationDropdown && selectedStation && (
                  <div
                    className="
                      tw-absolute tw-z-50 tw-top-full tw-left-0 tw-right-0 tw-mt-2
                      tw-bg-white tw-border tw-border-gray-100
                      tw-rounded-xl tw-shadow-xl tw-shadow-gray-200/50
                      tw-max-h-64 tw-overflow-auto
                    "
                    role="listbox"
                    onMouseLeave={() => setChargerActive(-1)}
                  >
                    {filteredChargers.length > 0 ? (
                      filteredChargers.map((item, idx) => (
                        <button
                          type="button"
                          key={item.id}
                          role="option"
                          className={`
                            tw-w-full tw-text-left tw-px-4 tw-py-2.5
                            tw-flex tw-items-center tw-justify-between tw-gap-3
                            tw-transition-colors tw-duration-150
                            ${idx === chargerActive ? "tw-bg-gray-50" : "hover:tw-bg-gray-50"}
                            ${idx !== filteredChargers.length - 1 ? "tw-border-b tw-border-gray-50" : ""}
                          `}
                          onMouseEnter={() => setChargerActive(idx)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => chooseCharger(item)}
                        >
                          <div className="tw-flex tw-items-center tw-gap-3 tw-min-w-0">
                            <div className="tw-p-1.5 tw-bg-gray-900 tw-rounded-lg">
                              <ChargerBoxIcon className="tw-h-3 tw-w-3 tw-text-white" />
                            </div>
                            <span className="tw-font-medium tw-text-gray-800 tw-truncate tw-text-sm">
                              {formatChargerDisplay(item)}
                            </span>
                          </div>
                          <span className={`
                            tw-flex-shrink-0 tw-h-2.5 tw-w-2.5 tw-rounded-full
                            tw-ring-2 tw-ring-offset-1
                            ${item.status
                              ? "tw-bg-emerald-500 tw-ring-emerald-200"
                              : "tw-bg-red-500 tw-ring-red-200"
                            }
                          `} />
                        </button>
                      ))
                    ) : (
                      <div className="tw-px-4 tw-py-6 tw-text-center tw-text-gray-400 tw-text-sm">
                        {chargers.length === 0 ? t.noChargersInStation : t.noChargersFound}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Search Button */}
            <button
              onClick={onSearch}
              disabled={lockStationDropdown}
              className="
                tw-px-4 tw-py-2.5 tw-rounded-xl
                tw-bg-gray-900
                hover:tw-bg-gray-800
                tw-text-white tw-font-medium tw-text-sm
                tw-shadow-sm
                tw-transition-all tw-duration-200
                active:tw-scale-95
                disabled:tw-opacity-50 disabled:tw-cursor-not-allowed
                tw-flex tw-items-center tw-justify-center tw-gap-2
                tw-w-full sm:tw-w-auto
              "
              title={lockStationDropdown ? "Selection locked on this page" : ""}
            >
              <MagnifyingGlassIcon className="tw-h-4 tw-w-4" />
              {t.search}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardNavbar;