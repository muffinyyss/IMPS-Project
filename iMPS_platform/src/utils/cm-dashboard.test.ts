import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  normalizeStatus,
  statusBadge,
  isCancelled,
  excludeCancelled,
  workStatusOf,
  filterByPeriod,
  applyFilters,
  applySearch,
  groupCount,
  groupCountMulti,
  causeLabelsOf,
  remedyCodesOf,
  remedyDescriptionsOf,
  toList,
  EMPTY_FILTERS,
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
    problem_details: "",
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

const noFilters: ActiveFilters = EMPTY_FILTERS;

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

  it('maps "Complete" (new closed label) → completed', () => {
    expect(normalizeStatus("Complete")).toBe("completed");
  });

  it('maps "completed" → completed', () => {
    expect(normalizeStatus("completed")).toBe("completed");
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

  it('maps "Cancelled" → cancelled (ไม่ใช่ open)', () => {
    expect(normalizeStatus("Cancelled")).toBe("cancelled");
  });

  it("accepte les variantes canceled / cancel / ยกเลิก", () => {
    expect(normalizeStatus("canceled")).toBe("cancelled");
    expect(normalizeStatus("cancel")).toBe("cancelled");
    expect(normalizeStatus("ยกเลิก")).toBe("cancelled");
  });
});

// ─── Cancelled : exclu des graphes et des KPI ────────────────────────────────

describe("cancelled rows", () => {
  it("normalizeWorkStatus met les fiches annulées dans leur propre bucket", () => {
    expect(normalizeWorkStatus("Cancelled")).toBe("cancelled");
    expect(normalizeWorkStatus("Cancelled")).not.toBe("new");
  });

  it("excludeCancelled retire uniquement les fiches annulées", () => {
    const rows = [
      makeRow({ id: "a", status: "Open" }),
      makeRow({ id: "b", status: "Cancelled" }),
      makeRow({ id: "c", status: "Closed" }),
    ];
    expect(rows.map(isCancelled)).toEqual([false, true, false]);
    expect(excludeCancelled(rows).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("groupByMonth ne compte pas les fiches annulées comme « open »", () => {
    const rows = [
      makeRow({ status: "Open", cm_date: `${thisYear}-01-10` }),
      makeRow({ status: "Cancelled", cm_date: `${thisYear}-01-11` }),
    ];
    expect(groupByMonth(rows).open[0]).toBe(1);
  });

  it("le filtre « wo_all » exclut les fiches annulées", () => {
    const rows = [
      makeRow({ id: "a", status: "In Progress" }),
      makeRow({ id: "b", status: "Cancelled" }),
    ];
    const kept = applyFilters(rows, { ...noFilters, workStatus: "wo_all" });
    expect(kept.map((r) => r.id)).toEqual(["a"]);
  });

  it('statusBadge affiche « Cancelled » et non « Open »', () => {
    expect(statusBadge("Cancelled").label).toBe("Cancelled");
  });
});

// ─── workStatusOf : bucket KPI = status + repair_result ──────────────────────

describe("workStatusOf", () => {
  it('"Wait for schedule" = WO แล้ว ไม่ใช่ SR ใหม่', () => {
    // head cs อนุมัติ → ใบกลายเป็น WO รอ planner วางแผน ต้องนับใน "WO ทั้งหมด"
    expect(workStatusOf(makeRow({ status: "Wait for schedule" }))).toBe("wait_manpower");
    expect(workStatusOf(makeRow({ status: "Wait for schedule" }))).not.toBe("new");
  });

  it('"Wait for approve" แยก 2 ด่านด้วย stage — SR (cs) กับ WO (ปิดงาน)', () => {
    expect(workStatusOf(makeRow({ status: "Wait for approve", stage: "cs_approval" }))).toBe("wait_cs_approve");
    expect(workStatusOf(makeRow({ status: "Wait for approve", stage: "close_approval" }))).toBe("wait_approve");
    // ใบเก่าที่ไม่มี stage = ด่านปิดงาน (ตรงกับที่ backend ตีความตอนอนุมัติ)
    expect(workStatusOf(makeRow({ status: "Wait for approve" }))).toBe("wait_approve");
  });

  it('SR ที่รอ head CS อนุมัติ ยังไม่นับเป็น WO', () => {
    const rows = [makeRow({ status: "Wait for approve", stage: "cs_approval" })];
    expect(applyFilters(rows, { ...EMPTY_FILTERS, workStatus: "wo_all" })).toHaveLength(0);
  });

  it('"Open" ยังเป็น SR ใหม่', () => {
    expect(workStatusOf(makeRow({ status: "Open" }))).toBe("new");
  });

  it("อ่านสถานะรอจาก repair_result (status เก็บไม่ได้)", () => {
    expect(workStatusOf(makeRow({ status: "In Progress", repair_result: "WO - wait for material" }))).toBe("wait_sparepart");
    expect(workStatusOf(makeRow({ status: "In Progress", repair_result: "WO - wait for site condition" }))).toBe("wait_site_access");
    expect(workStatusOf(makeRow({ status: "In Progress", repair_result: "WO - wait for scheduled" }))).toBe("wait_manpower");
  });

  it("ใบที่ปิด/ยกเลิกแล้ว ไม่ถูกดึงกลับด้วยสถานะรอรอบเก่า", () => {
    expect(workStatusOf(makeRow({ status: "Closed", repair_result: "WO - wait for material" }))).toBe("completed");
    expect(workStatusOf(makeRow({ status: "Cancelled", repair_result: "WO - wait for material" }))).toBe("cancelled");
  });

  it("repair_result ที่ไม่ใช่สถานะรอ ให้ใช้ status ตามเดิม", () => {
    expect(workStatusOf(makeRow({ status: "Wait for approve", repair_result: "แก้ไขสำเร็จ" }))).toBe("wait_approve");
  });

  it('« wo_all » นับ Wait for schedule เป็น WO', () => {
    const rows = [
      makeRow({ id: "a", status: "Open" }),
      makeRow({ id: "b", status: "Wait for schedule" }),
    ];
    const kept = applyFilters(rows, { ...noFilters, workStatus: "wo_all" });
    expect(kept.map((r) => r.id)).toEqual(["b"]);
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

  // ── workStatus (คลิกการ์ด KPI) ──
  it("filters by workStatus bucket (completed)", () => {
    const filters = { ...noFilters, workStatus: "completed" as const };
    const out = applyFilters([closedRow, openRow], filters);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(closedRow);
  });

  it("filters by workStatus bucket (new) — plain open rows count as new", () => {
    const filters = { ...noFilters, workStatus: "new" as const };
    const out = applyFilters([closedRow, openRow], filters);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(openRow);
  });

  it("filters by workStatus bucket (wait_sparepart) via keyword", () => {
    const spareRow = makeRow({ status: "WO wait for spare part" });
    const filters = { ...noFilters, workStatus: "wait_sparepart" as const };
    const out = applyFilters([closedRow, openRow, spareRow], filters);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(spareRow);
  });

  it("workStatus combines with other filters (AND logic)", () => {
    const filters = { ...noFilters, workStatus: "completed" as const, severity: "High" };
    expect(applyFilters([closedRow, openRow], filters)).toHaveLength(0);
  });

  it('exclude "workStatus" skips that dimension', () => {
    const filters = { ...noFilters, workStatus: "completed" as const };
    expect(applyFilters([closedRow, openRow], filters, "workStatus")).toHaveLength(2);
  });

  // ── « All work order » = tout sauf le bucket "new" ──
  it('workStatus "wo_all" keeps every row that left the new bucket', () => {
    const spareRow = makeRow({ status: "WO wait for spare part" });
    const filters = { ...noFilters, workStatus: "wo_all" as const };
    const out = applyFilters([closedRow, openRow, spareRow], filters);
    expect(out).toEqual([closedRow, spareRow]);
  });

  it('workStatus "wo_all" excludes plain new service requests', () => {
    const filters = { ...noFilters, workStatus: "wo_all" as const };
    expect(applyFilters([openRow], filters)).toHaveLength(0);
  });

  // ── cause / remedy (nouveaux donuts) ──
  it("filters by cause label (code Maximo traduit)", () => {
    const overheat = makeRow({ id: "o", cause: ["OVERHEAT"] });
    const simcard = makeRow({ id: "s", cause: ["SIMCARDP"] });
    const out = applyFilters([overheat, simcard], { ...noFilters, cause: "Overheat" });
    expect(out.map((r) => r.id)).toEqual(["o"]);
  });

  it("keeps a row matching any of its causes", () => {
    const multi = makeRow({ cause: ["OVERHEAT", "SIMCARDP"] });
    expect(applyFilters([multi], { ...noFilters, cause: "SIM Card Problem" })).toHaveLength(1);
  });

  it("drops rows with no cause when a cause filter is active", () => {
    expect(applyFilters([makeRow({ cause: [] })], { ...noFilters, cause: "Overheat" })).toHaveLength(0);
  });

  it("filters by remedy code", () => {
    const replace = makeRow({ id: "r", repaired_equipment: ["REPLACE"] });
    const reset = makeRow({ id: "x", repaired_equipment: ["RESET"] });
    const out = applyFilters([replace, reset], { ...noFilters, remedy: "REPLACE" });
    expect(out.map((r) => r.id)).toEqual(["r"]);
  });

  it('exclude "remedy" skips that dimension', () => {
    const rows = [makeRow({ repaired_equipment: ["REPLACE"] }), makeRow({ repaired_equipment: ["RESET"] })];
    expect(applyFilters(rows, { ...noFilters, remedy: "REPLACE" }, "remedy")).toHaveLength(2);
  });
});

// ─── Champs multi-valeurs (cause / remedy) ───────────────────────────────────

describe("toList", () => {
  it("wraps a plain string (fiches anciennes)", () => {
    expect(toList("OVERHEAT")).toEqual(["OVERHEAT"]);
  });
  it("trims and drops empty entries", () => {
    expect(toList([" OVERHEAT ", "", "  "])).toEqual(["OVERHEAT"]);
  });
  it("returns [] for undefined / empty string", () => {
    expect(toList(undefined)).toEqual([]);
    expect(toList("   ")).toEqual([]);
  });
});

describe("causeLabelsOf", () => {
  it("translates Maximo cause codes to their description", () => {
    expect(causeLabelsOf(makeRow({ cause: ["POWMODUL"] }))).toEqual(["Power Module Failed"]);
  });
  it("leaves unknown free text untouched", () => {
    expect(causeLabelsOf(makeRow({ cause: "Ethernet cable cut" }))).toEqual(["Ethernet cable cut"]);
  });
  it("de-duplicates codes sharing one description", () => {
    expect(causeLabelsOf(makeRow({ cause: ["OVERHEAT", "OVERHEAT"] }))).toEqual(["Overheat"]);
  });
});

describe("remedyCodesOf", () => {
  it("uppercases and de-duplicates", () => {
    expect(remedyCodesOf(makeRow({ repaired_equipment: ["replace", "REPLACE", "reset"] })))
      .toEqual(["REPLACE", "RESET"]);
  });
});

describe("remedyDescriptionsOf", () => {
  it("resolves the exact (fc, problem, cause, remedy) description", () => {
    const row = makeRow({
      faulty_equipment: "DCCHARFC", problem_type: ["POWERDRP"],
      cause: ["POWMODUL"], repaired_equipment: ["REPLACE"],
    });
    expect(remedyDescriptionsOf(row, "REPLACE")).toEqual(["Replace (Power Module)"]);
  });

  it("falls back to (cause, remedy) when the problem code is missing", () => {
    const row = makeRow({ faulty_equipment: "", problem_type: [], cause: ["CBPOWTRP"] });
    expect(remedyDescriptionsOf(row, "RESET")).toEqual(["Reset (CB)"]);
  });

  it("returns one description per cause on a multi-cause work order", () => {
    const row = makeRow({
      faulty_equipment: "DCCHARFC", problem_type: ["UN2STCHG"],
      cause: ["DCCTR1FC", "DCCTR2FC"],
    });
    expect(remedyDescriptionsOf(row, "REPLACE"))
      .toEqual(["Replace (DC Contactor No.1)", "Replace (DC Contactor No.2)"]);
  });

  it("falls back to the short remedy label when nothing matches", () => {
    const row = makeRow({ faulty_equipment: "charger_1", cause: "Ethernet" });
    expect(remedyDescriptionsOf(row, "REPLACE")).toEqual(["Replace"]);
  });

  it("returns [] when no remedy code is given", () => {
    expect(remedyDescriptionsOf(makeRow(), "")).toEqual([]);
  });
});

describe("groupCountMulti", () => {
  it("counts a row once per value it carries", () => {
    const rows = [
      makeRow({ cause: ["OVERHEAT", "SIMCARDP"] }),
      makeRow({ cause: ["OVERHEAT"] }),
    ];
    const g = groupCountMulti(rows, causeLabelsOf);
    expect(g.keys[0]).toBe("Overheat");
    expect(g.vals[0]).toBe(2);
    expect(g.vals[g.keys.indexOf("SIM Card Problem")]).toBe(1);
  });

  it("skips rows with no value (cause pas encore saisie)", () => {
    const g = groupCountMulti([makeRow({ cause: [] })], causeLabelsOf);
    expect(g.keys).toHaveLength(0);
  });

  it("caps the number of slices", () => {
    const rows = Array.from({ length: 12 }, (_, i) => makeRow({ cause: [`CAUSE_${i}`] }));
    expect(groupCountMulti(rows, causeLabelsOf, 5).keys).toHaveLength(5);
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

// ─── normalizeWorkStatus (7 KPI buckets) ─────────────────────────────────────

import { normalizeWorkStatus, weekOfMonth, weeksInMonth, filterByDate, groupByMonth, listYears } from "./cm-dashboard";

describe("normalizeWorkStatus", () => {
  it('maps "Open" → new', () => {
    expect(normalizeWorkStatus("Open")).toBe("new");
  });
  it('maps "Closed" → completed', () => {
    expect(normalizeWorkStatus("Closed")).toBe("completed");
  });
  it('maps "Complete" (new closed label) → completed', () => {
    expect(normalizeWorkStatus("Complete")).toBe("completed");
  });
  it('maps "In Progress" → in_progress', () => {
    expect(normalizeWorkStatus("In Progress")).toBe("in_progress");
  });
  it('maps "wait for scheduled" (new) → wait_manpower bucket', () => {
    expect(normalizeWorkStatus("WO - wait for scheduled")).toBe("wait_manpower");
  });
  it('maps "wait for manpower" (legacy) → wait_manpower', () => {
    expect(normalizeWorkStatus("WO - wait for manpower")).toBe("wait_manpower");
  });
  it('does NOT bucket status "Wait for schedule" as wait_manpower', () => {
    expect(normalizeWorkStatus("Wait for schedule")).toBe("new");
  });
  it('maps "wait for spare part" (legacy) → wait_sparepart', () => {
    expect(normalizeWorkStatus("wait for spare part")).toBe("wait_sparepart");
  });
  it('maps "WO - wait for material" (new) → wait_sparepart', () => {
    expect(normalizeWorkStatus("WO - wait for material")).toBe("wait_sparepart");
  });
  it('maps Maximo "WMATL" (waiting material) → wait_sparepart', () => {
    expect(normalizeWorkStatus("waiting material")).toBe("wait_sparepart");
  });
  it('maps "wait for approve" → wait_approve', () => {
    expect(normalizeWorkStatus("Wait for Approve")).toBe("wait_approve");
  });
  it('maps "wait for site access" (legacy) → wait_site_access', () => {
    expect(normalizeWorkStatus("WO - wait for site access")).toBe("wait_site_access");
  });
  it('maps "WO - wait for site condition" (new) → wait_site_access', () => {
    expect(normalizeWorkStatus("WO - wait for site condition")).toBe("wait_site_access");
  });
  it('maps "Wait for schedule" → new', () => {
    expect(normalizeWorkStatus("Wait for schedule")).toBe("new");
  });
  it('maps unknown/empty → new', () => {
    expect(normalizeWorkStatus("")).toBe("new");
    expect(normalizeWorkStatus("submitted")).toBe("new");
  });
});

// ─── weekOfMonth / weeksInMonth ──────────────────────────────────────────────

describe("weekOfMonth", () => {
  // Juillet 2026 : le 1er est un mercredi → semaine 1 = 1–5 juil., semaine 2 commence lundi 6
  it("day 1 is week 1", () => {
    expect(weekOfMonth(new Date(2026, 6, 1))).toBe(1);
  });
  it("Sunday July 5, 2026 is still week 1", () => {
    expect(weekOfMonth(new Date(2026, 6, 5))).toBe(1);
  });
  it("Monday July 6, 2026 starts week 2", () => {
    expect(weekOfMonth(new Date(2026, 6, 6))).toBe(2);
  });
  it("July 31, 2026 is week 5", () => {
    expect(weekOfMonth(new Date(2026, 6, 31))).toBe(5);
  });
  it("weeksInMonth July 2026 = 5", () => {
    expect(weeksInMonth(2026, 6)).toBe(5);
  });
});

// ─── filterByDate ────────────────────────────────────────────────────────────

describe("filterByDate", () => {
  const rows = [
    makeRow({ id: "a", cm_date: "2026-07-06" }),
    makeRow({ id: "b", cm_date: "2026-07-20" }),
    makeRow({ id: "c", cm_date: "2026-03-10" }),
    makeRow({ id: "d", cm_date: "2025-07-06" }),
    makeRow({ id: "e", cm_date: null }),
  ];

  it("year filter keeps only that year", () => {
    expect(filterByDate(rows, 2026, "all", "all").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
  it("year+month filter", () => {
    expect(filterByDate(rows, 2026, 6, "all").map((r) => r.id)).toEqual(["a", "b"]);
  });
  it("year+month+week filter", () => {
    expect(filterByDate(rows, 2026, 6, 2).map((r) => r.id)).toEqual(["a"]);
  });
  it("null dates only visible with year=all", () => {
    expect(filterByDate(rows, "all", "all", "all")).toHaveLength(5);
    expect(filterByDate(rows, 2026, "all", "all").find((r) => r.id === "e")).toBeUndefined();
  });
});

// ─── groupByMonth ────────────────────────────────────────────────────────────

describe("groupByMonth", () => {
  it("counts statuses per month index", () => {
    const rows = [
      makeRow({ cm_date: "2026-07-06", status: "Open" }),
      makeRow({ cm_date: "2026-07-07", status: "Closed" }),
      makeRow({ cm_date: "2026-07-08", status: "In Progress" }),
      makeRow({ cm_date: "2026-01-15", status: "Open" }),
      makeRow({ cm_date: null, status: "Open" }),
    ];
    const g = groupByMonth(rows);
    expect(g.open[6]).toBe(1);
    expect(g.completed[6]).toBe(1);
    expect(g.inProgress[6]).toBe(1);
    expect(g.open[0]).toBe(1);
    expect(g.open.reduce((s, v) => s + v, 0)).toBe(2); // แถว null ไม่ถูกนับ
  });
});

// ─── listYears ───────────────────────────────────────────────────────────────

describe("listYears", () => {
  it("returns distinct years desc, always including current year", () => {
    const rows = [makeRow({ cm_date: "2024-05-01" }), makeRow({ cm_date: "2026-01-01" })];
    const ys = listYears(rows);
    expect(ys).toContain(2024);
    expect(ys).toContain(new Date().getFullYear());
    expect([...ys].sort((a, b) => b - a)).toEqual(ys);
  });
});
