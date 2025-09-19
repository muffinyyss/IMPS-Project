"use client";

import { useState } from "react";
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

export type NewUserPayload = {
    station_id: string;
    station_name: string;
    brand: string;
    model: string;
    sn: string;
    status: boolean;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: NewUserPayload) => Promise<void> | void;
    loading?: boolean;
};

export default function AddUserModal({ open, onClose, onSubmit, loading }: Props) {
    const [form, setForm] = useState<NewUserPayload>({
        station_id: "",
        station_name: "",
        brand: "",
        model: "",
        sn: "",
        status: false,
    });

    const onChange = (k: keyof NewUserPayload, v: any) =>
        setForm((s) => ({ ...s, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit({
            ...form,
            station_id: form.station_id.trim(),
            station_name: form.station_name.trim(),
            brand: form.brand.trim(),
            model: form.model.trim(),
            // status เป็น boolean อยู่แล้ว ไม่ต้องแปลง
        });
    };

    const resetAndClose = () => {
        setForm({
            station_id: "",
            station_name: "",
            brand: "",
            model: "",
            sn: "",
            status: false,
        });
        onClose();
    };

    return (
        <Dialog open={open} handler={resetAndClose} size="md" className="tw-space-y-5 tw-px-8 tw-py-4">
            <DialogHeader className="tw-flex tw-items-center tw-justify-between">
                <Typography variant="h5" color="blue-gray">Add New Station</Typography>
                <Button variant="text" onClick={resetAndClose}>✕</Button>
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
                            label="S/N"
                            required
                            value={form.model}
                            onChange={(e) => onChange("sn", e.target.value)}
                            crossOrigin={undefined}
                        />

                        {/* ใช้ Select สำหรับสถานะ แล้วแปลงเป็น boolean */}
                        {/* <div>
                            <Select
                                label="Status"
                                value={String(form.status)} // "true" | "false"
                                onChange={(v) => onChange("status", v === "true")}
                            >
                                <Option value="true">On</Option>
                                <Option value="false">Off</Option>
                            </Select>
                        </div> */}
                    </div>
                </DialogBody>

                <DialogFooter className="tw-gap-2">
                    <Button variant="outlined" onClick={resetAndClose} type="button">Cancel</Button>
                    <Button type="submit" className="tw-bg-blue-600" disabled={loading}>
                        {loading ? "Saving..." : "Create Station"}
                    </Button>
                </DialogFooter>
            </form>
        </Dialog>
    );
}
