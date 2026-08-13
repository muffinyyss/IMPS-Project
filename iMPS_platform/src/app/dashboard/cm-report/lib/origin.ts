// ใบงาน CM เปิดได้จาก 2 ที่: ตาราง CM Report (list) และตารางในหน้า CM Dashboard
// หน้า dashboard จะติด ?from=cm-dashboard มากับ URL ตอนกดเข้าใบงาน เพื่อให้ปุ่มย้อนกลับ
// พากลับไปที่เดิมที่กดเข้ามา ไม่ใช่หน้า list ที่ผู้ใช้ไม่เคยเปิด

export const CM_DASHBOARD_ROUTE = "/dashboard/cm-dashboard";
/** ตารางใบงาน CM ที่แยกออกจากหน้า CM Dashboard */
export const CM_LIST_ROUTE = "/dashboard/cm-list";

/** ค่าที่ใส่ใน ?from= ตอนเปิดใบงานจากหน้า CM Dashboard */
export const CM_ORIGIN_DASHBOARD = "cm-dashboard";
/** ค่าที่ใส่ใน ?from= ตอนเปิดใบงานจากหน้า CM List (ตาราง) */
export const CM_ORIGIN_LIST = "cm-list";

type ReadonlyParams = { get(name: string): string | null };

function originOf(searchParams: ReadonlyParams): string {
  return (searchParams.get("from") ?? "").trim().toLowerCase();
}

/** ใบงานนี้ถูกเปิดมาจากหน้า CM Dashboard หรือ CM List หรือไม่ */
export function cameFromDashboard(searchParams: ReadonlyParams): boolean {
  return [CM_ORIGIN_DASHBOARD, CM_ORIGIN_LIST].includes(originOf(searchParams));
}

/**
 * หน้าที่ปุ่มย้อนกลับควรพากลับไป — ต้องกลับไปหน้าที่กดเข้ามาจริง ๆ
 * (dashboard กับตารางใบงานเป็นคนละหน้าแล้ว) คืน null เมื่อไม่ได้มาจากสองหน้านี้
 */
export function cmBackRoute(searchParams: ReadonlyParams): string | null {
  const from = originOf(searchParams);
  if (from === CM_ORIGIN_LIST) return CM_LIST_ROUTE;
  if (from === CM_ORIGIN_DASHBOARD) return CM_DASHBOARD_ROUTE;
  return null;
}
