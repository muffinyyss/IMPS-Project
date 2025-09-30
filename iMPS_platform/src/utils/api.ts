// utils/api.ts
const API_BASE = "http://localhost:8000";

type Jwt = { exp?: number };

function decodeJwt<T = Jwt>(token?: string|null): T | null {
  try {
    if (!token) return null;
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isExpired(token?: string|null) {
  const claims = decodeJwt<Jwt>(token);
  if (!claims?.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return claims.exp <= now;
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_BASE}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const at = json?.access_token;
    if (typeof at === "string" && at.length > 0) {
      localStorage.setItem("access_token", at);
      return at;
    }
    return null;
  } catch {
    return null;
  }
}

function kickToLogin() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  // เปลี่ยน path ตามหน้า login ของโปรเจกต์ (เช่น /auth/login)
  window.location.href = "/auth/signin/basic";
}

/**
 * apiFetch: ใช้แทน fetch
 * - แนบ Authorization อัตโนมัติ
 * - ถ้า access token หมดอายุ → refresh 1 ครั้ง แล้ว retry
 * - ถ้า refresh fail หรือยัง 401 → เคลียร์ storage และ redirect ไป /login
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}, retry = true): Promise<Response> {
  let access = localStorage.getItem("access_token");
  // เช็กหมดอายุก่อนยิง
  if (!access || isExpired(access)) {
    const newAt = await refreshAccessToken();
    access = newAt || "";
  }

  const headers = new Headers(init.headers || {});
  if (access) headers.set("Authorization", `Bearer ${access}`);

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401) {
    // ลอง refresh 1 ครั้งแล้ว retry
    if (retry) {
      const newAt = await refreshAccessToken();
      if (newAt) {
        const headers2 = new Headers(init.headers || {});
        headers2.set("Authorization", `Bearer ${newAt}`);
        const res2 = await fetch(input, { ...init, headers: headers2 });
        if (res2.status !== 401) return res2;
      }
    }
    // ยัง 401 → เด้ง login
    kickToLogin();
    // ให้ promise pending-less: โยน error ไว้กันโค้ดหลังบ้านทำงานต่อ
    throw new Error("Unauthorized – redirected to /auth/signin/basic");
  }

  return res;
}
