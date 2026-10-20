import { describe, expect, it } from "vitest";

import { allAssignees, chargerByMap, myVendorPlan, pendingVendorPlans } from "./planning";
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

describe("ใบงานเก่าที่ไม่มีใบส่งต่อ (Assign ก่อนมีฟีเจอร์ / EDS ยังไม่มี planner ตอนนั้น)", () => {
  const legacy = { wonum: "WO0", planning_status: "planned", assignees: ["Technician EGAT", "EDS"], vendor_plans: [] };

  it("planner EDS ยังได้วางแผนของบริษัทตัวเอง", () => {
    expect(myVendorPlan(legacy, "EDS")).toEqual({ vendor: "EDS", status: "pending" });
    expect(myVendorPlan(legacy, "EGAT")).toBeNull();
  });

  it("ไม่ทำให้ใบเดิมเด้งกลับเป็น Open สำหรับคนอื่น", () => {
    expect(pendingVendorPlans(legacy)).toEqual([]);
    expect(toPmFlow(woToRow(legacy, "x"))).toBe("wo_planned");
  });
});

describe("ผู้ทำ PM ที่ planner เลือกให้แต่ละตู้", () => {
  it("map SN → ผู้ทำ PM ไม่สนตัวพิมพ์ ตู้ที่ทีมเราทำไม่อยู่ในผล", () => {
    const wo = {
      vendor_plans: [{ vendor: "EDS", status: "pending" }],
      selected_equipment: [
        { type: "station" },
        { type: "charger", sn: "SN-A", by: "EDS" },
        { type: "charger", sn: "sn-b", by: "OS Co" },
        { type: "charger", sn: "SN-C", by: "" },
      ],
    };
    expect(chargerByMap(wo)).toEqual({ "sn-a": "EDS", "sn-b": "OS Co" });
  });

  it("ใบส่งต่อรุ่นก่อนที่ผูกตู้ไว้ยังอ่านได้", () => {
    expect(chargerByMap({ vendor_plans: [{ vendor: "EDS", status: "pending", chargers: ["X1"] }] }))
      .toEqual({ x1: "EDS" });
  });

  it("ใบที่ไม่มีข้อมูล = ทีมเราทำทุกตู้", () => {
    expect(chargerByMap({ vendor_plans: [] })).toEqual({});
    expect(chargerByMap(null)).toEqual({});
  });
});
