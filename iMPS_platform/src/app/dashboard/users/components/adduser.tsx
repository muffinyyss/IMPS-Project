"use client";

import { useState, useEffect } from "react";
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
    station_id?: string | string[];
};

type FormState = Omit<NewUserPayload, "station_id"> & {
    station_id?: string;
};

type Station = {
    station_id: string;
    station_name: string;
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
        station_id: undefined,
    });
    const [stations, setStations] = useState<Station[]>([]);
    const [loadingStations, setLoadingStations] = useState(false);
    const [stationSearchValue, setStationSearchValue] = useState("");
    const [showStationDropdown, setShowStationDropdown] = useState(false);
    const [selectedStations, setSelectedStations] = useState<Station[]>([]);

    const onChange = (k: keyof NewUserPayload, v: any) =>
        setForm((s) => ({ ...s, [k]: v }));

    // โหลด stations เมื่อ modal เปิด
    // ถ้า role เป็น admin → ดึง stations ทั้งหมด
    // ถ้า role เป็น owner → ดึง stations ที่เป็นเจ้าของ
    useEffect(() => {
        if (!open) return;

        const fetchStations = async () => {
            try {
                setLoadingStations(true);
                const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
                
                if (!token) {
                    console.warn("No token found");
                    return;
                }

                const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
                const res = await fetch(`${API_BASE}/my-stations/detail`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                    console.error("Failed to fetch stations:", res.status);
                    return;
                }

                const data = await res.json();
                // API returns { stations: [...] }
                const stationsList = data?.stations || (Array.isArray(data) ? data : []);
                setStations(stationsList);
            } catch (error) {
                console.error("Error fetching stations:", error);
            } finally {
                setLoadingStations(false);
            }
        };

        fetchStations();
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation: if technician, must select at least one station
        if (form.role === "technician" && selectedStations.length === 0) {
            alert("Please select at least one station for technician role");
            return;
        }

        const payload: NewUserPayload = {
            ...form,
            username: form.username.trim(),
            email: form.email.trim(),
            company_name: form.company_name?.trim() || undefined,
            tel: form.tel.trim(),
            ...(form.role === "technician" && selectedStations.length > 0 
                ? { station_id: selectedStations.map(s => s.station_id) }
                : {}),
        };
        try {
            await onSubmit(payload);
            resetAndClose();
        } catch (error) {
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
            station_id: undefined,
        });
        setStationSearchValue("");
        setShowStationDropdown(false);
        setSelectedStations([]);
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
                            <div className="tw-flex tw-items-center tw-gap-1">
                                <Select
                                    value={form.role}
                                    onChange={(v) => {
                                        onChange("role", String(v ?? form.role) as "owner" | "technician" | "admin");
                                        // รีเซ็ต station_id เมื่อเปลี่ยน role
                                        if (v !== "technician") {
                                            setForm((s) => ({ ...s, station_id: undefined }));
                                        }
                                    }}
                                    label="Role"
                                >
                                    <Option value="owner">Owner</Option>
                                    <Option value="admin">Admin</Option>
                                    <Option value="technician">Technician</Option>
                                </Select>
                                <span className="tw-text-red-500 tw-mt-4">*</span>
                            </div>
                        </div>

                        {/* แสดง Station Search เฉพาะเมื่อ role = technician */}
                        {form.role === "technician" && (
                            <div className="tw-relative">
                                <div className="tw-flex tw-items-center tw-gap-1">
                                    <Input
                                        label="Select Station"
                                        placeholder="Type to search..."
                                        value={stationSearchValue}
                                        onChange={(e) => {
                                            setStationSearchValue(e.target.value);
                                            setShowStationDropdown(true);
                                        }}
                                        onFocus={() => setShowStationDropdown(true)}
                                        disabled={loadingStations || stations.length === 0}
                                        crossOrigin={undefined}
                                    />
                                    <span className="tw-text-red-500 tw-mt-4">*</span>
                                </div>
                                
                                {/* Dropdown suggestions */}
                                {showStationDropdown && (
                                    <div className="tw-absolute tw-top-full tw-left-0 tw-right-0 tw-z-10 tw-mt-1 tw-max-h-48 tw-overflow-y-auto tw-bg-white tw-border tw-border-gray-300 tw-rounded-lg tw-shadow-lg">
                                        {stations
                                            .filter((station) =>
                                                !selectedStations.find(s => s.station_id === station.station_id) &&
                                                (station.station_name
                                                    .toLowerCase()
                                                    .includes(stationSearchValue.toLowerCase()) ||
                                                station.station_id
                                                    .toLowerCase()
                                                    .includes(stationSearchValue.toLowerCase()))
                                            )
                                            .map((station) => (
                                                <div
                                                    key={station.station_id}
                                                    onClick={() => {
                                                        setSelectedStations([...selectedStations, station]);
                                                        setStationSearchValue("");
                                                        setShowStationDropdown(false);
                                                    }}
                                                    className="tw-px-4 tw-py-2 tw-cursor-pointer hover:tw-bg-blue-50 tw-border-b tw-border-gray-100 last:tw-border-b-0"
                                                >
                                                    <Typography variant="small" className="tw-font-medium">
                                                        {station.station_name}
                                                    </Typography>
                                                    <Typography variant="small" color="gray">
                                                        {station.station_id}
                                                    </Typography>
                                                </div>
                                            ))}
                                        
                                        {stationSearchValue && stations.filter((station) =>
                                            !selectedStations.find(s => s.station_id === station.station_id) &&
                                            (station.station_name
                                                .toLowerCase()
                                                .includes(stationSearchValue.toLowerCase()) ||
                                            station.station_id
                                                .toLowerCase()
                                                .includes(stationSearchValue.toLowerCase()))
                                        ).length === 0 && (
                                            <div className="tw-px-4 tw-py-3 tw-text-center tw-text-gray-500">
                                                No stations found
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {loadingStations && (
                                    <Typography variant="small" color="gray" className="tw-mt-1">
                                        Loading stations...
                                    </Typography>
                                )}
                                {!loadingStations && stations.length === 0 && (
                                    <Typography variant="small" color="red" className="tw-mt-1">
                                        No stations available
                                    </Typography>
                                )}
                                
                                {/* Selected Stations Tags */}
                                {selectedStations.length > 0 && (
                                    <div className="tw-mt-3">
                                        <Typography variant="small" className="tw-font-semibold tw-mb-2">
                                            Selected Stations ({selectedStations.length}):
                                        </Typography>
                                        <div className="tw-flex tw-flex-wrap tw-gap-2">
                                            {selectedStations.map((station) => (
                                                <div
                                                    key={station.station_id}
                                                    className="tw-flex tw-items-center tw-gap-2 tw-bg-blue-100 tw-text-blue-700 tw-px-3 tw-py-1 tw-rounded-full tw-text-sm"
                                                >
                                                    <span>{station.station_name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedStations(
                                                                selectedStations.filter(s => s.station_id !== station.station_id)
                                                            );
                                                        }}
                                                        className="tw-font-bold tw-cursor-pointer hover:tw-text-blue-900"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </DialogBody>

                <DialogFooter className="tw-gap-2">
                    <Button variant="outlined" onClick={resetAndClose} type="button">Cancel</Button>
                    <Button type="submit" className="tw-bg-blue-600" disabled={loading || (form.role === "technician" && selectedStations.length === 0)}>
                        {loading ? "Saving..." : "Create User"}
                    </Button>
                </DialogFooter>
            </form>
        </Dialog>
    );
}
