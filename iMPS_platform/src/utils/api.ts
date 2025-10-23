// // utils/api.ts
// const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// type Jwt = { exp?: number };

// function decodeJwt<T = Jwt>(token?: string | null): T | null {
//   try {
//     if (!token) return null;
//     const payload = token.split(".")[1];
//     const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
//     return JSON.parse(json);
//   } catch {
//     return null;
//   }
// }

// function isExpired(token?: string | null) {
//   const claims = decodeJwt<Jwt>(token);
//   if (!claims?.exp) return true;
//   const now = Math.floor(Date.now() / 1000);
//   return claims.exp <= now;
// }

// function toUrl(input: RequestInfo | URL) {
//   const s = typeof input === "string" ? input : input.toString();
//   return s.startsWith("/") ? `${API_BASE}${s}` : s;
// }

// async function refreshAccessToken(): Promise<string | null> {
//   const refresh = localStorage.getItem("refresh_token");
//   if (!refresh) return null;
//   try {
//     const res = await fetch(`${API_BASE}/refresh`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ refresh_token: refresh }),
//     });
//     if (!res.ok) return null;
//     const json = await res.json();
//     const at = json?.access_token;
//     if (typeof at === "string" && at.length > 0) {
//       localStorage.setItem("access_token", at);
//       return at;
//     }
//     return null;
//   } catch {
//     return null;
//   }
// }

// function kickToLogin() {
//   localStorage.removeItem("access_token");
//   localStorage.removeItem("refresh_token");
//   // เปลี่ยน path ตามหน้า login ของโปรเจกต์ (เช่น /auth/login)
//   window.location.href = "/auth/signin/basic";
// }

// /**
//  * apiFetch: ใช้แทน fetch
//  * - แนบ Authorization อัตโนมัติ
//  * - ถ้า access token หมดอายุ → refresh 1 ครั้ง แล้ว retry
//  * - ถ้า refresh fail หรือยัง 401 → เคลียร์ storage และ redirect ไป /login
//  */
// // export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}, retry = true): Promise<Response> {
// //   let access = localStorage.getItem("access_token");
// //   // เช็กหมดอายุก่อนยิง
// //   if (!access || isExpired(access)) {
// //     const newAt = await refreshAccessToken();
// //     access = newAt || "";
// //   }

// //   const headers = new Headers(init.headers || {});
// //   if (access) headers.set("Authorization", `Bearer ${access}`);

// //   const res = await fetch(input, { ...init, headers });

// //   if (res.status === 401) {
// //     // ลอง refresh 1 ครั้งแล้ว retry
// //     if (retry) {
// //       const newAt = await refreshAccessToken();
// //       if (newAt) {
// //         const headers2 = new Headers(init.headers || {});
// //         headers2.set("Authorization", `Bearer ${newAt}`);
// //         const res2 = await fetch(input, { ...init, headers: headers2 });
// //         if (res2.status !== 401) return res2;
// //       }
// //     }
// //     // ยัง 401 → เด้ง login
// //     kickToLogin();
// //     // ให้ promise pending-less: โยน error ไว้กันโค้ดหลังบ้านทำงานต่อ
// //     throw new Error("Unauthorized – redirected to /auth/signin/basic");
// //   }

// //   return res;
// // }
// export async function apiFetch(input: string | URL, init: RequestInit = {}) {
//   // const url = toUrl(input);
//   const url = typeof input === "string" ? input : input.toString();
//   // ถ้ามี Authorization แล้ว ไม่ต้อง include credentials
//   const hasAuth = !!(init.headers as any)?.Authorization;
//   const baseInit: RequestInit = {
//     mode: "cors",
//     ...init,
//     credentials: hasAuth ? "omit" : "include",
//   };
//   const doFetch = async () => fetch(url, { ...init, credentials: "include" });
//   // const doFetch = async () => fetch(url, baseInit);
//   let res = await doFetch();
//   if (res.status !== 401) return res;


//   // ลอง refresh ถ้าหมดอายุ
//   try {


//     const data = await res.clone().json().catch(() => ({} as any));
//     const shouldTryRefresh =
//       data?.detail === "token_expired" ||
//       data?.detail === "invalid_token" ||
//       data?.detail === "session_idle_timeout" ||
//       (data?.detail === "Not authenticated" && !!localStorage.getItem("refresh_token"));

//     if (shouldTryRefresh) {
//       const r = await fetch(`${API_BASE}/refresh`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         credentials: "include",
//         body: JSON.stringify({ refresh_token: localStorage.getItem("refresh_token") }),
//       });
//       if (r.ok) {
//         // ได้คุกกี้ access ตัวใหม่แล้ว → ยิงซ้ำ
//         res = await doFetch();
//         if (res.status !== 401) return res;
//       }
//     }
//   } catch (err) {
//     console.error("apiFetch network error:", err);
//     // โยนต่อให้ caller แสดง error ที่ UI
//     throw err;
//   }

//   // ไม่รอด → เคลียร์แล้วเด้ง login
//   localStorage.removeItem("refresh_token");
//   if (typeof window !== "undefined") {
//     window.location.replace("/auth/signin/basic?reason=expired");
//   }
//   return res;
// }

// utils/api.ts

// const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// function toUrl(input: RequestInfo | URL) {
//   const s = typeof input === "string" ? input : input.toString();
//   return s.startsWith("/") ? `${API_BASE}${s}` : s;
// }

// export async function apiFetch(input: string | URL, init: RequestInit = {}) {
//   // ✅ กลับมาใช้ toUrl เพื่อ prefix ด้วย API_BASE เมื่อส่ง path ที่ขึ้นต้นด้วย "/"
//   const url = toUrl(input);

//   // ✅ สร้าง Headers ที่แก้ไขได้
//   const headers = new Headers(init.headers || {});
//   const hasAuth = headers.has("Authorization");

//   // ✅ ใช้ baseInit จริง ๆ และตั้ง mode/cors ให้ชัด
//   const baseInit: RequestInit = {
//     ...init,
//     headers,
//     mode: "cors",
//     credentials: hasAuth ? "omit" : "include",
//   };

//   // ✅ ใช้ baseInit เสมอ
//   const doFetch = async () => fetch(url, baseInit);

//   let res: Response;
//   try {
//     res = await doFetch();
//   } catch (e) {
//     // มักเป็นสัญญาณของ CORS/mixed-content/ปลายทางล่ม
//     console.error("apiFetch network-level failure:", e);
//     throw e;
//   }
//   if (res.status !== 401) return res;

//   // ---------- 401 handling ----------
//   try {
//     const data = await res.clone().json().catch(() => ({} as any));
//     const shouldTryRefresh =
//       data?.detail === "token_expired" ||
//       data?.detail === "invalid_token" ||
//       data?.detail === "session_idle_timeout" ||
//       (data?.detail === "Not authenticated" && !!localStorage.getItem("refresh_token"));

//     if (shouldTryRefresh) {
//       const r = await fetch(`${API_BASE}/refresh`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         credentials: "include", // รีเฟรชด้วยคุกกี้/refresh token
//         body: JSON.stringify({ refresh_token: localStorage.getItem("refresh_token") }),
//       });
//       if (r.ok) {
//         // ยิงซ้ำด้วยคุกกี้/เฮดเดอร์เดิม
//         const retry = await doFetch();
//         if (retry.status !== 401) return retry;
//       }
//     }
//   } catch (err) {
//     console.error("apiFetch 401/refresh flow error:", err);
//     throw err;
//   }

//   // ---------- ไม่รอด ----------
//   localStorage.removeItem("refresh_token");
//   if (typeof window !== "undefined") {
//     window.location.replace("/auth/signin/basic?reason=expired");
//   }
//   return res;
// }


// src/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

const ACCESS_KEY = "access_token";
const ACCESS_KEY2 = "accessToken";
const REFRESH_KEY = "refresh_token";

function toUrl(input: RequestInfo | URL) {
  const s = typeof input === "string" ? input : input.toString();
  return s.startsWith("/") ? `${API_BASE}${s}` : s;
}

function getAccessToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ACCESS_KEY) || localStorage.getItem(ACCESS_KEY2) || "";
}

function setAccessToken(token?: string) {
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

function getRefreshToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(REFRESH_KEY) || "";
}

function setRefreshToken(token?: string) {
  try {
    if (!token) localStorage.removeItem(REFRESH_KEY);
    else localStorage.setItem(REFRESH_KEY, token);
  } catch {}
}

function redirectToLogin(reason = "expired") {
  if (typeof window === "undefined") return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/auth/signin/basic?reason=${reason}&next=${next}`);
}

export async function apiFetch(input: string | URL, init: RequestInit = {}) {
  const url = toUrl(input);

  // ⚙️ Headers ที่แก้ไขได้
  const headers = new Headers(init.headers || {});
  const alreadyHasAuth = headers.has("Authorization");
  const token = getAccessToken();

  // ✅ ถ้ามี token และยังไม่ตั้ง Authorization ให้เติมให้เอง
  if (token && !alreadyHasAuth) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // ✅ ยก signal เข้ามา (รองรับ AbortController จาก caller)
  const baseInit: RequestInit = {
    ...init,
    headers,
    mode: "cors",
    // ถ้าใช้ Authorization header ให้ตัด cookies ออกกันซ้ำซ้อน; ถ้าไม่ได้ใส่ ให้ส่ง include เพื่อใช้ session/cookie ได้
    credentials: (token || alreadyHasAuth) ? "omit" : "include",
  };

  const doFetch = async () => fetch(url, baseInit);

  let res: Response;
  try {
    res = await doFetch();
  } catch (e) {
    console.error("apiFetch network-level failure:", e);
    throw e;
  }

  // 2xx, 3xx, 4xx นอกเหนือ 401 -> ส่งกลับตามปกติ
  if (res.status !== 401) return res;

  // ---------- 401 handling ----------
  // พยายามอ่านรายละเอียดเพื่อชี้ว่าควร refresh ไหม
  let detail = "";
  try {
    const data = await res.clone().json().catch(() => ({} as any));
    detail = data?.detail || "";
  } catch {}

  const refreshToken = getRefreshToken();
  const shouldTryRefresh =
    detail === "token_expired" ||
    detail === "invalid_token" ||
    detail === "session_idle_timeout" ||
    (detail === "Not authenticated" && !!refreshToken) ||
    (!!refreshToken && !token); // กันกรณี access หมดไปแล้ว

  if (shouldTryRefresh) {
    try {
      const r = await fetch(`${API_BASE}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // สำหรับเคส refresh ในคุกกี้
        body: JSON.stringify({ refresh_token: refreshToken || undefined }),
      });

      if (r.ok) {
        // 📥 สมมติ backend คืน JSON { access_token, refresh_token? }
        let acc = "";
        let ref = "";
        try {
          const body = await r.clone().json();
          acc = body?.access_token || "";
          ref = body?.refresh_token || "";
        } catch {
          // บางระบบอาจคืนแค่คุกกี้ -> ข้ามได้
        }

        if (acc) setAccessToken(acc);
        if (ref) setRefreshToken(ref);

        // 🔁 ยิงซ้ำด้วย token ใหม่ถ้ามี
        if (acc && !alreadyHasAuth) {
          headers.set("Authorization", `Bearer ${acc}`);
        }
        const retry = await fetch(url, {
          ...baseInit,
          headers,
          // ถ้าใช้ header แล้ว keep "omit"
          credentials: (acc || alreadyHasAuth) ? "omit" : baseInit.credentials,
        });

        if (retry.status !== 401) return retry;
      }
    } catch (err) {
      console.error("apiFetch refresh flow error:", err);
      // ไปต่อที่ไม่รอด
    }
  }

  // ---------- ไม่รอด -> เคลียร์ token + เด้ง login ----------
  setAccessToken(undefined);
  setRefreshToken(undefined);
  redirectToLogin("expired");
  // โยน error ให้ caller หยุด flow
  throw new Error("UNAUTHENTICATED");
}

/**
 * ตัวช่วยยอดนิยม: ขอ JSON แล้วเช็ค !ok โยน Error ให้เลย
 */
// export async function apiJson<T = any>(input: string | URL, init?: RequestInit): Promise<T> {
//   const res = await apiFetch(input, init);
//   if (!res.ok) {
//     const text = await res.text().catch(() => "");
//     throw new Error(`API ${res.status}: ${text || res.statusText}`);
//   }
//   return res.json() as Promise<T>;
// }
