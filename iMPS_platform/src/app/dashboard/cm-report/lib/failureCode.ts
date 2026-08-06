// FAILURECODE ที่เก็บใน faulty_equipment เป็นรหัส — ตารางรายการต้องโชว์คำอธิบายแทนรหัส
//
// ใบงานที่เปิดก่อนต่อ Maximo เก็บรหัสชุดเก่าของ iMPS (DCCHARFC/ACCHARFC/STATFC)
// ใบใหม่เก็บรหัสจริงของ Maximo (DCCHARGER/ACCHARGER/STATION) ที่ dropdown ดึงมาจาก
// ZAPIFAILURELIST — ต้องแปลงได้ทั้งสองชุด. ค่าเดิมที่ไม่ใช่รหัสให้แสดงตามเดิม
const FAILURE_CODE_LABELS: Record<string, string> = {
  // รหัสจริงฝั่ง Maximo (ใบงานใหม่)
  DCCHARGER: "DC Charger Failure",
  ACCHARGER: "AC Charger Failure",
  STATION: "Station Failure",
  // รหัสชุดเก่าของ iMPS (ใบงานเดิมใน DB)
  DCCHARFC: "DC Charger Failure",
  ACCHARFC: "AC Charger Failure",
  STATFC: "Station Failure",
};

export function failureCodeLabel(code?: string | null): string {
  const key = (code || "").trim();
  if (!key) return "";
  return FAILURE_CODE_LABELS[key.toUpperCase()] || key;
}
