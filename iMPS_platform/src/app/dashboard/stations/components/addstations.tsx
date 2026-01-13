"use client";

import { useEffect, useRef, useState, useMemo } from "react";
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
    Card,
    IconButton,
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
    commissioningDate: string;
    warrantyYears: number;
    numberOfCables: number;
    is_active: boolean;
    chargerImage: File | null;
    deviceImage: File | null;
};

export type StationForm = {
    station_id: string;
    station_name: string;
    owner: string;
    is_active: boolean;
    stationImage: File | null;
    mdbImage: File | null;
};

export type NewStationPayload = {
    station: Omit<StationForm, "stationImage" | "mdbImage">;
    chargers: Omit<ChargerForm, "id" | "chargerImage" | "deviceImage">[];
};

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: NewStationPayload) => Promise<any>;
    loading?: boolean;
    onSubmitImages?: (
        stationId: string,
        images: { station: File | null; mdb: File | null },
        chargerImages: Array<{ chargerNo: number; chargerImage: File | null; deviceImage: File | null }>,
        createdChargers: Array<{ id: string; chargerNo: number }>
    ) => Promise<void> | void;
    currentUser: string;
    isAdmin: boolean;
    allOwners?: string[];
};

// ===== Helper: Generate Station ID from Station Name =====
const generateStationId = (stationName: string): string => {
    const nameSlug = stationName
        .trim()
        .replace(/[^\u0E00-\u0E7FA-Za-z0-9\s]/g, "")
        .replace(/\s+/g, "_");

    if (!nameSlug) {
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `STATION_${random}`;
    }

    return nameSlug;
};

// ===== Helper: Get today's date in YYYY-MM-DD format =====
const getTodayDate = (): string => {
    const today = new Date();
    return today.toISOString().split("T")[0];
};

// ===== Helper: Create empty Charger =====
const createEmptyCharger = (chargerNo: number): ChargerForm => ({
    id: crypto.randomUUID(),
    chargerNo,
    brand: "",
    model: "",
    SN: "",
    WO: "",
    power: "",
    PLCFirmware: "",
    PIFirmware: "",
    RTFirmware: "",
    chargeBoxID: "",
    commissioningDate: getTodayDate(),
    warrantyYears: 1,
    numberOfCables: 1,
    is_active: true,
    chargerImage: null,
    deviceImage: null,
});

type StationImageKind = "station" | "mdb";
type Lang = "th" | "en";

// ===== Component =====
export default function AddStationModal({
    open,
    onClose,
    onSubmit,
    loading,
    currentUser,
    isAdmin,
    allOwners = [],
    onSubmitImages,
}: Props) {
    // ===== Language State =====
    const [lang, setLang] = useState<Lang>("en");

    useEffect(() => {
        const savedLang = localStorage.getItem("app_language") as Lang | null;
        if (savedLang === "th" || savedLang === "en") {
            setLang(savedLang);
        }

        const handleLangChange = (e: CustomEvent<{ lang: Lang }>) => {
            setLang(e.detail.lang);
        };

        window.addEventListener("language:change", handleLangChange as EventListener);
        return () => {
            window.removeEventListener("language:change", handleLangChange as EventListener);
        };
    }, []);

    // ===== Translations =====
    const t = useMemo(() => {
        const translations = {
            th: {
                // Dialog Header
                addNewStation: "เพิ่มสถานีใหม่",

                // Station Info Section
                stationInformation: "📍 ข้อมูลสถานี",
                stationName: "ชื่อสถานี",
                owner: "เจ้าของ",
                status: "สถานะ",
                active: "เปิดใช้งาน",
                inactive: "ปิดใช้งาน",

                // Station Images
                stationImages: "📷 รูปภาพสถานี",
                station: "สถานี",
                mdb: "MDB",

                // Chargers Section
                chargers: "⚡ ตู้ชาร์จ",
                addCharger: "+ เพิ่มตู้ชาร์จ",
                chargerNo: "ตู้ชาร์จ #",

                // Charger Form Labels
                chargerBoxId: "รหัสตู้ชาร์จ",
                chargerNoAuto: "ตู้ที่ (อัตโนมัติ)",
                auto: "อัตโนมัติ",
                brand: "ยี่ห้อ",
                model: "รุ่น",
                serialNumber: "หมายเลขเครื่อง (S/N)",
                workOrder: "ใบสั่งงาน (WO)",
                power: "กำลังไฟ (kW)",
                plcFirmware: "เฟิร์มแวร์ PLC",
                piFirmware: "เฟิร์มแวร์ Raspberry Pi",
                routerFirmware: "เฟิร์มแวร์ Router",
                commissioningDate: "วันที่เริ่มใช้งาน",
                warrantyYears: "ระยะรับประกัน (ปี)",
                numberOfCables: "จำนวนสายชาร์จ",

                // Charger Images
                chargerImages: "📷 รูปภาพตู้ชาร์จ",
                charger: "ตู้ชาร์จ",
                device: "อุปกรณ์",

                // Footer
                chargerCount: "ตู้ชาร์จ",
                cancel: "ยกเลิก",
                createStation: "สร้างสถานี",
                saving: "กำลังบันทึก...",

                // Validation Messages
                pleaseEnterStationName: "กรุณากรอกชื่อสถานี",
                pleaseFillChargerBoxId: "กรุณากรอกรหัสตู้ชาร์จให้ครบทุกตู้",
                atLeastOneCharger: "ต้องมีตู้ชาร์จอย่างน้อย 1 ตู้",
                selectImageOnly: "กรุณาเลือกไฟล์รูปภาพเท่านั้น",
                fileTooLarge: "ไฟล์ใหญ่เกินไป (สูงสุด 3MB)",
            },
            en: {
                // Dialog Header
                addNewStation: "Add New Station",

                // Station Info Section
                stationInformation: "📍 Station Information",
                stationName: "Station Name",
                owner: "Owner",
                status: "Status",
                active: "Active",
                inactive: "Inactive",

                // Station Images
                stationImages: "📷 Station Images",
                station: "Station",
                mdb: "MDB",

                // Chargers Section
                chargers: "⚡ Chargers",
                addCharger: "+ Add Charger",
                chargerNo: "Charger #",

                // Charger Form Labels
                chargerBoxId: "Charger Box ID",
                chargerNoAuto: "Charger No. (Auto)",
                auto: "Auto",
                brand: "Brand",
                model: "Model",
                serialNumber: "Serial Number (S/N)",
                workOrder: "Work Order (WO)",
                power: "Power (kW)",
                plcFirmware: "PLC Firmware",
                piFirmware: "Raspberry Pi Firmware",
                routerFirmware: "Router Firmware",
                commissioningDate: "Commissioning Date",
                warrantyYears: "Warranty (Years)",
                numberOfCables: "Number of Cables",

                // Charger Images
                chargerImages: "📷 Charger Images",
                charger: "Charger",
                device: "Device",

                // Footer
                chargerCount: "Charger(s)",
                cancel: "Cancel",
                createStation: "Create Station",
                saving: "Saving...",

                // Validation Messages
                pleaseEnterStationName: "Please enter Station Name",
                pleaseFillChargerBoxId: "Please fill in Charger Box ID for all chargers",
                atLeastOneCharger: "At least 1 Charger is required",
                selectImageOnly: "Please select an image file only",
                fileTooLarge: "File is too large (max 3MB)",
            },
        };
        return translations[lang];
    }, [lang]);

    // Station form
    const [station, setStation] = useState<StationForm>({
        station_id: "",
        station_name: "",
        owner: "",
        is_active: true,
        stationImage: null,
        mdbImage: null,
    });

    // Station image previews
    const [stationPreviews, setStationPreviews] = useState<Record<StationImageKind, string>>({
        station: "",
        mdb: "",
    });

    // Charger image previews
    const [chargerPreviews, setChargerPreviews] = useState<Record<string, { charger: string; device: string }>>({});

    // Chargers array
    const [chargers, setChargers] = useState<ChargerForm[]>([createEmptyCharger(1)]);

    const [submitting, setSubmitting] = useState(false);

    // ===== Effects =====
    useEffect(() => {
        if (open) {
            setStation((s) => ({
                ...s,
                owner: currentUser || s.owner,
            }));
        }
    }, [open, currentUser]);

    // Auto-generate station_id when station_name changes
    useEffect(() => {
        if (station.station_name.trim()) {
            const newId = generateStationId(station.station_name);
            setStation((s) => ({ ...s, station_id: newId }));
        } else {
            setStation((s) => ({ ...s, station_id: "" }));
        }
    }, [station.station_name]);

    // ===== Station handlers =====
    const onStationChange = (key: keyof StationForm, value: any) => {
        setStation((s) => ({ ...s, [key]: value }));
    };

    // ===== Station Image handlers =====
    const handleStationImage = (kind: StationImageKind, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            alert(t.selectImageOnly);
            return;
        }
        if (file.size > 3 * 1024 * 1024) {
            alert(t.fileTooLarge);
            return;
        }

        if (stationPreviews[kind]) URL.revokeObjectURL(stationPreviews[kind]);

        const imageKey = `${kind}Image` as keyof StationForm;
        setStation((s) => ({ ...s, [imageKey]: file }));
        setStationPreviews((p) => ({ ...p, [kind]: URL.createObjectURL(file) }));
    };

    const clearStationImage = (kind: StationImageKind) => {
        if (stationPreviews[kind]) URL.revokeObjectURL(stationPreviews[kind]);
        const imageKey = `${kind}Image` as keyof StationForm;
        setStation((s) => ({ ...s, [imageKey]: null }));
        setStationPreviews((p) => ({ ...p, [kind]: "" }));
    };

    // ===== Charger Image handlers =====
    const handleChargerImage = (chargerId: string, kind: "charger" | "device", e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            alert(t.selectImageOnly);
            return;
        }
        if (file.size > 3 * 1024 * 1024) {
            alert(t.fileTooLarge);
            return;
        }

        const oldPreview = chargerPreviews[chargerId]?.[kind];
        if (oldPreview) URL.revokeObjectURL(oldPreview);

        const imageKey = kind === "charger" ? "chargerImage" : "deviceImage";
        setChargers((prev) =>
            prev.map((c) => (c.id === chargerId ? { ...c, [imageKey]: file } : c))
        );

        setChargerPreviews((p) => ({
            ...p,
            [chargerId]: {
                ...p[chargerId],
                [kind]: URL.createObjectURL(file),
            },
        }));
    };

    const clearChargerImage = (chargerId: string, kind: "charger" | "device") => {
        const oldPreview = chargerPreviews[chargerId]?.[kind];
        if (oldPreview) URL.revokeObjectURL(oldPreview);

        const imageKey = kind === "charger" ? "chargerImage" : "deviceImage";
        setChargers((prev) =>
            prev.map((c) => (c.id === chargerId ? { ...c, [imageKey]: null } : c))
        );

        setChargerPreviews((p) => ({
            ...p,
            [chargerId]: {
                ...p[chargerId],
                [kind]: "",
            },
        }));
    };

    // ===== Charger handlers =====
    const addCharger = () => {
        const nextChargerNo = chargers.length + 1;
        setChargers((prev) => [...prev, createEmptyCharger(nextChargerNo)]);
    };

    const removeCharger = (id: string) => {
        if (chargers.length <= 1) {
            alert(t.atLeastOneCharger);
            return;
        }

        const preview = chargerPreviews[id];
        if (preview?.charger) URL.revokeObjectURL(preview.charger);
        if (preview?.device) URL.revokeObjectURL(preview.device);

        setChargerPreviews((p) => {
            const newPreviews = { ...p };
            delete newPreviews[id];
            return newPreviews;
        });

        setChargers((prev) => {
            const filtered = prev.filter((c) => c.id !== id);
            return filtered.map((c, index) => ({ ...c, chargerNo: index + 1 }));
        });
    };

    const onChargerChange = (id: string, key: keyof ChargerForm, value: any) => {
        setChargers((prev) =>
            prev.map((c) => (c.id === id ? { ...c, [key]: value } : c))
        );
    };

    // ===== Submit =====
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);

        if (!station.station_name.trim()) {
            alert(t.pleaseEnterStationName);
            setSubmitting(false);
            return;
        }

        if (chargers.some((c) => !c.chargeBoxID.trim())) {
            alert(t.pleaseFillChargerBoxId);
            setSubmitting(false);
            return;
        }

        const payload: NewStationPayload = {
            station: {
                station_id: station.station_id.trim(),
                station_name: station.station_name.trim(),
                owner: (station.owner || currentUser).trim(),
                is_active: station.is_active,
            },
            chargers: chargers.map((c) => ({
                chargerNo: c.chargerNo,
                brand: c.brand.trim(),
                model: c.model.trim(),
                SN: c.SN.trim(),
                WO: c.WO.trim(),
                power: c.power.trim(),
                PLCFirmware: c.PLCFirmware.trim(),
                PIFirmware: c.PIFirmware.trim(),
                RTFirmware: c.RTFirmware.trim(),
                chargeBoxID: c.chargeBoxID.trim(),
                commissioningDate: c.commissioningDate,
                warrantyYears: c.warrantyYears,
                numberOfCables: c.numberOfCables,
                is_active: c.is_active,
            })),
        };

        try {
            const created = await onSubmit(payload);

            if (onSubmitImages && created?.chargers) {
                const chargerImages = chargers.map((c) => ({
                    chargerNo: c.chargerNo,
                    chargerImage: c.chargerImage,
                    deviceImage: c.deviceImage,
                }));

                const createdChargers = created.chargers.map((c: any) => ({
                    id: c.id,
                    chargerNo: c.chargerNo,
                }));

                await onSubmitImages(
                    payload.station.station_id,
                    {
                        station: station.stationImage,
                        mdb: station.mdbImage,
                    },
                    chargerImages,
                    createdChargers
                );
            }

            resetAndClose();
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const resetAndClose = () => {
        Object.values(stationPreviews).forEach((url) => {
            if (url) URL.revokeObjectURL(url);
        });

        Object.values(chargerPreviews).forEach((preview) => {
            if (preview.charger) URL.revokeObjectURL(preview.charger);
            if (preview.device) URL.revokeObjectURL(preview.device);
        });

        setStation({
            station_id: "",
            station_name: "",
            owner: "",
            is_active: true,
            stationImage: null,
            mdbImage: null,
        });
        setStationPreviews({ station: "", mdb: "" });
        setChargerPreviews({});
        setChargers([createEmptyCharger(1)]);
        onClose();
    };

    // ===== Render =====
    return (
        <Dialog
            open={open}
            handler={resetAndClose}
            size="lg"
            dismiss={{ outsidePress: !loading, escapeKey: !loading }}
            className="tw-flex tw-flex-col tw-max-h-[90vh] tw-overflow-hidden tw-px-0 tw-py-0"
        >
            <DialogHeader className="tw-sticky tw-top-0 tw-z-10 tw-bg-white tw-px-6 tw-py-4 tw-border-b">
                <div className="tw-flex tw-items-center tw-justify-between tw-w-full">
                    <Typography variant="h5" color="blue-gray">
                        {t.addNewStation}
                    </Typography>
                    <Button variant="text" onClick={resetAndClose}>
                        ✕
                    </Button>
                </div>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="tw-flex tw-flex-col tw-min-h-0">
                <DialogBody className="tw-flex-1 tw-min-h-0 tw-overflow-y-auto tw-space-y-6 tw-px-6 tw-py-4">
                    {/* ========== STATION INFO ========== */}
                    <Card className="tw-p-4 tw-bg-blue-gray-50/50">
                        <Typography variant="h6" color="blue-gray" className="tw-mb-4">
                            {t.stationInformation}
                        </Typography>
                        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                            <div className="tw-space-y-1">
                                <Input
                                    label={t.stationName}
                                    required
                                    value={station.station_name}
                                    onChange={(e) => onStationChange("station_name", e.target.value)}
                                    crossOrigin={undefined}
                                />
                            </div>

                            {isAdmin ? (
                                <Select
                                    label={t.owner}
                                    value={station.owner || ""}
                                    onChange={(v) => onStationChange("owner", v || "")}
                                >
                                    {(allOwners.length ? allOwners : [currentUser]).map((name) => (
                                        <Option key={name} value={name}>
                                            {name}
                                        </Option>
                                    ))}
                                </Select>
                            ) : (
                                <Input
                                    label={t.owner}
                                    value={station.owner || currentUser || ""}
                                    readOnly
                                    disabled
                                    crossOrigin={undefined}
                                />
                            )}

                            <Select
                                label={t.status}
                                value={String(station.is_active)}
                                onChange={(v) => onStationChange("is_active", v === "true")}
                            >
                                <Option value="true">{t.active}</Option>
                                <Option value="false">{t.inactive}</Option>
                            </Select>
                        </div>

                        {/* Station Images */}
                        <div className="tw-mt-4">
                            <Typography variant="small" className="!tw-text-blue-gray-600 !tw-font-semibold tw-mb-3">
                                {t.stationImages}
                            </Typography>
                            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-4">
                                {/* Station Image */}
                                <div className="tw-space-y-2">
                                    <Typography variant="small" className="!tw-text-blue-gray-500 tw-text-xs">
                                        {t.station}
                                    </Typography>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleStationImage("station", e)}
                                        className="tw-block tw-w-full tw-text-xs file:tw-mr-2 file:tw-px-2 file:tw-py-1 file:tw-rounded file:tw-border file:tw-border-blue-gray-100 file:tw-bg-white file:hover:tw-bg-gray-50 file:tw-cursor-pointer"
                                    />
                                    {stationPreviews.station && (
                                        <div className="tw-relative tw-inline-block">
                                            <img
                                                src={stationPreviews.station}
                                                alt="station"
                                                className="tw-h-20 tw-w-20 tw-object-cover tw-rounded-lg tw-border"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => clearStationImage("station")}
                                                className="tw-absolute tw--top-2 tw--right-2 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-5 tw-h-5 tw-text-xs tw-leading-none tw-shadow-md hover:tw-bg-red-600"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* MDB Image */}
                                <div className="tw-space-y-2">
                                    <Typography variant="small" className="!tw-text-blue-gray-500 tw-text-xs">
                                        {t.mdb}
                                    </Typography>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleStationImage("mdb", e)}
                                        className="tw-block tw-w-full tw-text-xs file:tw-mr-2 file:tw-px-2 file:tw-py-1 file:tw-rounded file:tw-border file:tw-border-blue-gray-100 file:tw-bg-white file:hover:tw-bg-gray-50 file:tw-cursor-pointer"
                                    />
                                    {stationPreviews.mdb && (
                                        <div className="tw-relative tw-inline-block">
                                            <img
                                                src={stationPreviews.mdb}
                                                alt="mdb"
                                                className="tw-h-20 tw-w-20 tw-object-cover tw-rounded-lg tw-border"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => clearStationImage("mdb")}
                                                className="tw-absolute tw--top-2 tw--right-2 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-5 tw-h-5 tw-text-xs tw-leading-none tw-shadow-md hover:tw-bg-red-600"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* ========== CHARGERS ========== */}
                    <div className="tw-space-y-4">
                        <div className="tw-flex tw-items-center tw-justify-between">
                            <Typography variant="h6" color="blue-gray">
                                {t.chargers} ({chargers.length})
                            </Typography>
                            <Button
                                variant="outlined"
                                size="sm"
                                onClick={addCharger}
                                className="tw-flex tw-items-center tw-gap-1"
                            >
                                {t.addCharger}
                            </Button>
                        </div>

                        {chargers.map((charger, index) => (
                            <Card key={charger.id} className="tw-p-4 tw-border tw-border-blue-gray-100">
                                <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
                                    <Typography variant="small" className="tw-font-semibold tw-text-blue-gray-700">
                                        {t.chargerNo}{index + 1}
                                    </Typography>
                                    {chargers.length > 1 && (
                                        <IconButton
                                            variant="text"
                                            size="sm"
                                            onClick={() => removeCharger(charger.id)}
                                            className="tw-text-red-500 hover:tw-bg-red-50"
                                        >
                                            🗑️
                                        </IconButton>
                                    )}
                                </div>

                                <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-3">
                                    <Input
                                        label={t.chargerBoxId}
                                        required
                                        value={charger.chargeBoxID}
                                        onChange={(e) => onChargerChange(charger.id, "chargeBoxID", e.target.value)}
                                        crossOrigin={undefined}
                                    />

                                    <div className="tw-relative">
                                        <Input
                                            label={t.chargerNoAuto}
                                            type="number"
                                            value={charger.chargerNo}
                                            readOnly
                                            className="!tw-bg-gray-100 !tw-cursor-not-allowed"
                                            crossOrigin={undefined}
                                        />
                                        <span className="tw-absolute tw-right-3 tw-top-1/2 tw--translate-y-1/2 tw-text-xs tw-text-blue-gray-400">
                                            ({t.auto})
                                        </span>
                                    </div>

                                    <Input
                                        label={t.brand}
                                        required
                                        value={charger.brand}
                                        onChange={(e) => onChargerChange(charger.id, "brand", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label={t.model}
                                        required
                                        value={charger.model}
                                        onChange={(e) => onChargerChange(charger.id, "model", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label={t.serialNumber}
                                        required
                                        value={charger.SN}
                                        onChange={(e) => onChargerChange(charger.id, "SN", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label={t.workOrder}
                                        required
                                        value={charger.WO}
                                        onChange={(e) => onChargerChange(charger.id, "WO", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label={t.power}
                                        required
                                        value={charger.power}
                                        onChange={(e) => onChargerChange(charger.id, "power", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label={t.plcFirmware}
                                        required
                                        value={charger.PLCFirmware}
                                        onChange={(e) => onChargerChange(charger.id, "PLCFirmware", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label={t.piFirmware}
                                        required
                                        value={charger.PIFirmware}
                                        onChange={(e) => onChargerChange(charger.id, "PIFirmware", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label={t.routerFirmware}
                                        required
                                        value={charger.RTFirmware}
                                        onChange={(e) => onChargerChange(charger.id, "RTFirmware", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label={t.commissioningDate}
                                        type="date"
                                        required
                                        value={charger.commissioningDate}
                                        onChange={(e) => onChargerChange(charger.id, "commissioningDate", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label={t.warrantyYears}
                                        type="number"
                                        min={1}
                                        max={10}
                                        required
                                        value={charger.warrantyYears}
                                        onChange={(e) => onChargerChange(charger.id, "warrantyYears", parseInt(e.target.value) || 1)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label={t.numberOfCables}
                                        type="number"
                                        min={1}
                                        max={10}
                                        required
                                        value={charger.numberOfCables}
                                        onChange={(e) => onChargerChange(charger.id, "numberOfCables", parseInt(e.target.value) || 1)}
                                        crossOrigin={undefined}
                                    />
                                    <Select
                                        label={t.status}
                                        value={String(charger.is_active)}
                                        onChange={(v) => onChargerChange(charger.id, "is_active", v === "true")}
                                    >
                                        <Option value="true">{t.active}</Option>
                                        <Option value="false">{t.inactive}</Option>
                                    </Select>
                                </div>

                                {/* Charger Images */}
                                <div className="tw-mt-4 tw-pt-4 tw-border-t tw-border-blue-gray-100">
                                    <Typography variant="small" className="!tw-text-blue-gray-600 !tw-font-semibold tw-mb-3">
                                        {t.chargerImages}
                                    </Typography>
                                    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-4">
                                        {/* Charger Image */}
                                        <div className="tw-space-y-2">
                                            <Typography variant="small" className="!tw-text-blue-gray-500 tw-text-xs">
                                                {t.charger}
                                            </Typography>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleChargerImage(charger.id, "charger", e)}
                                                className="tw-block tw-w-full tw-text-xs file:tw-mr-2 file:tw-px-2 file:tw-py-1 file:tw-rounded file:tw-border file:tw-border-blue-gray-100 file:tw-bg-white file:hover:tw-bg-gray-50 file:tw-cursor-pointer"
                                            />
                                            {chargerPreviews[charger.id]?.charger && (
                                                <div className="tw-relative tw-inline-block">
                                                    <img
                                                        src={chargerPreviews[charger.id].charger}
                                                        alt="charger"
                                                        className="tw-h-20 tw-w-20 tw-object-cover tw-rounded-lg tw-border"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => clearChargerImage(charger.id, "charger")}
                                                        className="tw-absolute tw--top-2 tw--right-2 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-5 tw-h-5 tw-text-xs tw-leading-none tw-shadow-md hover:tw-bg-red-600"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Device Image */}
                                        <div className="tw-space-y-2">
                                            <Typography variant="small" className="!tw-text-blue-gray-500 tw-text-xs">
                                                {t.device}
                                            </Typography>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleChargerImage(charger.id, "device", e)}
                                                className="tw-block tw-w-full tw-text-xs file:tw-mr-2 file:tw-px-2 file:tw-py-1 file:tw-rounded file:tw-border file:tw-border-blue-gray-100 file:tw-bg-white file:hover:tw-bg-gray-50 file:tw-cursor-pointer"
                                            />
                                            {chargerPreviews[charger.id]?.device && (
                                                <div className="tw-relative tw-inline-block">
                                                    <img
                                                        src={chargerPreviews[charger.id].device}
                                                        alt="device"
                                                        className="tw-h-20 tw-w-20 tw-object-cover tw-rounded-lg tw-border"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => clearChargerImage(charger.id, "device")}
                                                        className="tw-absolute tw--top-2 tw--right-2 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-5 tw-h-5 tw-text-xs tw-leading-none tw-shadow-md hover:tw-bg-red-600"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </DialogBody>

                <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-6 tw-py-3 tw-border-t">
                    <div className="tw-flex tw-w-full tw-justify-between tw-items-center">
                        <Typography variant="small" className="tw-text-blue-gray-500">
                            {chargers.length} {t.chargerCount}
                        </Typography>
                        <div className="tw-flex tw-gap-2">
                            <Button variant="outlined" onClick={resetAndClose} type="button">
                                {t.cancel}
                            </Button>
                            <Button type="submit" className="tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black" disabled={loading || submitting}>
                                {loading || submitting ? t.saving : t.createStation}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </form>
        </Dialog>
    );
}