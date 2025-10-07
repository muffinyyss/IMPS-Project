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
    username: string;
    password: string;
    email: string;
    role: "owner" | "admin" | "technician";
    company_name?: string;
    payment: "y" | "n";
    tel: string;
};

type FormState = Omit<NewUserPayload, "station_id"> & {
    station_id: string; // เก็บเป็น string เพื่อผูกกับ <Input />
};


type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: NewUserPayload) => Promise<void> | void;
    loading?: boolean;
};

export default function AddUserModal({ open, onClose, onSubmit, loading }: Props) {
    const [form, setForm] = useState<NewUserPayload>({
        username: "",
        password: "",
        email: "",
        role: "owner",
        company_name: "",
        payment: "y",
        tel: "",
    });
    const [stationInput, setStationInput] = useState("");
    const [stationIds, setStationIds] = useState<string[]>([]);

    const onChange = (k: keyof NewUserPayload, v: any) =>
        setForm((s) => ({ ...s, [k]: v }));
    // เพิ่ม station ลงลิสต์ (กันค่าว่าง/ซ้ำ)
    const addStationId = () => {
        const parts = stationInput
            .split(",")                  // อนุญาตใส่หลายค่าแล้วคั่นด้วย comma ได้ทันที
            .map((s) => s.trim())
            .filter(Boolean);

        if (parts.length === 0) return;

        setStationIds((prev) => {
            const set = new Set(prev);
            parts.forEach((p) => set.add(p));
            return Array.from(set);
        });
        setStationInput("");
    };

    const removeStationId = (target: string) => {
        setStationIds((prev) => prev.filter((s) => s !== target));
    };

    const handleStationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addStationId();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload: NewUserPayload = {
            ...form,
            username: form.username.trim(),
            email: form.email.trim(),
            company_name: form.company_name?.trim() || undefined,
            // station_id: form.station_id?.trim() || undefined,

        };
        try {
            await onSubmit(payload); // ✅ ให้ parent ยิง API + โชว์ success
            resetAndClose();         // ปิดโมดัล
        } catch (error) {
            // ถ้า parent โยน error มาก็จัดการเพิ่มได้ตามต้องการ
            console.error(error);
        }
    };

    const resetAndClose = () => {
        setForm({
            username: "",
            password: "",
            email: "",
            role: "owner",
            tel: "",
            company_name: "",
            payment: "y",
        });
        onClose();
    };

    return (
        <Dialog open={open} handler={resetAndClose} size="md" className="tw-space-y-5 tw-px-8 tw-py-4">
            <DialogHeader className="tw-flex tw-items-center tw-justify-between">
                <Typography variant="h5" color="blue-gray">Add New User</Typography>
                <Button variant="text" onClick={resetAndClose}>✕</Button>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
                <DialogBody className="tw-space-y-6 tw-px-6 tw-py-4">

                    <div className="tw-flex tw-flex-col tw-gap-4">
                        <Input
                            label="Username"
                            required
                            value={form.username}
                            onChange={(e) => onChange("username", e.target.value)}
                            crossOrigin={undefined}
                        />
                        <Input
                            label="Email"
                            type="email"
                            required
                            value={form.email}
                            onChange={(e) => onChange("email", e.target.value)}
                            crossOrigin={undefined}
                        />
                        <Input
                            label="Password"
                            type="password"
                            required
                            value={form.password}
                            onChange={(e) => onChange("password", e.target.value)}
                            crossOrigin={undefined}
                        />
                        <Input
                            label="Tel"
                            required
                            value={form.tel}
                            onChange={(e) => onChange("tel", e.target.value)}
                            crossOrigin={undefined}
                        />
                        <Input
                            label="Company"
                            required
                            value={form.company_name}
                            onChange={(e) => onChange("company_name", e.target.value)}
                            crossOrigin={undefined}
                        />
                        <div>
                            <Select
                                value={form.role}
                                onChange={(v) => onChange("role", String(v ?? form.role) as "owner" | "technician" | "admin")}
                                label="Role"
                            >
                                <Option value="owner">Owner</Option>
                                <Option value="admin">Admin</Option>
                                <Option value="technician">Technician</Option>
                            </Select>
                        </div>

                    </div>
                </DialogBody>

                <DialogFooter className="tw-gap-2">
                    <Button variant="outlined" onClick={resetAndClose} type="button">Cancel</Button>
                    <Button type="submit" className="tw-bg-blue-600" disabled={loading}>
                        {loading ? "Saving..." : "Create User"}
                    </Button>
                </DialogFooter>
            </form>
        </Dialog>
    );
}
