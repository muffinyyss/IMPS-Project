"use client";
import React, { useEffect, useState } from "react";

/** 1) เมนูแม่แบบ + สิทธิ์ที่เห็นเมนูนั้น ๆ */
const baseRoutes = [
  {
    name: "admin",                       // ← จะถูกเปลี่ยนเป็นชื่อคนที่ล็อกอิน
    icon: <i className="fa fa-user" />,
    divider: true,
    allow: ["admin", "owner", "technician"],
    showMode: "both", // แสดงทั้งสองโหมด
    pages: [
      {
        layout: "dashboard",
        icon: <i className="fa fa-user" />,
        name: "My profile",
        path: "/dashboard/profile/settings",
        allow: ["*"], // ทุก role เห็นได้
      },
      {
        layout: "auth",
        icon: <i className="fa fa-sign-out" />,
        name: "logout",
        path: "/auth/signin/basic",
        allow: ["*"],
      },
    ],
  },
  { name: "Stations", icon: <i className="fa fa-map-marker-alt" />, path: "/dashboard/stations", allow: ["admin", "owner", "technician"], showMode: "both" },
  { name: "Users", icon: <i className="fa fa-users" />, path: "/dashboard/users", allow: ["admin"], showMode: "before" },
  { name: "My Charger", icon: <i className="fa fa-charging-station" />, path: "/dashboard/chargers", allow: ["admin", "owner"], showMode: "after" },
  { name: "Device", icon: <i className="fa fa-microchip" />, path: "/dashboard/device", allow: ["admin", "owner"], showMode: "after" },
  { name: "Configuration", icon: <i className="fa fa-cog" />, path: "/dashboard/setting", allow: ["admin", "owner"], showMode: "after" },
  { name: "Condition-base", icon: <i className="fa fa-desktop" />, path: "/dashboard/cbm", allow: ["admin", "owner"], showMode: "after" },
  { name: "MDB/CCB", icon: <i className="fa fa-database" />, path: "/dashboard/mdb", allow: ["admin", "owner"], showMode: "after" },
  { name: "PM report", icon: <i className="fa fa-file-alt" />, path: "/dashboard/pm-report", allow: ["admin", "owner", "technician"], showMode: "after" },
  { name: "CM report", icon: <i className="far fa-file" />, path: "/dashboard/cm-report", allow: ["admin", "owner", "technician"], showMode: "after" },
  { name: "Test report", icon: <i className="fa fa-check-square" />, path: "/dashboard/test-report", allow: ["admin", "owner", "technician"], showMode: "after" },
  { name: "Ai Module", icon: <i className="fa fa-robot" />, path: "/dashboard/ai", allow: ["admin", "owner"], showMode: "after" },
];

/** 2) อ่าน user/role จาก localStorage (ตาม payload ที่ backend ส่งมาใน /login) */
function readAuthFromStorage() {
  try {
    const raw = localStorage.getItem("user") || localStorage.getItem("auth") || "";
    if (!raw) return {};
    const obj = JSON.parse(raw);
    // รองรับทั้งโครงสร้าง { user: {...} } หรือแบนราบ
    const user = obj?.user ?? obj ?? {};
    return {
      username: user.username || "",
      email: user.email || "",
      role: user.role || "",
    };
  } catch {
    return {};
  }
}

function getRolesFromStorage() {
  const { role } = readAuthFromStorage();
  return role ? [String(role)] : [];
}

/** 3) กรองตาม allow */
const canSee = (allow, roles = []) => {
  if (!allow) return false;
  if (allow.includes("*")) return true;
  return roles.some(r => allow.includes(r));
};

/** 4) กรองตาม showMode 
 * - "before": แสดงเฉพาะเมื่อยังไม่เลือก charger (Stations, Users)
 * - "after": แสดงเฉพาะเมื่อเลือก charger แล้ว (เมนูอื่นๆ)
 * - "both" หรือ undefined: แสดงทั้งสองโหมด
 */
const canSeeByMode = (showMode, hasChargerSelected) => {
  if (!showMode || showMode === "both") return true;
  if (showMode === "before") return !hasChargerSelected;
  if (showMode === "after") return hasChargerSelected;
  return true;
};

function prune(items, roles, hasChargerSelected = false) {
  return items
    .filter(r => canSee(r.allow ?? ["*"], roles))
    .filter(r => canSeeByMode(r.showMode, hasChargerSelected))
    .map(r => {
      if (Array.isArray(r.pages)) {
        const pages = prune(r.pages, roles, hasChargerSelected);
        return { ...r, pages };
      }
      return r;
    });
}

/** 5) เปลี่ยนชื่อเมนู 'admin' → เป็นชื่อผู้ใช้ที่ล็อกอิน (เช่น username) */
function personalize(items) {
  const { username, email } = readAuthFromStorage();
  const displayName =
    username?.trim() ||
    (email ? String(email).split("@")[0] : "") ||
    ""; // fallback เป็นค่าว่าง ถ้าไม่มี

  return items.map((r) => {
    let name = r.name;
    // เงื่อนไขปรับชื่อ: เดิมตั้งต้นเป็น "admin"
    if (typeof name === "string" && name.toLowerCase() === "admin" && displayName) {
      name = displayName;
    }
    return {
      ...r,
      name,
      pages: Array.isArray(r.pages) ? personalize(r.pages) : r.pages,
    };
  });
}

/** 6) คำนวณเมนูตาม role + showMode + ใส่ชื่อผู้ใช้ */
export function getRoutes(roles, hasChargerSelected = false) {
  const r = roles && roles.length ? roles : getRolesFromStorage();
  const filtered = prune(baseRoutes, r, hasChargerSelected);
  return personalize(filtered);
}

/** 7) React Hook - ตรวจสอบ URL params หรือ localStorage และคำนวณเมนู */
export function useRoutes(rolesFromApp) {
  const [hasChargerSelected, setHasChargerSelected] = useState(false);

  // Check URL params OR localStorage for sn and station_id
  useEffect(() => {
    const checkChargerSelection = () => {
      if (typeof window === "undefined") return;
      
      // Check URL params first
      const params = new URLSearchParams(window.location.search);
      const snFromUrl = params.get("sn");
      const stationIdFromUrl = params.get("station_id");
      
      // Also check localStorage - only need selected_sn to indicate charger is selected
      const snFromStorage = localStorage.getItem("selected_sn");
      
      // Has charger if URL has both OR localStorage has sn
      const hasFromUrl = !!snFromUrl && !!stationIdFromUrl;
      const hasFromStorage = !!snFromStorage;
      
      setHasChargerSelected(hasFromUrl || hasFromStorage);
    };

    // Check on mount
    checkChargerSelection();

    // Listen for URL changes
    window.addEventListener("popstate", checkChargerSelection);
    
    // Custom event for programmatic navigation
    window.addEventListener("charger:selected", checkChargerSelection);
    window.addEventListener("charger:deselected", checkChargerSelection);
    
    // Listen for storage changes
    window.addEventListener("storage", checkChargerSelection);

    // Check periodically for URL changes (fallback for Next.js router)
    const interval = setInterval(checkChargerSelection, 500);

    return () => {
      window.removeEventListener("popstate", checkChargerSelection);
      window.removeEventListener("charger:selected", checkChargerSelection);
      window.removeEventListener("charger:deselected", checkChargerSelection);
      window.removeEventListener("storage", checkChargerSelection);
      clearInterval(interval);
    };
  }, []);

  const routes = React.useMemo(
    () => getRoutes(rolesFromApp, hasChargerSelected),
    [rolesFromApp, hasChargerSelected]
  );

  return routes;
}

export { baseRoutes }; // สำหรับ debug/เทสเมนูเต็ม