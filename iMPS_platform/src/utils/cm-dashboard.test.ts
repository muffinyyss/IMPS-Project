import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  normalizeStatus,
  filterByPeriod,
  applyFilters,
  applySearch,
  groupCount,
  STATUS_LABELS,
  CMRow,
  ActiveFilters,
} from "./cm-dashboard";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = new Date();
const thisYear = now.getFullYear();
const thisMonth = now.getMonth();

function makeRow(overrides: Partial<CMRow> = {}): CMRow {
  return {
    id: "1",
    station_id: "ST01",
    station_name: "สยาม",
    status: "open",
    faulty_equipment: "charger_1",
    cause: "overheat",
    severity: "High",
    cm_date: `${thisYear}-01-15`,
    reported_by: "admin",
    inspector: "tech1",
    issue_id: "CM-ST01-0101-01",
    doc_name: "ST01_doc",
    ...overrides,
  };
}

const noFilters: ActiveFilters = {
  status: null, equipment: null, severity: null, station: null,
};

// ─── normalizeStatus ─────────────────────────────────────────────────────────

describe("normalizeStatus", () => {
  it('maps "closed" → completed', () => {
    expect(normalizeStatus("closed")).toBe("completed");
  });

  it('maps "CLOSED" case-insensitively → completed', () => {
    expect(normalizeStatus("CLOSED")).toBe("completed");
  });

  it('maps "close" → completed', () => {
    expect(normalizeStatus("close")).toBe("completed");
  });

  it('maps "in_progress" → in_progress', () => {
    expect(normalizeStatus("in_progress")).toBe("in_progress");
  });

  it('maps "in progress" (with space) → in_progress', () => {
    expect(normalizeStatus("in progress")).toBe("in_progress");
  });

  it('maps "inprogress" (no space) → in_progress', () => {
    expect(normalizeStatus("inprogress")).toBe("in_progress");
  });

  it('maps unknown value → open', () => {
    expect(normalizeStatus("something_random")).toBe("open");
  });

  it('maps empty string → open', () => {
    expect(normalizeStatus("")).toBe("open");
  });

  it('maps whitespace-only string → open', () => {
    expect(normalizeStatus("   ")).toBe("open");
  });

  it('normalizes "IN-PROGRESS" with hyphens → in_progress', () => {
    expect(normalizeStatus("IN-PROGRESS")).toBe("in_progress");
  });
});

// ─── filterByPeriod ──────────────────────────────────────────────────────────

describe("filterByPeriod", () => {
  it("includes this-year rows in yearly view", () => {
    const rows = [makeRow({ cm_date: `${thisYear}-03-01` })];
    expect(filterByPeriod(rows, "yearly")).toHaveLength(1);
  });

  it("excludes last-year rows from yearly view", () => {
    const rows = [makeRow({ cm_date: `${thisYear - 1}-06-01` })];
    expect(filterByPeriod(rows, "yearly")).toHaveLength(0);
  });

  it("includes rows with null cm_date in yearly view only", () => {
    const row = makeRow({ cm_date: null });
    expect(filterByPeriod([row], "yearly")).toHaveLength(1);
    expect(filterByPeriod([row], "monthly")).toHaveLength(0);
    expect(filterByPeriod([row], "weekly")).toHaveLength(0);
  });

  it("excludes rows with invalid cm_date from monthly and weekly", () => {
    const row = makeRow({ cm_date: "not-a-date" });
    expect(filterByPeriod([row], "yearly")).toHaveLength(1);
    expect(filterByPeriod([row], "monthly")).toHaveLength(0);
    expect(filterByPeriod([row], "weekly")).toHaveLength(0);
  });

  it("includes a row from this month in monthly view", () => {
    // Use day 15 to avoid UTC midnight crossing month boundaries
    const mm = String(thisMonth + 1).padStart(2, "0");
    const iso = `${thisYear}-${mm}-15`;
    const rows = [makeRow({ cm_date: iso })];
    expect(filterByPeriod(rows, "monthly")).toHaveLength(1);
  });

  it("excludes a row from last month in monthly view", () => {
    const prevMonth = thisMonth === 0 ? 12 : thisMonth;
    const prevYear  = thisMonth === 0 ? thisYear - 1 : thisYear;
    const mm = String(prevMonth).padStart(2, "0");
    const iso = `${prevYear}-${mm}-15`;
    const rows = [makeRow({ cm_date: iso })];
    expect(filterByPeriod(rows, "monthly")).toHaveLength(0);
  });

  it("includes a row from today in weekly view", () => {
    const iso = now.toISOString().slice(0, 10);
    const rows = [makeRow({ cm_date: iso })];
    expect(filterByPeriod(rows, "weekly")).toHaveLength(1);
  });

  it("excludes a row older than 7 days in weekly view", () => {
    const old = new Date(now.getTime() - 8 * 86400000);
    const iso = old.toISOString().slice(0, 10);
    const rows = [makeRow({ cm_date: iso })];
    expect(filterByPeriod(rows, "weekly")).toHaveLength(0);
  });

  it("returns empty array when input is empty", () => {
    expect(filterByPeriod([], "yearly")).toHaveLength(0);
  });
});

// ─── applyFilters ─────────────────────────────────────────────────────────────

describe("applyFilters", () => {
  const closedRow = makeRow({ status: "closed", faulty_equipment: "fan", severity: "Low", station_name: "สยาม" });
  const openRow   = makeRow({ status: "open",   faulty_equipment: "mdb", severity: "High", station_name: "รังสิต" });

  it("returns all rows when no filters active", () => {
    expect(applyFilters([closedRow, openRow], noFilters)).toHaveLength(2);
  });

  it("filters by status", () => {
    const filters = { ...noFilters, status: STATUS_LABELS.completed };
    expect(applyFilters([closedRow, openRow], filters)).toHaveLength(1);
    expect(applyFilters([closedRow, openRow], filters)[0]).toBe(closedRow);
  });

  it("filters by equipment", () => {
    const filters = { ...noFilters, equipment: "fan" };
    expect(applyFilters([closedRow, openRow], filters)).toHaveLength(1);
  });

  it("filters by severity", () => {
    const filters = { ...noFilters, severity: "High" };
    expect(applyFilters([closedRow, openRow], filters)).toHaveLength(1);
    expect(applyFilters([closedRow, openRow], filters)[0]).toBe(openRow);
  });

  it("filters by station", () => {
    const filters = { ...noFilters, station: "รังสิต" };
    expect(applyFilters([closedRow, openRow], filters)).toHaveLength(1);
  });

  it("combines multiple filters (AND logic)", () => {
    const filters = { ...noFilters, equipment: "mdb", severity: "High" };
    expect(applyFilters([closedRow, openRow], filters)).toHaveLength(1);
    expect(applyFilters([closedRow, openRow], filters)[0]).toBe(openRow);
  });

  it("exclude parameter skips that dimension", () => {
    const filters = { ...noFilters, status: STATUS_LABELS.completed };
    // excluding "status" means status filter is ignored → both rows pass
    expect(applyFilters([closedRow, openRow], filters, "status")).toHaveLength(2);
  });

  it("treats missing equipment as Unknown when filter is Unknown", () => {
    const row = makeRow({ faulty_equipment: "" });
    const filters = { ...noFilters, equipment: "Unknown" };
    expect(applyFilters([row], filters)).toHaveLength(1);
  });

  it("returns empty when no rows match combined filters", () => {
    const filters = { ...noFilters, equipment: "fan", severity: "High" };
    expect(applyFilters([closedRow, openRow], filters)).toHaveLength(0);
  });
});

// ─── applySearch ─────────────────────────────────────────────────────────────

describe("applySearch", () => {
  const rows = [
    makeRow({ station_name: "สยามพารากอน", issue_id: "CM-ST01-0101-01", faulty_equipment: "charger_1" }),
    makeRow({ station_name: "เมกาบางนา",  issue_id: "CM-ST02-0102-01", faulty_equipment: "energy_meter" }),
  ];

  it("returns all rows for empty query", () => {
    expect(applySearch(rows, "")).toHaveLength(2);
    expect(applySearch(rows, "   ")).toHaveLength(2);
  });

  it("filters by station name (case-insensitive search field)", () => {
    expect(applySearch(rows, "สยาม")).toHaveLength(1);
  });

  it("filters by issue_id prefix", () => {
    expect(applySearch(rows, "CM-ST02")).toHaveLength(1);
  });

  it("filters by equipment", () => {
    expect(applySearch(rows, "energy_meter")).toHaveLength(1);
  });

  it("returns empty when nothing matches", () => {
    expect(applySearch(rows, "zzz_no_match")).toHaveLength(0);
  });
});

// ─── groupCount ──────────────────────────────────────────────────────────────

describe("groupCount", () => {
  it("returns empty keys/vals for empty array", () => {
    const result = groupCount([], "faulty_equipment");
    expect(result.keys).toHaveLength(0);
    expect(result.vals).toHaveLength(0);
  });

  it("maps missing value to Unknown", () => {
    const rows = [makeRow({ faulty_equipment: "" })];
    const result = groupCount(rows, "faulty_equipment");
    expect(result.keys).toContain("Unknown");
  });

  it("counts correctly", () => {
    const rows = [
      makeRow({ faulty_equipment: "fan" }),
      makeRow({ faulty_equipment: "fan" }),
      makeRow({ faulty_equipment: "mdb" }),
    ];
    const result = groupCount(rows, "faulty_equipment");
    const fanIdx = result.keys.indexOf("fan");
    expect(result.vals[fanIdx]).toBe(2);
  });

  it("sorts by descending count", () => {
    const rows = [
      makeRow({ severity: "Low" }),
      makeRow({ severity: "High" }),
      makeRow({ severity: "High" }),
    ];
    const result = groupCount(rows, "severity");
    expect(result.keys[0]).toBe("High");
    expect(result.vals[0]).toBe(2);
  });

  it("caps at 9 entries even with more distinct values", () => {
    const equipments = ["a","b","c","d","e","f","g","h","i","j","k"];
    const rows = equipments.map((e) => makeRow({ faulty_equipment: e }));
    const result = groupCount(rows, "faulty_equipment");
    expect(result.keys.length).toBeLessThanOrEqual(9);
    expect(result.vals.length).toBeLessThanOrEqual(9);
  });
});
