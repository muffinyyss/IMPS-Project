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
    station_id?: number | null;
    company_name?: string | null;
    payment: "y" | "n";
    tel: string;
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
        station_id: null,
        company_name: "",
        payment: "y",
        tel: "",
    });

    const onChange = (k: keyof NewUserPayload, v: any) =>
        setForm((s) => ({ ...s, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit({
            ...form,
            username: form.username.trim(),
            email: form.email.trim(),
            station_id:
                form.station_id === null || form.station_id === undefined || (form.station_id as any) === ""
                    ? null
                    : Number(form.station_id),
            company_name: form.company_name?.trim() || null,
        });
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
            station_id: null,
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
                            label="Tel"
                            required
                            value={form.tel}
                            onChange={(e) => onChange("tel", e.target.value)}
                            crossOrigin={undefined}
                        />

                        <div>
                            <Select
                                value={form.role}
                                onChange={(v) => onChange("role", String(v) as "owner" | "technician" | "admin")}
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
