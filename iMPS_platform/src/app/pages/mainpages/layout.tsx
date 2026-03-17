"use client";
import React from "react";
import SiteNavbar from "@/app/components/SiteNavbar";
import SiteFooter from "@/app/components/SiteFooter";

export default function MainpagesLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="tw-min-h-screen tw-flex tw-flex-col tw-bg-white">
            <SiteNavbar />
            <main className="tw-flex-1 tw-pt-0">{children}</main>
            <SiteFooter />
        </div>
    );
}
