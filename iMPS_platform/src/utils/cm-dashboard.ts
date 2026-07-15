export type CMRow = {
  id: string;
  station_id: string;
  station_name: string;
  status: string;
  faulty_equipment: string;
  problem_details: string;
  cause: string;
  severity: string;
  cm_date: string | null;
  reported_by: string;
  inspector: string;
  issue_id: string;
  doc_name: string;
};

export type Period = "yearly" | "monthly" | "weekly";

export type ActiveFilters = {
  status: string | null;
  equipment: string | null;
  severity: string | null;
  station: string | null;
};

export const STATUS_LABELS = {
  completed: "เสร็จสิ้น",
  in_progress: "รอดำเนินการ",
  open: "รอจัดซื้อ",
} as const;

export function normalizeStatus(s: string): keyof typeof STATUS_LABELS {
  const v = (s || "").trim().toLowerCase().replace(/[-_\s]+/g, " ");
  if (v === "closed" || v === "close") return "completed";
  if (v === "in progress" || v === "inprogress") return "in_progress";
  return "open";
}

export function statusBadge(status: string) {
  const s = normalizeStatus(status);
  if (s === "completed") return { bg: "#dcfce7", text: "#15803d", label: "Closed" };
  if (s === "in_progress") return { bg: "#fff7ed", text: "#ea580c", label: "In Progress" };
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
  | "wait_manpower"
  | "wait_sparepart"
  | "wait_approve"
  | "wait_site_access"
  | "in_progress"
  | "completed";

export function normalizeWorkStatus(s: string): WorkStatus {
  const v = (s || "").trim().toLowerCase().replace(/[-_\s]+/g, " ");
  if (v === "closed" || v === "close" || v.includes("complete") || v.includes("เสร็จ")) return "completed";
  if (v.includes("manpower") || v.includes("labor") || v.includes("labour") || v.includes("รอช่าง")) return "wait_manpower";
  if (v.includes("spare") || v.includes("material") || v.includes("matl") || v.includes("อะไหล่")) return "wait_sparepart";
  if (v.includes("approv") || v.includes("wappr") || v.includes("อนุมัติ")) return "wait_approve";
  if (v.includes("site access") || v.includes("access") || v.includes("เข้าพื้นที่") || v.includes("เข้าไซต์")) return "wait_site_access";
  if (v === "in progress" || v === "inprogress" || v.includes("ดำเนินการ")) return "in_progress";
  return "new";
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

/** นับสถานะ 3 กลุ่มแยกตามเดือน (ม.ค.–ธ.ค.) สำหรับกราฟแท่งรายเดือน */
export function groupByMonth(rows: CMRow[]): { open: number[]; inProgress: number[]; completed: number[] } {
  const open = Array(12).fill(0);
  const inProgress = Array(12).fill(0);
  const completed = Array(12).fill(0);
  for (const r of rows) {
    const d = rowDate(r);
    if (!d) continue;
    const m = d.getMonth();
    const s = normalizeStatus(r.status);
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
    return true;
  });
}

export function applySearch(rows: CMRow[], q: string): CMRow[] {
  if (!q.trim()) return rows;
  const lq = q.trim().toLowerCase();
  return rows.filter((r) =>
    [
      r.station_name, r.station_id, r.issue_id, r.faulty_equipment,
      r.problem_details, r.severity, r.cause, r.inspector, r.reported_by, r.status,
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
