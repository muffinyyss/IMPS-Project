// ใบงาน PM เปิดได้จาก 2 ที่: ตารางในหน้า PM report (ราย tab) และหน้า PM List (รวมทุกสถานี)
// หน้า PM List จะติด ?from=pm-list มากับ URL ตอนกดเข้าใบงาน เพื่อให้ปุ่มย้อนกลับ
// พากลับไปที่เดิมที่กดเข้ามา ไม่ใช่ตาราง tab ที่ผู้ใช้ไม่เคยเปิด
// (แพทเทิร์นเดียวกับ cm-report/lib/origin.ts)

export const PM_LIST_ROUTE = "/dashboard/pm-list";

/** หน้าวิเคราะห์ PM — role ที่ดูแดชบอร์ดไม่ได้จะถูกพาไป PM_LIST_ROUTE แทน */
export const PM_DASHBOARD_ROUTE = "/dashboard/pm-dashboard";

/** ค่าที่ใส่ใน ?from= ตอนเปิดใบงานจากหน้า PM List */
export const PM_ORIGIN_LIST = "pm-list";

type ReadonlyParams = { get(name: string): string | null };

function originOf(searchParams: ReadonlyParams): string {
  return (searchParams.get("from") ?? "").trim().toLowerCase();
}

/** ใบงานนี้ถูกเปิดมาจากหน้า PM List หรือไม่ */
export function cameFromPmList(searchParams: ReadonlyParams): boolean {
  return originOf(searchParams) === PM_ORIGIN_LIST;
}

/** หน้าที่ปุ่มย้อนกลับควรพากลับไป — คืน null เมื่อไม่ได้มาจาก PM List */
export function pmBackRoute(searchParams: ReadonlyParams): string | null {
  return cameFromPmList(searchParams) ? PM_LIST_ROUTE : null;
}

/**
 * ฟอร์มกรอก PM (ทั้ง 5 ชนิด) ออกจากฟอร์มแล้วต้องกลับไปหน้าที่เปิดเข้ามา
 * ใช้ทั้งปุ่มย้อนกลับ, หลังกดส่ง และหลังอนุมัติ/ตีกลับ
 *
 *   เปิดจากหน้ารวมของใบ PM สถานี (มี job_id) → กลับหน้ารวมใบนั้น
 *     คง from= ไว้ด้วย ปุ่มย้อนกลับของหน้ารวมจะพากลับ PM List ต่อได้ถูก
 *   เปิดจาก PM List                         → PM List
 *   นอกนั้น                                  → null (ผู้เรียกใช้ทางเดิมของตัวเอง)
 */
export function pmFormReturnRoute(searchParams: ReadonlyParams): string | null {
  const jobId = (searchParams.get("job_id") ?? "").trim();
  if (jobId) {
    const p = new URLSearchParams({ view: "form", job_id: jobId });
    const stationId = searchParams.get("station_id");
    if (stationId) p.set("station_id", stationId);
    const from = searchParams.get("from");
    if (from) p.set("from", from);
    return `/dashboard/pm-report?${p.toString()}`;
  }
  return pmBackRoute(searchParams);
}
