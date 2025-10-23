

// // // src/lib/api.ts
// // const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// // const ACCESS_KEY = "access_token";
// // const ACCESS_KEY2 = "accessToken";
// // const REFRESH_KEY = "refresh_token";

// // function toUrl(input: RequestInfo | URL) {
// //   const s = typeof input === "string" ? input : input.toString();
// //   return s.startsWith("/") ? `${API_BASE}${s}` : s;
// // }

// // function getAccessToken() {
// //   if (typeof window === "undefined") return "";
// //   return localStorage.getItem(ACCESS_KEY) || localStorage.getItem(ACCESS_KEY2) || "";
// // }

// // function setAccessToken(token?: string) {
// //   try {
// //     if (!token) {
// //       localStorage.removeItem(ACCESS_KEY);
// //       localStorage.removeItem(ACCESS_KEY2);
// //     } else {
// //       localStorage.setItem(ACCESS_KEY, token);
// //       localStorage.setItem(ACCESS_KEY2, token);
// //     }
// //   } catch { }
// // }

// // function getRefreshToken() {
// //   if (typeof window === "undefined") return "";
// //   return localStorage.getItem(REFRESH_KEY) || "";
// // }

// // function setRefreshToken(token?: string) {
// //   try {
// //     if (!token) localStorage.removeItem(REFRESH_KEY);
// //     else localStorage.setItem(REFRESH_KEY, token);
// //   } catch { }
// // }

// // function redirectToLogin(reason = "expired") {
// //   if (typeof window === "undefined") return;
// //   const next = encodeURIComponent(window.location.pathname + window.location.search);
// //   window.location.replace(`/auth/signin/basic?reason=${reason}&next=${next}`);
// // }

// // export async function apiFetch(input: string | URL, init: RequestInit = {}) {
// //   const url = toUrl(input);

// //   // ⚙️ Headers ที่แก้ไขได้
// //   const headers = new Headers(init.headers || {});
// //   const alreadyHasAuth = headers.has("Authorization");
// //   const token = getAccessToken();

// //   // ✅ ถ้ามี token และยังไม่ตั้ง Authorization ให้เติมให้เอง
// //   if (token && !alreadyHasAuth) {
// //     headers.set("Authorization", `Bearer ${token}`);
// //   }

// //   // ✅ ยก signal เข้ามา (รองรับ AbortController จาก caller)
// //   const baseInit: RequestInit = {
// //     ...init,
// //     headers,
// //     mode: "cors",
// //     // ถ้าใช้ Authorization header ให้ตัด cookies ออกกันซ้ำซ้อน; ถ้าไม่ได้ใส่ ให้ส่ง include เพื่อใช้ session/cookie ได้
// //     credentials: (token || alreadyHasAuth) ? "omit" : "include",
// //   };

// //   const doFetch = async () => fetch(url, baseInit);

// //   let res: Response;
// //   try {
// //     res = await doFetch();
// //   } catch (e) {
// //     console.error("apiFetch network-level failure:", e);
// //     throw e;
// //   }

// //   // 2xx, 3xx, 4xx นอกเหนือ 401 -> ส่งกลับตามปกติ
// //   if (res.status !== 401) return res;

// //   // ---------- 401 handling ----------
// //   // พยายามอ่านรายละเอียดเพื่อชี้ว่าควร refresh ไหม
// //   let detail = "";
// //   try {
// //     const data = await res.clone().json().catch(() => ({} as any));
// //     detail = data?.detail || "";
// //   } catch { }

// //   const refreshToken = getRefreshToken();
// //   // const shouldTryRefresh =
// //   //   detail === "token_expired" ||
// //   //   detail === "invalid_token" ||
// //   //   detail === "session_idle_timeout" ||
// //   //   (detail === "Not authenticated" && !!refreshToken) ||
// //   //   (!!refreshToken && !token); // กันกรณี access หมดไปแล้ว

// //   const isRefreshEndpoint = url.includes("/refresh");
// //   const shouldTryRefresh =
// //     !!refreshToken && !isRefreshEndpoint;

// //   if (shouldTryRefresh) {
// //     try {
// //       const r = await fetch(`${API_BASE}/refresh`, {
// //         method: "POST",
// //         headers: { "Content-Type": "application/json" },
// //         credentials: "include", // สำหรับเคส refresh ในคุกกี้
// //         body: JSON.stringify({ refresh_token: refreshToken || undefined }),
// //       });

// //       if (r.ok) {
// //         // 📥 สมมติ backend คืน JSON { access_token, refresh_token? }
// //         let acc = "";
// //         let ref = "";
// //         try {
// //           const body = await r.clone().json();
// //           acc = body?.access_token || "";
// //           ref = body?.refresh_token || "";
// //         } catch {
// //           // บางระบบอาจคืนแค่คุกกี้ -> ข้ามได้
// //         }

// //         if (acc) setAccessToken(acc);
// //         if (ref) setRefreshToken(ref);

// //         // 🔁 ยิงซ้ำด้วย token ใหม่ถ้ามี
// //         if (acc && !alreadyHasAuth) {
// //           headers.set("Authorization", `Bearer ${acc}`);
// //         }
// //         const retry = await fetch(url, {
// //           ...baseInit,
// //           headers,
// //           // ถ้าใช้ header แล้ว keep "omit"
// //           // credentials: (acc || alreadyHasAuth) ? "omit" : baseInit.credentials,
// //           credentials: (acc || alreadyHasAuth) ? "omit" : "include",
// //         });

// //         if (retry.status !== 401) return retry;
// //       }
// //     } catch (err) {
// //       console.error("apiFetch refresh flow error:", err);
// //       // ไปต่อที่ไม่รอด
// //     }
// //   }

// //   // ---------- ไม่รอด -> เคลียร์ token + เด้ง login ----------
// //   setAccessToken(undefined);
// //   setRefreshToken(undefined);
// //   redirectToLogin("expired");
// //   // โยน error ให้ caller หยุด flow
// //   throw new Error("UNAUTHENTICATED");
// // }

// // /**
// //  * ตัวช่วยยอดนิยม: ขอ JSON แล้วเช็ค !ok โยน Error ให้เลย
// //  */
// // // export async function apiJson<T = any>(input: string | URL, init?: RequestInit): Promise<T> {
// // //   const res = await apiFetch(input, init);
// // //   if (!res.ok) {
// // //     const text = await res.text().catch(() => "");
// // //     throw new Error(`API ${res.status}: ${text || res.statusText}`);
// // //   }
// // //   return res.json() as Promise<T>;
// // // }


// // "@/utils/api.ts"

// const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// const ACCESS_KEY = "access_token";
// const ACCESS_KEY2 = "accessToken"; // เผื่อโค้ดเก่า
// const REFRESH_KEY = "refresh_token";

// // ===================== Utils =====================
// function toUrl(input: RequestInfo | URL) {
//   const s = typeof input === "string" ? input : input.toString();
//   return s.startsWith("/") ? `${API_BASE}${s}` : s;
// }

// const isBrowser = () => typeof window !== "undefined";

// // ===================== Token I/O =====================
// function getAccessToken() {
//   if (!isBrowser()) return "";
//   return localStorage.getItem(ACCESS_KEY) || localStorage.getItem(ACCESS_KEY2) || "";
// }
// function setAccessToken(token?: string) {
//   try {
//     if (!token) {
//       localStorage.removeItem(ACCESS_KEY);
//       localStorage.removeItem(ACCESS_KEY2);
//     } else {
//       localStorage.setItem(ACCESS_KEY, token);
//       localStorage.setItem(ACCESS_KEY2, token);
//     }
//   } catch {}
// }

// function getRefreshToken() {
//   if (!isBrowser()) return "";
//   return localStorage.getItem(REFRESH_KEY) || "";
// }
// function setRefreshToken(token?: string) {
//   try {
//     if (!token) localStorage.removeItem(REFRESH_KEY);
//     else localStorage.setItem(REFRESH_KEY, token);
//   } catch {}
// }

// // ===================== Redirect =====================
// let _isRedirecting = false;
// function redirectToLogin(reason = "expired") {
//   if (!isBrowser() || _isRedirecting) return;
//   _isRedirecting = true;
//   const next = encodeURIComponent(window.location.pathname + window.location.search);
//   window.location.replace(`/auth/signin/basic?reason=${reason}&next=${next}`);
// }

// // ===================== apiFetch (ศูนย์กลาง) =====================
// export async function apiFetch(input: string | URL, init: RequestInit = {}) {
//   const url = toUrl(input);

//   // --- DEV guard: เตือนถ้าใช้ผิดรูปแบบ ---
//   const isDev = isBrowser() && process.env.NODE_ENV !== "production";
//   if (isDev) {
//     const raw = typeof input === "string" ? input : input.toString();
//     if (/^https?:\/\//i.test(raw)) {
//       console.warn("[apiFetch] Avoid absolute URL:", raw, "→ use relative path like `/foo`");
//     }
//     if (init.credentials) {
//       console.warn("[apiFetch] Avoid setting credentials in callers. apiFetch manages this.");
//     }
//     if (new Headers(init.headers || {}).has("Authorization")) {
//       console.warn("[apiFetch] Avoid setting Authorization in callers. Let apiFetch handle it.");
//     }
//   }

//   // --- Headers/credentials พื้นฐาน ---
//   const headers = new Headers(init.headers || {});
//   const alreadyHasAuth = headers.has("Authorization");
//   const token = getAccessToken();

//   // ถ้ามี token และ caller ยังไม่ได้ตั้ง Authorization ให้เติมเอง
//   if (token && !alreadyHasAuth) {
//     headers.set("Authorization", `Bearer ${token}`);
//   }

//   const baseInit: RequestInit = {
//     ...init,
//     headers,
//     mode: "cors",
//     // ถ้ามี Authorization header หรือมี token → ตัด cookies กันซ้ำซ้อน
//     // ถ้าไม่มี → ใช้คุกกี้ได้ (session-based)
//     credentials: (token || alreadyHasAuth) ? "omit" : "include",
//   };

//   const doFetch = async () => fetch(url, baseInit);

//   let res: Response;
//   try {
//     res = await doFetch();
//   } catch (e) {
//     console.error("apiFetch network-level failure:", e);
//     throw e;
//   }

//   // ไม่ใช่ 401 → ส่งกลับตามปกติ (รวม 2xx/3xx/4xx อื่น ๆ)
//   if (res.status !== 401) return res;

//   // ---------- 401 handling ----------
//   // พยายามอ่าน detail จาก body (ไม่พังถ้าไม่ใช่ JSON)
//   let detail = "";
//   try {
//     const data = await res.clone().json().catch(() => ({} as any));
//     detail = data?.detail || "";
//   } catch {}

//   const refreshToken = getRefreshToken();
//   const isRefreshEndpoint = url.includes("/refresh");

//   // บาง backend ไม่ได้ส่ง detail ชัดเจน → ถ้ามี refresh token ให้ลอง refresh เสมอ (กัน false negative)
//   const shouldTryRefresh =
//     !!refreshToken && !isRefreshEndpoint && (
//       detail === "token_expired" ||
//       detail === "invalid_token" ||
//       detail === "session_idle_timeout" ||
//       detail === "Not authenticated" ||
//       // fallback: มี RT ก็ลองเถอะ
//       true
//     );

//   if (shouldTryRefresh) {
//     try {
//       const r = await fetch(`${API_BASE}/refresh`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         credentials: "include", // refresh โดยพึ่งคุกกี้ได้
//         body: JSON.stringify({ refresh_token: refreshToken || undefined }),
//       });

//       if (r.ok) {
//         // สมมติ backend คืน JSON { access_token, refresh_token? } หรือแค่ Set-Cookie
//         let acc = "";
//         let ref = "";
//         try {
//           const body = await r.clone().json();
//           acc = body?.access_token || "";
//           ref = body?.refresh_token || "";
//         } catch {
//           // บางระบบอาจคืนแค่คุกกี้ -> ข้ามได้
//         }

//         if (acc) setAccessToken(acc);
//         if (ref) setRefreshToken(ref);

//         // ยิงซ้ำ
//         if (acc && !alreadyHasAuth) {
//           headers.set("Authorization", `Bearer ${acc}`);
//         }

//         const retry = await fetch(url, {
//           ...baseInit,
//           headers,
//           // 👇 จุดสำคัญ: ถ้าไม่มี acc ใหม่ และ caller ก็ไม่ได้ใส่ Authorization เอง
//           // แปลว่าเราต้องพึ่ง "คุกกี้" จาก /refresh → ต้องส่ง credentials: "include"
//           credentials: (acc || alreadyHasAuth) ? "omit" : "include",
//         });

//         if (retry.status !== 401) return retry;
//       }
//     } catch (err) {
//       console.error("apiFetch refresh flow error:", err);
//       // ดำเนินต่อไปสู่การเคลียร์ token + redirect
//     }
//   }

//   // ---------- ไม่รอด → เคลียร์ token + เด้ง login ----------
//   setAccessToken(undefined);
//   setRefreshToken(undefined);

//   if (isBrowser()) {
//     redirectToLogin("expired");
//     throw new Error("UNAUTHENTICATED");
//   } else {
//     // ฝั่ง Server: ให้ caller ตัดสินใจ redirect เอง
//     const err: any = new Error("UNAUTHENTICATED_SERVER");
//     err.code = "UNAUTHENTICATED_SERVER";
//     err.loginUrl = "/auth/signin/basic";
//     throw err;
//   }
// }

// // ===================== Helper functions (แนะนำให้ใช้) =====================
// // ใช้แทนการเขียน fetch เอง เพื่อลดโอกาสส่ง headers/credentials ผิดรูปแบบ

// export function get(path: string, init?: RequestInit) {
//   return apiFetch(path, { ...init, method: "GET" });
// }

// export function del(path: string, init?: RequestInit) {
//   return apiFetch(path, { ...init, method: "DELETE" });
// }

// export function postJson(path: string, body: unknown, init?: RequestInit) {
//   const headers = new Headers(init?.headers || {});
//   if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
//   return apiFetch(path, { ...init, method: "POST", headers, body: JSON.stringify(body) });
// }

// export function patchJson(path: string, body: unknown, init?: RequestInit) {
//   const headers = new Headers(init?.headers || {});
//   if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
//   return apiFetch(path, { ...init, method: "PATCH", headers, body: JSON.stringify(body) });
// }

// export function postForm(path: string, formData: FormData, init?: RequestInit) {
//   // อย่าตั้ง Content-Type เอง ให้ browser ใส่ boundary
//   return apiFetch(path, { ...init, method: "POST", body: formData });
// }

// utils/api.ts
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

function redirectToLogin(reason = "expired") {
  if (typeof window === "undefined") return;
  const next = encodeURIComponent(
    window.location.pathname + window.location.search
  );
  window.location.replace(`/auth/signin/basic?reason=${reason}&next=${next}`);
}

export async function apiFetch(input: string | URL, init: RequestInit = {}) {
  const url = toUrl(input);

  // รวม headers เดิม + ใส่ Authorization ถ้ายังไม่มี
  const headers = new Headers(init.headers || {});
  const alreadyHasAuth = headers.has("Authorization");
  const token = getAccessToken();

  if (token && !alreadyHasAuth) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // ถ้ามี Authorization ให้ตัด cookies ออกกันซ้ำซ้อน; ถ้าไม่มีจะส่งรวม cookie (session)
  const baseInit: RequestInit = {
    ...init,
    headers,
    mode: "cors",
    credentials: token || alreadyHasAuth ? "omit" : "include",
  };

  const doFetch = async () => fetch(url, baseInit);

  let res: Response;
  try {
    res = await doFetch();
  } catch (e) {
    console.error("apiFetch network-level failure:", e);
    throw e;
  }

  // ถ้าไม่ใช่ 401 ก็ส่งต่อปกติ
  if (res.status !== 401) return res;

  // ---------- handle 401 ----------
  // พยายามอ่าน detail จาก body เพื่อช่วยตัดสินใจ refresh
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
    (!!refreshToken && !token); // กันกรณี access หมดแล้วแต่ยังมี refresh อยู่

  if (shouldTryRefresh) {
    try {
      const r = await fetch(`${API_BASE}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // สำคัญ: รับ/ส่งคุกกี้ตอนรีเฟรช
        body: JSON.stringify({ refresh_token: refreshToken || undefined }),
      });

      if (r.ok) {
        // บางระบบคืน JSON { access_token, refresh_token? } | บางระบบคืนคุกกี้อย่างเดียว
        let acc = "";
        let ref = "";
        try {
          const body = await r.clone().json();
          acc = body?.access_token || "";
          ref = body?.refresh_token || "";
        } catch {
          // ไม่มี JSON ก็โอเค อาจเป็นคุกกี้ล้วน
        }

        if (acc) setAccessToken(acc);
        if (ref) setRefreshToken(ref);

        // ✅ กำหนดวิธี retry:
        // - ถ้ามี access token ใหม่ → ใช้ Authorization header ได้ (credentials: omit)
        // - ถ้าไม่มี access token ใหม่ (คุกกี้ล้วน) → ลบ Authorization ทิ้ง แล้วใช้ credentials: include
        const retryHeaders = new Headers(headers);
        if (acc && !alreadyHasAuth) {
          retryHeaders.set("Authorization", `Bearer ${acc}`);
        } else if (!acc) {
          retryHeaders.delete("Authorization");
        }

        const retry = await fetch(url, {
          ...baseInit,
          headers: retryHeaders,
          credentials: acc || alreadyHasAuth ? "omit" : "include",
        });

        if (retry.status !== 401) return retry;
      }
    } catch (err) {
      console.error("apiFetch refresh flow error:", err);
      // ไปต่อให้เคลียร์ token แล้วเด้ง login
    }
  }

  // ---------- refresh ไม่รอด -> ล้าง token + เด้ง login ----------
  setAccessToken(undefined);
  setRefreshToken(undefined);
  redirectToLogin("expired");
  throw new Error("UNAUTHENTICATED");
}
