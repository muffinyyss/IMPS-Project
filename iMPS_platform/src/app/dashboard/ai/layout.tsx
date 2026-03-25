"use client";
import React from "react";
import { useRouter, usePathname } from "next/navigation";

function AiSubNav() {
    const router = useRouter();
    const pathname = usePathname();
    const tabs = [
        { label: "📊 Dashboard",       href: "/dashboard/ai" },
        { label: "📡 Station Monitor", href: "/dashboard/ai/monitor" },
        { label: "📈 Health History",  href: "/dashboard/ai/history" },
        { label: "🎯 Heatmap",         href: "/dashboard/ai/heatmap" },
    ];
    return (
        <div className="tw-bg-white tw-border-b tw-border-gray-100 tw-px-4 sm:tw-px-6 tw-flex tw-gap-1 tw-overflow-x-auto tw-sticky tw-top-0 tw-z-30">
            {tabs.map((t) => (
                <button key={t.href} onClick={() => router.push(t.href)}
                    className="tw-px-3 sm:tw-px-6 tw-py-3 tw-text-[10px] sm:tw-text-xs tw-font-semibold tw-uppercase tw-tracking-widest tw-whitespace-nowrap tw-transition-colors tw-bg-transparent tw-border-b-2"
                    style={{
                        borderBottomColor: pathname === t.href ? "#eab308" : "transparent",
                        color: pathname === t.href ? "#111827" : "#6b7280",
                        fontWeight: pathname === t.href ? 700 : 600,
                    }}>{t.label}</button>
            ))}
        </div>
    );
}

export default function AiLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <AiSubNav />
            {children}
        </>
    );
}