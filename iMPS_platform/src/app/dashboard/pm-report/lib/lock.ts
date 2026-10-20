/**
 * ล็อกกันกรอกชนกันของงาน PM (ฝั่งหน้าจอ) — กลไกเดียวกับใบงาน CM (cm-report/lib/lock.ts)
 *
 * ใครเปิดฟอร์มในโหมดกรอกก่อนได้สิทธิ์แก้ คนที่เข้าทีหลังดูได้อย่างเดียว
 * ล็อกมีอายุ 2 นาทีฝั่ง backend (routers/pm_lock.py) หน้านี้ต่ออายุทุก 30 วิระหว่างเปิดอยู่
 * ปิดจอ/เน็ตหลุดจึงหลุดล็อกเองโดยไม่ต้องมีใครไปปลด
 *
 * ใช้ 2 ที่:
 *   - ฟอร์มกรอกของแต่ละส่วนในใบ PM สถานี — ล็อกทีละส่วน (sectionLockPath)
 *   - หน้าวางแผนใบงาน — ล็อกแผนของใบงาน (planLockPath)
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

export function sectionLockPath(jobId: string, stationId: string, section: string, sn?: string | null) {
  const qs = new URLSearchParams({ station_id: stationId, section });
  if (sn) qs.set("sn", sn);
  return `/stationpmjob/${encodeURIComponent(jobId)}/lock?${qs.toString()}`;
}

export function planLockPath(wonum: string) {
  return `/maximo/pm/${encodeURIComponent(wonum)}/plan-lock`;
}

/** path = null หรือ enabled = false → ไม่จองสิทธิ์ (โหมดดูอย่างเดียวไม่ควรไปกันคนอื่นกรอก) */
export function useEditLock(path: string | null, enabled: boolean): LockState {
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!enabled || !path) {
      setLockedBy(null);
      setChecking(false);
      return;
    }

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let held = false;
    const url = `${API_BASE}${path}`;
    setChecking(true);

    const release = () => {
      if (!held) return;
      held = false;
      // keepalive: ปล่อยล็อกให้ทันแม้แท็บกำลังปิด (ไม่ทันก็แค่รอหมดอายุเอง)
      void fetch(url, { method: "DELETE", credentials: "include", keepalive: true })
        .catch(() => { /* ปล่อยไม่สำเร็จ = รอ TTL หมดอายุ */ });
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
        // res ไม่ ok (สิทธิ์/เอกสารหาย) = ไม่ล็อกใคร ปล่อยให้ฟอร์ม/backend ตัดสินตาม role
      } catch {
        // เน็ตสะดุด — คงสถานะเดิมแล้วลองใหม่
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
  }, [path, enabled]);

  return { lockedBy, checking };
}
