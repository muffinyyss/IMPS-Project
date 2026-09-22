import { describe, expect, it } from "vitest";

import {
  filterPmAssigneeGroups,
  pmAssigneeGroups,
  pmAssigneeNames,
  togglePmAssigneeBatch,
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
