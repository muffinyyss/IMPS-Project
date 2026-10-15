import { describe, expect, it } from "vitest";

import { allAssignees, myVendorPlan, pendingVendorPlans } from "./planning";
import { toPmFlow, woToRow } from "./flow";
import { stageOf } from "@/utils/pm-dashboard";

// EGAT วางแผนแล้วเลือก EDS → EDS ต้องวางแผนอีกรอบเพื่อส่งทีมของตัวเองเข้าหน้างาน
const egatPlanned = {
  wonum: "WO1",
  planning_status: "planned",
  assignees: ["Technician1 EGAT", "EDS"],
  vendor_plans: [{ vendor: "EDS", status: "pending" }],
};
const edsPlanned = {
  ...egatPlanned,
  vendor_plans: [{ vendor: "EDS", status: "planned", assignees: ["tech.eds1", "tech.eds2"] }],
};

describe("vendor plan (EGAT → EDS)", () => {
  it("EDS ยังไม่วางแผน = ยังรอ EDS", () => {
    expect(pendingVendorPlans(egatPlanned).map((v) => v.vendor)).toEqual(["EDS"]);
    expect(pendingVendorPlans(edsPlanned)).toEqual([]);
    expect(pendingVendorPlans({ vendor_plans: null })).toEqual([]);
  });

  it("ใบงานยังเป็น Open จนกว่า EDS จะส่งทีม", () => {
    expect(toPmFlow({ kind: "wo", planning_status: "planned", vendor_plans: egatPlanned.vendor_plans }))
      .toBe("wo_pending");
    expect(toPmFlow(woToRow(edsPlanned, "x"))).toBe("wo_planned");
    expect(stageOf({ id: "WO1", kind: "wo", planning_status: "planned", vendor_plans: egatPlanned.vendor_plans }))
      .toBe("open");
    expect(stageOf({ id: "WO1", kind: "wo", planning_status: "planned", vendor_plans: edsPlanned.vendor_plans }))
      .toBe("in_progress");
  });

  it("ช่างของ EDS รวมอยู่ในผู้รับผิดชอบของใบงาน", () => {
    expect(allAssignees(edsPlanned)).toEqual(["Technician1 EGAT", "EDS", "tech.eds1", "tech.eds2"]);
    expect(woToRow(edsPlanned, "x").assignees_label).toContain("tech.eds1");
  });

  it("planner EDS เห็นแผนของบริษัทตัวเอง (ไม่สนตัวพิมพ์)", () => {
    expect(myVendorPlan(egatPlanned, "eds")?.vendor).toBe("EDS");
    expect(myVendorPlan(egatPlanned, "EGAT")).toBeNull();
  });
});
