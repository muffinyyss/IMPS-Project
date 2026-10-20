"use client";

import { useEffect } from "react";
import { showSessionToast } from "@/utils/session-toast";
import { safeNextPath } from "@/utils/safe-next";

// middleware ส่งมาที่นี่เมื่อเปิดหน้า dashboard แล้ว token หมดอายุ (เคย login ไว้)
// แสดง toast "เซสชันหมดอายุ ... กำลังนำไปหน้าเข้าสู่ระบบ" แบบเดียวกับตอน API ตอบ 401 แล้วค่อยไปหน้า login
export default function SessionExpiredPage() {
  useEffect(() => {
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    const loginUrl = `/auth/signin/basic?reason=token_expired${next ? `&next=${encodeURIComponent(next)}` : ""}`;
    const go = () => window.location.replace(loginUrl);
    const fallback = setTimeout(go, 3500);
    showSessionToast("token_expired", {
      duration: 3000,
      onDone: () => {
        clearTimeout(fallback);
        go();
      },
    });
    return () => clearTimeout(fallback);
  }, []);

  return null;
}
