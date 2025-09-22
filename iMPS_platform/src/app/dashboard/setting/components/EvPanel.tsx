"use client";
import React from "react";
import Card from "./chargerSetting-card";
import CircleProgress from "./CircleProgress";


function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-py-2">
            <span className="tw-text-sm tw-text-blue-gray-700">{label}</span>
            <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-900 tw-text-right">
                {value}
            </span>
        </div>
    );
}

// function SoCCircle({ label }: { label: string }) {
//     return (
//         <div className="tw-flex tw-flex-col tw-items-center tw-gap-2">
//             <div className="tw-text-sm tw-text-blue-gray-600">{label}</div>
//             <div className="tw-relative tw-w-24 tw-h-24">
//                 <div className="tw-absolute tw-inset-0 tw-rounded-full tw-bg-gradient-to-b tw-from-blue-gray-50 tw-to-white tw-shadow-inner" />
//                 <div className="tw-absolute tw-inset-0 tw-rounded-full tw-ring-4 tw-ring-blue-gray-100" />
//                 <div className="tw-absolute tw-inset-2 tw-rounded-full tw-grid tw-place-items-center tw-ring-4 tw-ring-blue-gray-200">
//                     <span className="tw-text-base tw-font-semibold tw-text-blue-gray-900">0%</span>
//                 </div>
//             </div>
//         </div>
//     );
// }

export default function EvPanel() {
    return (
        <Card title="EV" className="tw-h-full">
            <div className="tw-divide-y tw-divide-blue-gray-50">
                <Row label="CP State1" value="A" />
                <Row label="CP State2" value="A" />
                <Row label="Target Voltage (V)" value="0.00" />
                <Row label="Target Voltage (V)" value="0.00" />
                <Row label="Target Current (A)" value="0.00" />
                <Row label="Target Current (A)" value="0.00" />
            </div>

            <div className="tw-flex tw-flex-col tw-items-center tw-gap-6 tw-pt-6">
                <CircleProgress label="SoC1 :" value={43} />
                <CircleProgress label="SoC2 :" value={78} />
            </div>
        </Card>
    );
}
