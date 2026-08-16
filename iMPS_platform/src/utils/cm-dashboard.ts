import { causeLabel, remedyLabel, remedyDescriptions } from "@/utils/cm-failure-codes";

export type CMRow = {
  id: string;
  station_id: string;
  station_name: string;
  /** บริษัทเจ้าของสถานี (แยกจาก brand ของ charger) */
  company?: string;
  status: string;
  stage?: string;
  reject_remark?: string;
  faulty_equipment: string;
  /** ชื่อที่แสดงของอุปกรณ์รุ่นเก่า เช่น charger_1 (ค่า raw ยังใช้กรองข้อมูล) */
  faulty_equipment_label?: string;
  problem_details: string;
  /** codes CAUSE Maximo — fiches anciennes : texte libre. Peut arriver en chaîne simple. */
  cause: string | string[];
  /** codes PROBLEM Maximo */
  problem_type?: string | string[];
  /** codes REMEDY Maximo (champ « การแก้ไข » du formulaire CM) */
  repaired_equipment?: string | string[];
  /** สถานะรอ/ผลการซ่อมรอบล่าสุด — "WO - wait for material" ฯลฯ ใช้จัด bucket ของ KPI */
  repair_result?: string;
  severity: string;
  cm_date: string | null;
  reported_by: string;
  inspector: string;
  issue_id: string;
  doc_name: string;
  /** ช่างที่ planner assign ไว้สำหรับรอบปัจจุบัน */
  assignees?: string[];
  // ── ตัวตนของตู้ที่ใบงานนี้อ้างถึง (backend resolve จาก charger_sn / faulty_equipment) ──
  charger_name?: string;
  charger_no?: number | string | null;
  charger_sn?: string;
  charger_model?: string;
  /** ยี่ห้อ = บริษัทที่ถือครองตู้ (EGAT, iMPS, FlexxFast…) — ว่าง = ระบุไม่ได้ */
  charger_brand?: string;
  /** true = ใบที่ระบบเปิดเองจาก fault/alarm (auto_cm_watcher) */
  auto_generated?: boolean;
  auto_trigger?: string;
};

/** บริษัทผู้ถือครองตู้ของใบงานนี้ — ใบที่ระบุไม่ได้จัดกลุ่มเป็น UNKNOWN_BRAND */
export const UNKNOWN_BRAND = "Unknown";
export const UNKNOWN_COMPANY = "Unknown";
export const COMPANY_FILTER_OPTIONS = ["EGAT", "EDS"] as const;

export function companyOf(r: CMRow): string {
  return (r.company || "").trim() || UNKNOWN_COMPANY;
}

export function brandOf(r: CMRow): string {
  return (r.charger_brand || "").trim() || UNKNOWN_BRAND;
}

/** ที่มาของใบงาน — ระบบเปิดเอง vs ผู้ใช้กรอกเอง */
export type CmOrigin = "auto" | "user";

export function originOf(r: CMRow): CmOrigin {
  return r.auto_generated ? "auto" : "user";
}

/** ยี่ห้อทั้งหมดที่พบในชุดข้อมูล เรียงตามจำนวนใบงานจากมากไปน้อย */
export function listBrands(rows: CMRow[]): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const b = brandOf(r);
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => {
      // Unknown ไปท้ายสุดเสมอ — ไม่ใช่บริษัทจริง
      if (a[0] === UNKNOWN_BRAND) return 1;
      if (b[0] === UNKNOWN_BRAND) return -1;
      return b[1] - a[1] || a[0].localeCompare(b[0]);
    })
    .map((e) => e[0]);
}

export function listCompanies(rows: CMRow[]): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const company = companyOf(r);
    counts.set(company, (counts.get(company) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => {
      if (a[0] === UNKNOWN_COMPANY) return 1;
      if (b[0] === UNKNOWN_COMPANY) return -1;
      return a[0].localeCompare(b[0]);
    })
    .map(([company]) => company);
}

export type Period = "yearly" | "monthly" | "weekly";

export type ActiveFilters = {
  status: string | null;
  equipment: string | null;
  severity: string | null;
  station: string | null;
  /** กรองตาม bucket ของ KPI (คลิกการ์ด KPI ด้านบน) — ละเอียดกว่า status 3 กลุ่ม */
  workStatus: WorkStatusFilter | null;
  /** libellé de cause (CAUSE DESCRIPTION) — clic sur le donut « Count of Cause of Issue » */
  cause: string | null;
  /** code REMEDY — clic sur le donut « Remedy » */
  remedy: string | null;
  /** บริษัทผู้ถือครองตู้ (ยี่ห้อ) — ปุ่มกรองแถวบนของแดชบอร์ด */
  brand: string | null;
  /** บริษัทเจ้าของสถานี — แสดง/ใช้งานเฉพาะผู้ใช้ company EGAT */
  company: string | null;
  /** ที่มาของใบ: ระบบเปิดเอง / ผู้ใช้เปิดเอง */
  origin: CmOrigin | null;
};

export const EMPTY_FILTERS: ActiveFilters = {
  status: null, equipment: null, severity: null, station: null,
  workStatus: null, cause: null, remedy: null, brand: null, company: null, origin: null,
};

/** Champs multi-valeurs : le backend renvoie un tableau, les fiches anciennes une chaîne. */
export function toList(v: string | string[] | undefined | null): string[] {
  if (Array.isArray(v)) return v.map((x) => (x || "").trim()).filter(Boolean);
  const s = (v || "").trim();
  return s ? [s] : [];
}

/** Libellés de cause d'une fiche (codes Maximo traduits, texte libre laissé tel quel). */
export function causeLabelsOf(r: CMRow): string[] {
  const out: string[] = [];
  for (const c of toList(r.cause)) {
    const label = causeLabel(c);
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}

/** Codes REMEDY d'une fiche (normalisés en majuscules). */
export function remedyCodesOf(r: CMRow): string[] {
  const out: string[] = [];
  for (const c of toList(r.repaired_equipment)) {
    const code = c.toUpperCase();
    if (!out.includes(code)) out.push(code);
  }
  return out;
}

/** REMEDY DESCRIPTION(s) d'une fiche pour un code remedy donné. */
export function remedyDescriptionsOf(r: CMRow, remedyCode: string): string[] {
  return remedyDescriptions(
    r.faulty_equipment || "",
    toList(r.problem_type),
    toList(r.cause),
    remedyCode
  );
}

export const STATUS_LABELS = {
  completed: "เสร็จสิ้น",
  in_progress: "รอดำเนินการ",
  open: "รอจัดซื้อ",
  cancelled: "ยกเลิก",
} as const;

export function normalizeStatus(s: string): keyof typeof STATUS_LABELS {
  const v = (s || "").trim().toLowerCase().replace(/[-_\s]+/g, " ");
  if (v === "complete" || v === "completed" || v === "closed" || v === "close") return "completed";
  if (v === "in progress" || v === "inprogress") return "in_progress";
  // ใบที่ถูกยกเลิก — ต้องแยกจาก open ไม่งั้นจะถูกนับเป็นงานค้างทั้งที่ไม่มีใครต้องทำแล้ว
  if (v === "cancelled" || v === "canceled" || v === "cancel" || v === "void" || v === "ยกเลิก") return "cancelled";
  return "open";
}

/** ใบที่ถูกยกเลิก = ไม่ใช่ภาระงานซ่อม → ตัดออกจากกราฟและ KPI ทุกตัว (ยังโชว์ในตาราง) */
export function isCancelled(r: CMRow): boolean {
  return normalizeStatus(r.status) === "cancelled";
}

export function excludeCancelled(rows: CMRow[]): CMRow[] {
  return rows.filter((r) => !isCancelled(r));
}

export function statusBadge(status: string) {
  const s = normalizeStatus(status);
  if (s === "completed") return { bg: "#dcfce7", text: "#15803d", label: "Complete" };
  if (s === "in_progress") return { bg: "#fff7ed", text: "#ea580c", label: "In Progress" };
  if (s === "cancelled") return { bg: "#f1f5f9", text: "#475569", label: "Cancelled" };
  return { bg: "#fee2e2", text: "#dc2626", label: "Open" };
}

export function filterByPeriod(rows: CMRow[], period: Period): CMRow[] {
  const now = new Date();
  return rows.filter((r) => {
    if (!r.cm_date) return period === "yearly";
    const d = new Date(r.cm_date);
    if (isNaN(d.getTime())) return period === "yearly";
    if (period === "weekly") return (now.getTime() - d.getTime()) / 86400000 <= 7;
    if (period === "monthly")
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    return d.getFullYear() === now.getFullYear();
  });
}

// ─── Workflow status (7 KPI buckets) ─────────────────────────────────────────
// สถานะ SR/WO แบบละเอียดสำหรับแถว KPI 7 ใบ — สถานะที่ยังไม่มีในข้อมูล (wait for …)
// จะถูกจับด้วย keyword เพื่อรองรับข้อมูลจาก Maximo ในอนาคต
export type WorkStatus =
  | "new"
  /** SR รอ head CS อนุมัติ (status "Wait for approve" + stage "cs_approval") — ยังไม่เป็น WO */
  | "wait_cs_approve"
  | "wait_manpower"
  | "wait_sparepart"
  | "wait_approve"
  | "wait_site_access"
  | "in_progress"
  | "completed"
  /** ยกเลิก — ไม่มีการ์ด KPI ของตัวเอง แต่ต้องมี bucket แยก ไม่งั้นจะไปตกถัง "new" */
  | "cancelled";

/**
 * Filtre du bandeau KPI : soit un bucket précis, soit « wo_all » =
 * tous les work orders, c.-à-d. toutes les SR sorties du bucket "new".
 */
export type WorkStatusFilter = WorkStatus | "wo_all";

export function normalizeWorkStatus(s: string): WorkStatus {
  const v = (s || "").trim().toLowerCase().replace(/[-_\s]+/g, " ");
  // เช็คก่อนทุกถัง — ใบยกเลิกไม่ใช่ทั้ง SR ใหม่และงานที่ทำเสร็จ
  if (v.startsWith("cancel") || v === "void" || v.includes("ยกเลิก")) return "cancelled";
  if (v === "closed" || v === "close" || v.includes("complete") || v.includes("เสร็จ")) return "completed";
  // bucket wait_manpower ตอนนี้แทน "wait for scheduled" (เปลี่ยนชื่อจาก manpower) — คงชื่อ bucket เดิมไว้ กัน churn
  // ใช้ "scheduled" (มี -d) จับ ไม่ชนกับ status "wait for schedule" (ไม่มี -d) — ด่านนั้นจัดการใน workStatusOf()
  if (v.includes("scheduled") || v.includes("manpower") || v.includes("labor") || v.includes("labour") || v.includes("รอช่าง")) return "wait_manpower";
  if (v.includes("spare") || v.includes("material") || v.includes("matl") || v.includes("อะไหล่")) return "wait_sparepart";
  if (v.includes("approv") || v.includes("wappr") || v.includes("อนุมัติ")) return "wait_approve";
  if (v.includes("site access") || v.includes("site condition") || v.includes("access") || v.includes("condition") || v.includes("เข้าพื้นที่") || v.includes("เข้าไซต์")) return "wait_site_access";
  if (v === "in progress" || v === "inprogress" || v.includes("ดำเนินการ")) return "in_progress";
  return "new";
}

/**
 * bucket ของ KPI สำหรับ 1 ใบงาน — ต้องดู 2 ฟิลด์:
 *   • status        = ด่านของ workflow (Open → Wait for approve → Wait for schedule → In Progress → Closed)
 *   • repair_result = สถานะรอที่ planner/ช่างเลือก ("WO - wait for material" / "…site condition" / "…scheduled")
 * สถานะรอไม่เคยถูกเขียนลง status (backend จำกัดด้วย ALLOWED_STATUS) — ถ้าดูแค่ status
 * การ์ดรออะไหล่/รอเข้าพื้นที่/รอกำหนดการจะเป็น 0 ตลอด
 */
export function workStatusOf(r: CMRow): WorkStatus {
  const byStatus = normalizeWorkStatus(r.status);
  // ใบที่จบแล้ว/ยกเลิกแล้ว — สถานะรอของรอบก่อนไม่ใช่คิวปัจจุบันอีกต่อไป
  if (byStatus === "completed" || byStatus === "cancelled") return byStatus;
  // "Wait for approve" มี 2 ด่าน แยกกันด้วย stage — ด่าน cs คือ SR ที่รอ head CS อนุมัติ
  // (ยังไม่เป็น WO) ส่วนด่าน close_approval คือ WO ที่ช่างซ่อมเสร็จแล้วรอปิดงาน
  if (byStatus === "wait_approve"
    && (r.stage || "").trim().toLowerCase() === "cs_approval") return "wait_cs_approve";
  const byResult = normalizeWorkStatus(r.repair_result || "");
  if (byResult === "wait_manpower" || byResult === "wait_sparepart" || byResult === "wait_site_access") {
    return byResult;
  }
  // status "Wait for schedule" = head cs อนุมัติแล้ว รอ planner วางแผน → ขึ้นเป็น WO แล้ว
  // (ฟอร์มเปลี่ยนเลขที่งานจาก SR เป็น WO ที่ด่านนี้) — normalizeWorkStatus จงใจไม่จับ
  // เพราะเป็น mapper ของสตริงดิบที่ใช้กับ repair_result ด้วย จึงมาตัดสินที่ระดับใบงานตรงนี้แทน
  if (r.status.trim().toLowerCase() === "wait for schedule") return "wait_manpower";
  return byStatus;
}

/** สีป้ายสถานะละเอียด (8 bucket) — ใช้ในตารางใบงาน ให้ตรงกับสีการ์ด KPI ด้านบน */
const WORK_STATUS_COLORS: Record<WorkStatus, { bg: string; text: string }> = {
  new: { bg: "#fee2e2", text: "#dc2626" },
  wait_cs_approve: { bg: "#ffedd5", text: "#c2410c" },
  wait_approve: { bg: "#e0e7ff", text: "#4338ca" },
  wait_manpower: { bg: "#ffe4e6", text: "#e11d48" },
  wait_sparepart: { bg: "#fef3c7", text: "#b45309" },
  wait_site_access: { bg: "#f3e8ff", text: "#7e22ce" },
  in_progress: { bg: "#fff7ed", text: "#ea580c" },
  completed: { bg: "#dcfce7", text: "#15803d" },
  cancelled: { bg: "#f1f5f9", text: "#475569" },
};

/**
 * ป้ายสถานะของ 1 ใบงานแบบละเอียด — แยก wait for schedule / material / site condition ออกจากกัน
 * (statusBadge() เดิมยุบทั้งสามอันเป็น "Open" เพราะดูแค่ field status)
 * label ปล่อยให้หน้าเพจใส่เอง เพื่อใช้ข้อความ i18n ชุดเดียวกับการ์ด KPI
 */
export function workStatusBadge(r: CMRow): { ws: WorkStatus; bg: string; text: string } {
  const ws = workStatusOf(r);
  return { ws, ...WORK_STATUS_COLORS[ws] };
}

// ─── Date helpers (year / month / week selectors) ────────────────────────────

export type DateSel = number | "all";

export function rowDate(r: CMRow): Date | null {
  if (!r.cm_date) return null;
  const d = new Date(r.cm_date);
  return isNaN(d.getTime()) ? null : d;
}

/** สัปดาห์ของเดือน (เริ่มวันจันทร์) — สัปดาห์ที่ 1 คือสัปดาห์ที่มีวันที่ 1 */
export function weekOfMonth(d: Date): number {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7; // จันทร์ = 0
  return Math.floor((d.getDate() + mondayOffset - 1) / 7) + 1;
}

export function weeksInMonth(year: number, month: number): number {
  const lastDay = new Date(year, month + 1, 0);
  return weekOfMonth(lastDay);
}

export function listYears(rows: CMRow[]): number[] {
  const ys = new Set<number>();
  for (const r of rows) {
    const d = rowDate(r);
    if (d) ys.add(d.getFullYear());
  }
  ys.add(new Date().getFullYear());
  return Array.from(ys).sort((a, b) => b - a);
}

export function filterByDate(rows: CMRow[], year: DateSel, month: DateSel, week: DateSel): CMRow[] {
  return rows.filter((r) => {
    const d = rowDate(r);
    if (!d) return year === "all"; // แถวไม่มีวันที่ → เห็นเฉพาะตอนไม่กรองปี
    if (year !== "all" && d.getFullYear() !== year) return false;
    if (month !== "all" && d.getMonth() !== month) return false;
    if (month !== "all" && week !== "all" && weekOfMonth(d) !== week) return false;
    return true;
  });
}

/** นับสถานะ 3 กลุ่มแยกตามเดือน (ม.ค.–ธ.ค.) สำหรับกราฟแท่งรายเดือน — ใบที่ยกเลิกไม่นับ */
export function groupByMonth(rows: CMRow[]): { open: number[]; inProgress: number[]; completed: number[] } {
  const open = Array(12).fill(0);
  const inProgress = Array(12).fill(0);
  const completed = Array(12).fill(0);
  for (const r of rows) {
    const d = rowDate(r);
    if (!d) continue;
    const m = d.getMonth();
    const s = normalizeStatus(r.status);
    if (s === "cancelled") continue;
    if (s === "completed") completed[m]++;
    else if (s === "in_progress") inProgress[m]++;
    else open[m]++;
  }
  return { open, inProgress, completed };
}

export function applyFilters(
  rows: CMRow[],
  filters: ActiveFilters,
  exclude?: keyof ActiveFilters
): CMRow[] {
  return rows.filter((r) => {
    if (filters.status && exclude !== "status") {
      if (STATUS_LABELS[normalizeStatus(r.status)] !== filters.status) return false;
    }
    if (filters.equipment && exclude !== "equipment") {
      if ((r.faulty_equipment || "Unknown") !== filters.equipment) return false;
    }
    if (filters.severity && exclude !== "severity") {
      if ((r.severity || "Unknown") !== filters.severity) return false;
    }
    if (filters.station && exclude !== "station") {
      if ((r.station_name || r.station_id || "Unknown") !== filters.station) return false;
    }
    if (filters.workStatus && exclude !== "workStatus") {
      const ws = workStatusOf(r);
      // wo_all = SR ที่กลายเป็น WO แล้วทั้งหมด — ตัดถัง "new", SR ที่รอ head CS อนุมัติ
      // (ยังไม่ขึ้นเป็น WO) และใบที่ยกเลิกออก
      const notWo = ws === "new" || ws === "wait_cs_approve" || ws === "cancelled";
      if (filters.workStatus === "wo_all" ? notWo : ws !== filters.workStatus) return false;
    }
    if (filters.cause && exclude !== "cause") {
      if (!causeLabelsOf(r).includes(filters.cause)) return false;
    }
    if (filters.remedy && exclude !== "remedy") {
      if (!remedyCodesOf(r).includes(filters.remedy)) return false;
    }
    if (filters.brand && exclude !== "brand") {
      if (brandOf(r) !== filters.brand) return false;
    }
    if (filters.company && exclude !== "company") {
      if (companyOf(r).toLowerCase() !== filters.company.toLowerCase()) return false;
    }
    if (filters.origin && exclude !== "origin") {
      if (originOf(r) !== filters.origin) return false;
    }
    return true;
  });
}

export function applySearch(rows: CMRow[], q: string): CMRow[] {
  if (!q.trim()) return rows;
  const lq = q.trim().toLowerCase();
  return rows.filter((r) =>
    [
      r.station_name, r.station_id, r.issue_id, r.faulty_equipment,
      r.problem_details, r.severity, r.inspector, r.reported_by, r.status,
      // charger_no เป็นตัวเลขได้ (backend resolve มาจาก charger index) ต้องแปลงก่อน
      r.charger_name, r.charger_sn, r.charger_brand,
      r.charger_no === null || r.charger_no === undefined ? "" : String(r.charger_no),
      ...causeLabelsOf(r),
      ...remedyCodesOf(r).map(remedyLabel),
    ].some((v) => (v || "").toLowerCase().includes(lq))
  );
}

export function groupCount(
  rows: CMRow[],
  key: keyof CMRow
): { keys: string[]; vals: number[] } {
  const map: Record<string, number> = {};
  for (const r of rows) {
    const v = (r[key] as string) || "Unknown";
    map[v] = (map[v] || 0) + 1;
  }
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 9);
  return { keys: sorted.map((e) => e[0]), vals: sorted.map((e) => e[1]) };
}

/**
 * Comptage sur un champ multi-valeurs : une fiche portant deux causes compte
 * une fois dans chaque catégorie. Les fiches sans valeur (cause/correction pas
 * encore saisie) ne sont pas comptées. `top` limite le nombre de tranches.
 */
export function groupCountMulti(
  rows: CMRow[],
  valuesOf: (r: CMRow) => string[],
  top = 9
): { keys: string[]; vals: number[] } {
  const map: Record<string, number> = {};
  for (const r of rows) {
    for (const v of valuesOf(r)) map[v] = (map[v] || 0) + 1;
  }
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, top);
  return { keys: sorted.map((e) => e[0]), vals: sorted.map((e) => e[1]) };
}

/**
 * Même comptage que groupCountMulti, mais ventilé par marque (= entreprise
 * détentrice du chargeur). Les catégories gardent l'ordre et la troncature de
 * groupCountMulti, si bien que le donut et la vue « par marque » montrent
 * toujours exactement les mêmes tranches — seule la ventilation change.
 *
 * Retourne des séries prêtes pour un bar chart empilé : une série par marque,
 * data[i] = nombre de fiches de la catégorie keys[i] pour cette marque.
 */
export function groupCountMultiByBrand(
  rows: CMRow[],
  valuesOf: (r: CMRow) => string[],
  top = 9
): { keys: string[]; brands: string[]; series: { name: string; data: number[] }[] } {
  const { keys } = groupCountMulti(rows, valuesOf, top);
  const keyIndex = new Map(keys.map((k, i) => [k, i]));
  const perBrand = new Map<string, number[]>();
  const brandTotals = new Map<string, number>();

  for (const r of rows) {
    const brand = brandOf(r);
    for (const v of valuesOf(r)) {
      const i = keyIndex.get(v);
      if (i === undefined) continue; // catégorie hors du top N
      if (!perBrand.has(brand)) perBrand.set(brand, Array(keys.length).fill(0));
      perBrand.get(brand)![i] += 1;
      brandTotals.set(brand, (brandTotals.get(brand) ?? 0) + 1);
    }
  }

  const brands = Array.from(perBrand.keys()).sort((a, b) => {
    if (a === UNKNOWN_BRAND) return 1;
    if (b === UNKNOWN_BRAND) return -1;
    return (brandTotals.get(b) ?? 0) - (brandTotals.get(a) ?? 0) || a.localeCompare(b);
  });

  return {
    keys,
    brands,
    series: brands.map((b) => ({ name: b, data: perBrand.get(b)! })),
  };
}
