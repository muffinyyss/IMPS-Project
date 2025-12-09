

"use client";
// import React from "react";
import React from "react";

/** 1) เมนูแม่แบบ + สิทธิ์ที่เห็นเมนูนั้น ๆ */
const baseRoutes = [
  {
    name: "admin",                       // ← จะถูกเปลี่ยนเป็นชื่อคนที่ล็อกอิน
    icon: <i className="fa fa-user" />,
    divider: true,
    allow: ["admin", "owner","Technician"],
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
  { name: "My Charger", icon: <i className="fa fa-bolt" />, path: "/dashboard/chargers", allow: ["admin","owner"] },
  { name: "Device",     icon: <i className="fa fa-microchip" />, path: "/dashboard/device",  allow: ["admin","owner"] },
  { name: "Configuration",    icon: <i className="fa fa-cog" />,      path: "/dashboard/setting",  allow: ["admin","owner"] },
  { name: "Monitor(CBM)", icon: <i className="fa fa-desktop" />, path: "/dashboard/cbm",                   allow: ["admin","owner"] },
  { name: "MDB/CCB",      icon: <i className="fa fa-database" />, path: "/dashboard/mdb",     allow: ["admin","owner"] },
  { name: "PM report",    icon: <i className="fa fa-file-alt" />, path: "/dashboard/pm-report", allow: ["admin","owner","Technician"] },
  { name: "CM report",    icon: <i className="far fa-file" />,     path: "/dashboard/cm-report", allow: ["admin","owner","Technician"] },
  { name: "Test report",  icon: <i className="fa fa-check-square" />, path: "/dashboard/test-report", allow: ["admin","owner","Technician"] },
  { name: "Ai Module",    icon: <i className="fa fa-robot" />,    path: "/dashboard/ai",      allow: ["admin","owner"] },
  { name: "Users",        icon: <i className="fa fa-users" />,    path: "/dashboard/users",   allow: ["admin"] },
  { name: "Stations",     icon: <i className="fa fa-charging-station" />, path: "/dashboard/stations", allow: ["admin","owner"] },
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
const canSee = (allow, roles=[]) => {
  if (!allow) return false;
  if (allow.includes("*")) return true;
  return roles.some(r => allow.includes(r));
};

function prune(items, roles) {
  return items
    .filter(r => canSee(r.allow ?? ["*"], roles))
    .map(r => {
      if (Array.isArray(r.pages)) {
        const pages = prune(r.pages, roles);
        return { ...r, pages };
      }
      return r;
    });
}

/** 4) เปลี่ยนชื่อเมนู 'admin' → เป็นชื่อผู้ใช้ที่ล็อกอิน (เช่น username) */
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

/** 5) คำนวณเมนูตาม role + ใส่ชื่อผู้ใช้ แล้ว export ฟังก์ชัน/Hook */
export function getRoutes(roles) {
  const r = roles && roles.length ? roles : getRolesFromStorage();
  const filtered = prune(baseRoutes, r);
  return personalize(filtered);
}

// React Hook (คำนวณใหม่เมื่อ rolesFromApp เปลี่ยน)
export function useRoutes(rolesFromApp) {
  const routes = React.useMemo(
    () => getRoutes(rolesFromApp),
    [Array.isArray(rolesFromApp) ? rolesFromApp.join(",") : ""]
  );
  return routes;
}

export { baseRoutes }; // สำหรับ debug/เทสเมนูเต็ม
