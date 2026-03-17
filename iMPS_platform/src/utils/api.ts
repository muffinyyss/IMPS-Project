import { showSessionToast, detailToProblem, showNetworkError } from "./session-toast";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") ?? "http://localhost:8000";

const ACCESS_KEY = "access_token";
const ACCESS_KEY2 = "accessToken";
const REFRESH_KEY = "refresh_token";

function toUrl(input: RequestInfo | URL) {
  const s = typeof input === "string" ? input : input.toString();
  return s.startsWith("/") ? `${API_BASE}${s}` : s;
}

export function getAccessToken() {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem(ACCESS_KEY) ||
    localStorage.getItem(ACCESS_KEY2) ||
    ""
  );
}

export function setAccessToken(token?: string) {
  try {
    if (!token) {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(ACCESS_KEY2);
    } else {
      localStorage.setItem(ACCESS_KEY, token);
      localStorage.setItem(ACCESS_KEY2, token);
    }
  } catch {}
}

export function getRefreshToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(REFRESH_KEY) || "";
}

export function setRefreshToken(token?: string) {
  try {
    if (!token) localStorage.removeItem(REFRESH_KEY);
    else localStorage.setItem(REFRESH_KEY, token);
  } catch {}
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
  showSessionToast(problem, {
    duration: 3000,
    onDone: () => {
      window.location.replace(`/auth/signin/basic?reason=${reason}&next=${next}`);
    },
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
  const refreshToken = getRefreshToken();
  try {
    const r = await fetch(`${API_BASE}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refresh_token: refreshToken || undefined }),
    });

    if (!r.ok) {
      let detail = "";
      try {
        const body = await r.json();
        detail = body?.detail || "";
      } catch {}
      console.warn("[apiFetch] refresh failed:", detail || r.status);
      return false;
    }

    let acc = "";
    let ref = "";
    try {
      const body = await r.clone().json();
      acc = body?.access_token || "";
      ref = body?.refresh_token || "";
    } catch {}

    if (acc) setAccessToken(acc);
    if (ref) setRefreshToken(ref);
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

export async function apiFetch(input: string | URL, init: RequestInit = {}) {
  const url = toUrl(input);

  const headers = new Headers(init.headers || {});
  const token = getAccessToken();

  // ⚡ FIX: ไม่สนใจ Authorization ที่ caller ส่งมา — ใช้ token ล่าสุดเสมอ
  // เพื่อป้องกัน stale token จาก caller ที่ดึง token ไว้นานแล้ว
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const baseInit: RequestInit = {
    ...init,
    headers,
    mode: "cors",
    credentials: token ? "omit" : "include",
  };

  // ✅ retry พร้อม backoff ก่อนยอมแพ้
  let res!: Response;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      res = await fetch(url, baseInit);
      break;
    } catch (e) {
      if (attempt === MAX_RETRIES) {
        console.error("[apiFetch] network error after retries:", e);
        notifyNetworkError();
        throw e;
      }
      // backoff: 1s, 2s
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  if (res.status !== 401) return res;

  // ---------- handle 401 ----------
  let detail = "";
  try {
    const data = await res.clone().json().catch(() => ({} as any));
    detail = data?.detail || "";
  } catch {}

  console.warn("[apiFetch] 401 →", detail);

  // ⚡ FIX: ถ้ามี refresh_token → ลอง refresh เสมอ ไม่ว่า detail จะเป็นอะไร
  // เดิมเช็คแค่บาง detail ทำให้ "UNAUTHENTICATED", "Signature has expired" ฯลฯ ไม่ถูก refresh
  const refreshToken = getRefreshToken();
  const shouldTryRefresh = !!refreshToken;

  if (shouldTryRefresh) {
    const ok = await refreshOnce();

    if (ok) {
      // ⚡ FIX: ดึง token ใหม่ล่าสุดหลัง refresh สำเร็จ — ใส่ทับเสมอ
      const newToken = getAccessToken();
      const retryHeaders = new Headers(init.headers || {});
      if (newToken) {
        retryHeaders.set("Authorization", `Bearer ${newToken}`);
      } else {
        retryHeaders.delete("Authorization");
      }

      const retry = await fetch(url, {
        ...baseInit,
        headers: retryHeaders,
        credentials: newToken ? "omit" : "include",
      });

      if (retry.status !== 401) return retry;
    }
  }

  // ---------- refresh ไม่รอด → แจ้งเตือน + เด้ง login ----------
  setAccessToken(undefined);
  setRefreshToken(undefined);
  redirectToLogin(detail || "expired");
  throw new Error("UNAUTHENTICATED");
}