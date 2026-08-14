// ป้ายชื่อ "ผลหลังซ่อม" (repair_result) — ค่าที่เก็บใน DB เป็นภาษาอังกฤษเสมอ
// (ทั้ง Maximo และ backend อ้างค่านี้ตรง ๆ) ที่แปลคือ "ที่แสดง" เท่านั้น ห้ามแปลค่าที่บันทึก
//
// ค่าจริงในระบบมีชุดใหม่ + ชุดเก่าก่อนเปลี่ยนชื่อ ต้องแปลได้ทั้งคู่ ไม่งั้นใบเก่าจะโชว์ดิบ
import type { Lang } from "@/utils/useLanguage";

/** ค่าเดิมก่อนเปลี่ยนชื่อ → ค่าปัจจุบัน */
export const LEGACY_REPAIR_MAP: Record<string, string> = {
  "WO - wait for manpower": "WO - wait for scheduled",
  "WO - wait for spare part": "WO - wait for material",
  "WO - wait for site access": "WO - wait for site condition",
};

export const normalizeRepairResult = (v: string): string =>
  LEGACY_REPAIR_MAP[(v || "").trim()] ?? (v || "").trim();

const LABELS: Record<string, { th: string; en: string }> = {
  "WO - wait for scheduled": { th: "รอกำหนดวันเข้าซ่อม", en: "WO - wait for scheduled" },
  "WO - wait for material": { th: "รออะไหล่/วัสดุ", en: "WO - wait for material" },
  "WO - wait for site condition": { th: "รอสภาพหน้างานพร้อม", en: "WO - wait for site condition" },
  // ค่าที่บันทึกคือ "รออนุมัติ" แต่ในมุมช่างคือซ่อมจบแล้ว จึงโชว์เป็น "แก้ไขสำเร็จ"
  "WO - wait for approve": { th: "แก้ไขสำเร็จ", en: "Repair completed" },
  // ค่าที่ระบบเขียนเองตอนปิดงาน — โผล่ในตาราง/การ์ดประวัติได้
  "แก้ไขสำเร็จ": { th: "แก้ไขสำเร็จ", en: "Repair completed" },
  "แก้ไขไม่สำเร็จ": { th: "แก้ไขไม่สำเร็จ", en: "Repair unsuccessful" },
  "ไม่พบปัญหา": { th: "ไม่พบปัญหา", en: "No problem found" },
};

/**
 * รหัสผลหลังซ่อม → ข้อความตามภาษาที่เลือก
 * ค่าที่ไม่รู้จัก (ข้อความอิสระของใบเก่า) คืนค่าเดิม — ตารางจะได้ไม่เคยว่าง
 */
export function repairResultLabel(value?: string | null, lang: Lang = "th"): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  // ใบเก่าบางใบเก็บ status "Wait for approve" มาที่ช่องนี้ (ไม่มี prefix "WO - ")
  const key = raw.toLowerCase() === "wait for approve" ? "WO - wait for approve" : normalizeRepairResult(raw);
  return LABELS[key]?.[lang] ?? raw;
}

/** ตัวเลือกผลหลังซ่อมที่ช่างเลือกได้ในฟอร์ม In Progress */
export const REPAIR_RESULT_VALUES = [
  "WO - wait for scheduled",
  "WO - wait for material",
  "WO - wait for site condition",
  "WO - wait for approve",
] as const;
