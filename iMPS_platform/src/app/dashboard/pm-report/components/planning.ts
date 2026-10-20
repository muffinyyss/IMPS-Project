/**
 * ตัวช่วยกลางของการวางแผน PM — ใช้ร่วมกันระหว่าง
 *   - PmPlanForm.tsx       (ฟอร์มวางแผนของ planner)
 *   - PmWorkOrderInfo.tsx  (หน้าข้อมูลใบงานที่ช่างเห็นก่อนเริ่มกรอก)
 *   - flow.tsx             (แถว/สถานะใบงานในตารางของทั้ง 5 tab)
 * แยกออกมาเพื่อไม่ให้ต้องไล่แก้ตรรกะเดียวกันหลายที่
 */
import { apiFetch } from "@/utils/api";
import type { Lang } from "@/utils/useLanguage";

export type MaximoSource = "charger" | "mdb" | "ccb" | "cbbox" | "station";

export type EquipmentItem = {
  type: string;              // charger / mdb / ccb / cbbox / station
  sn?: string | null;        // เฉพาะ charger
  location?: string | null;
  label?: string | null;
  /** vendor ที่ดูแลตู้ (ช่อง Vendor ของตู้) — มีเฉพาะในรายการตัวเลือกตอนวางแผน ใช้เป็นคำใบ้เท่านั้น */
  vendor?: string | null;
  /**
   * ผู้ทำ PM อุปกรณ์ชิ้นนี้ในใบงานนี้ (vendor / outsource) — ว่าง = ทีมของ planner เอง
   * เลือกได้ทุกชนิด รวม Station/MDB/CCB/CB_BOX (จ้าง vendor ทำทั้งสถานี = เลือก vendor ทุกชิ้น)
   */
  by?: string | null;
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
  /** แก้แผนหลังวางแผนครั้งแรก */
  plan_edited_at?: string | null;
  plan_edited_by?: string | null;
  /** บริษัทของ planner ต้นทาง — เจ้าของงานทุกส่วนที่ไม่ได้ส่งต่อให้ vendor */
  planner_company?: string | null;
  sched_start?: string | null;
  sched_finish?: string | null;
  planning_status?: string | null;
  receivedAt?: string | null;
  /** vendor ที่ planner ต้นทางเลือกและมี planner ของตัวเอง — ต้องวางแผนอีกรอบ */
  vendor_plans?: VendorPlan[] | null;
};

/** แผนรอบที่ 2 ของ vendor 1 ราย — แผนของ planner ต้นทางยังอยู่ครบ ไม่ถูกแก้ */
export type VendorPlan = {
  vendor: string;
  status: "pending" | "planned" | string;
  planned_by?: string;
  planned_at?: string;
  sched_start?: string;
  sched_finish?: string;
  assignees?: string[];
  edited_by?: string;
  edited_at?: string;
  /** SN ของตู้ที่เป็นงานของ vendor รายนี้ — ว่างทั้ง chargers และ sections = ส่งต่อทั้งใบแบบเดิม */
  chargers?: string[];
  /** ส่วนระดับสถานีที่เป็นงานของ vendor รายนี้ เช่น ["station", "mdb"] */
  sections?: string[];
};

/**
 * key ของอุปกรณ์ 1 ชิ้นสำหรับเทียบผู้ทำ PM — ตู้ชาร์จ "charger:<sn ตัวพิมพ์เล็ก>" ที่เหลือใช้ type
 * ต้องตรงกับ item_key() ใน backend/routers/pm_scope.py
 */
export function byKey(e: Pick<EquipmentItem, "type" | "sn">): string {
  const type = String(e.type ?? "").trim().toLowerCase();
  return type === "charger" ? `charger:${String(e.sn ?? "").trim().toLowerCase()}` : type;
}

/**
 * byKey ของอุปกรณ์ → ผู้ทำ PM ที่ planner เลือกให้ชิ้นนั้น (vendor / outsource)
 * ชิ้นที่ไม่อยู่ในผล = ทีมของ planner เอง (backend เป็นคนตัดสินสิทธิ์จริง — routers/pm_scope.py)
 */
export function equipmentByMap(
  wo: Pick<MaximoWorkOrder, "vendor_plans" | "selected_equipment"> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  // ใบส่งต่อที่ผูกอุปกรณ์ไว้ (ข้อมูลรุ่นก่อนที่ยังไม่มีผู้ทำ PM รายชิ้น)
  for (const v of wo?.vendor_plans ?? []) {
    const name = String(v.vendor ?? "").trim();
    for (const sn of v.chargers ?? []) {
      if (String(sn ?? "").trim()) out[byKey({ type: "charger", sn })] = name;
    }
    for (const sec of v.sections ?? []) {
      if (String(sec ?? "").trim()) out[byKey({ type: sec })] = name;
    }
  }
  for (const e of wo?.selected_equipment ?? []) {
    const by = String(e.by ?? "").trim();
    if (!by) continue;
    if (e.type === "charger" && !String(e.sn ?? "").trim()) continue;
    out[byKey(e)] = by;
  }
  return out;
}

/**
 * แผนของ vendor ที่เป็นบริษัทของคนที่ login อยู่ (ไม่มี = ใบงานนี้ไม่ได้ส่งต่อมาให้)
 *
 * ใบงานที่ planner ต้นทางเลือกบริษัทเราเป็นผู้รับผิดชอบแต่ไม่มีใบส่งต่อเก็บไว้
 * (Assign ก่อนมีฟีเจอร์ส่งต่อ / ตอนนั้นบริษัทเรายังไม่มีบัญชี planner) ถือว่าส่งต่อมาให้
 * วางแผนเหมือนกัน — คืนแผนสถานะ pending ให้ (backend สร้างให้จริงตอนกด Assign)
 */
export function myVendorPlan(
  wo: Pick<MaximoWorkOrder, "vendor_plans" | "assignees"> | null | undefined,
  company: string | null | undefined,
): VendorPlan | null {
  const c = String(company ?? "").trim().toLowerCase();
  if (!c) return null;
  const stored = (wo?.vendor_plans ?? []).find((v) => String(v.vendor ?? "").trim().toLowerCase() === c);
  if (stored) return stored;
  const named = (wo?.assignees ?? []).find((n) => String(n ?? "").trim().toLowerCase() === c);
  return named ? { vendor: String(named).trim(), status: "pending" } : null;
}

/**
 * vendor ที่ถูกส่งต่อแต่ยังไม่ได้วางแผน = ยังไม่ได้ส่งทีม/ช่างเข้าหน้างาน
 * ใบงานที่ยังเหลือรายการนี้ถือว่ายัง "Open" ทุกหน้าจอ และยังเริ่ม PM ไม่ได้
 * (backend ก็พัก INPRG ไว้จนกว่า vendor รายสุดท้ายจะวางแผนเสร็จ)
 */
export function pendingVendorPlans(
  wo: Pick<MaximoWorkOrder, "vendor_plans"> | null | undefined,
): VendorPlan[] {
  return (wo?.vendor_plans ?? []).filter((v) => String(v.status ?? "").trim().toLowerCase() !== "planned");
}

/** ช่างทั้งหมดของใบงาน = ของ planner ต้นทาง + ที่ vendor มอบหมายเพิ่ม (ไม่ซ้ำ) */
export function allAssignees(wo: Pick<MaximoWorkOrder, "assignees" | "vendor_plans"> | null | undefined): string[] {
  const out: string[] = [];
  const add = (n: unknown) => {
    const s = String(n ?? "").trim();
    if (s && !out.includes(s)) out.push(s);
  };
  (wo?.assignees ?? []).forEach(add);
  (wo?.vendor_plans ?? []).forEach((v) => (v.assignees ?? []).forEach(add));
  return out;
}

export type EquipmentChoices = {
  wonum: string;
  station_id?: string | null;
  location?: string | null;
  chargers: EquipmentItem[];
  fixed: EquipmentItem[];
  selected_equipment: EquipmentItem[];
  plan_state?: PlanEditState | null;
};

/**
 * ใครแก้แผนที่บันทึกแล้วได้ตอนนี้ (backend: _plan_edit_state ใน routers/pm_maximo.py)
 *   - planner ต้นทาง: จนกว่าช่างจะกดเริ่ม PM และ vendor ที่ส่งต่อไปยังไม่ได้วางแผน
 *   - planner ของ vendor: แผนของบริษัทตัวเอง จนกว่าช่างจะกดเริ่ม PM
 */
export type PlanEditState = {
  started: boolean;
  planned: boolean;
  can_edit_plan: boolean;
  plan_reason: string;
  can_edit_vendor_plan: boolean;
  vendor_plan_reason: string;
};

export type TechnicianOption = {
  id?: string | null;
  username?: string | null;
  email?: string | null;
  company?: string | null;
};

/** ผู้รับผิดชอบงาน PM ที่เลือกได้ — ทุกกลุ่มจำกัดด้วย company ของคนที่ login แล้วจาก backend */
export type PmAssigneeOptions = {
  technicians: string[];
  vendors: string[];
  outsources: string[];
};

/** 1 หัวข้อในลิสต์ checkbox — แยกให้เห็นว่าใครเป็น Technician / Vendor / Outsource */
export type PmAssigneeGroup = {
  key: "technician" | "vendor" | "outsource";
  label: string;
  names: string[];
};

export const EMPTY_PM_ASSIGNEE_OPTIONS: PmAssigneeOptions = {
  technicians: [],
  vendors: [],
  outsources: [],
};

function toNameList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x ?? "").trim()).filter(Boolean);
}

/**
 * GET /companies/pm-options — ช่าง + vendor + outsource ของบริษัทคนที่ login
 * role ที่วางแผนไม่ได้ (เช่นช่าง) จะได้ 403 → คืนลิสต์ว่าง ให้ฝั่ง UI ไปแสดงโหมดอ่านอย่างเดียวเอง
 */
export async function fetchPmAssigneeOptions(): Promise<PmAssigneeOptions> {
  const res = await apiFetch("/companies/pm-options");
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) return EMPTY_PM_ASSIGNEE_OPTIONS;
  return {
    technicians: toNameList(json?.technicians),
    vendors: toNameList(json?.vendors),
    outsources: toNameList(json?.outsources),
  };
}

/**
 * กลุ่มที่มีคนอยู่จริงเท่านั้น — กันหัวข้อลอยที่ไม่มีรายการอยู่ข้างใต้
 *
 * vendors: false = ลิสต์ผู้รับผิดชอบของแผนต้นทาง — vendor เลือกได้ทางเดียวคือ "ผู้ทำ PM"
 * ของอุปกรณ์ (ติ๊กในลิสต์ด้วยก็ซ้ำกัน และถ้าติ๊กโดยไม่ได้ให้ทำอะไร vendor จะได้ใบส่งต่อ
 * แบบไม่ผูกอุปกรณ์ = ไม่ล็อกส่วนไหนเลย) — จ้างทำทั้งสถานีก็เลือก vendor ให้ทุกชิ้น
 */
export function pmAssigneeGroups(
  options: PmAssigneeOptions,
  { vendors = true }: { vendors?: boolean } = {},
): PmAssigneeGroup[] {
  return [
    { key: "technician" as const, label: "Technician", names: options.technicians },
    { key: "vendor" as const, label: "Vendor", names: vendors ? options.vendors : [] },
    { key: "outsource" as const, label: "Outsource", names: options.outsources },
  ].filter((group) => group.names.length > 0);
}

/** ตัดชื่อออกจากลิสต์ (ไม่สนตัวพิมพ์เล็ก-ใหญ่ / ช่องว่างหัวท้าย) */
export function withoutNames(
  names: string[],
  remove: Iterable<string | null | undefined>,
): string[] {
  const drop = new Set(
    Array.from(remove, (n) => String(n ?? "").trim().toLowerCase()).filter(Boolean),
  );
  return names.filter((n) => !drop.has(String(n ?? "").trim().toLowerCase()));
}

/**
 * vendor ที่ไม่ได้อยู่กลุ่มอื่นด้วย = ชื่อที่ลิสต์ผู้รับผิดชอบของแผนต้นทางไม่แสดง
 * (ชื่อเดียวกันที่เป็น outsource ด้วยยังติ๊กได้ในกลุ่ม Outsource)
 * ต้องตรงกับ _plan_assignees() ใน backend/routers/pm_maximo.py
 */
export function vendorOnlyNames(options: PmAssigneeOptions): string[] {
  return withoutNames(options.vendors, [...options.technicians, ...options.outsources]);
}

/**
 * ผู้รับผิดชอบที่ planner ต้นทางติ๊กเองในลิสต์ — ใช้ตั้งต้นฟอร์มตอนเปิดแผนเดิมมาแก้
 *
 * ตอนบันทึก backend เติมผู้ทำ PM ของอุปกรณ์แต่ละชิ้นเข้าไปในผู้รับผิดชอบให้ด้วย ถ้าไม่ตัดออก
 * เปลี่ยนอุปกรณ์กลับเป็นทีมเราแล้วชื่อนั้นยังค้างติ๊กอยู่
 * ส่วนใบงานที่ยังมีอุปกรณ์ให้รายนั้นทำ backend ก็เติมกลับให้เองตอนบันทึก
 */
export function ownPlanAssignees(
  wo: Pick<MaximoWorkOrder, "assignees" | "vendor_plans" | "selected_equipment"> | null | undefined,
): string[] {
  const parties = [
    ...Object.values(equipmentByMap(wo)),
    ...(wo?.vendor_plans ?? []).map((v) => v.vendor),
  ];
  const mine = (wo?.assignees ?? []).map((n) => String(n ?? "").trim()).filter(Boolean);
  return withoutNames(mine, parties);
}

/** อุปกรณ์ที่ให้คนอื่นทำ PM จัดกลุ่มตามผู้ทำ (เรียงตามลำดับที่เจอ) — ไว้โชว์สรุปใต้ลิสต์ผู้รับผิดชอบ */
export function handoffGroups(
  items: Array<{ label: string; by?: string | null }>,
): Array<{ name: string; labels: string[] }> {
  const out: Array<{ name: string; labels: string[] }> = [];
  for (const it of items) {
    const name = String(it.by ?? "").trim();
    if (!name) continue;
    const group = out.find((g) => g.name.toLowerCase() === name.toLowerCase());
    if (group) group.labels.push(it.label);
    else out.push({ name, labels: [it.label] });
  }
  return out;
}

/**
 * ต้องเลือกผู้รับผิดชอบฝั่งเราอย่างน้อย 1 รายไหม
 * ไม่ต้อง เมื่อทุกอุปกรณ์ที่เลือกให้คนอื่นทำ (เช่นจ้าง vendor ทำทั้งสถานี) — อุปกรณ์ที่ทีมเราทำ /
 * แผนที่ไม่ได้เลือกอุปกรณ์ ต้องมีคนของเราไปทำ
 */
export function needsOwnAssignee(items: Array<Pick<EquipmentItem, "by">>): boolean {
  return items.length === 0 || items.some((e) => !String(e.by ?? "").trim());
}

/**
 * ผู้ทำ PM ที่อุปกรณ์ทุกชิ้นตรงกัน — ไว้โชว์ในตัวเลือก "ตั้งทุกรายการ" ของแถว "ทั้งหมด"
 * "" = ทีมเราทุกชิ้น (หรือยังไม่ได้เลือกอุปกรณ์), null = แต่ละชิ้นไม่ตรงกัน
 */
export function commonBy(values: Array<string | null | undefined>): string | null {
  const names = values.map((v) => String(v ?? "").trim());
  if (names.length === 0) return "";
  const first = names[0];
  return names.every((n) => n.toLowerCase() === first.toLowerCase()) ? first : null;
}

/**
 * ชื่อทั้งหมดในลิสต์แบบไม่ซ้ำ — ใช้กับปุ่ม "ทั้งหมด" และตัวนับ
 * (ชื่อเดียวอยู่ได้ 2 กลุ่ม เช่น vendor ที่รับงาน outsource ให้บริษัทตัวเองด้วย)
 */
export function pmAssigneeNames(groups: PmAssigneeGroup[]): string[] {
  return Array.from(new Set(groups.flatMap((group) => group.names)));
}

/** กรองลิสต์ตามคำค้น (เทียบเฉพาะชื่อ) — กลุ่มที่ไม่เหลือชื่อเลยหายไปทั้งหัวข้อ */
export function filterPmAssigneeGroups(
  groups: PmAssigneeGroup[],
  query: string
): PmAssigneeGroup[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return groups;
  return groups
    .map((group) => ({
      ...group,
      names: group.names.filter((name) => name.toLocaleLowerCase().includes(needle)),
    }))
    .filter((group) => group.names.length > 0);
}

/**
 * ติ๊ก/ปลดติ๊ก "ทั้งหมด" กับเฉพาะชื่อที่เห็นอยู่ตอนนั้น
 * คนที่ติ๊กไว้แล้วแต่ถูกคำค้นกรองออกไปต้องอยู่ครบ ไม่งั้นพิมพ์ค้นหาแล้วกด All จะล้างของเดิมทิ้ง
 */
export function togglePmAssigneeBatch(
  selected: string[],
  names: string[],
  allChecked: boolean
): string[] {
  if (allChecked) return selected.filter((name) => !names.includes(name));
  return [...selected, ...names.filter((name) => !selected.includes(name))];
}

/** role ที่วางแผน PM ได้ — ต้องตรงกับ PM_PLANNING_ROLES ใน backend/routers/pm_maximo.py */
export const PM_PLANNING_ROLES = ["admin", "owner", "planner"];

/** role ที่วางแผนได้และกรอก PM form เองได้ด้วย — เห็นปุ่ม "เริ่ม PM" หลังวางแผนใบงานเสร็จแล้ว */
export const PM_PLANNER_FILL_ROLES = ["admin", "planner"];

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

/** ช่วงเริ่ม-เสร็จตั้งต้นของแผน PM: เริ่มตอนนี้ เสร็จอีก 7 วัน */
export const PM_DEFAULT_SPAN_DAYS = 7;

/**
 * ค่า YYYY-MM-DDTHH:mm ของ input type="datetime-local" — เวลาปัจจุบัน บวกจำนวนวันได้
 * setDate() ข้ามเดือน/ปี/DST ให้เอง จึงไม่บวกเป็น millisecond
 */
export function dateTimeLocalFromNow(addDays = 0) {
  const d = new Date();
  if (addDays) d.setDate(d.getDate() + addDays);

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";
  const cleaned = value.replace(" ", "T");
  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
