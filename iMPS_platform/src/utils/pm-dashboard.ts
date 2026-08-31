/**
 * Helpers du PM Dashboard — pendant exact de `cm-dashboard.ts` côté préventif.
 *
 * Les lignes viennent des deux mêmes sources que la page PM List, pour que les
 * deux écrans racontent la même histoire :
 *   GET /pm-reports/all-stations — เอกสาร PM ที่ช่างกรอกแล้ว
 *   GET /maximo/pm/open          — ใบงานที่ Maximo เปิดเข้ามา
 * ใบงานที่มีเอกสารแล้วถูก dedup ด้วย wonum ตั้งแต่ตอนโหลด — 1 งาน = 1 แถวเสมอ
 */

export type PmRow = {
  id: string;
  /** "wo" = ใบงาน Maximo ที่ยังไม่มีเอกสาร · "report" = เอกสารที่ช่างกรอกแล้ว */
  kind?: "report" | "wo";
  wonum?: string;
  issue_id?: string;
  document_name?: string;
  /** CHARGER | MDB | CCB | CB-BOX | STATION */
  pm_type?: string;
  pm_date?: string;
  status?: string;
  /** ใบงาน Maximo: pending = ยังไม่ assign · planned = assign แล้ว */
  planning_status?: string;
  technician?: string;
  sn?: string;
  station_id?: string;
  station_name?: string;
  /** บริษัทเจ้าของสถานี (backend เติมให้จาก iMPS.stations) */
  company?: string;
  /** ยี่ห้อของตู้ — ว่าง = ระบุไม่ได้ (backend เติมให้จาก iMPS.charger) */
  charger_brand?: string;
  assignees?: string[];
  created_at?: string;
  file_url?: string;
};

// ─── Brand / Company ─────────────────────────────────────────────────────────
// Mêmes règles que le CM Dashboard : une teinte = une entreprise sur les deux écrans.

export const UNKNOWN_BRAND = "Unknown";
export const UNKNOWN_COMPANY = "Unknown";
export const FLEXXFAST_BRAND = "FlexxFast";
export const COMPANY_FILTER_OPTIONS = ["EGAT", "EDS"] as const;

export function companyOf(r: PmRow): string {
  return (r.company || "").trim() || UNKNOWN_COMPANY;
}

export function brandOf(r: PmRow): string {
  const brand = (r.charger_brand || "").trim();
  if (brand.toLowerCase() === FLEXXFAST_BRAND.toLowerCase()) return FLEXXFAST_BRAND;
  return brand || UNKNOWN_BRAND;
}

export function matchesCompanyFilter(r: PmRow, company: string | null): boolean {
  if (!company) return true;
  if (company.trim().toLowerCase() === "eds") {
    return brandOf(r).toLowerCase() === FLEXXFAST_BRAND.toLowerCase();
  }
  return companyOf(r).toLowerCase() === company.trim().toLowerCase();
}

export function listBrands(rows: PmRow[]): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const b = brandOf(r);
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => {
      // Unknown ไปท้ายสุดเสมอ — ไม่ใช่ยี่ห้อจริง
      if (a[0] === UNKNOWN_BRAND) return 1;
      if (b[0] === UNKNOWN_BRAND) return -1;
      return b[1] - a[1] || a[0].localeCompare(b[0]);
    })
    .map(([brand]) => brand);
}

export function listCompanies(rows: PmRow[]): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const c = companyOf(r);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => {
      if (a[0] === UNKNOWN_COMPANY) return 1;
      if (b[0] === UNKNOWN_COMPANY) return -1;
      return a[0].localeCompare(b[0]);
    })
    .map(([company]) => company);
}

// ─── ที่มาของใบงาน ────────────────────────────────────────────────────────────
// PM ไม่มีตัวเปิดใบอัตโนมัติแบบ CM (auto_cm_watcher) — ต้นทางคือ Maximo
// ใบที่ผูก wonum ไว้ = มาจาก Maximo ถึงแม้ช่างจะกรอกเอกสารต่อแล้วก็ตาม

export type PmOrigin = "maximo" | "user";

export function originOf(r: PmRow): PmOrigin {
  if (r.kind === "wo") return "maximo";
  return String(r.wonum || "").trim() ? "maximo" : "user";
}

// ─── สถานะของงาน ──────────────────────────────────────────────────────────────

export type PmStage = "open" | "in_progress" | "wait_approve" | "closed" | "cancelled";

/** สถานะ Maximo ที่แปลว่างานถูกปิดไปแล้ว */
const WO_CLOSED_STATUSES = new Set(["COMP", "COMPLETE", "COMPLETED", "CLOSE", "CLOSED"]);
/** สถานะ Maximo ที่แปลว่ายกเลิก/เลื่อนแผน */
const WO_CANCELLED_STATUSES = new Set(["CAN", "CANCEL", "CANCELED", "CANCELLED", "RESCHED", "RESCHEDULED"]);

/** ใบถูกยกเลิกหรือเลื่อนแผน — ทั้งเอกสาร PM และใบงาน Maximo เขียนได้หลายแบบ */
function looksCancelled(status: string): boolean {
  const s = status.trim().toLowerCase();
  if (!s) return false;
  return (
    WO_CANCELLED_STATUSES.has(status.trim().toUpperCase()) ||
    s.includes("cancel") ||
    s.includes("resched") ||
    s.includes("postpone") ||
    s.includes("ยกเลิก") ||
    s.includes("เลื่อน")
  );
}

/**
 * ด่านของงาน — ชื่อและกติกาเดียวกับตารางหน้า PM List
 * (ต่างกันแค่ที่นี่แยกด่าน "cancelled" ออกมา เพราะแดชบอร์ดต้องนับใบที่ยกเลิกด้วย
 *  ส่วน PM List โชว์เฉพาะคิวงานที่ยังต้องทำ จึงไม่เคยเห็นใบยกเลิก)
 */
export function stageOf(r: PmRow): PmStage {
  const status = String(r.status ?? "");
  if (looksCancelled(status)) return "cancelled";

  if (r.kind === "wo") {
    if (WO_CLOSED_STATUSES.has(status.trim().toUpperCase())) return "closed";
    return String(r.planning_status ?? "pending").trim().toLowerCase() === "planned"
      ? "in_progress"
      : "open";
  }

  // ใบเก่าไม่มี status / เป็น "submitted" = ปิดไปแล้วก่อนมี flow อนุมัติ
  const s = status.trim().toLowerCase();
  if (s === "wait for approve") return "wait_approve";
  if (s === "draft") return "in_progress";
  return "closed";
}

export const STAGE_LABELS = {
  open: "Open",
  in_progress: "In Progress",
  wait_approve: "Wait for approve",
  closed: "Closed",
  cancelled: "Cancelled",
} as const;

/**
 * กลุ่มของงานสำหรับโดนัท + การ์ด 4 ใบ — 3 ถังนี้รวมกันได้ยอดรวมพอดี
 *   completed     = ปิดงานแล้ว
 *   not_completed = ยังค้างอยู่ (เปิดอยู่ / กำลังทำ / รออนุมัติ)
 *   cancelled     = ยกเลิกหรือเลื่อนแผน
 */
export type PmBucket = "completed" | "not_completed" | "cancelled";

export function bucketOf(r: PmRow): PmBucket {
  const stage = stageOf(r);
  if (stage === "cancelled") return "cancelled";
  if (stage === "closed") return "completed";
  return "not_completed";
}

// ─── Date helpers (ตัวเลือก ปี / เดือน / สัปดาห์) ─────────────────────────────

export type DateSel = number | "all";

/**
 * วันที่ PM ของแถว — `pm_date` มาเป็น "YYYY-MM-DD" ล้วน ๆ จึงอ่านเป็นเวลาท้องถิ่น
 * ไม่ใช่ UTC (new Date("2026-08-01") = เที่ยงคืน UTC ซึ่งเลื่อนวันในโซนติดลบ)
 */
export function rowDate(r: PmRow): Date | null {
  const raw = String(r.pm_date ?? "").trim();
  if (!raw || raw === "-") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** สัปดาห์ของเดือน (เริ่มวันจันทร์) — สัปดาห์ที่ 1 คือสัปดาห์ที่มีวันที่ 1 */
export function weekOfMonth(d: Date): number {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7; // จันทร์ = 0
  return Math.floor((d.getDate() + mondayOffset - 1) / 7) + 1;
}

export function weeksInMonth(year: number, month: number): number {
  return weekOfMonth(new Date(year, month + 1, 0));
}

export function listYears(rows: PmRow[]): number[] {
  const ys = new Set<number>();
  for (const r of rows) {
    const d = rowDate(r);
    if (d) ys.add(d.getFullYear());
  }
  ys.add(new Date().getFullYear());
  return Array.from(ys).sort((a, b) => b - a);
}

export function filterByDate(rows: PmRow[], year: DateSel, month: DateSel, week: DateSel): PmRow[] {
  return rows.filter((r) => {
    const d = rowDate(r);
    if (!d) return year === "all"; // แถวไม่มีวันที่ → เห็นเฉพาะตอนไม่กรองปี
    if (year !== "all" && d.getFullYear() !== year) return false;
    if (month !== "all" && d.getMonth() !== month) return false;
    if (month !== "all" && week !== "all" && weekOfMonth(d) !== week) return false;
    return true;
  });
}

// ─── ตัวกรองที่ผู้ใช้กดจากกราฟ ────────────────────────────────────────────────

export type PmActiveFilters = {
  /** โดนัท + การ์ด 4 ใบ */
  bucket: PmBucket | null;
  /** legend / แท่งของกราฟรายเดือน */
  stage: PmStage | null;
  station: string | null;
  brand: string | null;
  company: string | null;
  origin: PmOrigin | null;
};

export const EMPTY_PM_FILTERS: PmActiveFilters = {
  bucket: null, stage: null, station: null, brand: null, company: null, origin: null,
};

/**
 * `exclude` = มิติที่ไม่ต้องกรอง — ใช้ตอนคำนวณตัวเลขของ control ที่ตั้งค่ามิตินั้นเอง
 * (โดนัท/การ์ด/legend ต้องโชว์ครบทุกถังเสมอ ไม่งั้นกดเปลี่ยนตัวเลือกไม่ได้)
 */
export function applyFilters(
  rows: PmRow[],
  filters: PmActiveFilters,
  exclude?: keyof PmActiveFilters
): PmRow[] {
  return rows.filter((r) => {
    if (filters.bucket && exclude !== "bucket" && bucketOf(r) !== filters.bucket) return false;
    if (filters.stage && exclude !== "stage" && stageOf(r) !== filters.stage) return false;
    if (filters.station && exclude !== "station") {
      if ((r.station_name || r.station_id || "Unknown") !== filters.station) return false;
    }
    if (filters.brand && exclude !== "brand") {
      if (brandOf(r).toLowerCase() !== filters.brand.toLowerCase()) return false;
    }
    if (filters.company && exclude !== "company") {
      if (!matchesCompanyFilter(r, filters.company)) return false;
    }
    if (filters.origin && exclude !== "origin" && originOf(r) !== filters.origin) return false;
    return true;
  });
}

/**
 * นับสถานะรายเดือน (ม.ค.–ธ.ค.) สำหรับกราฟแท่ง — ใบที่ยกเลิกไม่นับ
 * "รออนุมัติ" นับรวมใน In Progress: งานลงมือไปแล้ว เหลือแค่ลายเซ็น
 * (กราฟมี 3 ชุดตามแบบที่ตกลงไว้ ไม่แตกด่านรออนุมัติออกมาอีกแท่ง)
 */
export function groupByMonth(rows: PmRow[]): { open: number[]; inProgress: number[]; completed: number[] } {
  const open = Array(12).fill(0) as number[];
  const inProgress = Array(12).fill(0) as number[];
  const completed = Array(12).fill(0) as number[];
  for (const r of rows) {
    const d = rowDate(r);
    if (!d) continue;
    const m = d.getMonth();
    const stage = stageOf(r);
    if (stage === "cancelled") continue;
    if (stage === "closed") completed[m]++;
    else if (stage === "in_progress" || stage === "wait_approve") inProgress[m]++;
    else open[m]++;
  }
  return { open, inProgress, completed };
}
