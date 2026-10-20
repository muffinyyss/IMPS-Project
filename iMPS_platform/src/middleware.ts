import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ด่านหน้าของหน้า dashboard — ทำงานบน server ก่อนเรนเดอร์หน้าใด ๆ
// เดิมการกันอยู่ฝั่ง client อย่างเดียว server จึงเรนเดอร์หน้า dashboard ให้ request ที่ไม่มี session เลย
//
// ตรวจแค่ว่ามี token ที่ยังไม่หมดอายุ ไม่ตรวจลายเซ็น: secret ของ JWT อยู่ที่ backend เท่านั้น
// และหน้าเว็บไม่มีข้อมูลในตัว — ข้อมูลทุกชิ้นมาจาก API ซึ่ง backend ตรวจ session + สิทธิ์ทุกครั้ง
// คุกกี้ถูกตั้งโดย backend: prod อยู่ origin เดียวกัน (nginx), dev คือ localhost ต่างพอร์ต (คุกกี้ไม่แยกพอร์ต)
// access token หมดอายุ = หลุดทันที ไม่ต่ออายุด้วย refresh token
const ACCESS_COOKIE = "access_token";
// ใช้แค่เป็นสัญญาณว่า "เคย login ไว้" (คุกกี้อยู่ 7 วัน, logout ลบทิ้ง) เพื่อแจ้งผู้ใช้ว่าเซสชันหมดอายุ
const REFRESH_COOKIE = "refresh_token";

function unexpired(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const part = token.split(".")[1] ?? "";
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
    const exp = JSON.parse(atob(b64))?.exp;
    return typeof exp === "number" && exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  if (unexpired(request.cookies.get(ACCESS_COOKIE)?.value)) {
    return NextResponse.next();
  }
  const hadSession = request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);
  const target = new URL(hadSession ? "/auth/session-expired" : "/auth/signin/basic", request.url);
  target.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
