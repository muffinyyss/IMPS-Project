import { showSessionToast, detailToProblem, showNetworkError } from "./session-toast";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") ?? "http://localhost:8000";

// ✅ session อยู่ในคุกกี้ HttpOnly ที่ backend ตั้ง (access_token + refresh_token)
// JavaScript ของหน้าเว็บอ่าน token ไม่ได้เลย — script ที่ถูกฉีดเข้ามาจึงขโมยไปใช้นอกเบราว์เซอร์ไม่ได้
// ฝั่ง frontend แค่ส่ง credentials: "include" ทุกครั้งที่เรียก API
// ใน localStorage เหลือเฉพาะโปรไฟล์ที่ไม่ใช่ความลับ (user / userRole) ไว้แสดงเมนูตาม role
const LEGACY_TOKEN_KEYS = ["access_token", "accessToken", "refresh_token", "token"];
const PROFILE_KEYS = ["user", "userRole"];

/** token ที่เวอร์ชันก่อนเก็บไว้ใน localStorage — ลบทิ้งทันทีที่โหลดโค้ดชุดนี้ */
function purgeLegacyTokens() {
  try {
    LEGACY_TOKEN_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch { }
}

if (typeof window !== "undefined") purgeLegacyTokens();

function toUrl(input: RequestInfo | URL) {
  const s = typeof input === "string" ? input : input.toString();
  return s.startsWith("/") ? `${API_BASE}${s}` : s;
}

/** มีโปรไฟล์จากการ login ค้างอยู่ไหม — ใช้ตัดสินใจเรื่อง UI เท่านั้น สิทธิ์จริงตรวจที่ backend ทุกครั้ง */
export function hasSession() {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem("user");
    return !!raw && raw !== "undefined" && raw !== "null";
  } catch {
    return false;
  }
}

export type SessionProfile = {
  user_id?: string;
  username?: string;
  email?: string;
  role?: string;
  company?: string;
  station_id?: string[];
};

/** โปรไฟล์ที่ /login (หรือ /users/switch-role) ส่งกลับมา — ใช้แทนการถอด JWT ที่ JS อ่านไม่ได้แล้ว */
export function getSessionProfile(): SessionProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    if (!raw || raw === "undefined" || raw === "null") return null;
    const obj = JSON.parse(raw);
    return (obj?.user ?? obj) || null;
  } catch {
    return null;
  }
}

export function clearSessionProfile() {
  try {
    [...LEGACY_TOKEN_KEYS, ...PROFILE_KEYS].forEach((k) => localStorage.removeItem(k));
  } catch { }
}

/** ออกจากระบบจริง: ให้ backend เพิกถอน session และลบคุกกี้ — ลบ localStorage อย่างเดียวไม่พอ */
export async function logout() {
  try {
    await fetch(`${API_BASE}/logout`, { method: "POST", credentials: "include" });
  } catch {
    // เครือข่ายล่ม — ยังล้างโปรไฟล์ฝั่งนี้ต่อ ผู้ใช้กดออกแล้วต้องไม่เห็นเมนูค้าง
  }
  clearSessionProfile();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("auth"));
}

// ✅ กัน redirect ซ้ำหลายครั้ง
let isRedirecting = false;

function redirectToLogin(reason = "expired") {
  if (typeof window === "undefined" || isRedirecting) return;
  isRedirecting = true;

  const next = encodeURIComponent(
    window.location.pathname + window.location.search
  );
  const problem = detailToProblem(reason);
  const loginUrl = `/auth/signin/basic?reason=${reason}&next=${next}`;

  // ✅ Fix #2: redirect เป็น fallback ที่ guaranteed — ไม่พึ่ง onDone เพียงอย่างเดียว
  const fallbackTimer = setTimeout(() => {
    window.location.replace(loginUrl);
  }, 3500); // safety net ถ้า onDone ไม่ถูกเรียก

  showSessionToast(problem, {
    duration: 3000,
    onDone: () => {
      clearTimeout(fallbackTimer);
      window.location.replace(loginUrl);
    },
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("pageshow", () => {
    isRedirecting = false;
  });
}

// ✅ ล็อค refresh ให้ยิงแค่ครั้งเดียว
let refreshPromise: Promise<boolean> | null = null;

// ✅ debounce network toast — ป้องกัน toast ซ้ำรัวๆ
let _networkToastActive = false;
function notifyNetworkError() {
  if (_networkToastActive) return;
  _networkToastActive = true;
  showNetworkError();
  setTimeout(() => {
    _networkToastActive = false;
  }, 5000);
}

async function doRefresh(): Promise<boolean> {
  try {
    // refresh token มากับคุกกี้เอง — backend ตั้งคุกกี้ access ใหม่กลับมา body ไม่มี token
    const r = await fetch(`${API_BASE}/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!r.ok) {
      let detail = "";
      try {
        const body = await r.json();
        detail = body?.detail || "";
      } catch { }
      console.warn("[apiFetch] refresh failed:", detail || r.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[apiFetch] refresh network error:", err);
    return false;
  }
}

function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ✅ จำนวนครั้ง retry เมื่อ network error
const MAX_RETRIES = 2;

// หมายเหตุ: การกรองชื่อไฟล์ + อ่านไฟล์เข้า memory ก่อนส่ง ทำที่ installUploadSafetyPatch
// ซึ่ง patch global fetch ไว้ (utils/upload-safety.ts) apiFetch เรียก fetch ตัวนั้น
// อยู่แล้วจึงได้ผลตามไปด้วย ไม่ต้องทำซ้ำที่นี่

export async function apiFetch(input: string | URL, init: RequestInit = {}) {
  const url = toUrl(input);

  // session มากับคุกกี้ — Authorization ที่ caller รุ่นเก่ายังส่งมา ("Bearer null") ไม่มีความหมายแล้ว
  const headers = new Headers(init.headers || {});
  headers.delete("Authorization");

  const baseInit: RequestInit = {
    ...init,
    headers,
    mode: "cors",
    credentials: "include",
  };

  // ✅ retry พร้อม backoff ก่อนยอมแพ้
  let res!: Response;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      res = await fetch(url, baseInit);
      break;
    } catch (e: any) {
      // ✅ ถ้าเป็น AbortError ให้ throw ออกไปทันที ไม่ retry ไม่ toast
      if (e?.name === "AbortError") throw e;

      if (attempt === MAX_RETRIES) {
        console.error("[apiFetch] network error after retries:", e);
        notifyNetworkError();
        throw e;
      }
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  if (res.status !== 401) return res;

  // ---------- handle 401 ----------
  let detail = "";
  try {
    const data = await res.clone().json().catch(() => ({} as any));
    detail = data?.detail || "";
  } catch { }

  console.warn("[apiFetch] 401 →", detail);

  // ลอง refresh ครั้งเดียวเสมอ — มี refresh token ไหมรู้ได้เฉพาะ backend (คุกกี้ HttpOnly)
  if (await refreshOnce()) {
    const retry = await fetch(url, baseInit);
    if (retry.status !== 401) return retry;
  }

  // ---------- refresh ไม่รอด → แจ้งเตือน + เด้ง login ----------
  clearSessionProfile();
  redirectToLogin(detail || "expired");
  throw new Error("UNAUTHENTICATED");
}
