import { describe, expect, it } from "vitest";
import { findMissingCcbMeasurementInputs } from "./validation";

const blankMeasurements = {
  "L-N": { value: "" },
  "L-G": { value: "" },
  "N-G": { value: "" },
};

describe("findMissingCcbMeasurementInputs", () => {
  it("skips question 9 and 10 inputs when the form marks them N/A", () => {
    const missing = findMissingCcbMeasurementInputs({
      rows: { r9_main: { pf: "NA" }, r10_sub1: { pf: "NA" } },
      mainMeasurements: blankMeasurements,
      subMeasurements: [blankMeasurements],
      subBreakerCount: 1,
    });

    expect(missing).toEqual([]);
  });

  it("requires every blank measurement when nothing is N/A", () => {
    const missing = findMissingCcbMeasurementInputs({
      rows: {},
      mainMeasurements: blankMeasurements,
      subMeasurements: [blankMeasurements],
      subBreakerCount: 1,
    });

    expect(missing).toHaveLength(6);
    expect(missing.map(({ qNo }) => qNo)).toEqual([9, 9, 9, 10, 10, 10]);
  });

  it("reports only applicable rows and accepts zero as a filled value", () => {
    const missing = findMissingCcbMeasurementInputs({
      rows: {
        r9_main: { pf: "NA" },
        r10_sub1: { pf: "NA" },
        r10_sub2: { pf: "GOOD" },
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

  it("ignores sub-breakers beyond the current count", () => {
    const missing = findMissingCcbMeasurementInputs({
      rows: { r9_main: { pf: "NA" } },
      mainMeasurements: blankMeasurements,
      subMeasurements: [
        { "L-N": { value: "230" }, "L-G": { value: "230" }, "N-G": { value: "1" } },
        blankMeasurements,
      ],
      subBreakerCount: 1,
    });

    expect(missing).toEqual([]);
  });
});
