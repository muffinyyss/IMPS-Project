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
  // ✅ แสดง toast แจ้งเตือน 3 วินาที แล้วค่อยเด้งไป login
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

export async function apiFetch(input: string | URL, init: RequestInit = {}) {
  const url = toUrl(input);

  const headers = new Headers(init.headers || {});
  const alreadyHasAuth = headers.has("Authorization");
  const token = getAccessToken();

  if (token && !alreadyHasAuth) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const baseInit: RequestInit = {
    ...init,
    headers,
    mode: "cors",
    credentials: token || alreadyHasAuth ? "omit" : "include",
  };

  let res: Response;
  try {
    res = await fetch(url, baseInit);
  } catch (e) {
    // ✅ แจ้ง network error (ไม่เด้ง login)
    console.error("[apiFetch] network error:", e);
    showNetworkError();
    throw e;
  }

  if (res.status !== 401) return res;

  // ---------- handle 401 ----------
  let detail = "";
  try {
    const data = await res.clone().json().catch(() => ({} as any));
    detail = data?.detail || "";
  } catch {}

  console.warn("[apiFetch] 401 →", detail);

  const refreshToken = getRefreshToken();
  const shouldTryRefresh =
    detail === "token_expired" ||
    detail === "invalid_token" ||
    detail === "session_idle_timeout" ||
    (detail === "Not authenticated" && !!refreshToken) ||
    (!!refreshToken && !token);

  if (shouldTryRefresh) {
    const ok = await refreshOnce();

    if (ok) {
      const retryHeaders = new Headers(headers);
      const newToken = getAccessToken();

      if (newToken && !alreadyHasAuth) {
        retryHeaders.set("Authorization", `Bearer ${newToken}`);
      } else if (!newToken) {
        retryHeaders.delete("Authorization");
      }

      const retry = await fetch(url, {
        ...baseInit,
        headers: retryHeaders,
        credentials: newToken || alreadyHasAuth ? "omit" : "include",
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