"use client";

import { useEffect, useRef, useState } from "react";
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
    id: string; // unique id for React key (not sent to backend)
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
};

export type StationForm = {
    station_id: string;
    station_name: string;
    owner: string;
    is_active: boolean;
    // Images
    stationImage: File | null;
    mdbImage: File | null;
    chargerImage: File | null;
    deviceImage: File | null;
};

export type NewStationPayload = {
    station: Omit<StationForm, "stationImage" | "mdbImage" | "chargerImage" | "deviceImage">;
    chargers: Omit<ChargerForm, "id">[];
};

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: NewStationPayload) => Promise<void> | void;
    loading?: boolean;

    onSubmitImages?: (
        stationId: string,
        images: {
            station: File | null;
            mdb: File | null;
            charger: File | null;
            device: File | null;
        }
    ) => Promise<void> | void;

    currentUser: string;
    isAdmin: boolean;
    allOwners?: string[];
};

// ===== Helper: Generate Station ID from Station Name =====
const generateStationId = (stationName: string): string => {
    // Convert station name to ID-friendly format
    // - Remove special characters (keep Thai, English, numbers)
    // - Replace spaces with underscores
    const nameSlug = stationName
        .trim()
        .replace(/[^\u0E00-\u0E7FA-Za-z0-9\s]/g, "") // Keep Thai, English, numbers, spaces
        .replace(/\s+/g, "_");                       // Replace spaces with underscore

    // If name is empty, generate random ID
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
});

type ImageKind = "station" | "mdb" | "charger" | "device";

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
    // Station form
    const [station, setStation] = useState<StationForm>({
        station_id: "",
        station_name: "",
        owner: "",
        is_active: true,
        stationImage: null,
        mdbImage: null,
        chargerImage: null,
        deviceImage: null,
    });

    // Image previews
    const [previews, setPreviews] = useState<Record<ImageKind, string>>({
        station: "",
        mdb: "",
        charger: "",
        device: "",
    });

    // Chargers array
    const [chargers, setChargers] = useState<ChargerForm[]>([createEmptyCharger(1)]);

    const [submitting, setSubmitting] = useState(false);

    // ===== Effects =====
    useEffect(() => {
        if (open) {
            // Set owner when modal opens
            setStation((s) => ({
                ...s,
                owner: currentUser || s.owner,
            }));
        }
    }, [open, currentUser]);

    // ===== Auto-generate station_id when station_name changes =====
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

    // ===== Image handlers =====
    const handleImage = (kind: ImageKind, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            alert("Please select an image file only");
            return;
        }
        if (file.size > 3 * 1024 * 1024) {
            alert("File is too large (max 3MB)");
            return;
        }

        // Cleanup old preview
        if (previews[kind]) URL.revokeObjectURL(previews[kind]);

        // Update state
        const imageKey = `${kind}Image` as keyof StationForm;
        setStation((s) => ({ ...s, [imageKey]: file }));
        setPreviews((p) => ({ ...p, [kind]: URL.createObjectURL(file) }));
    };

    const clearImage = (kind: ImageKind) => {
        if (previews[kind]) URL.revokeObjectURL(previews[kind]);
        const imageKey = `${kind}Image` as keyof StationForm;
        setStation((s) => ({ ...s, [imageKey]: null }));
        setPreviews((p) => ({ ...p, [kind]: "" }));
    };

    // ===== Charger handlers =====
    const addCharger = () => {
        const nextChargerNo = chargers.length + 1;
        setChargers((prev) => [...prev, createEmptyCharger(nextChargerNo)]);
    };

    const removeCharger = (id: string) => {
        if (chargers.length <= 1) {
            alert("At least 1 Charger is required");
            return;
        }
        setChargers((prev) => {
            const filtered = prev.filter((c) => c.id !== id);
            // Re-number chargers
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

        // Validate station name
        if (!station.station_name.trim()) {
            alert("Please enter Station Name");
            setSubmitting(false);
            return;
        }

        // Validate chargers
        if (chargers.some((c) => !c.chargeBoxID.trim())) {
            alert("Please fill in Charger Box ID for all chargers");
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
            await onSubmit(payload);

            // Submit images
            if (onSubmitImages) {
                await onSubmitImages(payload.station.station_id, {
                    station: station.stationImage,
                    mdb: station.mdbImage,
                    charger: station.chargerImage,
                    device: station.deviceImage,
                });
            }

            resetAndClose();
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const resetAndClose = () => {
        // Cleanup all previews
        Object.values(previews).forEach((url) => {
            if (url) URL.revokeObjectURL(url);
        });

        setStation({
            station_id: "",
            station_name: "",
            owner: "",
            is_active: true,
            stationImage: null,
            mdbImage: null,
            chargerImage: null,
            deviceImage: null,
        });
        setPreviews({ station: "", mdb: "", charger: "", device: "" });
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
                        Add New Station
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
                            📍 Station Information
                        </Typography>
                        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                            {/* Station Name with auto-generated ID shown below */}
                            <div className="tw-space-y-1">
                                <Input
                                    label="Station Name"
                                    required
                                    value={station.station_name}
                                    onChange={(e) => onStationChange("station_name", e.target.value)}
                                    crossOrigin={undefined}
                                />
                                {/* {station.station_id && (
                                    <Typography variant="small" className="!tw-text-blue-gray-500 tw-text-xs tw-pl-1">
                                        ID: <span className="tw-font-mono tw-bg-blue-gray-50 tw-px-1 tw-rounded">{station.station_id}</span>
                                    </Typography>
                                )} */}
                            </div>

                            {isAdmin ? (
                                <Select
                                    label="Owner"
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
                                    label="Owner"
                                    value={station.owner || currentUser || ""}
                                    readOnly
                                    disabled
                                    crossOrigin={undefined}
                                />
                            )}

                            <Select
                                label="Status"
                                value={String(station.is_active)}
                                onChange={(v) => onStationChange("is_active", v === "true")}
                            >
                                <Option value="true">Active</Option>
                                <Option value="false">Inactive</Option>
                            </Select>
                        </div>

                        {/* Station Images (4 types) */}
                        <div className="tw-mt-4">
                            <Typography variant="small" className="!tw-text-blue-gray-600 !tw-font-semibold tw-mb-3">
                                📷 Station Images
                            </Typography>
                            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-4 tw-gap-4">
                                {/* Station Image */}
                                <div className="tw-space-y-2">
                                    <Typography variant="small" className="!tw-text-blue-gray-500 tw-text-xs">
                                        Station
                                    </Typography>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImage("station", e)}
                                        className="tw-block tw-w-full tw-text-xs file:tw-mr-2 file:tw-px-2 file:tw-py-1 file:tw-rounded file:tw-border file:tw-border-blue-gray-100 file:tw-bg-white file:hover:tw-bg-gray-50 file:tw-cursor-pointer"
                                    />
                                    {previews.station && (
                                        <div className="tw-relative tw-inline-block">
                                            <img
                                                src={previews.station}
                                                alt="station"
                                                className="tw-h-20 tw-w-20 tw-object-cover tw-rounded-lg tw-border"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => clearImage("station")}
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
                                        MDB
                                    </Typography>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImage("mdb", e)}
                                        className="tw-block tw-w-full tw-text-xs file:tw-mr-2 file:tw-px-2 file:tw-py-1 file:tw-rounded file:tw-border file:tw-border-blue-gray-100 file:tw-bg-white file:hover:tw-bg-gray-50 file:tw-cursor-pointer"
                                    />
                                    {previews.mdb && (
                                        <div className="tw-relative tw-inline-block">
                                            <img
                                                src={previews.mdb}
                                                alt="mdb"
                                                className="tw-h-20 tw-w-20 tw-object-cover tw-rounded-lg tw-border"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => clearImage("mdb")}
                                                className="tw-absolute tw--top-2 tw--right-2 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-5 tw-h-5 tw-text-xs tw-leading-none tw-shadow-md hover:tw-bg-red-600"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Charger Image */}
                                <div className="tw-space-y-2">
                                    <Typography variant="small" className="!tw-text-blue-gray-500 tw-text-xs">
                                        Charger
                                    </Typography>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImage("charger", e)}
                                        className="tw-block tw-w-full tw-text-xs file:tw-mr-2 file:tw-px-2 file:tw-py-1 file:tw-rounded file:tw-border file:tw-border-blue-gray-100 file:tw-bg-white file:hover:tw-bg-gray-50 file:tw-cursor-pointer"
                                    />
                                    {previews.charger && (
                                        <div className="tw-relative tw-inline-block">
                                            <img
                                                src={previews.charger}
                                                alt="charger"
                                                className="tw-h-20 tw-w-20 tw-object-cover tw-rounded-lg tw-border"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => clearImage("charger")}
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
                                        Device
                                    </Typography>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImage("device", e)}
                                        className="tw-block tw-w-full tw-text-xs file:tw-mr-2 file:tw-px-2 file:tw-py-1 file:tw-rounded file:tw-border file:tw-border-blue-gray-100 file:tw-bg-white file:hover:tw-bg-gray-50 file:tw-cursor-pointer"
                                    />
                                    {previews.device && (
                                        <div className="tw-relative tw-inline-block">
                                            <img
                                                src={previews.device}
                                                alt="device"
                                                className="tw-h-20 tw-w-20 tw-object-cover tw-rounded-lg tw-border"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => clearImage("device")}
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
                                ⚡ Chargers ({chargers.length})
                            </Typography>
                            <Button
                                variant="outlined"
                                size="sm"
                                onClick={addCharger}
                                className="tw-flex tw-items-center tw-gap-1"
                            >
                                + Add Charger
                            </Button>
                        </div>

                        {chargers.map((charger, index) => (
                            <Card key={charger.id} className="tw-p-4 tw-border tw-border-blue-gray-100">
                                <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
                                    <Typography variant="small" className="tw-font-semibold tw-text-blue-gray-700">
                                        Charger #{index + 1}
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
                                        label="Charger Box ID"
                                        required
                                        value={charger.chargeBoxID}
                                        onChange={(e) => onChargerChange(charger.id, "chargeBoxID", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    
                                    {/* Charger No - Auto-generated, readonly */}
                                    <div className="tw-relative">
                                        <Input
                                            label="Charger No. (Auto)"
                                            type="number"
                                            value={charger.chargerNo}
                                            readOnly
                                            className="!tw-bg-gray-100 !tw-cursor-not-allowed"
                                            crossOrigin={undefined}
                                        />
                                        <span className="tw-absolute tw-right-3 tw-top-1/2 tw--translate-y-1/2 tw-text-xs tw-text-blue-gray-400">
                                            (Auto)
                                        </span>
                                    </div>

                                    <Input
                                        label="Brand"
                                        required
                                        value={charger.brand}
                                        onChange={(e) => onChargerChange(charger.id, "brand", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label="Model"
                                        required
                                        value={charger.model}
                                        onChange={(e) => onChargerChange(charger.id, "model", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label="Serial Number (S/N)"
                                        required
                                        value={charger.SN}
                                        onChange={(e) => onChargerChange(charger.id, "SN", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label="Work Order (WO)"
                                        required
                                        value={charger.WO}
                                        onChange={(e) => onChargerChange(charger.id, "WO", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label="Power (kW)"
                                        required
                                        value={charger.power}
                                        onChange={(e) => onChargerChange(charger.id, "power", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label="PLC Firmware"
                                        required
                                        value={charger.PLCFirmware}
                                        onChange={(e) => onChargerChange(charger.id, "PLCFirmware", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label="Raspberry Pi Firmware"
                                        required
                                        value={charger.PIFirmware}
                                        onChange={(e) => onChargerChange(charger.id, "PIFirmware", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label="Router Firmware"
                                        required
                                        value={charger.RTFirmware}
                                        onChange={(e) => onChargerChange(charger.id, "RTFirmware", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label="Commissioning Date"
                                        type="date"
                                        required
                                        value={charger.commissioningDate}
                                        onChange={(e) => onChargerChange(charger.id, "commissioningDate", e.target.value)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label="Warranty (Years)"
                                        type="number"
                                        min={1}
                                        max={10}
                                        required
                                        value={charger.warrantyYears}
                                        onChange={(e) => onChargerChange(charger.id, "warrantyYears", parseInt(e.target.value) || 1)}
                                        crossOrigin={undefined}
                                    />
                                    <Input
                                        label="Number of Cables"
                                        type="number"
                                        min={1}
                                        max={10}
                                        required
                                        value={charger.numberOfCables}
                                        onChange={(e) => onChargerChange(charger.id, "numberOfCables", parseInt(e.target.value) || 1)}
                                        crossOrigin={undefined}
                                    />
                                    <Select
                                        label="Status"
                                        value={String(charger.is_active)}
                                        onChange={(v) => onChargerChange(charger.id, "is_active", v === "true")}
                                    >
                                        <Option value="true">Active</Option>
                                        <Option value="false">Inactive</Option>
                                    </Select>
                                </div>
                            </Card>
                        ))}
                    </div>
                </DialogBody>

                <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-6 tw-py-3 tw-border-t">
                    <div className="tw-flex tw-w-full tw-justify-between tw-items-center">
                        <Typography variant="small" className="tw-text-blue-gray-500">
                            {chargers.length} Charger(s)
                        </Typography>
                        <div className="tw-flex tw-gap-2">
                            <Button variant="outlined" onClick={resetAndClose} type="button">
                                Cancel
                            </Button>
                            <Button type="submit" className="tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black" disabled={loading || submitting}>
                                {loading || submitting ? "Saving..." : "Create Station"}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </form>
        </Dialog>
    );
}