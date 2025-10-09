"use client";

import React, { useMemo, useState } from "react";
import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardFooter,
    Input,
    Typography,
} from "@material-tailwind/react";

/** --- ค่าคงที่ & ยูทิล --- */
const UNITS = {
    voltage: ["V", "MΩ", "kΩ"] as const,
};
type UnitVoltage = (typeof UNITS.voltage)[number];
type MeasureState<U extends string> = Record<string, { value: string; unit: U }>;
type CheckListProps = {
    onComplete: (status: boolean) => void;
    onNext: () => void; // เรียกเพื่อไปหน้า 2
    onPrev?: () => void; // (ถ้ามีใช้) ย้อนกลับหน้า 1
};

/** ---------- Types ---------- */
type PhotoItem = {
    id: string;
    file?: File;
    preview?: string; // dataURL
    remark?: string;
    uploading?: boolean;
    error?: string;
};

// รองรับ g1..g10 (หรือมากกว่านั้นในอนาคต)
type GroupKey = `g${number}`;
type PMReportPhotosProps = {
    onBack?: () => void;
};

/** --- แนบรูปหลายรูป + ถ่ายรูป (mobile) สำหรับข้อ 1 --- */
function PhotoMultiInput({
    label,
    photos,
    setPhotos,
    max = 20,
}: {
    label?: string;
    photos: PhotoItem[];
    setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
    max?: number;
}) {
    const fileRef = React.useRef<HTMLInputElement>(null);

    const handlePick = () => fileRef.current?.click();

    const handleFiles = (list: FileList | null) => {
        if (!list) return;
        const remain = Math.max(0, max - photos.length);
        const files = Array.from(list).slice(0, remain);

        const items: PhotoItem[] = files.map((f, i) => ({
            id: `${Date.now()}-${i}-${f.name}`,
            file: f,
            preview: URL.createObjectURL(f),
            remark: "",
        }));
        setPhotos((prev) => [...prev, ...items]);

        // reset input ให้เลือกไฟล์ชุดเดิมซ้ำได้
        if (fileRef.current) fileRef.current.value = "";
    };

    const handleRemove = (id: string) => {
        setPhotos((prev) => {
            const target = prev.find((p) => p.id === id);
            if (target?.preview) URL.revokeObjectURL(target.preview);
            return prev.filter((p) => p.id !== id);
        });
    };

    const handleRemark = (id: string, v: string) => {
        setPhotos((prev) =>
            prev.map((p) => (p.id === id ? { ...p, remark: v } : p))
        );
    };

    return (
        <div className="tw-space-y-3">
            {label && <Typography className="tw-font-medium">{label}</Typography>}

            {/* ปุ่มเลือกไฟล์ + อินพุตซ่อน */}
            <div className="tw-flex tw-flex-wrap tw-gap-2">
                <Button size="sm" color="blue" variant="outlined" onClick={handlePick}>
                    แนบรูป / ถ่ายรูป
                </Button>
                <Typography variant="small" className="!tw-text-blue-gray-500 tw-flex tw-items-center">
                    แนบได้สูงสุด {max} รูป • รองรับการถ่ายจากกล้องบนมือถือ
                </Typography>
            </div>

            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                // ช่วยสลับไปโหมดกล้องบนมือถือ/แท็บเล็ต (ไม่บังคับทุกเบราว์เซอร์)
                capture="environment"
                className="tw-hidden"
                onChange={(e) => handleFiles(e.target.files)}
            />

            {/* แกลเลอรีภาพที่เลือก */}
            {photos.length > 0 ? (
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
                    {photos.map((p) => (
                        <div
                            key={p.id}
                            className="tw-border tw-rounded-lg tw-overflow-hidden tw-bg-white tw-shadow-xs tw-flex tw-flex-col"
                        >
                            <div className="tw-relative tw-aspect-[4/3] tw-bg-blue-gray-50">
                                {p.preview && (
                                    <img
                                        src={p.preview}
                                        alt="preview"
                                        className="tw-w-full tw-h-full tw-object-cover"
                                    />
                                )}
                            </div>
                            <div className="tw-p-2 tw-space-y-2">
                                {/* <Input
                                    label="หมายเหตุรูปนี้ (ถ้ามี)"
                                    value={p.remark || ""}
                                    onChange={(e) => handleRemark(p.id, e.target.value)}
                                    crossOrigin=""
                                /> */}
                                <div className="tw-flex tw-justify-end">
                                    <Button
                                        size="sm"
                                        color="red"
                                        variant="text"
                                        onClick={() => handleRemove(p.id)}
                                    >
                                        ลบรูป
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <Typography variant="small" className="!tw-text-blue-gray-500">
                    ยังไม่มีรูปแนบ
                </Typography>
            )}
        </div>
    );
}

function initMeasureState<U extends string>(
    keys: string[],
    defaultUnit: U
): MeasureState<U> {
    return Object.fromEntries(keys.map((k) => [k, { value: "", unit: defaultUnit }])) as MeasureState<U>;
}

const VOLTAGE_FIELDS = ["L1L2", "L1L3", "L2L3", "L1N", "L2N", "L3N", "L1G", "L2G", "L3G", "NG"];
const INSUL_FIELDS = ["L1G", "L2G", "L3G", "L1N", "L2N", "L3N", "L1L2", "L1L3", "L2L3", "GN"];
const CHARGE_FIELDS = ["h1_DCpG", "h1_DCmG", "h2_DCpG", "h2_DCmG"];

const labelDict: Record<string, string> = {
    L1L2: "L1/L2",
    L1L3: "L1/L3",
    L2L3: "L2/L3",
    L1N: "L1/N",
    L2N: "L2/N",
    L3N: "L3/N",
    L1G: "L1/G",
    L2G: "L2/G",
    L3G: "L3/G",
    NG: "N/G",
    GN: "G/N",
    h1_DCpG: "Head 1: DC+/G",
    h1_DCmG: "Head 1: DC-/G",
    h2_DCpG: "Head 2: DC+/G",
    h2_DCmG: "Head 2: DC-/G",
};

/** อินพุตตัวเลข + หน่วย */
function InputWithUnit<U extends string>({
    label,
    value,
    unit,
    units,
    onValueChange,
    onUnitChange,
}: {
    label: string;
    value: string;
    unit: U;
    units: readonly U[];
    onValueChange: (v: string) => void;
    onUnitChange: (u: U) => void;
}) {
    return (
        <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-items-end sm:tw-items-center">
            <Input
                type="number"
                inputMode="decimal"
                step="any"
                label={`${label}`}
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                crossOrigin=""
                containerProps={{ className: "tw-col-span-1 !tw-min-w-0" }}
                className="!tw-w-full"
                required
            />
            <select
                required
                value={unit}
                onChange={(e) => onUnitChange(e.target.value as U)}
                className="
                    tw-col-span-1 tw-h-10 tw-rounded-lg tw-border tw-border-blue-gray-200
                    tw-bg-white tw-px-2 tw-text-sm focus:tw-outline-none focus:tw-ring-2
                    focus:tw-ring-blue-500/30 focus:tw-border-blue-500"
            >
                {units.map((u) => (
                    <option key={u} value={u}>
                        {u}
                    </option>
                ))}
            </select>
        </div>
    );
}

/** Toggle Pass/Fail + Remark */
function PassFailRow({
    label,
    value,
    onChange,
    remark,
    onRemarkChange,
}: {
    label: string;
    value: "PASS" | "FAIL" | "";
    onChange: (v: "PASS" | "FAIL") => void;
    remark?: string;
    onRemarkChange?: (v: string) => void;
}) {
    return (
        <div className="tw-space-y-3 tw-py-3">
            <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">
                <Typography className="tw-font-medium">{label}</Typography>
                <div className="tw-flex tw-gap-2 tw-w-full sm:tw-w-auto">
                    <Button
                        size="sm"
                        color="green"
                        variant={value === "PASS" ? "filled" : "outlined"}
                        className="tw-w-1/2 sm:tw-w-auto sm:tw-min-w-[84px]"
                        onClick={() => onChange("PASS")}
                        aria-pressed={value === "PASS"}
                    >
                        PASS
                    </Button>
                    <Button
                        size="sm"
                        color="red"
                        variant={value === "FAIL" ? "filled" : "outlined"}
                        className="tw-w-1/2 sm:tw-w-auto sm:tw-min-w-[84px]"
                        onClick={() => onChange("FAIL")}
                        aria-pressed={value === "FAIL"}
                    >
                        FAIL
                    </Button>
                </div>
            </div>

            {onRemarkChange && (
                <Input
                    label="หมายเหตุ (ถ้ามี)"
                    value={remark || ""}
                    onChange={(e) => onRemarkChange(e.target.value)}
                    crossOrigin=""
                />
            )}
        </div>
    );
}



export default function CheckList({ onComplete, onNext }: CheckListProps) {
    const [photosR1, setPhotosR1] = useState<PhotoItem[]>([]);
    const [photosR4, setPhotosR4] = useState<PhotoItem[]>([]);
    const [photosR6, setPhotosR6] = useState<PhotoItem[]>([]);
    const [photosR7, setPhotosR7] = useState<PhotoItem[]>([]);
    const [photosR8, setPhotosR8] = useState<PhotoItem[]>([]);
    const [photosR9, setPhotosR9] = useState<PhotoItem[]>([]);
    const [photosR10, setPhotosR10] = useState<PhotoItem[]>([]);
    const [photosR11, setPhotosR11] = useState<PhotoItem[]>([]);
    const [photosR12, setPhotosR12] = useState<PhotoItem[]>([]);
    const [photosR14, setPhotosR14] = useState<PhotoItem[]>([]);
    const [photosR16, setPhotosR16] = useState<PhotoItem[]>([]);

    // ---------- PHOTO CHECK ----------
    const photoGroups: Record<number, PhotoItem[]> = {
        1: photosR1,
        4: photosR4,
        6: photosR6,
        7: photosR7,
        8: photosR8,
        9: photosR9,
        10: photosR10,
        11: photosR11,
        12: photosR12,
        14: photosR14,
        16: photosR16,
    };

    // รายการข้อที่มี “ช่องแนบรูป”
    const REQUIRED_PHOTO_ITEMS = useMemo(
        () => Object.keys(photoGroups).map((n) => Number(n)).sort((a, b) => a - b),
        [photosR1, photosR4, photosR6, photosR7, photosR8, photosR9, photosR10, photosR11, photosR12, photosR14, photosR16]
    );

    // ข้อที่ยังไม่มีรูปอย่างน้อย 1 รูป
    const missingPhotoItems = useMemo(
        () => REQUIRED_PHOTO_ITEMS.filter((no) => (photoGroups[no]?.length ?? 0) < 1),
        [REQUIRED_PHOTO_ITEMS, photoGroups]
    );

    // ครบทุกรายการที่ต้องแนบรูปหรือยัง
    const allPhotosAttached = missingPhotoItems.length === 0;

    const [job, setJob] = useState({
        workOrder: "",
        sn: "",
        model: "",
        location: "",
        date: "",
        inspector: "",
    });

    async function fetchStation(stationId: string, token: string) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/selected/station/${stationId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    function applyStationToJob(station: any) {
        setJob((prev) => ({
            ...prev,
            workOrder: station.work_order ?? prev.workOrder,
            sn: station.sn ?? prev.sn,
            model: station.model ?? prev.model,
            location: station.location ?? prev.location,
            date: prev.date || new Date().toISOString().slice(0, 10),
        }));
    }

    const [rows, setRows] = useState<Record<string, { pf: "PASS" | "FAIL" | ""; remark: string }>>({
        r1: { pf: "", remark: "" },
        r2: { pf: "", remark: "" },
        r3: { pf: "", remark: "" },
        r4: { pf: "", remark: "" },
        r5: { pf: "", remark: "" },
        r6: { pf: "", remark: "" },
        r7: { pf: "", remark: "" },
        r8: { pf: "", remark: "" },
        r9: { pf: "", remark: "" },
        r10: { pf: "", remark: "" },
        r11: { pf: "", remark: "" },
        r12: { pf: "", remark: "" },
        r13: { pf: "", remark: "" },
        r14: { pf: "", remark: "" },
        r15: { pf: "", remark: "" },
        r16: { pf: "", remark: "" },
    });

    const [voltage, setVoltage] = useState<MeasureState<UnitVoltage>>(initMeasureState(VOLTAGE_FIELDS, "V"));
    const [insulIn, setInsulIn] = useState<MeasureState<UnitVoltage>>(initMeasureState(INSUL_FIELDS, "V"));
    const [insulCharge, setInsulCharge] = useState<MeasureState<UnitVoltage>>(initMeasureState(CHARGE_FIELDS, "V"));
    const [insulInPost, setInsulInPost] = useState<MeasureState<UnitVoltage>>(initMeasureState(INSUL_FIELDS, "V"));
    const [voltagePost, setVoltagePost] = useState<MeasureState<UnitVoltage>>(initMeasureState(VOLTAGE_FIELDS, "V"));

    // --- utils for measure patch ---
    const patchMeasure =
        <U extends string>(setter: React.Dispatch<React.SetStateAction<MeasureState<U>>>) =>
            (key: string, patch: Partial<{ value: string; unit: U }>) => {
                setter((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
            };

    const patchVoltage = patchMeasure(setVoltage);
    const patchVoltagePost = patchMeasure(setVoltagePost);
    const patchInsulIn = patchMeasure(setInsulIn);
    const patchInsulInPost = patchMeasure(setInsulInPost);
    const patchInsulCharge = patchMeasure(setInsulCharge);

    function syncAllUnits<U extends string>(
        setter: React.Dispatch<React.SetStateAction<MeasureState<U>>>,
        keys: string[],
        newUnit: U
    ) {
        setter((prev) => {
            const next: MeasureState<U> = { ...prev };
            keys.forEach((k) => {
                next[k] = { ...prev[k], unit: newUnit };
            });
            return next;
        });
    }

    const handleVoltageUnitChange = (key: string, u: UnitVoltage) => {
        const firstKey = VOLTAGE_FIELDS[0];
        if (key !== firstKey) patchVoltage(firstKey, { unit: u });
        syncAllUnits(setVoltage, VOLTAGE_FIELDS, u);
    };
    const handleVoltagePostUnitChange = (key: string, u: UnitVoltage) => {
        const firstKey = VOLTAGE_FIELDS[0];
        if (key !== firstKey) patchVoltagePost(firstKey, { unit: u });
        syncAllUnits(setVoltagePost, VOLTAGE_FIELDS, u);
    };
    const handleInsulInUnitChange = (key: string, u: UnitVoltage) => {
        const firstKey = INSUL_FIELDS[0];
        if (key !== firstKey) patchInsulIn(firstKey, { unit: u });
        syncAllUnits(setInsulIn, INSUL_FIELDS, u);
    };
    const handleInsulInPostUnitChange = (key: string, u: UnitVoltage) => {
        const firstKey = INSUL_FIELDS[0];
        if (key !== firstKey) patchInsulInPost(firstKey, { unit: u });
        syncAllUnits(setInsulInPost, INSUL_FIELDS, u);
    };
    const handleInsulChargeUnitChange = (key: string, u: UnitVoltage) => {
        const firstKey = CHARGE_FIELDS[0];
        if (key !== firstKey) patchInsulCharge(firstKey, { unit: u });
        syncAllUnits(setInsulCharge, CHARGE_FIELDS, u);
    };

    // ---------- CHECK LOGIC (ตามที่ขอ 2 ข้อ) ----------
    // 1) เช็ก PASS/FAIL ครบ 15 ข้อ (ไม่รวม r16)
    const PF_REQUIRED_KEYS = useMemo(
        () => Array.from({ length: 15 }, (_, i) => `r${i + 1}` as const), // r1..r15
        []
    );
    /** 1) เช็กว่ากด PASS/FAIL ครบ 15 ข้อหรือยัง + เหลือข้อไหน (ไม่รวม r16) */
    const allPFAnswered = useMemo(
        () => PF_REQUIRED_KEYS.every((k) => rows[k].pf === "PASS" || rows[k].pf === "FAIL"),
        [rows, PF_REQUIRED_KEYS]
    );
    const missingPFItems = useMemo(() => {
        return PF_REQUIRED_KEYS
            .filter((k) => !rows[k].pf)
            .map((k) => Number(k.replace("r", "")))
            .sort((a, b) => a - b);
    }, [rows, PF_REQUIRED_KEYS]);

    /** helper: คืนค่า key ที่ value ว่างของชุดฟิลด์ */
    const getEmptyKeys = (state: MeasureState<string>, keys: string[]) =>
        keys.filter((k) => !state[k]?.value?.toString().trim());

    /** 2) เช็กอินพุต ข้อ 5,6,7,11,12 + รายการที่ยังไม่ครบ (บอกเป็น label) */
    const missingInputs = useMemo(() => {
        const m5 = getEmptyKeys(voltage, VOLTAGE_FIELDS);
        const m6 = getEmptyKeys(insulIn, INSUL_FIELDS);
        const m7 = getEmptyKeys(insulCharge, CHARGE_FIELDS);
        const m11 = getEmptyKeys(insulInPost, INSUL_FIELDS);
        const m12 = getEmptyKeys(voltagePost, VOLTAGE_FIELDS);

        return { 5: m5, 6: m6, 7: m7, 11: m11, 12: m12 };
    }, [voltage, insulIn, insulCharge, insulInPost, voltagePost]);

    const allRequiredInputsFilled = useMemo(
        () => Object.values(missingInputs).every((arr) => arr.length === 0),
        [missingInputs]
    );

    /** ใช้สรุปข้อความสวย ๆ ใน UI */
    const missingInputsTextLines = useMemo(() => {
        const lines: string[] = [];
        ([
            [5, missingInputs[5]],
            [6, missingInputs[6]],
            [7, missingInputs[7]],
            [11, missingInputs[11]],
            [12, missingInputs[12]],
        ] as const).forEach(([no, arr]) => {
            if (arr.length > 0) {
                const labels = arr.map((k) => labelDict[k]).join(", ");
                lines.push(`ข้อ ${no}: ${labels}`);
            }
        });
        return lines;
    }, [missingInputs]);


    // 3) ต้องมีรูปอย่างน้อย 1 รูป (รวมทุกข้อภาพ)
    const hasAnyPhoto = useMemo(
        () => Object.values(photoGroups).some((arr) => arr.length > 0),
        [photosR1, photosR4, photosR6, photosR7, photosR8, photosR9, photosR10, photosR11, photosR12, photosR14, photosR16]
    );


    /** ปุ่มถัดไป: ต้องครบทั้ง PF และ อินพุต */
    const canGoNext = allPFAnswered && allRequiredInputsFilled;
    const canFinalSave = allPhotosAttached && allPFAnswered && allRequiredInputsFilled;
    const saveDisabled = !allPhotosAttached;
    const saveTitle = saveDisabled
        ? `ต้องแนบรูปให้ครบก่อน → ข้อที่ยังขาด: ${missingPhotoItems.join(", ")}`
        : "บันทึกชั่วคราว";

    const onSave = () => {
        console.log({
            job,
            rows,
            voltage,
            insulIn,
            insulCharge,
            insulInPost,
            voltagePost,
            photos: photoGroups, // เผื่ออยากเก็บรวมด้วย
        });
        alert("บันทึกชั่วคราว (เดโม่) – ดูข้อมูลใน console");
    };

    const onFinalSave = () => {
        console.log({
            job,
            rows,
            voltage,
            insulIn,
            insulCharge,
            insulInPost,
            voltagePost,
            photos: photoGroups,
        });
        alert("บันทึกเรียบร้อย (เดโม่) – ดูข้อมูลใน console");
        // ถ้าต้องไปหน้าถัดไปหลังบันทึกจริง ให้เปิดบรรทัดนี้
        // onNext();
    };

    // แจ้ง parent (คงพฤติกรรมเดิม: รายงานเฉพาะสถานะ PASS/FAIL ครบไหม)
    React.useEffect(() => {
        onComplete(allPFAnswered);
    }, [allPFAnswered, onComplete]);

    // ---------- UI ----------
    return (
        <section className="tw-mx-0 tw-px-3 md:tw-px-6 xl:tw-px-0 tw-pb-24">
            {/* Job Info */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    <Typography variant="h6">ข้อมูลงาน</Typography>
                    <Typography variant="small" className="!tw-text-blue-gray-500">
                        กรุณากรอกทุกช่องให้ครบ เพื่อความสมบูรณ์ของรายงาน PM
                    </Typography>
                </CardHeader>
                <CardBody className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                    <Input
                        label="Work Order"
                        value={job.workOrder}
                        onChange={(e) => setJob({ ...job, workOrder: e.target.value })}
                        crossOrigin=""
                        readOnly
                        className="!tw-bg-blue-gray-50"
                    />
                    <Input
                        label="SN / หมายเลขเครื่อง"
                        value={job.sn}
                        onChange={(e) => setJob({ ...job, sn: e.target.value })}
                        crossOrigin=""
                        className="!tw-bg-blue-gray-50"
                    />
                    <Input
                        label="Model / รุ่น"
                        value={job.model}
                        onChange={(e) => setJob({ ...job, model: e.target.value })}
                        crossOrigin=""
                        className="!tw-bg-blue-gray-50"
                    />
                    <Input
                        label="Location / สถานที่"
                        value={job.location}
                        onChange={(e) => setJob({ ...job, location: e.target.value })}
                        crossOrigin=""
                        className="!tw-bg-blue-gray-50"
                    />
                    <Input
                        label="วันที่ตรวจ"
                        type="date"
                        value={job.date}
                        onChange={(e) => setJob({ ...job, date: e.target.value })}
                        crossOrigin=""
                    />
                </CardBody>
            </Card>

            {/* Checklist simple items */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    <Typography variant="h6">Checklist</Typography>
                </CardHeader>
                <CardBody className="tw-space-y-1">
                    <PassFailRow
                        label="1) Visual Check / ตรวจสอบด้วยสายตา"
                        value={rows.r1.pf}
                        onChange={(v) => setRows({ ...rows, r1: { ...rows.r1, pf: v } })}
                        remark={rows.r1.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r1: { ...rows.r1, remark: v } })}
                    />
                    {/* --- แนบรูปประกอบข้อ 1 --- */}
                    <div className="tw-pt-2 tw-pb-4 tw-border-b tw-border-blue-gray-50">
                        <PhotoMultiInput
                            label="แนบรูปประกอบ (ข้อ 1)"
                            photos={photosR1}
                            setPhotos={setPhotosR1}
                            max={20} // ปรับจำนวนสูงสุดได้
                        />
                    </div>
                    <PassFailRow
                        label="2) Test Charge / ทดสอบชาร์จทั้ง2หัว (ก่อน PM)"
                        value={rows.r2.pf}
                        onChange={(v) => setRows({ ...rows, r2: { ...rows.r2, pf: v } })}
                        remark={rows.r2.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r2: { ...rows.r2, remark: v } })}
                    />
                    <PassFailRow
                        label="3) Thermal scan / ภาพถ่ายความร้อน (ก่อน PM)"
                        value={rows.r3.pf}
                        onChange={(v) => setRows({ ...rows, r3: { ...rows.r3, pf: v } })}
                        remark={rows.r3.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r3: { ...rows.r3, remark: v } })}
                    />
                    <PassFailRow
                        label="4) Test trip / ทดสอบการทำงานของอุปกรณ์ป้องกันระบบไฟฟ้า"
                        value={rows.r4.pf}
                        onChange={(v) => setRows({ ...rows, r4: { ...rows.r4, pf: v } })}
                        remark={rows.r4.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r4: { ...rows.r4, remark: v } })}
                    />
                    {/* --- แนบรูปประกอบข้อ 4 --- */}
                    <div className="tw-pt-2 tw-pb-4 tw-border-b tw-border-blue-gray-50">
                        <PhotoMultiInput
                            label="แนบรูปประกอบ (ข้อ 4)"
                            photos={photosR4}
                            setPhotos={setPhotosR4}
                            max={20} // ปรับจำนวนสูงสุดได้
                        />
                    </div>
                </CardBody>
            </Card>

            {/* 5. Incoming Voltage (ก่อน PM) */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    <Typography variant="h6">
                        5) Incoming voltage check / ตรวจสอบแรงดันขาเข้า (ก่อน PM)
                    </Typography>
                </CardHeader>
                <CardBody className="tw-space-y-4">
                    <PassFailRow
                        label="ผลการตรวจ"
                        value={rows.r5.pf}
                        onChange={(v) => setRows({ ...rows, r5: { ...rows.r5, pf: v } })}
                        remark={rows.r5.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r5: { ...rows.r5, remark: v } })}
                    />
                    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                        {VOLTAGE_FIELDS.map((k) => (
                            <InputWithUnit<UnitVoltage>
                                key={`pre-${k}`}
                                label={labelDict[k]}
                                value={voltage[k].value}
                                unit={voltage[k].unit}
                                units={UNITS.voltage}
                                onValueChange={(v) => patchVoltage(k, { value: v })}
                                onUnitChange={(u) => handleVoltageUnitChange(k, u)}
                            />
                        ))}
                    </div>
                </CardBody>
            </Card>

            {/* 6. Incoming cable Insulation (ก่อน PM) */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    <Typography variant="h6">
                        6) Incoming cable Insulation Test / การทดสอบความเป็นฉนวนของสาย Incoming
                        ที่แรงดัน 500V (ต้อง ≥ 100 MΩ) — ก่อน PM
                    </Typography>
                </CardHeader>
                <CardBody className="tw-space-y-4">
                    <PassFailRow
                        label="ผลการทดสอบ"
                        value={rows.r6.pf}
                        onChange={(v) => setRows({ ...rows, r6: { ...rows.r6, pf: v } })}
                        remark={rows.r6.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r6: { ...rows.r6, remark: v } })}
                    />
                    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                        {INSUL_FIELDS.map((k) => (
                            <InputWithUnit<UnitVoltage>
                                key={`ins-pre-${k}`}
                                label={labelDict[k]}
                                value={insulIn[k].value}
                                unit={insulIn[k].unit}
                                units={UNITS.voltage}
                                onValueChange={(v) => patchInsulIn(k, { value: v })}
                                onUnitChange={(u) => handleInsulInUnitChange(k, u)}
                            />
                        ))}
                    </div>
                    {/* --- แนบรูปประกอบข้อ 6 --- */}
                    <div className="tw-pt-2 tw-pb-4 tw-border-b tw-border-blue-gray-50">
                        <PhotoMultiInput
                            label="แนบรูปประกอบ (ข้อ 6)"
                            photos={photosR6}
                            setPhotos={setPhotosR6}
                            max={20} // ปรับจำนวนสูงสุดได้
                        />
                    </div>
                </CardBody>
            </Card>

            {/* 7. Charging cable insulation */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    <div>
                        <Typography variant="h6">
                            7) Charging cable insulation Test / ทดสอบความเป็นฉนวนของสายชาร์จ ที่แรงดัน
                            500V (ต้อง ≥ 100 MΩ)
                        </Typography>
                        <Typography variant="small" className="!tw-text-blue-gray-500 tw-italic tw-mt-1">
                            *อ้างอิงจากมาตรฐาน IEC 61851-2
                        </Typography>
                    </div>
                </CardHeader>
                <CardBody className="tw-space-y-4">
                    <PassFailRow
                        label="ผลการทดสอบ"
                        value={rows.r7.pf}
                        onChange={(v) => setRows({ ...rows, r7: { ...rows.r7, pf: v } })}
                        remark={rows.r7.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r7: { ...rows.r7, remark: v } })}
                    />
                    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-4 tw-gap-3">
                        {CHARGE_FIELDS.map((k) => (
                            <InputWithUnit<UnitVoltage>
                                key={`charge-${k}`}
                                label={labelDict[k]}
                                value={insulCharge[k].value}
                                unit={insulCharge[k].unit}
                                units={UNITS.voltage}
                                onValueChange={(v) => patchInsulCharge(k, { value: v })}
                                onUnitChange={(u) => handleInsulChargeUnitChange(k, u)}
                            />
                        ))}
                    </div>
                    {/* --- แนบรูปประกอบข้อ 7 --- */}
                    <div className="tw-pt-2 tw-pb-4 tw-border-b tw-border-blue-gray-50">
                        <PhotoMultiInput
                            label="แนบรูปประกอบ (ข้อ 7)"
                            photos={photosR7}
                            setPhotos={setPhotosR7}
                            max={20} // ปรับจำนวนสูงสุดได้
                        />
                    </div>
                </CardBody>
            </Card>

            {/* 8–10 simple */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardBody className="tw-space-y-1">
                    <PassFailRow
                        label="8) Check torque and tightness / ตรวจสอบค่าแรงบิดและขันแน่น"
                        value={rows.r8.pf}
                        onChange={(v) => setRows({ ...rows, r8: { ...rows.r8, pf: v } })}
                        remark={rows.r8.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r8: { ...rows.r8, remark: v } })}
                    />
                    {/* --- แนบรูปประกอบข้อ 8 --- */}
                    <div className="tw-pt-2 tw-pb-4 tw-border-b tw-border-blue-gray-50">
                        <PhotoMultiInput
                            label="แนบรูปประกอบ (ข้อ 8)"
                            photos={photosR8}
                            setPhotos={setPhotosR8}
                            max={20} // ปรับจำนวนสูงสุดได้
                        />
                    </div>
                    <PassFailRow
                        label="9) Cleaning the air filter / ทำความสะอาดไส้กรองอากาศ"
                        value={rows.r9.pf}
                        onChange={(v) => setRows({ ...rows, r9: { ...rows.r9, pf: v } })}
                        remark={rows.r9.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r9: { ...rows.r9, remark: v } })}
                    />
                    {/* --- แนบรูปประกอบข้อ 9 --- */}
                    <div className="tw-pt-2 tw-pb-4 tw-border-b tw-border-blue-gray-50">
                        <PhotoMultiInput
                            label="แนบรูปประกอบ (ข้อ 9)"
                            photos={photosR9}
                            setPhotos={setPhotosR9}
                            max={20} // ปรับจำนวนสูงสุดได้
                        />
                    </div>
                    <PassFailRow
                        label="10) Internal Cleaning / ทำความสะอาดภายใน"
                        value={rows.r10.pf}
                        onChange={(v) => setRows({ ...rows, r10: { ...rows.r10, pf: v } })}
                        remark={rows.r10.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r10: { ...rows.r10, remark: v } })}
                    />
                    {/* --- แนบรูปประกอบข้อ 10 --- */}
                    <div className="tw-pt-2 tw-pb-4 tw-border-b tw-border-blue-gray-50">
                        <PhotoMultiInput
                            label="แนบรูปประกอบ (ข้อ 10)"
                            photos={photosR10}
                            setPhotos={setPhotosR10}
                            max={20} // ปรับจำนวนสูงสุดได้
                        />
                    </div>
                </CardBody>
            </Card>

            {/* 11. Incoming cable Insulation (หลัง PM) */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    <Typography variant="h6">
                        11) Incoming cable Insulation Test / การทดสอบความเป็นฉนวนของสาย Incoming ที่แรงดัน
                        500V (ต้อง ≥ 100 MΩ) — หลัง PM
                    </Typography>
                    <Typography variant="small" className="!tw-text-blue-gray-500 tw-italic tw-mต-1">
                        *อ้างอิงจากมาตรฐาน IEC 60364
                    </Typography>
                </CardHeader>
                <CardBody className="tw-space-y-4">
                    <PassFailRow
                        label="ผลการทดสอบ"
                        value={rows.r11.pf}
                        onChange={(v) => setRows({ ...rows, r11: { ...rows.r11, pf: v } })}
                        remark={rows.r11.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r11: { ...rows.r11, remark: v } })}
                    />
                    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                        {INSUL_FIELDS.map((k) => (
                            <InputWithUnit<UnitVoltage>
                                key={`ins-post-${k}`}
                                label={labelDict[k]}
                                value={insulInPost[k].value}
                                unit={insulInPost[k].unit}
                                units={UNITS.voltage}
                                onValueChange={(v) => patchInsulInPost(k, { value: v })}
                                onUnitChange={(u) => handleInsulInPostUnitChange(k, u)}
                            />
                        ))}
                    </div>
                    {/* --- แนบรูปประกอบข้อ 11 --- */}
                    <div className="tw-pt-2 tw-pb-4 tw-border-b tw-border-blue-gray-50">
                        <PhotoMultiInput
                            label="แนบรูปประกอบ (ข้อ 11)"
                            photos={photosR11}
                            setPhotos={setPhotosR11}
                            max={20} // ปรับจำนวนสูงสุดได้
                        />
                    </div>
                </CardBody>
            </Card>

            {/* 12. Incoming Voltage (หลัง PM) */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    <Typography variant="h6">12) Incoming voltage check / ตรวจสอบแรงดันขาเข้า (หลัง PM)</Typography>
                </CardHeader>
                <CardBody className="tw-space-y-4">
                    <PassFailRow
                        label="ผลการตรวจ"
                        value={rows.r12.pf}
                        onChange={(v) => setRows({ ...rows, r12: { ...rows.r12, pf: v } })}
                        remark={rows.r12.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r12: { ...rows.r12, remark: v } })}
                    />
                    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                        {VOLTAGE_FIELDS.map((k) => (
                            <InputWithUnit<UnitVoltage>
                                key={`post-${k}`}
                                label={labelDict[k]}
                                value={voltagePost[k].value}
                                unit={voltagePost[k].unit}
                                units={UNITS.voltage}
                                onValueChange={(v) => patchVoltagePost(k, { value: v })}
                                onUnitChange={(u) => handleVoltagePostUnitChange(k, u)}
                            />
                        ))}
                    </div>
                    {/* --- แนบรูปประกอบข้อ 12 --- */}
                    <div className="tw-pt-2 tw-pb-4 tw-border-b tw-border-blue-gray-50">
                        <PhotoMultiInput
                            label="แนบรูปประกอบ (ข้อ 12)"
                            photos={photosR12}
                            setPhotos={setPhotosR12}
                            max={20} // ปรับจำนวนสูงสุดได้
                        />
                    </div>
                </CardBody>
            </Card>

            {/* 13–15 (หลัง PM) */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardBody className="tw-space-y-1">
                    <PassFailRow
                        label="13) Test Charge / ทดสอบชาร์จทั้ง 2 หัว (หลัง PM)"
                        value={rows.r13.pf}
                        onChange={(v) => setRows({ ...rows, r13: { ...rows.r13, pf: v } })}
                        remark={rows.r13.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r13: { ...rows.r13, remark: v } })}
                    />
                    <PassFailRow
                        label="14) Thermal scan / ภาพถ่ายความร้อน (หลัง PM)"
                        value={rows.r14.pf}
                        onChange={(v) => setRows({ ...rows, r14: { ...rows.r14, pf: v } })}
                        remark={rows.r14.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r14: { ...rows.r14, remark: v } })}
                    />
                    {/* --- แนบรูปประกอบข้อ 14 --- */}
                    <div className="tw-pt-2 tw-pb-4 tw-border-b tw-border-blue-gray-50">
                        <PhotoMultiInput
                            label="แนบรูปประกอบ (ข้อ 14)"
                            photos={photosR14}
                            setPhotos={setPhotosR14}
                            max={20} // ปรับจำนวนสูงสุดได้
                        />
                    </div>
                    <PassFailRow
                        label="15) ทำความสะอาดหน้าสัมผัส SIM Internet"
                        value={rows.r15.pf}
                        onChange={(v) => setRows({ ...rows, r15: { ...rows.r15, pf: v } })}
                        remark={rows.r15.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r15: { ...rows.r15, remark: v } })}
                    />
                    <Typography
                        variant="paragraph"
                        className="tw-pt-2 tw-text-base tw-font-medium"
                    >
                        16) Check the strength between each wire connection / ทดสอบความแข็งแรงของจุดต่อไฟฟ้า
                    </Typography>

                    {/* --- แนบรูปประกอบข้อ 16 --- */}
                    <div className="tw-pt-2 tw-pb-4 tw-border-b tw-border-blue-gray-50">
                        <PhotoMultiInput
                            label="แนบรูปประกอบ (ข้อ 16)"
                            photos={photosR16}
                            setPhotos={setPhotosR16}
                            max={20} // ปรับจำนวนสูงสุดได้
                        />
                    </div>
                    <Input
                        label="หมายเหตุ (ถ้ามี)"
                        value={rows.r16.remark}
                        onChange={(e) =>
                            setRows({ ...rows, r16: { ...rows.r16, remark: e.target.value } })
                        }
                        crossOrigin=""
                    />

                </CardBody>
            </Card>

            {/* สรุปสถานะ & ปุ่ม */}
            {/* ===== Footer (อัปเดตแล้ว) ===== */}
            <CardFooter className="tw-flex tw-flex-col tw-gap-3 tw-mt-8">
                {/* ข้อ 1: PASS/FAIL ครบไหม */}
                <div
                    className={`tw-rounded-lg tw-border tw-p-3 ${allPFAnswered ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"
                        }`}
                >
                    <Typography className="tw-font-medium">1) สถานะ PASS/FAIL ทั้ง 15 ข้อ</Typography>
                    {allPFAnswered ? (
                        <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
                    ) : (
                        <Typography variant="small" className="!tw-text-amber-700">
                            ยังไม่ได้เลือกข้อ: {missingPFItems.join(", ")}
                        </Typography>
                    )}
                </div>

                {/* ข้อ 2: อินพุตข้อ 5,6,7,11,12 ครบไหม */}
                <div
                    className={`tw-rounded-lg tw-border tw-p-3 ${allRequiredInputsFilled ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"
                        }`}
                >
                    <Typography className="tw-font-medium">2) อินพุตข้อ 5, 6, 7, 11, 12</Typography>
                    {allRequiredInputsFilled ? (
                        <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
                    ) : (
                        <div className="tw-space-y-1">
                            <Typography variant="small" className="!tw-text-amber-700">ยังขาด:</Typography>
                            <ul className="tw-list-disc tw-ml-5 tw-text-sm tw-text-blue-gray-700">
                                {missingInputsTextLines.map((line, i) => (
                                    <li key={i}>{line}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* ข้อ 3: แนบรูปครบทุกข้อที่กำหนด */}
                <div
                    className={`tw-rounded-lg tw-border tw-p-3 ${allPhotosAttached ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"
                        }`}
                >
                    <Typography className="tw-font-medium">3) ตรวจสอบการแนบรูปภาพตามข้อที่กำหนด</Typography>
                    {allPhotosAttached ? (
                        <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
                    ) : (
                        <Typography variant="small" className="!tw-text-amber-700">
                            ยังไม่ได้แนบรูปข้อ: {missingPhotoItems.join(", ")}
                        </Typography>
                    )}
                </div>


                {/* ปุ่มแอคชัน */}
                <div className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-end tw-gap-3">
                    {!canFinalSave ? (
                        <Button variant="outlined" color="blue-gray" type="button" onClick={onSave}>
                            บันทึกชั่วคราว
                        </Button>
                    ) : (
                        <Button color="blue" type="button" onClick={onFinalSave}>
                            บันทึก
                        </Button>
                    )}


                    {/* ปุ่มถัดไป (คงคอมเมนต์ไว้ตามเดิม) */}
                    {/*
    <Button
      color="blue"
      type="button"
      onClick={onNext}
      disabled={!canGoNext}
      aria-disabled={!canGoNext}
      title={
        canGoNext
          ? "ไปหน้า PMReportPhotos"
          : !allPFAnswered
            ? `ยังไม่ได้เลือก PASS/FAIL ข้อ: ${missingPFItems.join(", ")}`
            : `อินพุตยังไม่ครบ → ${missingInputsTextLines.join(" | ")}`
      }
      className={!canGoNext ? "tw-opacity-60 tw-cursor-not-allowed" : ""}
    >
      ถัดไป
    </Button>
    */}
                </div>
            </CardFooter>

        </section>
    );
}
