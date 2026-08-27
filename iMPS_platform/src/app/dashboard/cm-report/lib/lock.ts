/**
 * ล็อกใบงาน CM กันกรอกชนกัน (ฝั่งหน้าจอ)
 *
 * ใครเปิดฟอร์มในโหมดกรอกก่อนได้สิทธิ์แก้ คนที่เข้าทีหลังยังเปิดดูได้แต่กรอกไม่ได้
 * ล็อกมีอายุ 2 นาทีฝั่ง backend (routers/cmreport.py: CM_LOCK_TTL_SECONDS) หน้านี้
 * ต่ออายุให้ทุก 30 วิระหว่างเปิดอยู่ — ปิดจอ/เน็ตหลุดจึงหลุดล็อกเองโดยไม่ต้องมีใครไปปลด
 *
 * ใช้ร่วมกันทุกฟอร์มที่เขียนลงใบงานเดียวกัน: ฟอร์ม Open (cs เปิดใบ / planner วางแผน)
 * กับฟอร์ม In Progress (ช่างกรอกผลซ่อม / planner แก้ก่อนอนุมัติ) — ล็อกตัวเดียวกัน
 * ต่อ 1 ใบงาน คนละฟอร์มก็ชนกันไม่ได้
 */

"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// ต่ออายุถี่กว่าอายุล็อกอยู่มาก — เน็ตสะดุดหนึ่งสองจังหวะยังไม่หลุดสิทธิ์
const RENEW_MS = 30_000;
// ระหว่างรอคิว ขอถี่ขึ้นหน่อย จะได้กรอกต่อได้ทันทีที่คนแรกออกจากหน้าโดยไม่ต้องรีเฟรช
const RETRY_MS = 15_000;

export type LockState = {
    /** ชื่อคนที่ถือสิทธิ์กรอกอยู่ (ถ้าไม่ใช่เรา) — null = เรากรอกได้ */
    lockedBy: string | null;
    /** ยังไม่รู้ผลรอบแรก — ระหว่างนี้ยังไม่ควรปล่อยให้กรอก */
    checking: boolean;
};

function lockUrl(reportId: string, stationId: string) {
    return `${API_BASE}/cmreport/${encodeURIComponent(reportId)}/lock`
        + `?station_id=${encodeURIComponent(stationId)}`;
}

export function useReportLock(reportId: string, stationId: string, enabled: boolean): LockState {
    const [lockedBy, setLockedBy] = useState<string | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        if (!enabled || !reportId || !stationId) {
            // โหมดดูอย่างเดียวไม่ต้องจองสิทธิ์ — ไม่งั้นคนที่แค่เปิดดูจะไปกันคนอื่นกรอก
            setLockedBy(null);
            setChecking(false);
            return;
        }

        let alive = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let held = false;
        const url = lockUrl(reportId, stationId);

        const release = () => {
            if (!held) return;
            held = false;
            // keepalive: ปล่อยล็อกให้ทันแม้แท็บกำลังปิด (ไม่ทันก็แค่รอหมดอายุเอง)
            void fetch(url, { method: "DELETE", credentials: "include", keepalive: true })
                .catch(() => { /* ปล่อยไม่สำเร็จ = รอ TTL หมดอายุ ไม่ต้องแจ้งผู้ใช้ */ });
        };

        const acquire = async () => {
            let delay = RETRY_MS;
            try {
                const res = await fetch(url, { method: "POST", credentials: "include" });
                const data = res.ok ? await res.json() : null;
                if (!alive) return;
                if (data?.held_by_me) {
                    held = true;
                    setLockedBy(null);
                    delay = RENEW_MS;
                } else if (data) {
                    held = false;
                    setLockedBy(String(data.locked_by || "").trim() || null);
                }
                // res ไม่ ok (สิทธิ์/ใบหาย) = ไม่ล็อกใครทั้งนั้น ปล่อยให้ฟอร์มตัดสินเองตาม role
            } catch {
                // เน็ตสะดุด — คงสถานะเดิมไว้แล้วลองใหม่ ไม่ต้องเด้ง error ใส่ผู้ใช้
            } finally {
                if (alive) {
                    setChecking(false);
                    timer = setTimeout(() => void acquire(), delay);
                }
            }
        };

        void acquire();
        window.addEventListener("pagehide", release);

        return () => {
            alive = false;
            if (timer) clearTimeout(timer);
            window.removeEventListener("pagehide", release);
            release();
        };
    }, [reportId, stationId, enabled]);

    return { lockedBy, checking };
}
