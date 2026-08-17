// ขอบเขตการเห็น/เปิดใบงาน CM ตามยี่ห้อตู้ชาร์จที่บริษัทนั้นดูแล
//
// EDS ดูแลเฉพาะตู้ FlexxFast → พนักงาน EDS role cs/planner/technician เห็นและเปิดใบงานได้เฉพาะตู้ยี่ห้อนี้
// technician ของบริษัทอื่นเห็นทุกสถานีและทุกยี่ห้อ
// EGAT (และบริษัทอื่น) เห็นทุกยี่ห้อ | admin/owner ไม่ถูกจำกัดไม่ว่าสังกัดไหน
//
// กติกาชุดนี้ถูกบังคับจริงที่ backend (routers/cmreport.py) — ฝั่งนี้มีไว้บอกผู้ใช้ล่วงหน้า
// ไม่ให้กรอกฟอร์มจนจบแล้วเพิ่งโดนปฏิเสธตอนกดบันทึก

export const FLEXXFAST_BRAND = "flexxfast";

const BRAND_SCOPED_ROLES = ["planner", "technician", "cs"];

/** company (ตัวพิมพ์เล็ก) → ยี่ห้อที่บริษัทนั้นดูแล */
const COMPANY_BRAND_SCOPE: Record<string, string> = { eds: FLEXXFAST_BRAND };

/** ยี่ห้อที่ user คนนี้ถูกจำกัดให้เห็น — null = ไม่จำกัด */
export function brandScopeOf(role: string, company: string): string | null {
  if (!BRAND_SCOPED_ROLES.includes((role || "").trim().toLowerCase())) return null;
  return COMPANY_BRAND_SCOPE[(company || "").trim().toLowerCase()] ?? null;
}

/**
 * เปิดใบงานที่สถานีนี้ได้ไหม
 *
 * ฟอร์มเปิดใบงานเลือกได้แค่ failure class ระดับสถานี (DCCHARGER/ACCHARGER/STATION)
 * ไม่ได้ระบุตู้ จึงต้องเป็นสถานีที่ตู้ทุกตู้เป็นยี่ห้อที่ดูแลอยู่ — ไม่งั้นใบที่เปิดจะกลาย
 * เป็นใบที่ตัวเองมองไม่เห็นทันทีที่กดบันทึก
 */
export function canOpenCmAtStation(
  chargers: { brand?: string }[],
  scope: string | null,
): boolean {
  if (!scope) return true;
  if (!chargers.length) return false; // ไม่มีข้อมูลตู้ = พิสูจน์ยี่ห้อไม่ได้
  return chargers.every((c) => (c.brand || "").trim().toLowerCase() === scope);
}
