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
    role: "admin" | "user";
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
        role: "user",
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
                form.station_id === null || form.station_id === undefined || form.station_id === ("" as any)
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
            role: "user",
            tel: "",
            company_name: "",
            payment: "y",
        });
        onClose();
    };

    return (
        <Dialog open={open} handler={resetAndClose} size="lg">
            <DialogHeader className="tw-flex tw-items-center tw-justify-between">
                <Typography variant="h5" color="blue-gray">Add New User</Typography>
                <Button variant="text" onClick={resetAndClose}>✕</Button>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
                <DialogBody className="tw-space-y-6">
                    <div className="tw-grid md:tw-grid-cols-2 tw-gap-4">
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
                        {/* <Input
                            label="Password"
                            type="password"
                            required
                            value={form.password}
                            onChange={(e) => onChange("password", e.target.value)}
                            crossOrigin={undefined}
                        /> */}
                        <div>
                            {/* <Typography variant="small" className="tw-mb-1 !tw-font-medium !tw-text-blue-gray-600">
                                Role
                            </Typography> */}
                            <Select value={form.role} onChange={(v) => onChange("role", String(v) as "admin" | "user")} label="Role">
                                <Option value="admin">admin</Option>
                                <Option value="user">user</Option>
                            </Select>
                        </div>
                        {/* <Input
                            label="Company Name"
                            value={form.company_name ?? ""}
                            onChange={(e) => onChange("company_name", e.target.value)}
                            crossOrigin={undefined}
                        /> */}
                        {/* <div>
                            <Typography variant="small" className="tw-mb-1 !tw-font-medium !tw-text-blue-gray-600">
                                Payment
                            </Typography>
                            <Select value={form.payment} onChange={(v) => onChange("payment", String(v) as "y" | "n")} label="Payment">
                                <Option value="y">y</Option>
                                <Option value="n">n</Option>
                            </Select>
                        </div> */}
                    </div>

                    {/* <Typography variant="small" className="!tw-text-blue-gray-500">
                        * ฟิลด์ที่จำเป็น | ระบบจะจัดการ `_id`, `user_id`, `token`, `refreshTokens` เอง
                    </Typography> */}
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
