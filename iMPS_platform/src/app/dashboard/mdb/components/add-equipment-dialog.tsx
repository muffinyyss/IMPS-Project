"use client";

import React, { useEffect, useState } from "react";
import {
    Button, Typography,
    Dialog, DialogHeader, DialogBody, DialogFooter,
    Input,
} from "@material-tailwind/react";
import { PlusIcon, CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/solid";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type Lang = "th" | "en";

const Spinner = () => (
    <svg className="tw-animate-spin tw-h-4 tw-w-4" viewBox="0 0 24 24" fill="none">
        <circle className="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
);

const translations = {
    th: {
        title: "เพิ่มอุปกรณ์ MDB",
        stationId: "Station ID",
        topic: "Topic",
        topicPlaceholder: "เช่น PW/Pakchong2",
        broker: "Broker",
        brokerPlaceholder: "เช่น 212.80.215.42:1883",
        cancel: "ยกเลิก",
        save: "บันทึก",
        saving: "กำลังบันทึก...",
        requiredTopic: "กรุณากรอก Topic",
        requiredBroker: "กรุณากรอก Broker",
        success: "บันทึกเรียบร้อยแล้ว",
        error: "บันทึกไม่สำเร็จ",
    },
    en: {
        title: "Add MDB Equipment",
        stationId: "Station ID",
        topic: "Topic",
        topicPlaceholder: "e.g. PW/Pakchong2",
        broker: "Broker",
        brokerPlaceholder: "e.g. 212.80.215.42:1883",
        cancel: "Cancel",
        save: "Save",
        saving: "Saving...",
        requiredTopic: "Please enter Topic",
        requiredBroker: "Please enter Broker",
        success: "Saved successfully",
        error: "Save failed",
    },
};

type Toast = { type: "success" | "error"; message: string } | null;

export type AddEquipmentDialogProps = {
    open: boolean;
    onClose: () => void;
    stationId: string | null;
    stationName?: string;
    lang?: Lang;
    onSuccess?: () => void;
};

export default function AddEquipmentDialog({
    open, onClose, stationId, stationName, lang = "th", onSuccess,
}: AddEquipmentDialogProps) {

    const t = translations[lang];
    const [saving, setSaving] = useState(false);
    const [topic, setTopic] = useState("");
    const [broker, setBroker] = useState("");
    const [toast, setToast] = useState<Toast>(null);

    useEffect(() => {
        if (open) {
            setTopic("");
            setBroker("");
            setToast(null);
        }
    }, [open]);

    // auto-hide toast
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(timer);
    }, [toast]);

    const handleSubmit = async () => {
        if (!stationId) return setToast({ type: "error", message: "Station ID not found" });
        if (!topic.trim()) return setToast({ type: "error", message: t.requiredTopic });
        if (!broker.trim()) return setToast({ type: "error", message: t.requiredBroker });

        setSaving(true);
        setToast(null);
        try {
            const token = localStorage.getItem("access_token") || localStorage.getItem("accessToken") || "";

            const payload = { station_id: stationId, topic: topic.trim(), broker: broker.trim() };
            const res = await fetch(`${API_BASE}/MDB/equipment`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(`${t.error}: ${res.status}`);

            setToast({ type: "success", message: t.success });

            // รอให้เห็น toast แล้วค่อยปิด
            setTimeout(() => {
                onSuccess?.();
                onClose();
            }, 1200);

        } catch (err: any) {
            console.error(err);
            setToast({ type: "error", message: err?.message || t.error });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} handler={onClose} size="sm"
            dismiss={{ outsidePress: !saving, escapeKey: !saving }}
            className="tw-flex tw-flex-col tw-overflow-hidden !tw-rounded-xl sm:!tw-rounded-2xl !tw-m-2 sm:!tw-m-4">

            <DialogHeader className="tw-px-5 sm:tw-px-6 tw-py-4 sm:tw-py-5 tw-border-0 tw-shadow-xl tw-shrink-0"
                style={{ background: 'linear-gradient(135deg, #1a1a1a, #2d2d2d, #1a1a1a)' }}>
                <div className="tw-flex tw-items-center tw-justify-between tw-w-full">
                    <div className="tw-flex tw-items-center tw-gap-3">
                        <div className="tw-h-10 tw-w-10 tw-rounded-xl tw-flex tw-items-center tw-justify-center"
                            style={{ background: 'rgba(59,130,246,0.2)' }}>
                            <PlusIcon className="tw-h-5 tw-w-5 tw-text-blue-400" />
                        </div>
                        <div>
                            <Typography variant="h5" className="!tw-text-white !tw-font-bold !tw-tracking-tight !tw-text-base sm:!tw-text-lg">
                                {t.title}
                            </Typography>
                            {stationName && (
                                <Typography variant="small" className="!tw-text-white/40 !tw-text-xs">
                                    {stationName}
                                </Typography>
                            )}
                        </div>
                    </div>
                    <button type="button" onClick={onClose}
                        className="tw-p-2 tw-rounded-xl tw-bg-white/10 hover:tw-bg-white/20 tw-text-white/60 hover:tw-text-white tw-transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" className="tw-h-5 tw-w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </DialogHeader>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="tw-flex tw-flex-col">
                <DialogBody className="tw-px-5 sm:tw-px-6 tw-py-5 sm:tw-py-6 tw-bg-gray-50/60">
                    <div className="tw-space-y-4">
                        {/* Toast notification */}
                        {toast && (
                            <div className={`tw-flex tw-items-center tw-gap-2.5 tw-px-4 tw-py-3 tw-rounded-xl tw-text-sm tw-font-medium tw-animate-fade-in ${
                                toast.type === "success"
                                    ? "tw-bg-emerald-50 tw-text-emerald-700 tw-border tw-border-emerald-200"
                                    : "tw-bg-red-50 tw-text-red-700 tw-border tw-border-red-200"
                            }`}>
                                {toast.type === "success" ? (
                                    <CheckCircleIcon className="tw-h-5 tw-w-5 tw-text-emerald-500 tw-shrink-0" />
                                ) : (
                                    <ExclamationCircleIcon className="tw-h-5 tw-w-5 tw-text-red-500 tw-shrink-0" />
                                )}
                                {toast.message}
                            </div>
                        )}

                        {/* Station ID (read-only) */}
                        <div className="tw-px-3 tw-py-2.5 tw-rounded-lg tw-bg-gray-100 tw-border tw-border-gray-200">
                            <span className="tw-text-xs tw-text-gray-500 tw-font-medium">{t.stationId}</span>
                            <p className="tw-text-sm tw-font-semibold tw-text-gray-800 tw-mt-0.5">
                                {stationId || "-"}
                            </p>
                        </div>

                        <Input label={t.broker} required
                            placeholder={t.brokerPlaceholder}
                            value={broker}
                            onChange={(e) => setBroker(e.target.value)}
                            crossOrigin={undefined} />
                        <Input label={t.topic} required
                            placeholder={t.topicPlaceholder}
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            crossOrigin={undefined} />
                    </div>
                </DialogBody>

                <DialogFooter className="tw-bg-white tw-px-5 sm:tw-px-6 tw-py-3.5 tw-border-t tw-border-gray-200/80 tw-shrink-0">
                    <div className="tw-flex tw-gap-2.5 tw-w-full sm:tw-w-auto sm:tw-ml-auto">
                        <Button variant="outlined" type="button" onClick={onClose}
                            className="tw-flex-1 sm:tw-flex-none tw-rounded-xl tw-border-gray-300 tw-text-gray-600 hover:tw-bg-gray-50 tw-normal-case tw-font-semibold tw-text-sm tw-px-5 tw-py-2.5">
                            {t.cancel}
                        </Button>
                        <Button type="submit" disabled={saving}
                            className="tw-flex-1 sm:tw-flex-none tw-rounded-xl tw-shadow-lg tw-normal-case tw-font-semibold tw-text-sm tw-px-6 tw-py-2.5 disabled:tw-opacity-50 tw-transition-all tw-duration-200 hover:tw-shadow-xl"
                            style={{ background: 'linear-gradient(135deg, #1a1a1a, #2d2d2d)' }}>
                            {saving ? (
                                <span className="tw-flex tw-items-center tw-justify-center tw-gap-2">
                                    <Spinner />{t.saving}
                                </span>
                            ) : t.save}
                        </Button>
                    </div>
                </DialogFooter>
            </form>
        </Dialog>
    );
}