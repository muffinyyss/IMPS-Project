import { describe, expect, it } from "vitest";

import {
  chargerHandoffs,
  filterPmAssigneeGroups,
  needsOwnAssignee,
  ownPlanAssignees,
  pmAssigneeGroups,
  pmAssigneeNames,
  togglePmAssigneeBatch,
  vendorOnlyNames,
  withoutNames,
} from "./planning";

const OPTIONS = {
  technicians: ["Technician1 EGAT", "Technician2 EGAT"],
  vendors: ["EDS", "ABB", "Delta"],
  outsources: ["หจก.ช่างไทยบริการ"],
};

describe("pmAssigneeGroups", () => {
  it("เรียง Technician → Vendor → Outsource", () => {
    expect(pmAssigneeGroups(OPTIONS).map((g) => g.key)).toEqual([
      "technician",
      "vendor",
      "outsource",
    ]);
  });

  it("ซ่อนกลุ่มที่ไม่มีคน", () => {
    const groups = pmAssigneeGroups({ ...OPTIONS, vendors: [] });
    expect(groups.map((g) => g.key)).toEqual(["technician", "outsource"]);
  });

  it("ไม่มีคนเลยทั้ง 3 กลุ่ม = ไม่มีหัวข้อเลย", () => {
    expect(pmAssigneeGroups({ technicians: [], vendors: [], outsources: [] })).toEqual([]);
  });

  it("แผนต้นทาง (vendors: false) ไม่มีกลุ่ม Vendor — เลือก vendor ที่ผู้ทำ PM ของตู้แทน", () => {
    const groups = pmAssigneeGroups(OPTIONS, { vendors: false });
    expect(groups.map((g) => g.key)).toEqual(["technician", "outsource"]);
    expect(pmAssigneeNames(groups)).not.toContain("EDS");
  });

  it("vendor ที่เป็น outsource ด้วย ยังติ๊กได้ในกลุ่ม Outsource", () => {
    const groups = pmAssigneeGroups({ ...OPTIONS, outsources: ["EDS"] }, { vendors: false });
    expect(groups.find((g) => g.key === "outsource")?.names).toEqual(["EDS"]);
  });
});

describe("vendorOnlyNames / withoutNames", () => {
  it("vendor ที่ไม่ได้อยู่กลุ่มอื่น", () => {
    expect(vendorOnlyNames({ ...OPTIONS, outsources: ["ABB"] })).toEqual(["EDS", "Delta"]);
  });

  it("ตัดชื่อไม่สนตัวพิมพ์และช่องว่าง", () => {
    expect(withoutNames(["Technician1 EGAT", "EDS", "abb"], [" eds ", "ABB", null])).toEqual([
      "Technician1 EGAT",
    ]);
  });
});

describe("ownPlanAssignees — เปิดแผนเดิมมาแก้", () => {
  it("ไม่เอาผู้ทำ PM ของตู้ที่ backend เติมให้กลับมาติ๊กค้าง", () => {
    const wo = {
      assignees: ["Technician2 EGAT", "EDS", "หจก.ช่างไทยบริการ"],
      selected_equipment: [
        { type: "station" },
        { type: "charger", sn: "F1500425005", by: "EDS" },
        { type: "charger", sn: "F2", by: "หจก.ช่างไทยบริการ" },
      ],
      vendor_plans: [{ vendor: "EDS", status: "pending", chargers: ["F1500425005"] }],
    };
    expect(ownPlanAssignees(wo)).toEqual(["Technician2 EGAT"]);
  });

  it("vendor ที่ได้ใบส่งต่อแบบไม่ผูกตู้ (แผนรุ่นก่อน) ก็ไม่ติ๊กค้าง", () => {
    const wo = {
      assignees: ["Technician2 EGAT", "EDS"],
      selected_equipment: [{ type: "station" }, { type: "charger", sn: "F1" }],
      vendor_plans: [{ vendor: "EDS", status: "pending" }],
    };
    expect(ownPlanAssignees(wo)).toEqual(["Technician2 EGAT"]);
  });

  it("outsource ที่ติ๊กเองโดยไม่ได้ให้ทำตู้ อยู่ครบ", () => {
    const wo = { assignees: ["Technician2 EGAT", "หจก.ช่างไทยบริการ"], selected_equipment: [] };
    expect(ownPlanAssignees(wo)).toEqual(["Technician2 EGAT", "หจก.ช่างไทยบริการ"]);
    expect(ownPlanAssignees(null)).toEqual([]);
  });
});

describe("chargerHandoffs", () => {
  it("จัดกลุ่มตู้ตามผู้ทำ PM ข้ามตู้ของทีมเรา", () => {
    expect(
      chargerHandoffs([
        { label: "Charger 1", by: "EDS" },
        { label: "Charger 2", by: "" },
        { label: "Charger 3", by: "eds" },
        { label: "Charger 4", by: "OS Co" },
      ])
    ).toEqual([
      { name: "EDS", labels: ["Charger 1", "Charger 3"] },
      { name: "OS Co", labels: ["Charger 4"] },
    ]);
  });
});

describe("needsOwnAssignee", () => {
  it("มีส่วนสถานี / ตู้ของทีมเรา / ไม่ได้เลือกอุปกรณ์ = ต้องมีคนของเรา", () => {
    expect(needsOwnAssignee([{ type: "station" }, { type: "charger", by: "EDS" }])).toBe(true);
    expect(needsOwnAssignee([{ type: "charger", by: "EDS" }, { type: "charger", by: "" }])).toBe(true);
    expect(needsOwnAssignee([])).toBe(true);
  });

  it("ทุกอุปกรณ์เป็นตู้ที่ให้คนอื่นทำ = ไม่ต้อง", () => {
    expect(needsOwnAssignee([{ type: "charger", by: "EDS" }, { type: "charger", by: "OS Co" }])).toBe(false);
  });
});

describe("pmAssigneeNames", () => {
  it("ชื่อที่อยู่ 2 กลุ่มนับครั้งเดียว", () => {
    const groups = pmAssigneeGroups({ ...OPTIONS, outsources: ["EDS"] });
    expect(pmAssigneeNames(groups).filter((n) => n === "EDS")).toHaveLength(1);
  });
});

describe("filterPmAssigneeGroups", () => {
  const groups = pmAssigneeGroups(OPTIONS);

  it("คำค้นว่าง = ได้ทุกกลุ่มเดิม", () => {
    expect(filterPmAssigneeGroups(groups, "   ")).toBe(groups);
  });

  it("ค้นหาไม่สนตัวพิมพ์เล็ก-ใหญ่ และตัดกลุ่มที่ไม่เหลือชื่อทิ้ง", () => {
    const found = filterPmAssigneeGroups(groups, "eds");
    expect(found.map((g) => g.key)).toEqual(["vendor"]);
    expect(found[0].names).toEqual(["EDS"]);
  });

  it("ค้นด้วยบางส่วนของชื่อได้", () => {
    const found = filterPmAssigneeGroups(groups, "technician2");
    expect(found.flatMap((g) => g.names)).toEqual(["Technician2 EGAT"]);
  });

  it("ค้นภาษาไทยได้", () => {
    const found = filterPmAssigneeGroups(groups, "ช่างไทย");
    expect(found.map((g) => g.key)).toEqual(["outsource"]);
  });

  it("ไม่เจอเลย = ลิสต์ว่าง", () => {
    expect(filterPmAssigneeGroups(groups, "ไม่มีชื่อนี้")).toEqual([]);
  });
});

describe("togglePmAssigneeBatch", () => {
  it("ติ๊กทั้งหมดเพิ่มเฉพาะชื่อที่ยังไม่ถูกเลือก ไม่ซ้ำ", () => {
    expect(togglePmAssigneeBatch(["EDS"], ["EDS", "ABB"], false)).toEqual(["EDS", "ABB"]);
  });

  it("ปลดติ๊กทั้งหมดขณะค้นหา ไม่ล้างคนที่ถูกกรองออกไป", () => {
    const selected = ["Technician1 EGAT", "EDS", "ABB"];
    // ค้นหา "ab" เหลือเห็นแค่ ABB → กด All เพื่อปลด ต้องเหลืออีกสองคนไว้
    expect(togglePmAssigneeBatch(selected, ["ABB"], true)).toEqual(["Technician1 EGAT", "EDS"]);
  });

  it("ติ๊กทั้งหมดขณะค้นหา ไม่แตะคนที่เลือกไว้นอกคำค้น", () => {
    expect(togglePmAssigneeBatch(["Technician1 EGAT"], ["ABB", "Delta"], false)).toEqual([
      "Technician1 EGAT",
      "ABB",
      "Delta",
    ]);
  });
});
