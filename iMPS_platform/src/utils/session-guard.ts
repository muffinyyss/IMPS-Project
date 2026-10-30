import { API_BASE, handleUnauthorized, clearSessionProfile } from "./api";

/**
 * ดัก 401 จาก backend ทุก request ทั้งเว็บ — ไม่ใช่แค่ที่เรียกผ่าน apiFetch — รวมถึง SSE (EventSource)
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
// fetch ตัวจริงก่อนถูกห่อ — ใช้กับการเช็ค session แบบเงียบ (verifySession) ที่ต้องไม่เด้งไป login
let rawFetch: typeof window.fetch | null = null;

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

// ---------- SSE (EventSource) ----------
// EventSource ไม่ได้วิ่งผ่าน fetch และไม่บอก status code ตอนต่อไม่ติด — รู้แค่ว่า "error"
// พอเกิด error จึงถาม /me หนึ่งครั้ง (ผ่าน fetch ที่ถูกดักแล้ว) ถ้า 401 ก็เด้งไป login แบบเดียวกับหน้าอื่น
// backend ปิด stream เองเมื่อ token หมดอายุ (deps.session_expired) → เบราว์เซอร์ต่อใหม่ → 401 → error → มาถึงตรงนี้

const PROBE_MIN_INTERVAL_MS = 10_000;   // stream หลุดเพราะเน็ต/backend restart จะ error ทุก ~3 วิ — ไม่ต้องถามถี่ขนาดนั้น
let probing: Promise<void> | null = null;
let lastProbeAt = 0;

/** ถาม backend ว่า session ยังใช้ได้ไหม — 401 จะถูกตัวดัก fetch พาไป login เอง */
export function probeSession(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (probing) return probing;
  if (Date.now() - lastProbeAt < PROBE_MIN_INTERVAL_MS) return Promise.resolve();
  lastProbeAt = Date.now();
  const url = `${API_BASE}/me`;
  if (!shouldHandle401(url)) return Promise.resolve();
  probing = window
    .fetch(url, { credentials: "include", cache: "no-store" })
    .then(() => undefined, () => undefined)   // เน็ตหลุด/backend ล่ม ไม่ใช่เรื่อง session — ปล่อยให้หน้าเดิม retry ต่อ
    .finally(() => {
      probing = null;
    });
  return probing;
}

function installEventSourceGuard() {
  const Original = (window as any).EventSource as typeof EventSource | undefined;
  if (typeof Original !== "function") return;

  class GuardedEventSource extends Original {
    constructor(url: string | URL, init?: EventSourceInit) {
      super(url, init);
      if (shouldHandle401(url)) {
        this.addEventListener("error", () => {
          void probeSession();
        });
      }
    }
  }
  (window as any).EventSource = GuardedEventSource;
}

export function installSessionGuard() {
  if (installed) return;
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  rawFetch = originalFetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const res = await originalFetch(input, init);
    if (res.status === 401 && shouldHandle401(input)) {
      void detailOf(res).then(handleUnauthorized);
    }
    return res;
  };

  installEventSourceGuard();
}

// ---------- เช็ค session แบบเงียบ (หน้า public) ----------
// หน้า /pages/* (Home, Package, ...) แสดงชื่อผู้ใช้จากโปรไฟล์ใน localStorage ซึ่งไม่รู้ว่า token หมดอายุแล้ว
// (token อยู่ในคุกกี้ HttpOnly, JS อ่านไม่ได้) → ชื่อค้าง "Hi, ..." ทั้งที่ session หมดตั้งแต่ตี 3
// ถาม /me ด้วย fetch ตัวจริง (ไม่ผ่านตัวดัก) เพราะหน้า public ไม่ควรขึ้น toast แล้วเด้งไป login

export type SessionCheck = "valid" | "invalid" | "unknown";

/** 200 = ใช้ได้, 401 = หมดอายุ/ถูกเพิกถอน (ล้างโปรไฟล์ให้), อย่างอื่น/เน็ตหลุด = ไม่รู้ (ไม่แตะโปรไฟล์) */
export async function verifySession(): Promise<SessionCheck> {
  if (typeof window === "undefined") return "unknown";
  const f = rawFetch ?? window.fetch.bind(window);
  try {
    const res = await f(`${API_BASE}/me`, { credentials: "include", cache: "no-store" });
    if (res.status === 401) {
      clearSessionProfile();
      return "invalid";
    }
    return res.ok ? "valid" : "unknown";
  } catch {
    return "unknown";
  }
}
