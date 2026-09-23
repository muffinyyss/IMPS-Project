const VOLTAGE_FIELDS = ["L-N", "L-G", "N-G"] as const;

type StatusRows = Readonly<Record<string, { pf?: string | null } | undefined>>;
type MeasurementState = Readonly<Partial<Record<(typeof VOLTAGE_FIELDS)[number], { value?: unknown }>>>;

export interface MissingCcbMeasurementInput {
  qNo: number;
  subNo?: number;
  label: string;
  fieldKey: string;
}

interface FindMissingMeasurementInputsArgs {
  rows: StatusRows;
  mainMeasurements: MeasurementState;
  subMeasurements: readonly MeasurementState[];
  subBreakerCount: number;
}

/** ข้อที่เลือก N/A ในฟอร์ม (Post-PM) ไม่ต้องกรอกค่าวัด */
function isMeasurementNotApplicable(rowKey: string, rows: StatusRows): boolean {
  return rows[rowKey]?.pf === "NA";
}

export function findMissingCcbMeasurementInputs({
  rows,
  mainMeasurements,
  subMeasurements,
  subBreakerCount,
}: FindMissingMeasurementInputsArgs): MissingCcbMeasurementInput[] {
  const missing: MissingCcbMeasurementInput[] = [];

  if (!isMeasurementNotApplicable("r9_main", rows)) {
    VOLTAGE_FIELDS.forEach((fieldKey) => {
      if (!String(mainMeasurements[fieldKey]?.value ?? "").trim()) {
        missing.push({ qNo: 9, label: fieldKey, fieldKey });
      }
    });
  }

  for (let index = 0; index < subBreakerCount; index += 1) {
    const rowKey = `r10_sub${index + 1}`;
    if (isMeasurementNotApplicable(rowKey, rows)) continue;

    const measurements = subMeasurements[index] ?? {};
    VOLTAGE_FIELDS.forEach((fieldKey) => {
      if (!String(measurements[fieldKey]?.value ?? "").trim()) {
        missing.push({ qNo: 10, subNo: index + 1, label: fieldKey, fieldKey });
      }
    });
  }

  return missing;
}
