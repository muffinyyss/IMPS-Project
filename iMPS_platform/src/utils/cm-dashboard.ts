export type CMRow = {
  id: string;
  station_id: string;
  station_name: string;
  status: string;
  faulty_equipment: string;
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
      r.severity, r.cause, r.inspector, r.reported_by, r.status,
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
