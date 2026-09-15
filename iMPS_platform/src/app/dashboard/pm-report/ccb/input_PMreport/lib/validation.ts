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
  isPostMode: boolean;
  currentRows: StatusRows;
  preRows: StatusRows;
  mainMeasurements: MeasurementState;
  subMeasurements: readonly MeasurementState[];
  subBreakerCount: number;
}

function isMeasurementNotApplicable(
  rowKey: string,
  isPostMode: boolean,
  currentRows: StatusRows,
  preRows: StatusRows,
): boolean {
  return currentRows[rowKey]?.pf === "NA"
    || (isPostMode && preRows[rowKey]?.pf === "NA");
}

export function findMissingCcbMeasurementInputs({
  isPostMode,
  currentRows,
  preRows,
  mainMeasurements,
  subMeasurements,
  subBreakerCount,
}: FindMissingMeasurementInputsArgs): MissingCcbMeasurementInput[] {
  const missing: MissingCcbMeasurementInput[] = [];

  if (!isMeasurementNotApplicable("r9_main", isPostMode, currentRows, preRows)) {
    VOLTAGE_FIELDS.forEach((fieldKey) => {
      if (!String(mainMeasurements[fieldKey]?.value ?? "").trim()) {
        missing.push({ qNo: 9, label: fieldKey, fieldKey });
      }
    });
  }

  for (let index = 0; index < subBreakerCount; index += 1) {
    const rowKey = `r10_sub${index + 1}`;
    if (isMeasurementNotApplicable(rowKey, isPostMode, currentRows, preRows)) continue;

    const measurements = subMeasurements[index] ?? {};
    VOLTAGE_FIELDS.forEach((fieldKey) => {
      if (!String(measurements[fieldKey]?.value ?? "").trim()) {
        missing.push({ qNo: 10, subNo: index + 1, label: fieldKey, fieldKey });
      }
    });
  }

  return missing;
}
