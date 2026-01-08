"use client";
import { jwtDecode } from "jwt-decode";
import React, { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Navbar, Typography, IconButton, Breadcrumbs, Input, Button,
} from "@material-tailwind/react";

import {
  UserCircleIcon,
  Cog6ToothIcon,
  BellIcon,
  Bars3Icon,
  HomeIcon,
  Bars3CenterLeftIcon,
  EnvelopeIcon,
  MicrophoneIcon,
  ShoppingCartIcon,
  BoltIcon,
  LanguageIcon,
  ArrowLeftIcon,
  UserIcon,
  MapPinIcon,
} from "@heroicons/react/24/solid";

// @context
import {
  useMaterialTailwindController,
  setOpenConfigurator,
  setOpenSidenav,
} from "@/context";

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

  // Check if current tab requires charger selection
  const isChargerTab = tab === "charger";
  const isMdbTab = tab === "mdb";
  const isPmReportPage = pathname.startsWith("/dashboard/pm-report");
  const isStationsPage = pathname.startsWith("/dashboard/stations");

  // Hide topbar on some pages
  const HIDE_TOPBAR = ["/pages", "/mainpages"];
  const hideTopbar = HIDE_TOPBAR.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isAuthPage = pathname.startsWith("/auth");

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

  // Lock station dropdown when in form view (any tab)
  const lockStationDropdown = isPmReportPage && isFormView;

  // Hide charger dropdown on PM Report page when tab is NOT "charger"
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

  // Helper function to format charger display text
  const formatChargerDisplay = (c: Charger): string => {
    const chargerNo = c.chargerNo ? String(c.chargerNo) : c.chargeBoxID || "?";
    return lang === "th" ? `ตู้ที่ ${chargerNo} - ${c.SN}` : `Box ${chargerNo} - ${c.SN}`;
  };

  // ===== Fetch User Role from JWT =====
  useEffect(() => {
    if (isAuthPage) return;
    try {
      const token = localStorage.getItem("access_token") ?? "";
      if (!token) return;
      const decoded: any = jwtDecode(token);
      setUserRole(decoded?.role ?? "");
      setUserId(decoded?.user_id ?? "");
    } catch (e) {
      console.warn("[JWT] decode failed", e);
    }
  }, [isAuthPage]);

  // ===== Admin: Load selected station/charger from localStorage =====
  useEffect(() => {
    if (!isAdmin) return;

    const loadAdminSelection = () => {
      const sn = localStorage.getItem("selected_sn") ?? "";
      const stationId = localStorage.getItem("selected_station_id") ?? "";
      const stationName = localStorage.getItem("selected_station_name") ?? stationId;
      const chargerNo = localStorage.getItem("selected_charger_no") ?? "";

      setAdminSelectedSN(sn);
      setAdminSelectedStationId(stationId);
      setAdminSelectedStationName(stationName);
      setAdminSelectedChargerNo(chargerNo);
    };

    loadAdminSelection();

    // Listen for changes
    window.addEventListener("storage", loadAdminSelection);
    window.addEventListener("charger:selected", loadAdminSelection);
    window.addEventListener("charger:deselected", loadAdminSelection);

    const interval = setInterval(loadAdminSelection, 500);

    return () => {
      window.removeEventListener("storage", loadAdminSelection);
      window.removeEventListener("charger:selected", loadAdminSelection);
      window.removeEventListener("charger:deselected", loadAdminSelection);
      clearInterval(interval);
    };
  }, [isAdmin]);

  // ===== Non-Admin: Load user's stations =====
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

  // ===== Non-Admin: Load Chargers when Station is selected =====
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

  // Update charger display when language changes
  useEffect(() => {
    if (selectedCharger) {
      setChargerQuery(formatChargerDisplay(selectedCharger));
    }
  }, [lang, selectedCharger]);

  // filter stations
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (s) => s.station_name.toLowerCase().includes(q) || s.station_id.toLowerCase().includes(q)
    );
  }, [stations, query]);

  // filter chargers
  const filteredChargers = useMemo(() => {
    const q = chargerQuery.trim().toLowerCase();
    if (!q) return chargers;
    return chargers.filter(
      (c) => c.chargeBoxID.toLowerCase().includes(q) ||
        c.SN.toLowerCase().includes(q) ||
        (c.chargerNo && String(c.chargerNo).toLowerCase().includes(q))
    );
  }, [chargers, chargerQuery]);

  // click outside -> close station dropdown
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

  // click outside -> close charger dropdown
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

  // choose station (non-admin)
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

  // choose charger (non-admin)
  const chooseCharger = (c: Charger) => {
    setSelectedCharger(c);
    setChargerQuery(formatChargerDisplay(c));
    setChargerOpen(false);
    localStorage.setItem("selected_sn", c.SN);
  };

  // ===== Admin: Back to Stations =====
  const handleBackToStations = () => {
    localStorage.removeItem("selected_sn");
    localStorage.removeItem("selected_charger_no");
    window.dispatchEvent(new CustomEvent("charger:deselected"));
    router.push("/dashboard/stations");
  };

  // onSearch (non-admin)
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

  // Restore from URL (non-admin)
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

  // keyboard nav for station
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

  // keyboard nav for charger
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

  // Localized text
  const t = {
    searchStation: lang === "th" ? "ค้นหาสถานี" : "Search station",
    selectCharger: lang === "th" ? "เลือกตู้ชาร์จ" : "Select Charger",
    loading: lang === "th" ? "กำลังโหลด..." : "Loading...",
    selectStationFirst: lang === "th" ? "เลือกสถานีก่อน" : "Select station first",
    noChargersFound: lang === "th" ? "ไม่พบตู้ชาร์จ" : "No chargers found",
    searchCharger: lang === "th" ? "ค้นหาตู้ชาร์จ" : "Search charger",
    noStationsFound: lang === "th" ? "ไม่พบสถานี" : "No stations found",
    noChargersInStation: lang === "th" ? "ไม่มีตู้ชาร์จในสถานีนี้" : "No chargers in this station",
    search: lang === "th" ? "ค้นหา" : "SEARCH",
    // backToStations: lang === "th" ? "กลับไปเลือกสถานี" : "Back to Stations",
    currentStation: lang === "th" ? "สถานี:" : "Station:",
    currentCharger: lang === "th" ? "ตู้ชาร์จ:" : "Charger:",
    pleaseSelectCharger: lang === "th" ? "กรุณาเลือกตู้ชาร์จที่หน้า Stations" : "Please select a charger from Stations page",
  };

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
          {!hideTopbar && (
            <Breadcrumbs
              className={`tw-bg-transparent !tw-p-0 tw-transition-all ${fixedNavbar ? "tw-mt-1" : ""}`}
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
          {!hideTopbar && (
            <Typography variant="h6" color="blue-gray">
              {title}
            </Typography>
          )}
        </div>

        {/* ===== Dropdown/Info Section ===== */}
        <div className="tw-mb-3 tw-flex tw-flex-col lg:tw-flex-row lg:tw-items-end tw-gap-3">

          {/* ===== ADMIN: Show info box or nothing (no dropdown) ===== */}
          {isAdmin && !isStationsPage && (
            <>
              {adminHasChargerSelected ? (
                /* Admin has charger selected - show info box + back button */
                <div className="tw-flex tw-items-center tw-gap-3">
                  {/* <Button
                    variant="outlined"
                    size="sm"
                    onClick={handleBackToStations}
                    className="tw-flex tw-items-center tw-gap-2 tw-border-blue-gray-200 tw-text-blue-gray-700 tw-normal-case"
                  >
                    <ArrowLeftIcon className="tw-h-4 tw-w-4" />
                    {t.backToStations}
                  </Button> */}

                  {/* Current Station & Charger Info */}
                  <div className="tw-flex tw-items-center tw-gap-4 tw-px-4 tw-py-2 tw-bg-blue-gray-50 tw-rounded-lg tw-border tw-border-blue-gray-100">
                    <div className="tw-flex tw-items-center tw-gap-2">
                      <i className="fa fa-map-marker-alt tw-text-blue-gray-500" />
                      <span className="tw-text-xs tw-text-blue-gray-500">{t.currentStation}</span>
                      <span className="tw-font-medium tw-text-blue-gray-800">{adminSelectedStationName || adminSelectedStationId}</span>
                    </div>
                    <div className="tw-w-px tw-h-5 tw-bg-blue-gray-200" />
                    <div className="tw-flex tw-items-center tw-gap-2">
                      <i className="fa fa-charging-station tw-text-amber-500" />
                      <span className="tw-text-xs tw-text-blue-gray-500">{t.currentCharger}</span>
                      <span className="tw-font-medium tw-text-blue-gray-800">
                        {adminSelectedChargerNo ? `${lang === "th" ? "ตู้ที่" : "Box"} ${adminSelectedChargerNo} - ` : ""}
                        {adminSelectedSN}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Admin has NO charger selected - show message */
                <div className="tw-flex tw-items-center tw-gap-3">
                  <div className="tw-px-4 tw-py-2 tw-bg-amber-50 tw-rounded-lg tw-border tw-border-amber-200">
                    <span className="tw-text-sm tw-text-amber-700">{t.pleaseSelectCharger}</span>
                  </div>
                  <Button
                    variant="filled"
                    size="sm"
                    onClick={() => router.push("/dashboard/stations")}
                    className="tw-bg-amber-500 hover:tw-bg-amber-600 tw-normal-case"
                  >
                    {lang === "th" ? "ไปหน้า Stations" : "Go to Stations"}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ===== NON-ADMIN: Show dropdowns ===== */}
          {!isAdmin && (
            <>
              {/* Station Dropdown */}
              <div ref={containerRef} className="tw-relative tw-flex tw-flex-col">
                <Input
                  size="lg"
                  label={t.searchStation}
                  type="text"
                  placeholder={t.searchStation}
                  className="tw-min-w-[200px] tw-border tw-p-2 tw-rounded tw-text-black"
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
                  crossOrigin=""
                  disabled={lockStationDropdown}
                />

                {open && !lockStationDropdown && (
                  <div
                    className="tw-absolute tw-z-50 tw-top-[100%] tw-left-0 tw-right-0 tw-mt-1 tw-bg-white tw-border tw-rounded-lg tw-shadow-lg tw-max-h-64 tw-overflow-auto tw-text-black"
                    role="listbox"
                    onMouseLeave={() => setActive(-1)}
                  >
                    {filtered.length > 0 ? (
                      filtered.map((item, idx) => (
                        <button
                          type="button"
                          key={item.station_id}
                          role="option"
                          className={`tw-w-full tw-text-left tw-px-3 tw-py-2 hover:tw-bg-blue-gray-50 focus:tw-bg-blue-gray-50 tw-flex tw-items-center tw-justify-between ${idx === active ? "tw-bg-blue-gray-50" : ""}`}
                          onMouseEnter={() => setActive(idx)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => choose(item)}
                        >
                          <span className="tw-flex tw-flex-col">
                            <span className="tw-font-medium">{item.station_name}</span>
                            <span className="tw-text-xs tw-text-blue-gray-400">{item.station_id}</span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="tw-px-3 tw-py-2 tw-text-gray-500">{t.noStationsFound}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Charger Dropdown - Hidden when PM Report tab is not "charger" */}
              {!hideChargerDropdown && (
                <div ref={chargerContainerRef} className="tw-relative tw-flex tw-flex-col">
                  <Input
                    size="lg"
                    label={t.selectCharger}
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
                    className="tw-min-w-[220px] tw-border tw-p-2 tw-rounded tw-text-black"
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
                    crossOrigin=""
                    disabled={lockStationDropdown || !selectedStation || loadingChargers}
                  />

                  {chargerOpen && !lockStationDropdown && selectedStation && (
                    <div
                      className="tw-absolute tw-z-50 tw-top-[100%] tw-left-0 tw-right-0 tw-mt-1 tw-bg-white tw-border tw-rounded-lg tw-shadow-lg tw-max-h-64 tw-overflow-auto tw-text-black"
                      role="listbox"
                      onMouseLeave={() => setChargerActive(-1)}
                    >
                      {filteredChargers.length > 0 ? (
                        filteredChargers.map((item, idx) => (
                          <button
                            type="button"
                            key={item.id}
                            role="option"
                            className={`tw-w-full tw-text-left tw-px-3 tw-py-2 hover:tw-bg-blue-gray-50 focus:tw-bg-blue-gray-50 tw-flex tw-items-center tw-justify-between ${idx === chargerActive ? "tw-bg-blue-gray-50" : ""}`}
                            onMouseEnter={() => setChargerActive(idx)}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => chooseCharger(item)}
                          >
                            <span className="tw-font-medium">
                              {formatChargerDisplay(item)}
                            </span>
                            <span className={`tw-inline-block tw-h-2 tw-w-2 tw-rounded-full ${item.status ? "tw-bg-green-500" : "tw-bg-red-500"}`} />
                          </button>
                        ))
                      ) : (
                        <div className="tw-px-3 tw-py-2 tw-text-gray-500">
                          {chargers.length === 0 ? t.noChargersInStation : t.noChargersFound}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Search Button (non-admin only) */}
              <Button
                className="
                  tw-h-11 tw-min-w-[90px] tw-rounded-xl tw-px-4
                  tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900
                  hover:tw-to-black
                  tw-text-white
                  tw-shadow-[0_6px_14px_rgba(0,0,0,0.12),0_3px_6px_rgba(0,0,0,0.08)]
                  focus:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-blue-500/50
                  tw-shrink-0 tw-whitespace-nowrap
                "
                onClick={onSearch}
                disabled={lockStationDropdown}
                title={lockStationDropdown ? "Selection locked on this page" : ""}
              >
                {t.search}
              </Button>
            </>
          )}

          {/* Menu Toggle + Language Toggle (always visible) */}
          <div className="tw-flex tw-items-end tw-gap-2">
            <IconButton
              variant="text"
              color="blue-gray"
              className="tw-grid xl:tw-hidden"
              onClick={() => setOpenSidenav(dispatch, !openSidenav)}
            >
              {openSidenav ? (
                <Bars3Icon strokeWidth={3} className="tw-h-6 tw-w-6 tw-text-gray-900" />
              ) : (
                <Bars3CenterLeftIcon strokeWidth={3} className="tw-h-6 tw-w-6 tw-text-gray-900" />
              )}
            </IconButton>

            {/* Language Toggle Button */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="
                tw-h-11 tw-px-3 tw-rounded-xl
                tw-bg-white tw-border tw-border-blue-gray-200
                hover:tw-bg-blue-gray-50
                tw-text-blue-gray-700
                tw-shadow-sm
                tw-flex tw-items-center tw-gap-1.5
                tw-transition-all tw-duration-200
                focus:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-blue-500/50
              "
              title={lang === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
            >
              <LanguageIcon className="tw-h-4 tw-w-4" />
              <span className="tw-font-medium tw-text-sm">
                {lang === "th" ? "TH" : "EN"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Navbar>
  );
}

export default DashboardNavbar;