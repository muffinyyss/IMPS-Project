"use client";
import React, { useState } from "react";
import Card from "./chargerSetting-card";
import {
    PlayIcon,
    StopIcon,
    BoltIcon,
} from "@heroicons/react/24/solid";

function LimitRow({
    label,
    unit,
    value,
    onChange,
}: {
    label: string;
    unit: string;
    value: number;
    onChange: (v: number) => void;
}) {
    return (
        <div>
            <div className="tw-flex tw-items-end tw-justify-between tw-mb-2">
                <span className="tw-text-sm tw-text-blue-gray-700">{label}</span>
                <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-900">
                    {value} {unit}
                </span>
            </div>
            <input
                type="range"
                min={0}
                max={200}
                step={1}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="tw-w-full tw-accent-emerald-600"
            />
        </div>
    );
}

function HeadActions({
    title,
    status = "Ready",
    onStart,
    onStop,
    startLabel = "Start",
    stopLabel = "Stop",
}: {
    title: string;
    status?: string;
    onStart?: () => void;
    onStop?: () => void;
    startLabel?: string;
    stopLabel?: string;
}) {
    return (
        <div className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-blue-gray-50/40 tw-p-3">
            <div className="tw-flex tw-items-center tw-gap-3">
                <div className="tw-grid tw-place-items-center tw-w-9 tw-h-9 tw-rounded-full tw-bg-emerald-100">
                    <BoltIcon className="tw-w-5 tw-h-5 tw-text-emerald-600" />
                </div>
                <div>
                    <div className="tw-font-semibold tw-text-blue-gray-900">{title}</div>
                    <div className="tw-text-xs tw-text-blue-gray-500">{status}</div>
                </div>
            </div>
            <div className="tw-flex tw-gap-2">
                <button
                    onClick={onStart}
                    className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-bg-emerald-500 hover:tw-bg-emerald-600 tw-text-white tw-font-medium tw-px-4 tw-h-9"
                >
                    <PlayIcon className="tw-w-4 tw-h-4" />
                    {startLabel}
                </button>
                <button
                    onClick={onStop}
                    className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-border tw-border-red-300 tw-text-red-600 hover:tw-bg-red-50 tw-font-medium tw-px-4 tw-h-9"
                >
                    <StopIcon className="tw-w-4 tw-h-4" />
                    {stopLabel}
                </button>
            </div>
        </div>
    );
}

export default function ControlPanel() {
    const [maxCurrent, setMaxCurrent] = useState(120);
    const [maxPower, setMaxPower] = useState(90);

    return (
        <Card title="Control">
            <div className="tw-space-y-6">
                {/* Dynamic limits */}
                <div className="tw-space-y-5">
                    <LimitRow label="Dynamic Max Current" unit="A" value={maxCurrent} onChange={setMaxCurrent} />
                    <LimitRow label="Dynamic Max Power" unit="kW" value={maxPower} onChange={setMaxPower} />
                    <p className="tw-text-xs tw-text-blue-gray-500">
                        * ค่าที่กำหนดนี้เป็นเพดานแบบไดนามิก ระบบจะไม่จ่ายเกินค่านี้
                    </p>
                </div>

                {/* Actions per head */}
                <div className="tw-space-y-3">
                    <HeadActions
                        title="Charger Head 1"
                        status="Ready"
                        startLabel="Start Charge"
                        stopLabel="Stop"
                        onStart={() => console.log("start head 1")}
                        onStop={() => console.log("stop head 1")}
                    />
                    <HeadActions
                        title="Charger Head 2"
                        status="Ready"
                        startLabel="Start Charge"
                        stopLabel="Stop"
                        onStart={() => console.log("start head 2")}
                        onStop={() => console.log("stop head 2")}
                    />
                </div>
            </div>
        </Card>
    );
}
