"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
    Card,
    CardHeader,
    CardBody,
    Typography,
    Switch,
} from "@material-tailwind/react";

import {
    AdjustmentsHorizontalIcon,
    ChatBubbleLeftEllipsisIcon,
} from "@heroicons/react/24/solid";

type Lang = "th" | "en";

const CBMCard = () => {
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
                conditionBasedMaintenance: "การบำรุงรักษาตามสภาพ",
                conditionBase: "ตามสภาพ",
                conditionBaseDesc: "ตรวจสอบและบำรุงรักษาตามสภาพการใช้งานจริง",
                askExpert: "ถามผู้เชี่ยวชาญ",
                askExpertDesc: "สอบถามผู้เชี่ยวชาญเกี่ยวกับปัญหาการบำรุงรักษา",
                active: "เปิด",
                inactive: "ปิด",
            },
            en: {
                conditionBasedMaintenance: "Condition-Based Maintenance",
                conditionBase: "Condition-Base",
                conditionBaseDesc: "Monitor and maintain based on actual operating conditions",
                askExpert: "Ask expert",
                askExpertDesc: "Consult experts about maintenance issues",
                active: "Active",
                inactive: "Inactive",
            },
        };
        return translations[lang];
    }, [lang]);

    // Events card data with translations
    const EVENTS_CARD_DATA = useMemo(() => [
        {
            icon: AdjustmentsHorizontalIcon,
            titleKey: "conditionBase",
            descKey: "conditionBaseDesc",
        },
        {
            icon: ChatBubbleLeftEllipsisIcon,
            titleKey: "askExpert",
            descKey: "askExpertDesc",
        },
    ], []);

    const [activeStates, setActiveStates] = useState<{ [key: string]: boolean }>(
        EVENTS_CARD_DATA.reduce<{ [key: string]: boolean }>((acc, { titleKey }) => {
            acc[titleKey] = false;
            return acc;
        }, {})
    );

    const handleToggle = (titleKey: string) => {
        setActiveStates((prevStates) => ({
            ...prevStates,
            [titleKey]: !prevStates[titleKey],
        }));
    };

    return (
        <div className="tw-col-span-1 tw-my-5">
            <Card className="tw-border tw-border-blue-gray-100 tw-shadow-lg">
                <CardHeader floated={false} shadow={false} color="transparent">
                    <Typography className="!tw-font-bold tw-text-lg tw-my-4" color="blue-gray">
                        {t.conditionBasedMaintenance}
                    </Typography>
                </CardHeader>
                <CardBody className="!tw-p-0">
                    <div className="tw-flex tw-flex-col">
                        {EVENTS_CARD_DATA.map(({ icon, titleKey, descKey }) => (
                            <div
                                key={titleKey}
                                className="tw-px-4 tw-py-3 tw-border tw-border-gray-200"
                            >
                                {/* Row 1: Icon + Title + Switch */}
                                <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                                    <div className="tw-flex tw-items-center tw-gap-3 tw-min-w-0">
                                        <div className="tw-rounded-lg tw-bg-gradient-to-tr tw-from-gray-900 tw-to-gray-800 tw-p-3 sm:tw-p-4 tw-shadow tw-flex-shrink-0">
                                            {React.createElement(icon, {
                                                className: "tw-h-5 tw-w-5 sm:tw-h-6 sm:tw-w-6 tw-text-white",
                                            })}
                                        </div>
                                        <Typography
                                            variant="small"
                                            className="!tw-font-semibold tw-text-gray-800 tw-text-sm"
                                        >
                                            {t[titleKey as keyof typeof t]}
                                        </Typography>
                                    </div>

                                    {/* Status + Switch - always on the right */}
                                    <div className="tw-flex tw-items-center tw-gap-2 tw-flex-shrink-0">
                                        <Typography variant="small" className="tw-text-xs sm:tw-text-sm tw-text-blue-gray-600 tw-whitespace-nowrap">
                                            {activeStates[titleKey] ? t.active : t.inactive}
                                        </Typography>
                                        <Switch
                                            checked={activeStates[titleKey]}
                                            onChange={() => handleToggle(titleKey)}
                                        />
                                    </div>
                                </div>

                                {/* Row 2: Description (below icon) */}
                                <div className="tw-mt-2 tw-ml-12 sm:tw-ml-16">
                                    <Typography
                                        variant="small"
                                        className="!tw-font-normal tw-text-blue-gray-600 tw-text-xs sm:tw-text-sm tw-leading-tight"
                                    >
                                        {t[descKey as keyof typeof t]}
                                    </Typography>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardBody>
            </Card>
        </div>
    );
};

export default CBMCard;