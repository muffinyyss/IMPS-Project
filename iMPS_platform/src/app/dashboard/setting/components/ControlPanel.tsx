// // "use client";
// // import React, { useState } from "react";
// // import Card from "./chargerSetting-card";
// // import {
// //     PlayIcon,
// //     StopIcon,
// //     BoltIcon,
// // } from "@heroicons/react/24/solid";

// // function LimitRow({
// //     label,
// //     unit,
// //     value,
// //     onChange,
// // }: {
// //     label: string;
// //     unit: string;
// //     value: number;
// //     onChange: (v: number) => void;
// // }) {
// //     return (
// //         <div>
// //             <div className="tw-flex tw-items-end tw-justify-between tw-mb-2">
// //                 <span className="tw-text-sm tw-text-blue-gray-700">{label}</span>
// //                 <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-900">
// //                     {value} {unit}
// //                 </span>
// //             </div>
// //             <input
// //                 type="range"
// //                 min={0}
// //                 max={200}
// //                 step={1}
// //                 value={value}
// //                 onChange={(e) => onChange(Number(e.target.value))}
// //                 className="tw-w-full tw-accent-emerald-600"
// //             />
// //         </div>
// //     );
// // }

// // function HeadActions({
// //     title,
// //     status = "Ready",
// //     onStart,
// //     onStop,
// //     startLabel = "Start",
// //     stopLabel = "Stop",
// // }: {
// //     title: string;
// //     status?: string;
// //     onStart?: () => void;
// //     onStop?: () => void;
// //     startLabel?: string;
// //     stopLabel?: string;
// // }) {
// //     return (
// //         <div className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-blue-gray-50/40 tw-p-3">
// //             <div className="tw-flex tw-items-center tw-gap-3">
// //                 <div className="tw-grid tw-place-items-center tw-w-9 tw-h-9 tw-rounded-full tw-bg-emerald-100">
// //                     <BoltIcon className="tw-w-5 tw-h-5 tw-text-emerald-600" />
// //                 </div>
// //                 <div>
// //                     <div className="tw-font-semibold tw-text-blue-gray-900">{title}</div>
// //                     <div className="tw-text-xs tw-text-blue-gray-500">{status}</div>
// //                 </div>
// //             </div>
// //             <div className="tw-flex tw-gap-2">
// //                 <button
// //                     onClick={onStart}
// //                     className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-bg-emerald-500 hover:tw-bg-emerald-600 tw-text-white tw-font-medium tw-px-4 tw-h-9"
// //                 >
// //                     <PlayIcon className="tw-w-4 tw-h-4" />
// //                     {startLabel}
// //                 </button>
// //                 <button
// //                     onClick={onStop}
// //                     className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-border tw-border-red-300 tw-text-red-600 hover:tw-bg-red-50 tw-font-medium tw-px-4 tw-h-9"
// //                 >
// //                     <StopIcon className="tw-w-4 tw-h-4" />
// //                     {stopLabel}
// //                 </button>
// //             </div>
// //         </div>
// //     );
// // }

// // export default function ControlPanel() {
// //     const [maxCurrent, setMaxCurrent] = useState(120);
// //     const [maxPower, setMaxPower] = useState(90);

// //     return (
// //         <Card title="Control">
// //             <div className="tw-space-y-6">
// //                 {/* Dynamic limits */}
// //                 <div className="tw-space-y-5">
// //                     <LimitRow label="Dynamic Max Current" unit="A" value={maxCurrent} onChange={setMaxCurrent} />
// //                     <LimitRow label="Dynamic Max Power" unit="kW" value={maxPower} onChange={setMaxPower} />
// //                     <p className="tw-text-xs tw-text-blue-gray-500">
// //                         * ค่าที่กำหนดนี้เป็นเพดานแบบไดนามิก ระบบจะไม่จ่ายเกินค่านี้
// //                     </p>
// //                 </div>

// //                 {/* Actions per head */}
// //                 <div className="tw-space-y-3">
// //                     <HeadActions
// //                         title="Charger Head 1"
// //                         status="Ready"
// //                         startLabel="Start Charge"
// //                         stopLabel="Stop"
// //                         onStart={() => console.log("start head 1")}
// //                         onStop={() => console.log("stop head 1")}
// //                     />
// //                     <HeadActions
// //                         title="Charger Head 2"
// //                         status="Ready"
// //                         startLabel="Start Charge"
// //                         stopLabel="Stop"
// //                         onStart={() => console.log("start head 2")}
// //                         onStop={() => console.log("stop head 2")}
// //                     />
// //                 </div>
// //             </div>
// //         </Card>
// //     );
// // }


// "use client";
// import React, { useState } from "react";
// import Card from "./chargerSetting-card";
// import { BoltIcon } from "@heroicons/react/24/solid";

// /* ---------- Slider (เหมือนเดิมแต่จัด spacing นิดหน่อย) ---------- */
// function LimitRow({
//     label,
//     unit,
//     value,
//     onChange,
// }: {
//     label: string;
//     unit: string;
//     value: number;
//     onChange: (v: number) => void;
// }) {
//     return (
//         <div className="tw-space-y-2">
//             <div className="tw-flex tw-items-end tw-justify-between">
//                 <span className="tw-text-sm tw-text-blue-gray-700">{label}</span>
//                 <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-900">
//                     {value} {unit}
//                 </span>
//             </div>
//             <input
//                 type="range"
//                 min={0}
//                 max={200}
//                 step={1}
//                 value={value}
//                 onChange={(e) => onChange(Number(e.target.value))}
//                 className="tw-w-full tw-accent-emerald-600 tw-appearance-none tw-h-2 tw-rounded-full tw-bg-blue-gray-100"
//             />
//         </div>
//     );
// }

// /* --------------------------- Toggle Switch --------------------------- */
// function PowerToggle({
//     checked,
//     onChange,
// }: {
//     checked: boolean;
//     onChange: (v: boolean) => void;
// }) {
//     return (
//         <label className="tw-inline-flex tw-items-center tw-gap-2 tw-select-none">
//             <span
//                 className={`tw-text-sm tw-font-medium ${checked ? "tw-text-emerald-600" : "tw-text-blue-gray-500"
//                     }`}
//             >
//                 {checked ? "On" : "Off"}
//             </span>
//             <button
//                 type="button"
//                 role="switch"
//                 aria-checked={checked}
//                 onClick={() => onChange(!checked)}
//                 className={`
//           tw-relative tw-h-7 tw-w-12 tw-rounded-full tw-transition-colors
//           ${checked ? "tw-bg-emerald-500" : "tw-bg-blue-gray-200"}
//           focus:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-emerald-300
//         `}
//             >
//                 <span
//                     className={`
//             tw-absolute tw-top-0.5 tw-left-0.5 tw-h-6 tw-w-6
//             tw-rounded-full tw-bg-white tw-shadow tw-ring-1 tw-ring-black/10
//             tw-transition-transform ${checked ? "tw-translate-x-5" : "tw-translate-x-0"}
//           `}
//                 />
//             </button>
//         </label>
//     );
// }

// /* ------------------------ Card ของหัวชาร์จ ------------------------- */
// function HeadRow({
//     title,
//     isOn,
//     onToggle,
// }: {
//     title: string;
//     isOn: boolean;
//     onToggle: (v: boolean) => void;
// }) {
//     return (
//         <div
//             className="
//         tw-flex tw-items-center tw-justify-between tw-gap-4
//         tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-bg-white
//         tw-shadow-sm hover:tw-shadow-md tw-transition tw-px-4 tw-py-3
//       "
//         >
//             <div className="tw-flex tw-items-center tw-gap-3">
//                 <div className="tw-grid tw-place-items-center tw-w-10 tw-h-10 tw-rounded-xl tw-bg-blue-gray-50 tw-ring-1 tw-ring-blue-gray-100">
//                     <BoltIcon className={`tw-w-5 tw-h-5 ${isOn ? "tw-text-emerald-600" : "tw-text-blue-gray-400"}`} />
//                 </div>
//                 <div>
//                     <div className="tw-font-semibold tw-text-blue-gray-900">{title}</div>
//                     <div className="tw-flex tw-items-center tw-gap-2">
//                         <span
//                             className={`tw-inline-block tw-w-2 tw-h-2 tw-rounded-full ${isOn ? "tw-bg-emerald-500" : "tw-bg-blue-gray-300"
//                                 }`}
//                         />
//                         <span className="tw-text-xs tw-text-blue-gray-500">
//                             {isOn ? "Ready / Enabled" : "Standby / Disabled"}
//                         </span>
//                     </div>
//                 </div>
//             </div>

//             <PowerToggle checked={isOn} onChange={onToggle} />
//         </div>
//     );
// }

// /* ------------------------------ Main ------------------------------- */
// export default function ControlPanel() {
//     const [maxCurrent, setMaxCurrent] = useState(66);
//     const [maxPower, setMaxPower] = useState(136);
//     const [head1On, setHead1On] = useState(false);
//     const [head2On, setHead2On] = useState(false);

//     return (
//         <Card title="Control">
//             <div className="tw-space-y-8">
//                 {/* Dynamic limits */}
//                 <div className="tw-space-y-6">
//                     <LimitRow label="Dynamic Max Current" unit="A" value={maxCurrent} onChange={setMaxCurrent} />
//                     <LimitRow label="Dynamic Max Power" unit="kW" value={maxPower} onChange={setMaxPower} />
//                     <p className="tw-text-xs tw-text-blue-gray-500">
//                         * ค่าที่กำหนดนี้เป็นเพดานแบบไดนามิก ระบบจะไม่จ่ายเกินค่านี้
//                     </p>
//                 </div>

//                 {/* Heads: ใช้สวิตช์ On/Off แทนปุ่ม Start/Stop */}
//                 <div className="tw-space-y-4">
//                     <HeadRow title="Charger Head 1" isOn={head1On} onToggle={setHead1On} />
//                     <HeadRow title="Charger Head 2" isOn={head2On} onToggle={setHead2On} />
//                 </div>
//             </div>
//         </Card>
//     );
// }


"use client";
import React, { useState } from "react";
import Card from "./chargerSetting-card";
import { BoltIcon } from "@heroicons/react/24/solid";

/* ---------- Slider (เหมือนเดิม) ---------- */
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
    <div className="tw-space-y-2">
      <div className="tw-flex tw-items-end tw-justify-between">
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
        className="tw-w-full tw-accent-emerald-600 tw-appearance-none tw-h-2 tw-rounded-full tw-bg-blue-gray-100"
      />
    </div>
  );
}

/* --------------------------- Toggle Switch (ON=เขียว / OFF=แดง) --------------------------- */
function PowerToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="tw-inline-flex tw-items-center tw-gap-2 tw-select-none">
      <span
        className={`tw-text-sm tw-font-medium ${
          checked ? "tw-text-emerald-600" : "tw-text-red-600"
        }`}
      >
        {checked ? "On" : "Off"}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          tw-relative tw-h-7 tw-w-12 tw-rounded-full tw-transition-colors
          ${checked ? "tw-bg-emerald-500" : "tw-bg-red-500"}
          focus:tw-outline-none
          ${checked ? "focus-visible:tw-ring-2 focus-visible:tw-ring-emerald-300"
                    : "focus-visible:tw-ring-2 focus-visible:tw-ring-red-300"}
        `}
      >
        <span
          className={`
            tw-absolute tw-top-0.5 tw-left-0.5 tw-h-6 tw-w-6
            tw-rounded-full tw-bg-white tw-shadow tw-ring-1 tw-ring-black/10
            tw-transition-transform ${checked ? "tw-translate-x-5" : "tw-translate-x-0"}
          `}
        />
      </button>
    </label>
  );
}

/* ------------------------ การ์ดหัวชาร์จ ------------------------- */
function HeadRow({
  title,
  isOn,
  onToggle,
}: {
  title: string;
  isOn: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div
      className="
        tw-flex tw-items-center tw-justify-between tw-gap-4
        tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-bg-white
        tw-shadow-sm hover:tw-shadow-md tw-transition tw-px-4 tw-py-3
      "
    >
      <div className="tw-flex tw-items-center tw-gap-3">
        <div className="tw-grid tw-place-items-center tw-w-10 tw-h-10 tw-rounded-xl tw-bg-blue-gray-50 tw-ring-1 tw-ring-blue-gray-100">
          <BoltIcon className={`tw-w-5 tw-h-5 ${isOn ? "tw-text-emerald-600" : "tw-text-red-500"}`} />
        </div>
        <div>
          <div className="tw-font-semibold tw-text-blue-gray-900">{title}</div>
          <div className="tw-flex tw-items-center tw-gap-2">
            <span className={`tw-inline-block tw-w-2 tw-h-2 tw-rounded-full ${isOn ? "tw-bg-emerald-500" : "tw-bg-red-500"}`} />
            <span className={`tw-text-xs ${isOn ? "tw-text-blue-gray-500" : "tw-text-red-600"}`}>
              {isOn ? "Ready / Enabled" : "Standby / Disabled"}
            </span>
          </div>
        </div>
      </div>

      <PowerToggle checked={isOn} onChange={onToggle} />
    </div>
  );
}

/* ------------------------------ Main ------------------------------- */
export default function ControlPanel() {
  const [maxCurrent, setMaxCurrent] = useState(66);
  const [maxPower, setMaxPower] = useState(136);
  const [head1On, setHead1On] = useState(false);
  const [head2On, setHead2On] = useState(false);

  return (
    <Card title="Control">
      <div className="tw-space-y-8">
        <div className="tw-space-y-6">
          <LimitRow label="Dynamic Max Current" unit="A" value={maxCurrent} onChange={setMaxCurrent} />
          <LimitRow label="Dynamic Max Power" unit="kW" value={maxPower} onChange={setMaxPower} />
          <p className="tw-text-xs tw-text-blue-gray-500">
            * ค่าที่กำหนดนี้เป็นเพดานแบบไดนามิก ระบบจะไม่จ่ายเกินค่านี้
          </p>
        </div>

        <div className="tw-space-y-4">
          <HeadRow title="Charger Head 1" isOn={head1On} onToggle={setHead1On} />
          <HeadRow title="Charger Head 2" isOn={head2On} onToggle={setHead2On} />
        </div>
      </div>
    </Card>
  );
}
