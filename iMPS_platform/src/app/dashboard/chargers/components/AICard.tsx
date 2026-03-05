"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardBody, Typography, Switch } from "@material-tailwind/react";
import { apiFetch } from "@/utils/api";

type Lang = "th" | "en";

const AICard = () => {
    const [isActive, setIsActive] = useState(false);
    const [role, setRole] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [lang, setLang] = useState<Lang>("en");

    const isAdmin = role === "admin";

    useEffect(() => {
        (async () => {
            try {
                const res = await apiFetch("/me/ai-package");
                if (res.ok) {
                    const data = await res.json();
                    setIsActive(data.has_access === true);
                    setRole(data.role ?? "");
                }
            } catch (e) {
                console.error("Failed to fetch ai-package", e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        const savedLang = localStorage.getItem("app_language") as Lang | null;
        if (savedLang === "th" || savedLang === "en") setLang(savedLang);
        const handleLangChange = (e: CustomEvent<{ lang: Lang }>) => setLang(e.detail.lang);
        window.addEventListener("language:change", handleLangChange as EventListener);
        return () => window.removeEventListener("language:change", handleLangChange as EventListener);
    }, []);

    const t = useMemo(() => ({
        th: {
            artificialIntelligence: "โมดูลอัจฉริยะ",
            enabled: "กำลังทำงาน",
            disabled: "ปิดใช้งาน",
            active: "เปิด",
            inactive: "ปิด",
            activeContent: "โมดูล AI กำลังทำงาน ระบบจะวิเคราะห์และแจ้งเตือนความผิดปกติของตู้ชาร์จโดยอัตโนมัติ",
            inactiveContent: "โมดูล AI ทั้งหมดถูกปิดใช้งาน การวิเคราะห์และแจ้งเตือนอัตโนมัติจะไม่ทำงาน",
        },
        en: {
            artificialIntelligence: "Intelligent Modules",
            enabled: "Running",
            disabled: "Disabled",
            active: "Active",
            inactive: "Inactive",
            activeContent: "All AI modules are active. The system will automatically analyze and alert on charger anomalies.",
            inactiveContent: "All AI modules are disabled. Automated analysis and alerts will not run.",
        },
    }[lang]), [lang]);

    if (loading) return null;

    return (
        <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-h-full">
            <CardHeader floated={false} shadow={false} color="transparent" className="tw-overflow-visible tw-rounded-none">
                <div className="tw-flex tw-items-center tw-justify-between">
                    <div className="tw-flex tw-items-center tw-gap-3">
                        <i className="fa-fw fa-solid fa-brain tw-text-xl tw-text-gray-800" aria-hidden="true" />
                        <div>
                            <Typography variant="h6" className="tw-leading-none tw-text-gray-900">
                                {t.artificialIntelligence}
                            </Typography>
                            <Typography className="!tw-text-xs !tw-font-normal !tw-text-blue-gray-500">
                                {isActive ? t.enabled : t.disabled}
                            </Typography>
                        </div>
                    </div>

                    {/* Admin: toggle ได้ | Owner: badge อ่านอย่างเดียว */}
                    {isAdmin ? (
                        <div className="tw-flex tw-items-center tw-gap-2">
                            <Typography className="tw-text-sm tw-text-blue-gray-600">
                                {isActive ? t.active : t.inactive}
                            </Typography>
                            <Switch
                                checked={isActive}
                                onChange={() => setIsActive(v => !v)}
                            />
                        </div>
                    ) : (
                        <span className={`tw-px-3 tw-py-1 tw-rounded-full tw-text-xs tw-font-semibold ${
                            isActive
                                ? "tw-bg-green-50 tw-text-green-700 tw-ring-1 tw-ring-green-200"
                                : "tw-bg-gray-100 tw-text-gray-500 tw-ring-1 tw-ring-gray-200"
                        }`}>
                            {isActive ? t.active : t.inactive}
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardBody className="tw-flex tw-flex-col tw-p-6">
                <Typography color="blue-gray">
                    {isActive ? t.activeContent : t.inactiveContent}
                </Typography>
            </CardBody>
        </Card>
    );
};

export default AICard;