/**
 * ตัวช่วยกลางของการวางแผน PM — ใช้ร่วมกันระหว่าง
 *   - MaximoWorkOrders.tsx (การ์ดรวมใบงาน Maximo ของ tab mdb/ccb/cb-box/station)
 *   - PmPlanForm.tsx       (ฟอร์มวางแผนเต็มหน้าแบบเดียวกับ CM)
 * แยกออกมาเพื่อไม่ให้ต้องไล่แก้ตรรกะเดียวกัน 2 ที่
 */
import type { Lang } from "@/utils/useLanguage";

export type MaximoSource = "charger" | "mdb" | "ccb" | "cbbox" | "station";

export type EquipmentItem = {
  type: string;              // charger / mdb / ccb / cbbox / station
  sn?: string | null;        // เฉพาะ charger
  location?: string | null;
  label?: string | null;
};

/** ใบงาน PM ที่ Maximo เปิดแล้วยิงเข้ามาทาง IN06 (POST /maximo/pm/open) */
export type MaximoWorkOrder = {
  // 5 field ตาม contract IN06
  location?: string | null;
  pm_date?: string | null;
  wonum?: string | null;
  status?: string | null;
  company?: string | null;
  description?: string | null;
  // ที่ iMPS map ให้เอง
  station_id?: string | null;
  sn?: string | null;
  origin?: string | null;
  selected_equipment?: EquipmentItem[] | null;
  selected_at?: string | null;
  selected_by?: string | null;
  assignees?: string[] | null;
  planned_at?: string | null;
  planned_by?: string | null;
  sched_start?: string | null;
  sched_finish?: string | null;
  planning_status?: string | null;
  receivedAt?: string | null;
};

export type EquipmentChoices = {
  wonum: string;
  station_id?: string | null;
  location?: string | null;
  chargers: EquipmentItem[];
  fixed: EquipmentItem[];
  selected_equipment: EquipmentItem[];
};

export type TechnicianOption = {
  id?: string | null;
  username?: string | null;
  email?: string | null;
  company?: string | null;
};

/** role ที่วางแผน PM ได้ — ต้องตรงกับ PM_PLANNING_ROLES ใน backend/routers/pm_maximo.py */
export const PM_PLANNING_ROLES = ["admin", "owner", "planner"];

export function derivePlanningStatus(
  selectedCountOrItems: number | Array<EquipmentItem | null | undefined> | null | undefined,
  current?: string | null
): "pending" | "planned" {
  const normalized = String(current ?? "").trim().toLowerCase();
  if (normalized === "planned") return "planned";
  if (normalized === "pending") return "pending";

  const count = Array.isArray(selectedCountOrItems)
    ? selectedCountOrItems.filter(Boolean).length
    : Number(selectedCountOrItems ?? 0);

  return count > 0 ? "planned" : "pending";
}

// ป้ายชื่ออุปกรณ์ระดับสถานี — ให้ตรงกับชื่อ tab ในหน้า PM report
export const FIXED_LABELS: Record<string, string> = {
  mdb: "MDB",
  ccb: "CCB",
  cbbox: "CB_BOX",
  station: "Station",
};

/** key ประจำอุปกรณ์ 1 ตัว — charger แยกด้วย sn, ที่เหลือใช้ type ตรง ๆ */
export function equipKey(e: EquipmentItem) {
  return e.type === "charger" ? `charger:${e.sn ?? ""}` : e.type;
}

export function equipLabel(e: EquipmentItem) {
  return e.label || FIXED_LABELS[e.type] || e.sn || e.type;
}

// Same date formatting as the surrounding PM tables
export function formatDate(iso?: string | null, lang: Lang = "th") {
  if (!iso) return "-";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T00:00:00Z") : new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "th-TH-u-ca-gregory", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function statusChipClass(status?: string | null) {
  const s = String(status ?? "").toUpperCase();
  if (s === "COMP" || s === "CLOSE" || s === "CLOSED")
    return "tw-bg-green-50 tw-text-green-700 tw-border-green-200";
  if (s === "INPRG") return "tw-bg-amber-50 tw-text-amber-700 tw-border-amber-200";
  if (s === "OPEN" || s === "APPR" || s === "WAPPR")
    return "tw-bg-blue-50 tw-text-blue-700 tw-border-blue-200";
  if (s === "CAN" || s === "CANCELLED")
    return "tw-bg-red-50 tw-text-red-700 tw-border-red-200";
  return "tw-bg-blue-gray-50 tw-text-blue-gray-700 tw-border-blue-gray-200";
}

export function planningChipClass(status: "pending" | "planned") {
  return status === "planned"
    ? "tw-bg-emerald-50 tw-text-emerald-700 tw-border-emerald-200"
    : "tw-bg-amber-50 tw-text-amber-700 tw-border-amber-200";
}

export function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";
  const cleaned = value.replace(" ", "T");
  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
