// ใบงาน CM เปิดได้จาก 2 ที่: ตาราง CM Report (list) และตารางในหน้า CM Dashboard
// หน้า dashboard จะติด ?from=cm-dashboard มากับ URL ตอนกดเข้าใบงาน เพื่อให้ปุ่มย้อนกลับ
// พากลับไปที่เดิมที่กดเข้ามา ไม่ใช่หน้า list ที่ผู้ใช้ไม่เคยเปิด

export const CM_DASHBOARD_ROUTE = "/dashboard/cm-dashboard";

/** ค่าที่ใส่ใน ?from= ตอนเปิดใบงานจากหน้า CM Dashboard */
export const CM_ORIGIN_DASHBOARD = "cm-dashboard";

type ReadonlyParams = { get(name: string): string | null };

/** ใบงานนี้ถูกเปิดมาจากหน้า CM Dashboard หรือไม่ */
export function cameFromDashboard(searchParams: ReadonlyParams): boolean {
  return (searchParams.get("from") ?? "").trim().toLowerCase() === CM_ORIGIN_DASHBOARD;
}
