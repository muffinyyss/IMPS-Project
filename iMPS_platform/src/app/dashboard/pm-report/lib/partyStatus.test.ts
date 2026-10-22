import { describe, expect, it } from "vitest";
import { partyLine, showPartyLine, partyChipText, type PartySummary } from "./partyStatus";

const egat = (state: PartySummary["state"], done = 2, total = 2): PartySummary =>
  ({ key: "egat", name: "EGAT", state, done, total });
const eds = (state: PartySummary["state"], done = 1, total = 3): PartySummary =>
  ({ key: "eds", name: "EDS", state, done, total });

describe("partyLine", () => {
  it("ใบฝ่ายเดียวไม่แสดง", () => {
    expect(partyLine([egat("in_progress")], "th")).toBeNull();
  });
  it("ฝ่ายเดียวที่รอ planner vendor แสดง", () => {
    expect(partyLine([eds("vendor_review")], "th")?.text).toBe("รอ: planner EDS อนุมัติ");
  });
  it("หลายฝ่าย บอกจำนวนที่ส่งแล้วและรอใคร", () => {
    expect(partyLine([egat("submitted"), eds("in_progress")], "th")).toEqual({
      text: "ส่งแล้ว 1/2 ฝ่าย · รอ: EDS กรอก 1/3", tone: "amber",
    });
  });
  it("ตีกลับขึ้นก่อนและเป็นสีแดง", () => {
    const r = partyLine([egat("not_started"), eds("rejected")], "en");
    expect(r?.tone).toBe("red");
    expect(r?.text).toBe("0/2 parties submitted · Waiting: EDS fixing rejected form, EGAT not started");
  });
  it("ส่งครบทุกฝ่ายแล้วไม่แสดง", () => {
    expect(partyLine([egat("submitted"), eds("submitted")], "th")).toBeNull();
  });
  it("ข้อมูลจาก backend รุ่นเก่า (ไม่มี state) ไม่แสดง", () => {
    expect(showPartyLine([{ key: "a", name: "A" }, { key: "b", name: "B" }])).toBe(false);
  });
  it("ชื่อว่าง = ทีมต้นทาง", () => {
    expect(partyChipText({ key: "", name: "", state: "ready" }, "th")).toBe("กรอกครบ รอกดส่งงาน");
    expect(partyLine([{ key: "", name: "", state: "ready" }, eds("submitted")], "th")?.text)
      .toBe("ส่งแล้ว 1/2 ฝ่าย · รอ: ทีมต้นทาง รอกดส่งงาน");
  });
});
