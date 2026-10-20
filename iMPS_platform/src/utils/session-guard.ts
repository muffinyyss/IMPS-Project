import { API_BASE, handleUnauthorized } from "./api";

/**
 * ดัก 401 จาก backend ทุก request ทั้งเว็บ — ไม่ใช่แค่ที่เรียกผ่าน apiFetch
 *
 * หลายหน้า (CM inprogress/closed, notifications, navbar, setting, MDB ฯลฯ) เรียก fetch ตรง ๆ
 * พอ token หมดอายุจึงเห็นแค่ error/ตารางว่าง ไม่ถูกพาไป login ตัวนี้ทำให้ทุกหน้าเด้งแบบเดียวกัน
 *
 * response ยังส่งกลับให้ผู้เรียกตามปกติ — โค้ดเดิมที่จับ error (เช่นร่าง CM เซฟลงเครื่องเมื่อส่ง server ไม่ผ่าน)
 * ทำงานต่อได้ก่อนเด้ง (toast ค้าง 3 วินาที)
 */

// endpoint ที่ 401 แปลว่า "กรอกผิด" ไม่ใช่ "session หมดอายุ"
const IGNORED_PATHS = ["/login", "/logout", "/refresh", "/forgot-password", "/reset-password"];

let installed = false;

function backendPath(input: RequestInfo | URL): string | null {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    const api = new URL(API_BASE, window.location.href);
    if (url.origin !== api.origin) return null;
    const base = api.pathname.replace(/\/+$/, "");
    if (base && !url.pathname.startsWith(base + "/")) return null;
    return url.pathname.slice(base.length) || "/";
  } catch {
    return null;
  }
}

export function shouldHandle401(input: RequestInfo | URL): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.pathname.startsWith("/auth/")) return false;   // อยู่หน้า login/reset อยู่แล้ว
  const path = backendPath(input);
  if (path === null) return false;
  const p = path.replace(/\/+$/, "");
  return !IGNORED_PATHS.some((x) => p === x || p.startsWith(x + "/"));
}

async function detailOf(res: Response): Promise<string> {
  try {
    const data = await res.clone().json();
    return typeof data?.detail === "string" ? data.detail : "";
  } catch {
    return "";
  }
}

export function installSessionGuard() {
  if (installed) return;
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const res = await originalFetch(input, init);
    if (res.status === 401 && shouldHandle401(input)) {
      void detailOf(res).then(handleUnauthorized);
    }
    return res;
  };
}
