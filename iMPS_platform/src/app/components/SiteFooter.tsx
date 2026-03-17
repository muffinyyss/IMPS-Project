"use client";
import React from "react";

const sections = [
    {
        title: "Help",
        links: [
            { label: "Be our partner", href: "#" },
            { label: "Terms of Service", href: "#" },
            { label: "Privacy Policy", href: "#" },
        ],
    },
    {
        title: "Contact",
        links: [
            { label: "Address", href: "#" },
            { label: "Facebook", href: "#" },
            { label: "Phone number", href: "#" },
        ],
    },
    {
        title: "Menu",
        links: [
            { label: "Package", href: "#" },
            { label: "About", href: "#" },
            { label: "Customer", href: "#" },
        ],
    },
    {
        title: "Ourservice",
        links: [
            { label: "EV Charge", href: "#" },
            { label: "IMPS", href: "#" },
        ],
    },
];

export default function SiteFooter() {
    const [openIndex, setOpenIndex] = React.useState<number | null>(null);

    const toggle = (i: number) => {
        setOpenIndex((prev) => (prev === i ? null : i));
    };

    return (
        <footer className="tw-border-t tw-border-gray-200 tw-bg-gray-50">
            <div className="tw-mx-auto tw-max-w-7xl tw-px-4 sm:tw-px-6 lg:tw-px-8 tw-pt-12 tw-pb-8 sm:tw-pt-16 sm:tw-pb-12">
                {/* Mobile: แสดงแบบ Accordion | Desktop: แสดงเป็นคอลัมน์ */}
                <nav aria-label="Footer" className="tw-grid tw-gap-4 sm:tw-gap-8 md:tw-gap-10 tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-4">
                    {sections.map((sec, i) => (
                        <div key={sec.title} className="tw-w-full">
                            {/* Header (Mobile: ปุ่มกดเปิด/ปิด, Desktop: หัวเรื่องปกติ) */}
                            <button
                                type="button"
                                onClick={() => toggle(i)}
                                className="tw-flex tw-w-full tw-items-center tw-justify-between tw-py-3 tw-text-left md:tw-hidden tw-text-base tw-font-semibold tw-text-gray-900"
                                aria-expanded={openIndex === i}
                                aria-controls={`footer-section-${i}`}
                            >
                                {sec.title}
                                <svg
                                    className={`tw-h-5 tw-w-5 tw-transition-transform ${openIndex === i ? "tw-rotate-180" : ""}`}
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden="true"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>

                            {/* Desktop header */}
                            <h3 className="tw-hidden md:tw-block tw-text-base tw-font-semibold tw-text-gray-900 tw-mb-4">
                                {sec.title}
                            </h3>

                            {/* รายการลิงก์ (Mobile: accordion content, Desktop: แสดงตลอด) */}
                            <div
                                id={`footer-section-${i}`}
                                className={`md:tw-block ${openIndex === i ? "tw-block" : "tw-hidden"}`}
                            >
                                <ul className="tw-list-none tw-space-y-2 tw-text-sm tw-text-gray-700">
                                    {sec.links.map((link) => (
                                        <li key={link.label}>
                                            <a
                                                href={link.href}
                                                className="tw-inline-block tw-transition tw-hover:tw-text-gray-900 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-gray-900 focus:tw-ring-offset-2 focus:tw-ring-offset-gray-50"
                                            >
                                                {link.label}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </nav>

                {/* เส้นคั่น + bottom bar */}
                <div className="tw-mt-10 tw-border-t tw-border-gray-200 tw-pt-6 tw-flex tw-flex-col sm:tw-flex-row tw-items-start sm:tw-items-center tw-justify-between tw-gap-4">
                    <p className="tw-text-xs tw-text-gray-500">
                        © {new Date().getFullYear()} Your Company. All rights reserved.
                    </p>

                    <ul className="tw-flex tw-flex-wrap tw-gap-x-6 tw-gap-y-2 tw-text-sm tw-text-gray-600">
                        <li>
                            <a href="#" className="tw-hover:tw-text-gray-900">Privacy</a>
                        </li>
                        <li>
                            <a href="#" className="tw-hover:tw-text-gray-900">Terms</a>
                        </li>
                        <li>
                            <a href="#" className="tw-hover:tw-text-gray-900">Sitemap</a>
                        </li>
                    </ul>
                </div>
            </div>
        </footer>
    );
}
