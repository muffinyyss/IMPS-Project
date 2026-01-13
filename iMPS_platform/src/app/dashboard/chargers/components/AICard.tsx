"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardBody, Typography, Switch } from "@material-tailwind/react";

type Lang = "th" | "en";

const AICard = () => {
    const [isActive, setIsActive] = useState(false);

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
                artificialIntelligence: "ปัญญาประดิษฐ์",
                enabled: "เปิดใช้งาน",
                disabled: "ปิดใช้งาน",
                active: "เปิด",
                inactive: "ปิด",
                activeContent: "ข้อมูลเกี่ยวกับปัญญาประดิษฐ์จะแสดงที่นี่ สามารถเพิ่มรายละเอียดเพิ่มเติมได้ในภายหลัง",
                inactiveContent: "ส่วนนี้ยังไม่ได้เปิดใช้งาน สามารถเพิ่มเนื้อหาได้ในภายหลัง",
            },
            en: {
                artificialIntelligence: "Artificial Intelligence",
                enabled: "Enabled",
                disabled: "Disabled",
                active: "Active",
                inactive: "Inactive",
                activeContent: "Information about artificial intelligence will go here. You can add more details later.",
                inactiveContent: "This section is currently inactive. You can add content here later.",
            },
        };
        return translations[lang];
    }, [lang]);

    const handleToggle = () => setIsActive(!isActive);

    return (
        <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-h-full">
            <CardHeader floated={false} shadow={false} color="transparent" className="tw-overflow-visible tw-rounded-none">
                <div className="tw-flex tw-items-center tw-justify-between">
                    <div className="tw-flex tw-items-center tw-gap-3">
                        <i
                            className="fa-fw fa-solid fa-brain tw-text-xl tw-text-gray-800"
                            aria-hidden="true"
                        />
                        <div>
                            <Typography
                                variant="h6"
                                className="tw-leading-none tw-transition-colors tw-text-gray-900"
                            >
                                {t.artificialIntelligence}
                            </Typography>
                            <Typography className="!tw-text-xs !tw-font-normal tw-transition-colors !tw-text-blue-gray-500">
                                {isActive ? t.enabled : t.disabled}
                            </Typography>
                        </div>
                    </div>
                    <div className="tw-flex tw-items-center tw-gap-2">
                        <Typography className="tw-text-sm tw-text-blue-gray-600">
                            {isActive ? t.active : t.inactive}
                        </Typography>
                        <Switch checked={isActive} onChange={handleToggle} />
                    </div>
                </div>
            </CardHeader>
            <CardBody className="tw-flex tw-flex-col tw-p-6">
                {isActive ? (
                    <Typography color="blue-gray">
                        {t.activeContent}
                    </Typography>
                ) : (
                    <Typography color="blue-gray">
                        {t.inactiveContent}
                    </Typography>
                )}
            </CardBody>
        </Card>
    );
};

export default AICard;