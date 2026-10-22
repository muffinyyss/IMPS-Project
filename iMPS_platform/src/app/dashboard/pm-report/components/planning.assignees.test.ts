import { describe, expect, it } from "vitest";

import {
  commonBy,
  filterPmAssigneeGroups,
  needsOwnAssignee,
  ownPlanAssignees,
  pmAssigneeGroups,
  handoffGroups,
  isAssignedTo,
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

  it("vendor ที่ได้ส่วนระดับสถานี (จ้างทั้งสถานี) ก็ไม่ติ๊กค้าง", () => {
    const wo = {
      assignees: ["EDS"],
      selected_equipment: [{ type: "station", by: "EDS" }, { type: "mdb", by: "EDS" }],
    };
    expect(ownPlanAssignees(wo)).toEqual([]);
  });

  it("outsource ที่ติ๊กเองโดยไม่ได้ให้ทำตู้ อยู่ครบ", () => {
    const wo = { assignees: ["Technician2 EGAT", "หจก.ช่างไทยบริการ"], selected_equipment: [] };
    expect(ownPlanAssignees(wo)).toEqual(["Technician2 EGAT", "หจก.ช่างไทยบริการ"]);
    expect(ownPlanAssignees(null)).toEqual([]);
  });
});

describe("handoffGroups", () => {
  it("จัดกลุ่มอุปกรณ์ตามผู้ทำ PM ข้ามชิ้นของทีมเรา", () => {
    expect(
      handoffGroups([
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
  it("มีอุปกรณ์ที่ทีมเราทำ / ไม่ได้เลือกอุปกรณ์ = ต้องมีคนของเรา", () => {
    expect(needsOwnAssignee([{ by: "" }, { by: "EDS" }])).toBe(true);
    expect(needsOwnAssignee([{ by: "EDS" }, { by: null }])).toBe(true);
    expect(needsOwnAssignee([])).toBe(true);
  });

  it("ทุกอุปกรณ์ให้คนอื่นทำ (จ้างทั้งสถานี / แบ่ง vendor กับ outsource) = ไม่ต้อง", () => {
    expect(needsOwnAssignee([{ by: "EDS" }, { by: "EDS" }])).toBe(false);
    expect(needsOwnAssignee([{ by: "EDS" }, { by: "OS Co" }])).toBe(false);
  });
});

describe("commonBy — ตัวเลือก \"ผู้ทำ PM ทุกรายการ\" ของแถวทั้งหมด", () => {
  it("ตรงกันทุกชิ้น = ชื่อนั้น (ไม่สนตัวพิมพ์)", () => {
    expect(commonBy(["EDS", "eds", " EDS "])).toBe("EDS");
    expect(commonBy(["", undefined, null])).toBe("");
  });

  it("ไม่ตรงกัน = null (โชว์ หลายราย)", () => {
    expect(commonBy(["EDS", ""])).toBeNull();
    expect(commonBy(["EDS", "OS Co"])).toBeNull();
  });

  it("ยังไม่ได้เลือกอุปกรณ์ = ทีมเรา", () => {
    expect(commonBy([])).toBe("");
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

describe("isAssignedTo", () => {
  const WO = {
    // ช่าง EGAT 1 คน + outsource ทั้งบริษัท + EDS ที่ backend เติมจากผู้ทำ PM ของอุปกรณ์
    assignees: ["Technician1 EGAT", "หจก.ช่างไทยบริการ", "EDS"],
    vendor_plans: [{ vendor: "EDS", status: "planned", assignees: ["eds.tech1", "ABC Outsource"] }],
  };

  it("ช่างที่ถูกติ๊กชื่อเห็น / ช่างบริษัทเดียวกันที่ไม่ถูกติ๊กไม่เห็น", () => {
    expect(isAssignedTo(WO, "technician1 egat", "EGAT")).toBe(true);
    expect(isAssignedTo(WO, "Technician2 EGAT", "EGAT")).toBe(false);
  });

  it("ติ๊กบริษัท outsource → ช่างทุกคนของบริษัทนั้นเห็น", () => {
    expect(isAssignedTo(WO, "somchai", " หจก.ช่างไทยบริการ ")).toBe(true);
    expect(isAssignedTo(WO, "somsak", "หจก.ช่างไทยบริการ")).toBe(true);
  });

  it("ชื่อ vendor ที่มีใบส่งต่อไม่นับเป็นติ๊กทั้งบริษัท — เห็นเฉพาะทีมที่ vendor มอบหมาย", () => {
    expect(isAssignedTo(WO, "eds.tech1", "EDS")).toBe(true);
    expect(isAssignedTo(WO, "eds.tech2", "EDS")).toBe(false);
  });

  it("vendor ติ๊กบริษัท outsource ในแผนรอบ 2 → ช่างทุกคนของบริษัทนั้นเห็น", () => {
    expect(isAssignedTo(WO, "abc.tech9", "abc outsource")).toBe(true);
  });

  it("รับ assignees ที่รวมทีม vendor แล้ว (allAssignees) ได้ผลเดียวกัน", () => {
    const merged = { ...WO, assignees: [...WO.assignees, "eds.tech1", "ABC Outsource"] };
    expect(isAssignedTo(merged, "eds.tech2", "EDS")).toBe(false);
    expect(isAssignedTo(merged, "abc.tech9", "ABC Outsource")).toBe(true);
  });

  it("ไม่มีชื่อ / ไม่มีบริษัท / ใบว่าง", () => {
    expect(isAssignedTo(WO, "", "")).toBe(false);
    expect(isAssignedTo(null, "Technician1 EGAT", "EGAT")).toBe(false);
  });
});
