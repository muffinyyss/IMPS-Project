"use client";

import { useEffect, useState } from "react";
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
} from "@material-tailwind/react";

export type NewStationForm = {
    station_id: string;
    station_name: string;
    brand: string;
    model: string;
    SN: string;
    WO: string;
    PLCFirmware: string;
    PIFirmware: string;
    RTFirmware: string;
    chargeBoxID: string;
    owner: string;
    is_active: boolean;
    // is_active: boolean;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: NewStationForm) => Promise<void> | void;
    loading?: boolean;

    // ใหม่
    currentUser: string;       // ชื่อ username ของคนที่ล็อกอิน
    isAdmin: boolean;          // true = admin
    allOwners?: string[];      // รายชื่อ owner ทั้งหมด (ใช้เมื่อ isAdmin = true)
};

export default function AddUserModal({
    open,
    onClose,
    onSubmit,
    loading,
    currentUser,
    isAdmin,
    allOwners = [],
}: Props) {
    const [form, setForm] = useState<NewStationForm>({
        station_id: "",
        station_name: "",
        brand: "",
        model: "",
        SN: "",
        WO: "",
        PLCFirmware: "",
        PIFirmware: "",
        RTFirmware: "",
        chargeBoxID: "",
        owner: "",
        is_active: true,
    });

    // ตั้ง owner อัตโนมัติเป็น currentUser เมื่อ modal เปิด หรือเมื่อ currentUser เปลี่ยน
    useEffect(() => {
        if (open) {
            setForm((s) => ({ ...s, owner: currentUser || s.owner }));
        }
    }, [open, currentUser]);

    const onChange = (k: keyof NewStationForm, v: any) =>
        setForm((s) => ({ ...s, [k]: v }));
    const [submitting, setSubmitting] = useState(false);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        const payload: NewStationForm = {
            ...form,
            station_id: form.station_id.trim(),
            station_name: form.station_name.trim(),
            brand: form.brand.trim(),
            model: form.model.trim(),
            SN: form.SN.trim(),
            WO: form.WO.trim(),
            PLCFirmware: form.PLCFirmware.trim(),
            PIFirmware: form.PIFirmware.trim(),
            RTFirmware: form.RTFirmware.trim(),
            chargeBoxID: form.chargeBoxID.trim(),
            owner: (form.owner || currentUser).trim(),
            is_active: form.is_active
            // status เป็น boolean อยู่แล้ว
        };

        try {
            await onSubmit(payload);
            resetAndClose();
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const resetAndClose = () => {
        setForm({
            station_id: "",
            station_name: "",
            brand: "",
            model: "",
            SN: "",
            WO: "",
            PLCFirmware: "",
            PIFirmware: "",
            RTFirmware: "",
            chargeBoxID: "",
            owner: "",
            is_active: false,
        });
        onClose();
    };

    return (
        <Dialog
            open={open}
            handler={resetAndClose}
            size="md"
            dismiss={{ outsidePress: !loading, escapeKey: !loading }}
            className="tw-space-y-5 tw-px-8 tw-py-4"
        >
            <DialogHeader className="tw-flex tw-items-center tw-justify-between">
                <Typography variant="h5" color="blue-gray">
                    Add New Station
                </Typography>
                <Button variant="text" onClick={resetAndClose}>
                    ✕
                </Button>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
                <DialogBody className="tw-space-y-6 tw-px-6 tw-py-4">
                    <div className="tw-flex tw-flex-col tw-gap-4">
                        <Input
                            label="Station ID"
                            required
                            value={form.station_id}
                            onChange={(e) => onChange("station_id", e.target.value)}
                            crossOrigin={undefined}
                        />
                        <Input
                            label="Station Name"
                            required
                            value={form.station_name}
                            onChange={(e) => onChange("station_name", e.target.value)}
                            crossOrigin={undefined}
                        />
                        <Input
                            label="Brand"
                            required
                            value={form.brand}
                            onChange={(e) => onChange("brand", e.target.value)}
                            crossOrigin={undefined}
                        />
                        <Input
                            label="Model"
                            required
                            value={form.model}
                            onChange={(e) => onChange("model", e.target.value)}
                            crossOrigin={undefined}
                        />
                        <Input
                            label="Serial Number (S/N)"
                            required
                            value={form.SN}
                            onChange={(e) => onChange("SN", e.target.value)}
                            crossOrigin={undefined}
                        />
                        <Input
                            label="Work Order (WO)"
                            required
                            value={form.WO}
                            onChange={(e) => onChange("WO", e.target.value)}
                            crossOrigin={undefined}
                        />
                        <Input
                            label="PLC Firmware"
                            required
                            value={form.PLCFirmware}
                            onChange={(e) => onChange("PLCFirmware", e.target.value)}
                            crossOrigin={undefined}
                        />
                        <Input
                            label="Raspberry pi Firmware"
                            required
                            value={form.PIFirmware}
                            onChange={(e) => onChange("PIFirmware", e.target.value)}
                            crossOrigin={undefined}
                        />
                        <Input
                            label="Router Firmware"
                            required
                            value={form.RTFirmware}
                            onChange={(e) => onChange("RTFirmware", e.target.value)}
                            crossOrigin={undefined}
                        />
                        <Input
                            label="Charger Box ID"
                            required
                            value={form.chargeBoxID}
                            onChange={(e) => onChange("chargeBoxID", e.target.value)}
                            crossOrigin={undefined}
                        />

                        {/* OWNER */}
                        {isAdmin ? (
                            <div>
                                <Select
                                    label="Owner"
                                    value={form.owner || ""}
                                    onChange={(v) => onChange("owner", v || "")}
                                >
                                    {(allOwners.length ? allOwners : [currentUser]).map((name) => (
                                        <Option key={name} value={name}>
                                            {name}
                                        </Option>
                                    ))}
                                </Select>
                            </div>
                        ) : (
                            // ผู้ใช้ทั่วไป: แสดงเป็น input readonly/disabled
                            <Input
                                label="Owner"
                                value={form.owner || currentUser || ""}
                                crossOrigin={undefined}
                                readOnly
                                disabled
                            />
                        )}

                        {/* Is_active */}
                        <div>
                            <Select
                                label="Is_active"
                                value={String(form.is_active)} // "true" | "false"
                                onChange={(v) => onChange("is_active", v === "true")}
                            >
                                <Option value="true">Active</Option>
                                <Option value="false">Inactive</Option>
                            </Select>
                        </div>
                    </div>
                </DialogBody>

                <DialogFooter className="tw-gap-2">
                    <Button variant="outlined" onClick={resetAndClose} type="button">
                        Cancel
                    </Button>
                    <Button type="submit" className="tw-bg-blue-600" disabled={loading || submitting}>
                        {loading || submitting ? "Saving..." : "Create Station"}
                    </Button>
                </DialogFooter>
            </form>
        </Dialog>
    );
}
