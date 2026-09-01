import { describe, expect, it } from "vitest";
import { findMissingCcbMeasurementInputs } from "./validation";

const blankMeasurements = {
  "L-N": { value: "" },
  "L-G": { value: "" },
  "N-G": { value: "" },
};

describe("findMissingCcbMeasurementInputs", () => {
  it("skips question 9 and 10 inputs in post-PM when pre-PM marked them N/A", () => {
    const missing = findMissingCcbMeasurementInputs({
      isPostMode: true,
      currentRows: {},
      preRows: {
        r8_1: { pf: "NA" },
        r8_2: { pf: "NA" },
        r9_main: { pf: "NA" },
        r10_sub1: { pf: "NA" },
      },
      mainMeasurements: blankMeasurements,
      subMeasurements: [blankMeasurements],
      subBreakerCount: 1,
    });

    expect(missing).toEqual([]);
  });

  it("keeps current-form N/A behavior in both pre-PM and post-PM", () => {
    const base = {
      currentRows: { r9_main: { pf: "NA" }, r10_sub1: { pf: "NA" } },
      preRows: {},
      mainMeasurements: blankMeasurements,
      subMeasurements: [blankMeasurements],
      subBreakerCount: 1,
    };

    expect(findMissingCcbMeasurementInputs({ ...base, isPostMode: false })).toEqual([]);
    expect(findMissingCcbMeasurementInputs({ ...base, isPostMode: true })).toEqual([]);
  });

  it("reports only applicable rows and accepts zero as a filled value", () => {
    const missing = findMissingCcbMeasurementInputs({
      isPostMode: true,
      currentRows: { r10_sub2: { pf: "PASS" } },
      preRows: {
        r9_main: { pf: "NA" },
        r10_sub1: { pf: "NA" },
        r10_sub2: { pf: "PASS" },
      },
      mainMeasurements: blankMeasurements,
      subMeasurements: [blankMeasurements, {
        "L-N": { value: 0 },
        "L-G": { value: "" },
        "N-G": { value: "230" },
      }],
      subBreakerCount: 2,
    });

    expect(missing).toEqual([
      { qNo: 10, subNo: 2, label: "L-G", fieldKey: "L-G" },
    ]);
  });

  it("does not use pre-PM N/A state while validating the pre-PM form", () => {
    const missing = findMissingCcbMeasurementInputs({
      isPostMode: false,
      currentRows: {},
      preRows: { r9_main: { pf: "NA" }, r10_sub1: { pf: "NA" } },
      mainMeasurements: blankMeasurements,
      subMeasurements: [blankMeasurements],
      subBreakerCount: 1,
    });

    expect(missing).toHaveLength(6);
    expect(missing.map(({ qNo }) => qNo)).toEqual([9, 9, 9, 10, 10, 10]);
  });
});
