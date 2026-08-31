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
