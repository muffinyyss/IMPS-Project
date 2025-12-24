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
} from "@heroicons/react/24/solid";

// @context
import {
  useMaterialTailwindController,
  setOpenConfigurator,
  setOpenSidenav,
} from "@/context";

type Station = { station_id: string; station_name: string };
type StationInfo = {
  station_id: string;
  station_name: string;
  SN?: string;
  WO?: string;
  model?: string;
  status?: boolean;
};
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"; // e.g. "http://localhost:8000"

export function DashboardNavbar() {
  const [controller, dispatch] = useMaterialTailwindController();
  const { fixedNavbar, openSidenav } = controller;

  const toggleSidenav = () => setOpenSidenav(dispatch, !openSidenav);

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const view = searchParams.get("view") ?? "";
  const tab = searchParams.get("tab") ?? "";
  const isFormView = view === "form";
  const isChargerTab = tab === "charger" || "mdb";

  // ซ่อน topbar บางหน้า
  const HIDE_TOPBAR = ["/pages", "/mainpages"];
  const hideTopbar = HIDE_TOPBAR.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isAuthPage = pathname.startsWith("/auth"); // กัน redirect loop บนหน้า auth

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
  else if (segs[1] === "cbm") title = "Conditio-base";

  // ล็อก dropdown
  // const lockStationDropdown = pathname.startsWith("/dashboard/input_PMreport");
  // const lockStationDropdown = pathname.startsWith("/dashboard/pm-report/mdb/input_PMreport");
  const lockStationDropdown =
  pathname.startsWith("/dashboard/pm-report") && isChargerTab && isFormView;

  // Dropdown state
  const [query, setQuery] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [searching, setSearching] = useState(false);
  const [stationInfo, setStationInfo] = useState<StationInfo | null>(null);

  // โหลดสถานีของผู้ใช้ที่ล็อกอิน (JWT only)
  useEffect(() => {
    if (isAuthPage) return; // กัน loop บนหน้า /auth

    (async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
        console.log("[Stations] API_BASE =", API_BASE);
        console.log("[Stations] has token? =", !!token);

        if (!token) {
          // ยังไม่มี token -> ให้ page guard ตัดสินใจ redirect เอง
          return;
        }

        // เช็คหมดอายุแบบเร็ว ๆ
        try {
          const decoded: any = jwtDecode(token);
          const nowSec = Math.floor(Date.now() / 1000);
          if (decoded?.exp && decoded.exp <= nowSec) {
            console.warn("[Stations] token expired");
            localStorage.removeItem("access_token");
            return;
          }
          // เก็บ role สำหรับการจัดการแสดง stations
          const userRole = decoded?.role;
          console.log("[Stations] user role =", userRole);
        } catch (e) {
          console.warn("[Stations] token decode failed", e);
          localStorage.removeItem("access_token");
          return;
        }

        // ดึงสถานีที่เชื่อมกับผู้ใช้ (สำหรับ technician จะได้เฉพาะ stations ที่กำหนดให้)
        // สำหรับ owner/admin จะได้สถานีที่เป็นเจ้าของ
        let res = await fetch(`${API_BASE}/my-stations/detail`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log("[Stations] /detail status =", res.status);

        if (res.status === 401) {
          localStorage.removeItem("access_token");
          return;
        }

        // ถ้าไม่มี endpoint นี้ (404) ลอง fallback ไป /my-stations (เฉพาะ id)
        if (res.status === 404) {
          console.warn("[Stations] /detail 404 -> fallback /my-stations");
          res = await fetch(`${API_BASE}/my-stations`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          });
        }

        if (!res.ok) {
          const txt = await res.text();
          console.error("[Stations] fetch failed:", res.status, txt);
          setStations([]);
          return;
        }

        const data = await res.json();
        console.log("[Stations] response =", data);

        // รองรับทั้งแบบ detail และแบบ id ล้วน
        // สำหรับ technician จะได้เฉพาะสถานีที่กำหนดให้จากการแมพ station_id ใน user profile
        let list: Station[] = [];
        if (Array.isArray(data?.stations) && data.stations.length && typeof data.stations[0] === "object") {
          list = data.stations as Station[]; // มี station_id + station_name (สำหรับ technician ได้เฉพาะ assigned stations)
        } else if (Array.isArray(data?.stations)) {
          list = data.stations.map((id: string) => ({ station_id: id, station_name: id }));
        }

        setStations(list);
        console.log("[Stations] loaded stations count =", list.length);

        // auto-select ถ้ามีสถานีเดียว หรือ restore ค่าเดิม
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
        console.error("[Stations] exception:", err);
        setStations([]);
      }
    })();
  }, [isAuthPage]);

  // filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (s) => s.station_name.toLowerCase().includes(q) || s.station_id.toLowerCase().includes(q)
    );
  }, [stations, query]);

  // click outside -> close
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

  // choose
  const choose = (s: Station) => {
    setSelectedStation(s);
    setQuery(s.station_name);
    setOpen(false);
    localStorage.setItem("selected_station_id", s.station_id);
    localStorage.setItem("selected_station_name", s.station_name);
    // ที่นี่ค่อย trigger refetch อื่น ๆ ถ้าต้องการ
  };
  const onSearch = async () => {
    if (!selectedStation) { setOpen(true); return; }

    // 1) อัปเดต URL ปัจจุบันด้วย station_id
    // const params = new URLSearchParams(window.location.search);
    // params.set("station_id", selectedStation.station_id);
    // router.push(`${pathname}?${params.toString()}`, { scroll: false });

    // อัปเดต query เดิม + set station_id ใหม่
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("station_id", selectedStation.station_id);

    // ✅ อยู่หน้าเดิม แต่เปลี่ยน query (ไม่เด้งไปหน้าอื่น)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });

    // 2) ยิง API ดึงข้อมูลสถานี (ของคุณมีอยู่แล้ว)
    await handleSearchClick();
  };
  // ✅ ดึง "ข้อมูลสถานี" เท่านั้น
  const handleSearchClick = async () => {
    if (!selectedStation) { setOpen(true); return; }
    setSearching(true);
    try {
      const token =
        localStorage.getItem("access_token");
      if (!token) return;

      const url = `${API_BASE}/station/info?station_id=${encodeURIComponent(selectedStation.station_id)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

      if (res.status === 401) { localStorage.removeItem("access_token"); return; }
      if (res.status === 403) { console.warn("Forbidden station_id"); return; }
      if (!res.ok) { console.error("Fetch station info failed:", res.status, await res.text()); return; }

      const data = await res.json();
      setStationInfo(data.station ?? data); // รองรับทั้ง {station:{...}} หรือ {...}

      // broadcast ให้คอมโพเนนต์อื่นใช้ต่อได้ (ถ้าต้องการ)
      window.dispatchEvent(new CustomEvent("station:info", {
        detail: { station: selectedStation, info: data.station ?? data },
      }));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const sid = searchParams.get("station_id");
    if (!sid) return;

    const found = stations.find(s => s.station_id === sid);
    if (found) {
      setSelectedStation(found);
      setQuery(found.station_name);
    }
    handleSearchClick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, searchParams]); // ✅ ไม่ต้องอิง window.location อีก


  // keyboard nav
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

  const goToCurrentPage = () => {
    if (!selectedStation) {          // ยังไม่ได้เลือกจาก dropdown
      setOpen(true);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    params.set("station_id", selectedStation.station_id);  // อัปเดต/เพิ่มพารามิเตอร์

    // push ไป path ปัจจุบัน พร้อมพารามิเตอร์ใหม่
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
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
          {!hideTopbar && (
            <Typography variant="h6" color="blue-gray">
              {title}
            </Typography>
          )}
        </div>

        {/* Dropdown เลือกสถานี */}
        <div ref={containerRef} className="tw-mb-3 tw-relative tw-flex tw-flex-col md:tw-flex-row md:tw-items-center tw-gap-2">
          <Typography
            variant="small"
            color="blue-gray"
            className="-tw-mb-3 !tw-font-medium tw-whitespace-nowrap md:tw-mr-2 tw-shrink-0"
          >
            เลือกสถานี
          </Typography>

          {/* กลุ่ม input + button (ให้อยู่บรรทัดเดียวกันเสมอ) */}
          <div className="tw-flex tw-w-full tw-items-center tw-gap-2 tw-flex-nowrap tw-mt-3">
            <Input
              size="lg"
              label="พิมพ์เพื่อค้นหา / เลือกสถานี"
              type="text"
              placeholder="พิมพ์เพื่อค้นหา / เลือกสถานี"
              className="tw-w-full tw-min-w-0 tw-flex-1 tw-border tw-p-2 tw-rounded tw-text-black"
              value={query}
              onChange={(e) => {
                if (lockStationDropdown) return;
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => {
                if (lockStationDropdown) return;
                setOpen(true)
              }}
              onKeyDown={(e) => {
                if (lockStationDropdown) return;
                onKeyDown(e);
              }}
              crossOrigin=""
              disabled={lockStationDropdown}
            />

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
              // onClick={goToCurrentPage}
              onClick={onSearch}
              disabled={lockStationDropdown}
              title={lockStationDropdown ? "ล็อกการเลือกสถานีบนหน้านี้" : ""}
            >
              search
            </Button>
            <IconButton
              variant="text"
              color="blue-gray"
              className="tw-grid xl:tw-hidden"
              onClick={() => setOpenSidenav(dispatch, !openSidenav)}
            >
              {openSidenav ? (
                <Bars3Icon
                  strokeWidth={3}
                  className="tw-h-6 tw-w-6 tw-text-gray-900"
                />
              ) : (
                <Bars3CenterLeftIcon
                  strokeWidth={3}
                  className="tw-h-6 tw-w-6 tw-text-gray-900"
                />
              )}
            </IconButton>
          </div>

          {open && !lockStationDropdown && (
            <div
              className="tw-absolute tw-z-50 tw-top-[100%] tw-left-0 tw-right-0 tw-mt-2 tw-bg-white tw-border tw-rounded-lg tw-shadow-lg tw-max-h-64 tw-overflow-auto tw-text-black"
              role="listbox"
              onMouseLeave={() => setActive(-1)}
            >
              {filtered.length > 0 ? (
                filtered.map((item, idx) => (
                  <button
                    type="button"
                    key={item.station_id}
                    role="option"
                    className={`tw-w-full tw-text-left tw-px-3 tw-py-2 hover:tw-bg-blue-gray-50 focus:tw-bg-blue-gray-50 ${idx === active ? "tw-bg-blue-gray-50" : ""
                      }`}
                    onMouseEnter={() => setActive(idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(item)}
                  >
                    {item.station_name}
                  </button>
                ))
              ) : (
                <div className="tw-px-3 tw-py-2 tw-text-gray-500">ไม่พบสถานีที่ค้นหา</div>
              )}
            </div>
          )}
        </div>
      </div>
    </Navbar>
  );
}

export default DashboardNavbar;
