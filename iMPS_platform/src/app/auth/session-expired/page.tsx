"use client";

import { useEffect } from "react";
import { showSessionToast, detailToProblem } from "@/utils/session-toast";
import { safeNextPath } from "@/utils/safe-next";

// มาที่นี่ 2 ทาง แล้วแสดง toast "เซสชันหมดอายุ ... กำลังนำไปหน้าเข้าสู่ระบบ" แบบเดียวกับตอน API ตอบ 401:
// - middleware: เปิดหน้า dashboard แล้ว token หมดอายุ (เคย login ไว้) — มี ?next=<หน้าเดิม>
// - backend (auth_redirect.py): เปิดลิงก์ PDF / zip รูปในแท็บใหม่ตอน session หมด — มี ?reason=<detail ของ 401>
export default function SessionExpiredPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = safeNextPath(params.get("next"));
    const reason = params.get("reason") || "token_expired";
    const loginUrl = `/auth/signin/basic?reason=${encodeURIComponent(reason)}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
    const go = () => window.location.replace(loginUrl);
    const fallback = setTimeout(go, 3500);
    showSessionToast(detailToProblem(reason), {
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
