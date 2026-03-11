"use client";
import LoadingOverlay from "../../components/Loadingoverlay";
import { useEffect, useState, useMemo } from "react";
import {
    Dialog,
    DialogHeader,
    DialogBody,
    DialogFooter,
    Button,
    Input,
    Typography,
    Select,
    Option,
    Tooltip,
} from "@material-tailwind/react";

// ===== Types =====
export type ChargerForm = {
    id: string;
    chargerNo: number;
    brand: string;
    model: string;
    SN: string;
    WO: string;
    power: string;
    PLCFirmware: string;
    PIFirmware: string;
    RTFirmware: string;
    chargeBoxID: string;
    ocppUrl: string;
    commissioningDate: string;
    warrantyYears: number;
    numberOfCables: number;
    is_active: boolean;
    maximo_location: string;
    maximo_desc: string;
    chargerType: string;
    chargerImages: File[];
    deviceImages: File[];
};

export type StationForm = {
    station_id: string;
    station_name: string;
    owner: string;
    is_active: boolean;
    maximo_location: string;
    maximo_desc: string;
    stationImages: File[];
    mdbImages: File[];
};

export type NewStationPayload = {
    station: Omit<StationForm, "stationImages" | "mdbImages">;
    chargers: Omit<ChargerForm, "id" | "chargerImages" | "deviceImages">[];
};

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: NewStationPayload) => Promise<any>;
    loading?: boolean;
    onSubmitImages?: (
        stationId: string,
        images: { station: File[]; mdb: File[] },
        chargerImages: Array<{ chargerNo: number; chargerImages: File[]; deviceImages: File[] }>,
        createdChargers: Array<{ id: string; chargerNo: number }>
    ) => Promise<void> | void;
    currentUser: string;
    isAdmin: boolean;
    allOwners?: string[];
};

// ===== Helpers =====
const generateStationId = (stationName: string): string => {
    const nameSlug = stationName.trim().replace(/[^\u0E00-\u0E7FA-Za-z0-9\s]/g, "").replace(/\s+/g, "_");
    if (!nameSlug) return `STATION_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    return nameSlug;
};

const getTodayDate = (): string => new Date().toISOString().split("T")[0];

const generateId = (): string => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
};

const createEmptyCharger = (chargerNo: number): ChargerForm => ({
    id: generateId(), chargerNo, brand: "", model: "", SN: "", WO: "", power: "",
    PLCFirmware: "", PIFirmware: "", RTFirmware: "", chargeBoxID: "", ocppUrl: "",
    commissioningDate: getTodayDate(), warrantyYears: 1, numberOfCables: 1, is_active: true,
    maximo_location: "", maximo_desc: "", chargerType: "DC", chargerImages: [], deviceImages: [],
});

type StationImageKind = "station" | "mdb";
type Lang = "th" | "en";

/* ─────────────────────────── Sub-components ─────────────────────────── */

/** Thumbnail gallery with remove-on-hover */
const ImageGallery = ({ previews, onRemove, emptyLabel }: {
    previews: string[];
    onRemove: (i: number) => void;
    emptyLabel: string;
}) => {
    if (!previews.length) {
        return (
            <div className="tw-flex tw-items-center tw-justify-center tw-h-14 sm:tw-h-[68px] tw-rounded-xl tw-border-2 tw-border-dashed tw-border-blue-gray-100">
                <span className="tw-text-[10px] sm:tw-text-[11px] tw-text-blue-gray-300 tw-select-none">{emptyLabel}</span>
            </div>
        );
    }
    return (
        <div className="tw-flex tw-flex-wrap tw-gap-1.5 sm:tw-gap-2">
            {previews.map((url, i) => (
                <div
                    key={i}
                    className="tw-group/img tw-relative tw-h-14 tw-w-14 sm:tw-h-[68px] sm:tw-w-[68px] tw-rounded-xl tw-overflow-hidden tw-ring-1 tw-ring-black/10 tw-shadow-sm hover:tw-shadow-md hover:tw-ring-blue-400/40 tw-transition-all tw-duration-200 hover:tw--translate-y-0.5"
                >
                    <img src={url} alt="" className="tw-h-full tw-w-full tw-object-cover" />
                    <div className="tw-absolute tw-inset-0 tw-bg-black/0 group-hover/img:tw-bg-black/25 tw-transition-colors" />
                    <button
                        type="button"
                        onClick={() => onRemove(i)}
                        className="tw-absolute tw-top-0.5 tw-right-0.5 sm:tw-top-1 sm:tw-right-1 tw-h-5 tw-w-5 tw-rounded-full tw-bg-red-500 tw-text-white tw-flex tw-items-center tw-justify-center sm:tw-opacity-0 group-hover/img:tw-opacity-100 tw-shadow-lg tw-transition-all tw-duration-150 hover:tw-bg-red-600 hover:tw-scale-110 tw-text-[10px] tw-leading-none"
                    >
                        ✕
                    </button>
                    <span className="tw-absolute tw-bottom-0 tw-inset-x-0 tw-text-center tw-text-[8px] tw-font-medium tw-text-white tw-bg-gradient-to-t tw-from-black/40 tw-to-transparent tw-pt-3 tw-pb-0.5 tw-opacity-0 group-hover/img:tw-opacity-100 tw-transition-opacity">
                        {i + 1}
                    </span>
                </div>
            ))}
        </div>
    );
};

/** Styled upload trigger */
const UploadBtn = ({ label, onChange }: {
    label: string;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
}) => (
    <label className="tw-inline-flex tw-items-center tw-gap-1 sm:tw-gap-1.5 tw-px-2.5 sm:tw-px-3 tw-py-[5px] tw-rounded-lg tw-bg-white tw-border tw-border-blue-gray-200 tw-text-[10px] sm:tw-text-[11px] tw-font-semibold tw-text-blue-gray-600 tw-cursor-pointer hover:tw-border-blue-400 hover:tw-text-blue-600 hover:tw-bg-blue-50/50 tw-transition-all tw-duration-200 tw-shadow-sm hover:tw-shadow tw-select-none">
        <svg xmlns="http://www.w3.org/2000/svg" className="tw-h-3 tw-w-3 sm:tw-h-3.5 sm:tw-w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
        {label}
        <input type="file" accept="image/*" multiple onChange={onChange} className="tw-hidden" />
    </label>
);

/** Image upload zone (label + button + gallery) */
const ImageZone = ({ label, previews, onUpload, onRemove, emptyLabel, uploadLabel }: {
    label: string;
    previews: string[];
    onUpload: React.ChangeEventHandler<HTMLInputElement>;
    onRemove: (i: number) => void;
    emptyLabel: string;
    uploadLabel: string;
}) => (
    <div className="tw-space-y-1.5 sm:tw-space-y-2 tw-p-2.5 sm:tw-p-3 tw-rounded-xl tw-bg-blue-gray-50/40 tw-ring-1 tw-ring-blue-gray-100/60">
        <div className="tw-flex tw-items-center tw-justify-between tw-min-h-[28px]">
            <span className="tw-text-[10px] sm:tw-text-[11px] tw-font-bold tw-text-blue-gray-500 tw-uppercase tw-tracking-wider">{label}</span>
            <UploadBtn label={uploadLabel} onChange={onUpload} />
        </div>
        <ImageGallery previews={previews} onRemove={onRemove} emptyLabel={emptyLabel} />
    </div>
);

/** Section icon badge */
const SectionIcon = ({ emoji }: { emoji: string; }) => (
    <span className="tw-inline-flex tw-items-center tw-justify-center tw-h-7 tw-w-7 sm:tw-h-8 sm:tw-w-8 tw-rounded-xl tw-bg-gradient-to-br tw-shadow-lg tw-text-xs sm:tw-text-sm">
        {emoji}
    </span>
);

/** Spinner */
const Spinner = () => (
    <svg className="tw-animate-spin tw-h-4 tw-w-4" viewBox="0 0 24 24" fill="none">
        <circle className="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
);

/* ─────────────────────────── Main Component ─────────────────────────── */
export default function AddStationModal({
    open, onClose, onSubmit, loading, currentUser, isAdmin, allOwners = [], onSubmitImages,
}: Props) {
    const [lang, setLang] = useState<Lang>("en");

    useEffect(() => {
        const saved = localStorage.getItem("app_language") as Lang | null;
        if (saved === "th" || saved === "en") setLang(saved);
        const handler = (e: CustomEvent<{ lang: Lang }>) => setLang(e.detail.lang);
        window.addEventListener("language:change", handler as EventListener);
        return () => window.removeEventListener("language:change", handler as EventListener);
    }, []);

    /* ── translations ── */
    const t = useMemo(() => {
        const tr = {
            th: {
                addNewStation: "เพิ่มสถานีใหม่", subtitle: "กรอกข้อมูลสถานีและตู้ชาร์จ",
                stationInfo: "ข้อมูลสถานี", stationName: "ชื่อสถานี", owner: "เจ้าของ",
                status: "สถานะ", active: "เปิดใช้งาน", inactive: "ปิดใช้งาน",
                maximoLocation: "Maximo Location", maximoDesc: "Maximo Description",
                stationImages: "รูปภาพสถานี", station: "สถานี", mdb: "MDB",
                chargers: "ตู้ชาร์จ", addCharger: "เพิ่มตู้ชาร์จ", chargerNo: "ตู้ชาร์จ #",
                chargerBoxId: "Charge Box ID", ocppUrl: "OCPP URL", ocppSection: "OCPP",
                chargerType: "ประเภท", chargerNoAuto: "ลำดับ (อัตโนมัติ)", auto: "อัตโนมัติ",
                brand: "ยี่ห้อ", model: "รุ่น", serialNumber: "S/N",
                workOrder: "WO", power: "กำลังไฟ (kW)", plcFirmware: "PLC Firmware",
                piFirmware: "Pi Firmware", routerFirmware: "Router Firmware",
                commissioningDate: "วันเริ่มใช้งาน", warrantyYears: "รับประกัน (ปี)",
                numberOfCables: "จำนวนสาย", images: "รูปภาพ", charger: "ตู้ชาร์จ",
                device: "อุปกรณ์", chargerCount: "ตู้ชาร์จ", cancel: "ยกเลิก",
                createStation: "สร้างสถานี", saving: "กำลังบันทึก...",
                pleaseEnterStationName: "กรุณากรอกชื่อสถานี",
                pleaseFillChargerBoxId: "กรุณากรอก Charge Box ID ให้ครบ",
                atLeastOneCharger: "ต้องมีตู้ชาร์จอย่างน้อย 1 ตู้",
                selectImageOnly: "กรุณาเลือกไฟล์รูปภาพเท่านั้น",
                fileTooLarge: "ไฟล์ใหญ่เกินไป (สูงสุด 3MB)",
                upload: "เลือกรูป", noImages: "ยังไม่มีรูป", removeCharger: "ลบตู้ชาร์จนี้",
                duplicateSN: "SN ซ้ำกัน กรุณาตรวจสอบ",
                duplicateWO: "WO ซ้ำกัน กรุณาตรวจสอบ",
                duplicateChargeBoxID: "Charge Box ID ซ้ำกัน กรุณาตรวจสอบ",
            },
            en: {
                addNewStation: "Add New Station", subtitle: "Fill in station and charger details",
                stationInfo: "Station Information", stationName: "Station Name", owner: "Owner",
                status: "Status", active: "Active", inactive: "Inactive",
                maximoLocation: "Maximo Location", maximoDesc: "Maximo Description",
                stationImages: "Station Images", station: "Station", mdb: "MDB",
                chargers: "Chargers", addCharger: "Add Charger", chargerNo: "Charger #",
                chargerBoxId: "Charge Box ID", ocppUrl: "OCPP URL", ocppSection: "OCPP",
                chargerType: "Type", chargerNoAuto: "No. (Auto)", auto: "Auto",
                brand: "Brand", model: "Model", serialNumber: "S/N",
                workOrder: "WO", power: "Power (kW)", plcFirmware: "PLC Firmware",
                piFirmware: "Pi Firmware", routerFirmware: "Router Firmware",
                commissioningDate: "Commissioning Date", warrantyYears: "Warranty (Yrs)",
                numberOfCables: "Cables", images: "Images", charger: "Charger",
                device: "Device", chargerCount: "Charger(s)", cancel: "Cancel",
                createStation: "Create Station", saving: "Saving...",
                pleaseEnterStationName: "Please enter Station Name",
                pleaseFillChargerBoxId: "Please fill in Charge Box ID for all chargers",
                atLeastOneCharger: "At least 1 Charger is required",
                selectImageOnly: "Please select image files only",
                fileTooLarge: "File too large (max 3 MB)",
                upload: "Browse", noImages: "No images yet", removeCharger: "Remove this charger",
                duplicateSN: "Duplicate SN found, please check",
                duplicateWO: "Duplicate WO found, please check",
                duplicateChargeBoxID: "Duplicate Charge Box ID found, please check",
            },
        };
        return tr[lang];
    }, [lang]);

    /* ── state ── */
    const [station, setStation] = useState<StationForm>({
        station_id: "", station_name: "", owner: "", is_active: true,
        maximo_location: "", maximo_desc: "", stationImages: [], mdbImages: [],
    });
    const [stationPreviews, setStationPreviews] = useState<Record<StationImageKind, string[]>>({ station: [], mdb: [] });
    const [chargerPreviews, setChargerPreviews] = useState<Record<string, { charger: string[]; device: string[] }>>({});
    const [chargers, setChargers] = useState<ChargerForm[]>([createEmptyCharger(1)]);
    const [submitting, setSubmitting] = useState(false);

    const isFlexxfast = (brand: string) => brand.trim().toLowerCase() === "flexxfast";

    useEffect(() => { if (open) setStation((s) => ({ ...s, owner: currentUser || s.owner })); }, [open, currentUser]);
    useEffect(() => {
        setStation((s) => ({ ...s, station_id: s.station_name.trim() ? generateStationId(s.station_name) : "" }));
    }, [station.station_name]);

    const onStationChange = (key: keyof StationForm, value: any) => setStation((s) => ({ ...s, [key]: value }));
    const onChargerChange = (id: string, key: keyof ChargerForm, value: any) =>
        setChargers((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)));

    /* ── file validation ── */
    const pickValid = (files: FileList | null): File[] =>
        Array.from(files || []).filter((f) => {
            if (!f.type.startsWith("image/")) { alert(t.selectImageOnly); return false; }
            if (f.size > 3 * 1024 * 1024) { alert(t.fileTooLarge); return false; }
            return true;
        });

    /* ── station images ── */
    const handleStationImage = (kind: StationImageKind, e: React.ChangeEvent<HTMLInputElement>) => {
        const valid = pickValid(e.target.files);
        if (!valid.length) return;
        const key = `${kind}Images` as keyof StationForm;
        setStation((s) => ({ ...s, [key]: [...(s[key] as File[]), ...valid] }));
        setStationPreviews((p) => ({ ...p, [kind]: [...p[kind], ...valid.map((f) => URL.createObjectURL(f))] }));
        e.target.value = "";
    };
    const removeStationImage = (kind: StationImageKind, idx: number) => {
        URL.revokeObjectURL(stationPreviews[kind][idx]);
        const key = `${kind}Images` as keyof StationForm;
        setStation((s) => ({ ...s, [key]: (s[key] as File[]).filter((_, i) => i !== idx) }));
        setStationPreviews((p) => ({ ...p, [kind]: p[kind].filter((_, i) => i !== idx) }));
    };

    /* ── charger images ── */
    const handleChargerImage = (cid: string, kind: "charger" | "device", e: React.ChangeEvent<HTMLInputElement>) => {
        const valid = pickValid(e.target.files);
        if (!valid.length) return;
        const key = kind === "charger" ? "chargerImages" : "deviceImages";
        setChargers((prev) => prev.map((c) => (c.id === cid ? { ...c, [key]: [...c[key], ...valid] } : c)));
        setChargerPreviews((p) => ({
            ...p,
            [cid]: {
                charger: p[cid]?.charger || [],
                device: p[cid]?.device || [],
                [kind]: [...(p[cid]?.[kind] || []), ...valid.map((f) => URL.createObjectURL(f))],
            },
        }));
        e.target.value = "";
    };
    const removeChargerImage = (cid: string, kind: "charger" | "device", idx: number) => {
        const url = chargerPreviews[cid]?.[kind]?.[idx];
        if (url) URL.revokeObjectURL(url);
        const key = kind === "charger" ? "chargerImages" : "deviceImages";
        setChargers((prev) => prev.map((c) => (c.id === cid ? { ...c, [key]: c[key].filter((_, i) => i !== idx) } : c)));
        setChargerPreviews((p) => ({ ...p, [cid]: { ...p[cid], [kind]: (p[cid]?.[kind] || []).filter((_, i) => i !== idx) } }));
    };

    /* ── add / remove charger ── */
    const addCharger = () => setChargers((prev) => [...prev, createEmptyCharger(prev.length + 1)]);
    const removeCharger = (id: string) => {
        if (chargers.length <= 1) { alert(t.atLeastOneCharger); return; }
        const p = chargerPreviews[id];
        if (p) { p.charger?.forEach((u) => URL.revokeObjectURL(u)); p.device?.forEach((u) => URL.revokeObjectURL(u)); }
        setChargerPreviews((prev) => { const n = { ...prev }; delete n[id]; return n; });
        setChargers((prev) => prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, chargerNo: i + 1 })));
    };

    /* ── submit ── */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        if (!station.station_name.trim()) { alert(t.pleaseEnterStationName); setSubmitting(false); return; }
        if (chargers.some((c) => isFlexxfast(c.brand) && !c.chargeBoxID.trim())) { alert(t.pleaseFillChargerBoxId); setSubmitting(false); return; }

        const payload: NewStationPayload = {
            station: {
                station_id: station.station_id.trim(), station_name: station.station_name.trim(),
                owner: (station.owner || currentUser).trim(), is_active: station.is_active,
                maximo_location: station.maximo_location.trim(), maximo_desc: station.maximo_desc.trim(),
            },
            chargers: chargers.map((c) => ({
                chargerNo: c.chargerNo, brand: c.brand.trim(), model: c.model.trim(),
                SN: c.SN.trim(), WO: c.WO.trim(), power: c.power.trim(),
                PLCFirmware: c.PLCFirmware.trim(), PIFirmware: c.PIFirmware.trim(),
                RTFirmware: c.RTFirmware.trim(), chargeBoxID: c.chargeBoxID.trim(),
                ocppUrl: c.ocppUrl.trim(), commissioningDate: c.commissioningDate,
                warrantyYears: c.warrantyYears, numberOfCables: c.numberOfCables,
                is_active: c.is_active, maximo_location: c.maximo_location.trim(),
                maximo_desc: c.maximo_desc.trim(), chargerType: c.chargerType,
            })),
        };

        // ── ตรวจ duplicate SN ──
        const sns = chargers.map((c) => c.SN.trim()).filter(Boolean);
        if (new Set(sns).size !== sns.length) {
            alert(t.duplicateSN);
            setSubmitting(false);
            return;
        }

        // ── ตรวจ duplicate WO (เฉพาะที่กรอก) ──
        const wos = chargers.map((c) => c.WO.trim()).filter(Boolean);
        if (new Set(wos).size !== wos.length) {
            alert(t.duplicateWO);
            setSubmitting(false);
            return;
        }

        const cbids = chargers.map((c) => c.chargeBoxID.trim()).filter(Boolean);
        if (new Set(cbids).size !== cbids.length) {
            alert(t.duplicateChargeBoxID); setSubmitting(false); return;
        }

        try {
            const created = await onSubmit(payload);
            if (onSubmitImages && created?.chargers) {
                await onSubmitImages(
                    payload.station.station_id,
                    { station: station.stationImages, mdb: station.mdbImages },
                    chargers.map((c) => ({ chargerNo: c.chargerNo, chargerImages: c.chargerImages, deviceImages: c.deviceImages })),
                    created.chargers.map((c: any) => ({ id: c.id, chargerNo: c.chargerNo })),
                );
            }
            resetAndClose();
        } catch (err) { console.error(err); } finally { setSubmitting(false); }
    };

    const resetAndClose = () => {
        Object.values(stationPreviews).forEach((urls) => urls.forEach((u) => u && URL.revokeObjectURL(u)));
        Object.values(chargerPreviews).forEach((p) => { p.charger?.forEach((u) => URL.revokeObjectURL(u)); p.device?.forEach((u) => URL.revokeObjectURL(u)); });
        setStation({ station_id: "", station_name: "", owner: "", is_active: true, maximo_location: "", maximo_desc: "", stationImages: [], mdbImages: [] });
        setStationPreviews({ station: [], mdb: [] });
        setChargerPreviews({});
        setChargers([createEmptyCharger(1)]);
        onClose();
    };

    /* ─────────────────────── Render ─────────────────────── */
    return (
        <>
            {loading && <LoadingOverlay show={loading} text={lang === "th" ? "กำลังโหลดข้อมูล..." : "Loading data..."} />}
            <Dialog
                open={open}
                handler={resetAndClose}
                size="lg"
                dismiss={{ outsidePress: !loading, escapeKey: !loading }}
                className="tw-flex tw-flex-col tw-max-h-[95vh] sm:tw-max-h-[90vh] tw-overflow-hidden !tw-rounded-xl sm:!tw-rounded-2xl !tw-m-2 sm:!tw-m-4"
            >
                {/* ══════ HEADER ══════ */}
                <DialogHeader className="tw-sticky tw-top-0 tw-z-10 tw-bg-gradient-to-r tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-4 sm:tw-px-6 tw-py-3.5 sm:tw-py-5 tw-border-0 tw-shadow-xl tw-shrink-0">
                    <div className="tw-flex tw-items-center tw-justify-between tw-w-full">
                        <div className="tw-flex tw-items-center tw-gap-2.5 sm:tw-gap-3.5">
                            <div>
                                <Typography variant="h5" className="!tw-text-white !tw-font-bold !tw-tracking-tight !tw-leading-tight !tw-text-base sm:!tw-text-lg">
                                    {t.addNewStation}
                                </Typography>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={resetAndClose}
                            className="tw-p-1.5 sm:tw-p-2 tw-rounded-xl tw-bg-white/10 hover:tw-bg-white/20 tw-text-white/60 hover:tw-text-white tw-transition-all tw-duration-200"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="tw-h-5 tw-w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="tw-flex tw-flex-col tw-min-h-0">
                    <DialogBody className="tw-flex-1 tw-min-h-0 tw-overflow-y-auto tw-space-y-3 sm:tw-space-y-5 tw-px-3 sm:tw-px-6 tw-py-3 sm:tw-py-5 tw-bg-gray-50/60">

                        {/* ══════ STATION INFO CARD ══════ */}
                        <section className="tw-rounded-xl sm:tw-rounded-2xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/[.06] tw-overflow-hidden">
                            <div className="tw-px-3.5 sm:tw-px-5 tw-py-3 sm:tw-py-4 tw-border-b tw-border-gray-100 tw-flex tw-items-center tw-gap-2.5 sm:tw-gap-3">
                                <SectionIcon emoji="📍" />
                                <Typography variant="h6" className="!tw-text-gray-800 !tw-font-bold !tw-tracking-tight !tw-text-sm sm:!tw-text-base">{t.stationInfo}</Typography>
                            </div>
                            <div className="tw-p-3.5 sm:tw-p-5 tw-space-y-4 sm:tw-space-y-5">
                                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-3 sm:tw-gap-4">
                                    <Input label={t.stationName} required value={station.station_name} onChange={(e) => onStationChange("station_name", e.target.value)} crossOrigin={undefined} />
                                    {isAdmin ? (
                                        <Select label={t.owner} value={station.owner || ""} onChange={(v) => onStationChange("owner", v || "")}>
                                            {(allOwners.length ? allOwners : [currentUser]).map((n) => <Option key={n} value={n}>{n}</Option>)}
                                        </Select>
                                    ) : (
                                        <Input label={t.owner} value={station.owner || currentUser || ""} readOnly disabled crossOrigin={undefined} />
                                    )}
                                    <Input label={t.maximoLocation} value={station.maximo_location} onChange={(e) => onStationChange("maximo_location", e.target.value)} crossOrigin={undefined} />
                                    <Input label={t.maximoDesc} value={station.maximo_desc} onChange={(e) => onStationChange("maximo_desc", e.target.value)} crossOrigin={undefined} />
                                    <Select label={t.status} value={String(station.is_active)} onChange={(v) => onStationChange("is_active", v === "true")}>
                                        <Option value="true">{t.active}</Option>
                                        <Option value="false">{t.inactive}</Option>
                                    </Select>
                                </div>

                                {/* images */}
                                <div className="tw-pt-3 sm:tw-pt-4 tw-border-t tw-border-gray-100">
                                    <p className="tw-text-[10px] sm:tw-text-[11px] tw-font-bold tw-text-blue-gray-500 tw-uppercase tw-tracking-widest tw-mb-2.5 sm:tw-mb-3">📷 {t.stationImages}</p>
                                    <div className="tw-grid tw-grid-cols-1 tw-gap-2.5 sm:tw-grid-cols-2 sm:tw-gap-3">
                                        <ImageZone label={t.station} previews={stationPreviews.station} onUpload={(e) => handleStationImage("station", e)} onRemove={(i) => removeStationImage("station", i)} emptyLabel={t.noImages} uploadLabel={t.upload} />
                                        <ImageZone label={t.mdb} previews={stationPreviews.mdb} onUpload={(e) => handleStationImage("mdb", e)} onRemove={(i) => removeStationImage("mdb", i)} emptyLabel={t.noImages} uploadLabel={t.upload} />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* ══════ CHARGERS ══════ */}
                        <section className="tw-space-y-3 sm:tw-space-y-4">
                            <div className="tw-flex tw-items-center tw-justify-between">
                                <div className="tw-flex tw-items-center tw-gap-2 sm:tw-gap-3">
                                    <SectionIcon emoji="⚡" />
                                    <Typography variant="h6" className="!tw-text-gray-800 !tw-font-bold !tw-tracking-tight !tw-text-sm sm:!tw-text-base">
                                        {t.chargers} <span className="tw-text-blue-gray-400 tw-font-normal">({chargers.length})</span>
                                    </Typography>
                                </div>
                                <button
                                    type="button"
                                    onClick={addCharger}
                                    className="tw-inline-flex tw-items-center tw-gap-1 sm:tw-gap-1.5 tw-px-3 sm:tw-px-4 tw-py-1.5 sm:tw-py-2 tw-rounded-xl tw-bg-gray-900 tw-text-white tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-tracking-wide tw-shadow-lg tw-shadow-gray-900/20 hover:tw-bg-black tw-transition-all tw-duration-200 hover:tw-shadow-xl hover:tw--translate-y-0.5"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="tw-h-3 tw-w-3 sm:tw-h-3.5 sm:tw-w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                    {t.addCharger}
                                </button>
                            </div>

                            {chargers.map((charger, index) => (
                                <div key={charger.id} className="tw-rounded-xl sm:tw-rounded-2xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/[.06] tw-overflow-hidden tw-transition-shadow tw-duration-300 hover:tw-shadow-md">
                                    {/* charger header bar */}
                                    <div className="tw-flex tw-items-center tw-justify-between tw-px-3.5 sm:tw-px-5 tw-py-2.5 sm:tw-py-3 tw-bg-gradient-to-r tw-from-amber-50 tw-to-orange-50/80 tw-border-b tw-border-amber-100/70">
                                        <div className="tw-flex tw-items-center tw-gap-2 sm:tw-gap-2.5 tw-min-w-0">
                                            <span className="tw-inline-flex tw-items-center tw-justify-center tw-h-6 tw-w-6 sm:tw-h-7 sm:tw-w-7 tw-rounded-lg tw-bg-gradient-to-br tw-from-amber-400 tw-to-orange-500 tw-shadow tw-text-white tw-text-[10px] sm:tw-text-xs tw-font-bold tw-shrink-0">
                                                {index + 1}
                                            </span>
                                            <span className="tw-text-xs sm:tw-text-sm tw-font-bold tw-text-gray-700 tw-truncate">{t.chargerNo}{index + 1}</span>
                                            {charger.brand && (
                                                <span className="tw-hidden sm:tw-inline tw-px-2 tw-py-0.5 tw-rounded-md tw-bg-white/90 tw-text-[10px] tw-font-semibold tw-text-blue-gray-500 tw-ring-1 tw-ring-black/5 tw-shadow-sm tw-truncate tw-max-w-[120px]">
                                                    {charger.brand}{charger.model ? ` ${charger.model}` : ""}
                                                </span>
                                            )}
                                        </div>
                                        {chargers.length > 1 && (
                                            <Tooltip content={t.removeCharger}>
                                                <button type="button" onClick={() => removeCharger(charger.id)} className="tw-p-1 sm:tw-p-1.5 tw-rounded-lg tw-text-red-400 hover:tw-text-red-600 hover:tw-bg-red-50 tw-transition-colors tw-shrink-0">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="tw-h-4 tw-w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                </button>
                                            </Tooltip>
                                        )}
                                    </div>

                                    <div className="tw-p-3.5 sm:tw-p-5 tw-space-y-3 sm:tw-space-y-4">
                                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-2.5 sm:tw-gap-3">
                                            <div className="tw-relative">
                                                <Input label={t.chargerNoAuto} type="number" value={charger.chargerNo} readOnly className="!tw-bg-gray-50" crossOrigin={undefined} />
                                                <span className="tw-absolute tw-right-3 tw-top-1/2 tw--translate-y-1/2 tw-text-[9px] tw-text-blue-gray-300 tw-font-medium">({t.auto})</span>
                                            </div>
                                            <Select label={t.chargerType} value={charger.chargerType} onChange={(v) => onChargerChange(charger.id, "chargerType", v ?? "DC")}>
                                                <Option value="DC">DC</Option>
                                                <Option value="AC">AC</Option>
                                            </Select>
                                            <Input label={t.brand} required value={charger.brand} onChange={(e) => onChargerChange(charger.id, "brand", e.target.value)} crossOrigin={undefined} />
                                            <Input label={t.model} required value={charger.model} onChange={(e) => onChargerChange(charger.id, "model", e.target.value)} crossOrigin={undefined} />
                                            <Input label={t.serialNumber} required value={charger.SN} onChange={(e) => onChargerChange(charger.id, "SN", e.target.value)} crossOrigin={undefined} />
                                            <Input label={t.power} required value={charger.power} onChange={(e) => onChargerChange(charger.id, "power", e.target.value)} crossOrigin={undefined} />
                                            {isFlexxfast(charger.brand) && (
                                                <>
                                                    <Input label={t.workOrder} value={charger.WO} onChange={(e) => onChargerChange(charger.id, "WO", e.target.value)} crossOrigin={undefined} />
                                                    <Input label={t.plcFirmware} required value={charger.PLCFirmware} onChange={(e) => onChargerChange(charger.id, "PLCFirmware", e.target.value)} crossOrigin={undefined} />
                                                    <Input label={t.piFirmware} required value={charger.PIFirmware} onChange={(e) => onChargerChange(charger.id, "PIFirmware", e.target.value)} crossOrigin={undefined} />
                                                    <Input label={t.routerFirmware} required value={charger.RTFirmware} onChange={(e) => onChargerChange(charger.id, "RTFirmware", e.target.value)} crossOrigin={undefined} />
                                                </>)}
                                            <Input label={t.maximoLocation} value={charger.maximo_location} onChange={(e) => onChargerChange(charger.id, "maximo_location", e.target.value)} crossOrigin={undefined} />
                                            <Input label={t.maximoDesc} value={charger.maximo_desc} onChange={(e) => onChargerChange(charger.id, "maximo_desc", e.target.value)} crossOrigin={undefined} />
                                            <Input label={t.commissioningDate} type="date" required value={charger.commissioningDate} onChange={(e) => onChargerChange(charger.id, "commissioningDate", e.target.value)} crossOrigin={undefined} />
                                            <Input label={t.warrantyYears} type="number" min={1} max={10} required value={charger.warrantyYears} onChange={(e) => onChargerChange(charger.id, "warrantyYears", parseInt(e.target.value) || 1)} crossOrigin={undefined} />
                                            <Input label={t.numberOfCables} type="number" min={1} max={10} required value={charger.numberOfCables} onChange={(e) => onChargerChange(charger.id, "numberOfCables", parseInt(e.target.value) || 1)} crossOrigin={undefined} />
                                            <Select label={t.status} value={String(charger.is_active)} onChange={(v) => onChargerChange(charger.id, "is_active", v === "true")}>
                                                <Option value="true">{t.active}</Option>
                                                <Option value="false">{t.inactive}</Option>
                                            </Select>
                                        </div>

                                        {/* OCPP */}
                                        {/* {isFlexxfast(charger.brand) && ( */}
                                        <div className="tw-pt-3 sm:tw-pt-4 tw-border-t tw-border-gray-100">
                                            <p className="tw-text-[10px] sm:tw-text-[11px] tw-font-bold tw-text-purple-500 tw-uppercase tw-tracking-widest tw-mb-2.5 sm:tw-mb-3">🔌 {t.ocppSection}</p>
                                            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-2.5 sm:tw-gap-3">
                                                <Input label={t.chargerBoxId} required value={charger.chargeBoxID} onChange={(e) => onChargerChange(charger.id, "chargeBoxID", e.target.value)} crossOrigin={undefined} />
                                                <Input label={t.ocppUrl} value={charger.ocppUrl} onChange={(e) => onChargerChange(charger.id, "ocppUrl", e.target.value)} crossOrigin={undefined} />
                                            </div>
                                        </div>
                                        {/* )} */}

                                        {/* Charger images */}
                                        <div className="tw-pt-3 sm:tw-pt-4 tw-border-t tw-border-gray-100">
                                            <p className="tw-text-[10px] sm:tw-text-[11px] tw-font-bold tw-text-blue-gray-500 tw-uppercase tw-tracking-widest tw-mb-2.5 sm:tw-mb-3">📷 {t.images}</p>
                                            <div className="tw-grid tw-grid-cols-1 tw-gap-2.5 sm:tw-grid-cols-2 sm:tw-gap-3">
                                                <ImageZone label={t.charger} previews={chargerPreviews[charger.id]?.charger || []} onUpload={(e) => handleChargerImage(charger.id, "charger", e)} onRemove={(i) => removeChargerImage(charger.id, "charger", i)} emptyLabel={t.noImages} uploadLabel={t.upload} />
                                                <ImageZone label={t.device} previews={chargerPreviews[charger.id]?.device || []} onUpload={(e) => handleChargerImage(charger.id, "device", e)} onRemove={(i) => removeChargerImage(charger.id, "device", i)} emptyLabel={t.noImages} uploadLabel={t.upload} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </section>
                    </DialogBody>

                    {/* ══════ FOOTER ══════ */}
                    <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-3 sm:tw-px-6 tw-py-3 sm:tw-py-4 tw-border-t tw-border-gray-200/80 tw-shrink-0">
                        <div className="tw-flex tw-w-full tw-flex-col sm:tw-flex-row tw-justify-between tw-items-center tw-gap-2.5 sm:tw-gap-0">
                            <span className="tw-inline-flex tw-items-center tw-gap-2 tw-px-3 sm:tw-px-3.5 tw-py-1.5 tw-rounded-full tw-bg-amber-50 tw-ring-1 tw-ring-amber-200/70">
                                <span className="tw-text-xs sm:tw-text-sm">⚡</span>
                                <span className="tw-text-[11px] sm:tw-text-xs tw-font-bold tw-text-amber-700">{chargers.length}</span>
                                <span className="tw-text-[11px] sm:tw-text-xs tw-text-amber-600/80">{t.chargerCount}</span>
                            </span>
                            <div className="tw-flex tw-gap-2 sm:tw-gap-2.5 tw-w-full sm:tw-w-auto">
                                <Button
                                    variant="outlined"
                                    onClick={resetAndClose}
                                    type="button"
                                    className="tw-flex-1 sm:tw-flex-none tw-rounded-xl tw-border-gray-300 tw-text-gray-600 hover:tw-bg-gray-50 tw-normal-case tw-font-semibold tw-text-xs sm:tw-text-sm tw-px-4 sm:tw-px-5 tw-py-2.5 sm:tw-py-2"
                                >
                                    {t.cancel}
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading || submitting}
                                    className="tw-flex-1 sm:tw-flex-none tw-rounded-xl tw-bg-gray-900 hover:tw-bg-black tw-shadow-lg tw-shadow-gray-900/20 tw-normal-case tw-font-semibold tw-text-xs sm:tw-text-sm tw-tracking-wide tw-px-4 sm:tw-px-6 tw-py-2.5 sm:tw-py-2 disabled:tw-opacity-50 tw-transition-all tw-duration-200 hover:tw-shadow-xl"
                                >
                                    {loading || submitting
                                        ? <span className="tw-flex tw-items-center tw-justify-center tw-gap-2"><Spinner />{t.saving}</span>
                                        : t.createStation
                                    }
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </form>
            </Dialog>
        </>
    );
}