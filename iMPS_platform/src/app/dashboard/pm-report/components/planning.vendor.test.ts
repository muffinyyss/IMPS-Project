import { describe, expect, it } from "vitest";

import { allAssignees, byKey, equipmentByMap, myVendorPlan, pendingVendorPlans } from "./planning";
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

describe("ผู้ทำ PM ที่ planner เลือกให้อุปกรณ์แต่ละชิ้น", () => {
  it("map byKey → ผู้ทำ PM ไม่สนตัวพิมพ์ ชิ้นที่ทีมเราทำไม่อยู่ในผล", () => {
    const wo = {
      vendor_plans: [{ vendor: "EDS", status: "pending" }],
      selected_equipment: [
        { type: "station", by: "EDS" },
        { type: "mdb" },
        { type: "charger", sn: "SN-A", by: "EDS" },
        { type: "charger", sn: "sn-b", by: "OS Co" },
        { type: "charger", sn: "SN-C", by: "" },
        { type: "charger", by: "EDS" },
      ],
    };
    expect(equipmentByMap(wo)).toEqual({ station: "EDS", "charger:sn-a": "EDS", "charger:sn-b": "OS Co" });
  });

  it("จ้าง vendor ทำทั้งสถานี = ทุกชิ้นเป็นของ vendor", () => {
    const types = ["station", "mdb", "ccb", "cbbox"];
    const wo = {
      selected_equipment: [
        ...types.map((type) => ({ type, by: "EDS" })),
        { type: "charger", sn: "F1", by: "EDS" },
      ],
    };
    expect(Object.values(equipmentByMap(wo))).toEqual(["EDS", "EDS", "EDS", "EDS", "EDS"]);
  });

  it("ใบส่งต่อรุ่นก่อนที่ผูกอุปกรณ์ไว้ยังอ่านได้", () => {
    expect(equipmentByMap({ vendor_plans: [{ vendor: "EDS", status: "pending", chargers: ["X1"], sections: ["MDB"] }] }))
      .toEqual({ "charger:x1": "EDS", mdb: "EDS" });
  });

  it("ใบที่ไม่มีข้อมูล = ทีมเราทำทุกชิ้น", () => {
    expect(equipmentByMap({ vendor_plans: [] })).toEqual({});
    expect(equipmentByMap(null)).toEqual({});
  });

  it("byKey ตรงกับ item_key ของ backend (routers/pm_scope.py)", () => {
    expect(byKey({ type: "charger", sn: " SN-A " })).toBe("charger:sn-a");
    expect(byKey({ type: "CBBOX" })).toBe("cbbox");
  });
});
