"use client";
import { jwtDecode } from "jwt-decode";
import React, { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Navbar,
  Typography,
  IconButton,
  Breadcrumbs,
  Input,
  Button,
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

import { useRouter } from "next/navigation";

type Station = {
  station_id: string;
  station_name: string;
}
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

  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);        // ไอเท็มที่กำลังโฟกัส (คีย์บอร์ด)
  const [selectedDropdown, setSelectedDropdown] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  function getUserRole(): string {
    return (localStorage.getItem("userRole") || "").toLowerCase();
  }

  useEffect(() => {
    const controller = new AbortController();

    const fetchStations = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) {
          window.location.href = "/auth/signin/basic";
          return;
        }

        const role = (localStorage.getItem("userRole") || "").toLowerCase();
        if (!role) {
          window.location.href = "/auth/signin/basic";
          return;
        }

        // 🧭 เลือก endpoint ตาม role
        const endpoint = role.includes("admin")
          ? `http://localhost:8000/station/`
          : `http://localhost:8000/owner/stations/?q=${encodeURIComponent(query)}`;

        const res = await fetch(endpoint, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (res.status === 401) {
          localStorage.removeItem("accessToken");
          window.location.href = "/auth/signin/basic";
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch stations");

        const data: Station[] = await res.json();
        data.sort((a, b) =>
          a.station_name.localeCompare(b.station_name, undefined, {
            numeric: true,
            sensitivity: "base",
          })
        );
        setStations(data);

        if (!selectedDropdown && data.length > 0) {
          selectItem(data[0]);
          setSelectedDropdown(true);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.error(err);
          setStations([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStations();
    return () => controller.abort();
  }, [query]);
  // useEffect(() => {
  //   const fetchStations = async () => {
  //     setLoading(true);
  //     try {
  //       const token = localStorage.getItem("accessToken");
  //       if (!token) throw new Error("No access token found");

  //       // ✅ decode JWT เพื่อดู role
  //       const decoded: any = jwtDecode(token);
  //       const userRole = decoded?.role;
  //       console.log("role", userRole)
  //       const res = await fetch(`http://localhost:8000/owner/stations/?q=${query}`, {
  //         headers: {
  //           "Accept": "application/json",
  //           "Authorization": `Bearer ${token}`,
  //         },
  //       });

  //       if (res.status === 401) {
  //         // 🔁 Token หมดอายุ → เด้งกลับไปหน้า login
  //         localStorage.removeItem("accessToken");
  //         window.location.href = "/auth/signin/basic";  // ← ใส่ path ที่หน้า login ของคุณ
  //         return;
  //       }

  //       if (!res.ok) {
  //         throw new Error("Failed to fetch stations");
  //       }

  //       const data = await res.json();
  //       // ✅ Sort ตาม station_name ก่อน set
  //       data.sort((a: Station, b: Station) =>
  //         a.station_name.localeCompare(b.station_name, undefined, { numeric: true, sensitivity: 'base' })
  //       );
  //       setStations(data);
  //       // ✅ เลือกสถานีแรก
  //       if (!selectedDropdown && data.length > 0) {
  //         selectItem(data[0]);
  //         setSelectedDropdown(true);  // ตั้งค่าว่าเลือกแล้ว
  //       }
  //     } catch (err) {
  //       console.error(err);
  //       setStations([]);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };


  //   fetchStations();
  // }, [query]);

  // console.log("Access Token:", localStorage.getItem("accessToken"));

  useEffect(() => {
    if (!selectedStation) return;

    const fetchStationDetails = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) throw new Error("No access token");

        const res = await fetch(`http://localhost:8000/selected/station/${selectedStation.station_id}`, {
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        });

        if (res.status === 401) {
          localStorage.removeItem("accessToken");
          window.location.href = "/auth/signin/basic";
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to fetch station details");
        }

        const data = await res.json();
        console.log("Station Detail:", data);

        // setStationDetails(data); // ถ้าจะเก็บไว้ใช้

      } catch (err) {
        console.error("Error fetching station details:", err);
      }
    };

    fetchStationDetails();
  }, [selectedStation]);  // ✅ ทำงานทุกครั้งที่สถานีเปลี่ยน


  const selectItem = (item: Station) => {
    setQuery(item.station_name);
    setOpen(false);
    // // ✅ เรียก API ไปหลังบ้านเพื่อดึงข้อมูลเฉพาะของสถานีนี้
    // fetchStationDetails(item.station_id);
    setSelectedStation(item);
    router.push(`/dashboard/chargers?station_id=${item.station_id}`);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((prev) => Math.min(prev + 1, stations.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && stations[active]) {
        e.preventDefault();
        selectItem(stations[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
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

        <div className="tw-mb-3 tw-flex tw-flex-row tw-items-center tw-gap-2 tw-relative">
          <Typography
            variant="small"
            color="blue-gray"
            className="-tw-mb-1 !tw-font-medium tw-whitespace-nowrap tw-mr-2"
          >
            เลือกสถานี
          </Typography>

          <Input
            size="lg"
            label="พิมพ์เพื่อค้นหา / เลือกสถานี"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            placeholder="พิมพ์เพื่อค้นหา / เลือกสถานี"
            className="border p-2 rounded w-full"
            crossOrigin=""
          />

          <Button
            size="sm"
            className="
              tw-h-11 tw-rounded-xl tw-px-4 
              tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900
              hover:tw-from-black hover:tw-to-black
              tw-text-white
              tw-shadow-[0_6px_14px_rgba(0,0,0,0.12),0_3px_6px_rgba(0,0,0,0.08)]
              focus-visible:tw-ring-2 focus-visible:tw-ring-blue-500/50 focus:tw-outline-none
            ">
            search
          </Button>




          {open && (
            // <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border rounded shadow max-h-64 overflow-auto">
            <div
              className="tw-absolute tw-z-50 tw-top-[100%] tw-left-0 tw-right-0 tw-mt-2 tw-bg-white tw-border tw-rounded-lg tw-shadow-lg tw-max-h-64 tw-overflow-auto"
              role="listbox"
            >
              {stations.length > 0 ? (
                stations.map((item, idx) => (
                  <button
                    type="button"
                    key={item.station_id}
                    role="option"

                    // className="w-full text-left px-3 py-2 hover:bg-blue-100"
                    className={`tw-w-full tw-text-left tw-px-3 tw-py-2 hover:tw-bg-blue-gray-50 focus:tw-bg-blue-gray-50 ${idx === active ? "tw-bg-blue-gray-50" : ""
                      }`}
                    onMouseEnter={() => setActive(idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectItem(item)}
                  >
                    {item.station_name}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-gray-500">
                  ไม่พบสถานีที่ค้นหา
                </div>
              )}
            </div>
          )}
        </div>



      </div>
    </Navbar >
  );
}

export default DashboardNavbar;
