import { afterEach, describe, expect, it, vi } from "vitest";

import { dateTimeLocalFromNow, PM_DEFAULT_SPAN_DAYS } from "./planning";

/** ตรึงนาฬิกาไว้ที่เวลา local ที่กำหนด (เดือนนับจาก 1 เพื่ออ่านง่าย) */
function freeze(y: number, m: number, d: number, hh = 0, mm = 0) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(y, m - 1, d, hh, mm));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("dateTimeLocalFromNow", () => {
  it("ไม่บวกวัน = เวลาปัจจุบันในรูปแบบของ input datetime-local", () => {
    freeze(2026, 9, 22, 14, 5);
    expect(dateTimeLocalFromNow()).toBe("2026-09-22T14:05");
  });

  it("เติมศูนย์หน้าเลขหลักเดียวครบทุกช่อง", () => {
    freeze(2026, 1, 2, 3, 4);
    expect(dateTimeLocalFromNow()).toBe("2026-01-02T03:04");
  });

  it("บวก 7 วันตามค่าตั้งต้นของแผน และคงเวลาเดิมไว้", () => {
    freeze(2026, 9, 22, 14, 5);
    expect(dateTimeLocalFromNow(PM_DEFAULT_SPAN_DAYS)).toBe("2026-09-29T14:05");
  });

  it("บวกแล้วข้ามเดือนได้", () => {
    freeze(2026, 9, 28, 9, 0);
    expect(dateTimeLocalFromNow(7)).toBe("2026-10-05T09:00");
  });

  it("บวกแล้วข้ามปีได้", () => {
    freeze(2026, 12, 30, 23, 59);
    expect(dateTimeLocalFromNow(7)).toBe("2027-01-06T23:59");
  });

  it("บวกแล้วข้ามวันที่ 29 ก.พ. ของปีอธิกสุรทินได้", () => {
    freeze(2028, 2, 26, 8, 30);
    expect(dateTimeLocalFromNow(7)).toBe("2028-03-04T08:30");
  });

  it("วันเสร็จตั้งต้นมาทีหลังวันเริ่มเสมอ (ผ่าน validation ของฟอร์ม)", () => {
    freeze(2026, 12, 30, 23, 59);
    expect(dateTimeLocalFromNow(PM_DEFAULT_SPAN_DAYS) > dateTimeLocalFromNow()).toBe(true);
  });
});
