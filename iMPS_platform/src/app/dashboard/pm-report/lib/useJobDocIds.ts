"use client";

/**
 * เลขที่เอกสาร / ชื่อเอกสารของใบ PM สถานี (ใบแม่) ที่ฟอร์มส่วนนี้สังกัดอยู่
 *
 * ทุกส่วนของใบใช้เลขเดียวกับใบแม่ — backend ประทับเลขของใบแม่ลงส่วนตอนบันทึกครั้งแรก
 * ส่วนที่ยังไม่เคยบันทึกจึงไม่มีเลขในตัวเอง หัวฟอร์มต้องอ่านจากใบแม่แทน
 * ไม่ได้เปิดจากใบแม่ (ไม่มี job_id) = ใบเดี่ยวแบบเดิม คืน null ให้ฟอร์มใช้ค่าของตัวเอง
 */

import { useEffect, useState } from "react";
import { apiFetch } from "@/utils/api";

export type JobDocIds = { issue_id: string; doc_name: string };

export function useJobDocIds(jobId: string | null | undefined, stationId: string | null | undefined): JobDocIds | null {
  const [ids, setIds] = useState<JobDocIds | null>(null);

  useEffect(() => {
    setIds(null);
    if (!jobId || !stationId) return;
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch(
          `/stationpmjob/${encodeURIComponent(jobId)}?station_id=${encodeURIComponent(stationId)}`
        );
        if (!res.ok) return;
        const json = await res.json().catch(() => ({} as any));
        if (!alive || !json?.job) return;
        setIds({ issue_id: String(json.job.issue_id ?? ""), doc_name: String(json.job.doc_name ?? "") });
      } catch (err) {
        console.error("load PM job doc ids failed:", err);
      }
    })();
    return () => { alive = false; };
  }, [jobId, stationId]);

  return ids;
}
