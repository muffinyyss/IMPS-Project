// "use client";

// import React, { useMemo } from "react";
// import { Typography } from "@material-tailwind/react";

// type Device = {
//   id: string;
//   name: "EdgeBox" | "Raspberry Pi" | "Router" | string;
//   temp: number;     // °C
//   target?: number;  // เกณฑ์ < อุณหภูมิ
//   imgSrc?: string;  // ➜ รูปภาพของอุปกรณ์ (ถ้าไม่ส่ง จะโชว์ไอคอนแทน)
// };

// type Props = {
//   title?: string;
//   updatedAt?: string;
//   devices: Device[];
// };

// /* ---------- utils ---------- */
// function statusColor(temp: number) {
//   if (temp > 65)
//     return { ring: "tw-text-red-500", badge: "tw-bg-red-50 tw-text-red-700 tw-ring-1 tw-ring-red-100", label: "Hot" };
//   if (temp >= 45)
//     return { ring: "tw-text-amber-500", badge: "tw-bg-amber-50 tw-text-amber-700 tw-ring-1 tw-ring-amber-100", label: "Warm" };
//   return { ring: "tw-text-green-500", badge: "tw-bg-green-50 tw-text-green-700 tw-ring-1 tw-ring-green-100", label: "Normal" };
// }

// // const Icon = ({ name }: { name: string }) => {
// //   const n = name.toLowerCase();
// //   if (n.includes("edge")) return <i className="fa-solid fa-square-terminal" />;
// //   if (n.includes("pi")) return <i className="fa-brands fa-raspberry-pi" />;
// //   if (n.includes("router")) return <i className="fa-solid fa-wifi" />;
// //   return <i className="fa-solid fa-microchip" />;
// // };

// const Icon = ({ name }: { name: string }) => {
//   const n = name.toLowerCase();

//   let imgSrc = "/images/default-device.png"; // 🔹 รูป default

//   if (n.includes("edge")) imgSrc = "/images/edgebox.png";
//   else if (n.includes("pi")) imgSrc = "/images/raspberry.png";
//   else if (n.includes("router")) imgSrc = "/images/router.png";

//   return (
//     <img
//       src={imgSrc}
//       alt={name}
//       className="tw-w-16 tw-h-16 md:tw-w-20 md:tw-h-20 tw-object-contain"
//     />
//   );
// };


// /* ---------- mini card ---------- */
// function DeviceTile({
//   name,
//   temp,
//   target = 60,
//   imgSrc,
// }: {
//   name: string;
//   temp: number;
//   target?: number;
//   imgSrc?: string;
// }) {
//   const tone = statusColor(temp);

//   return (
//     <div
//       className="tw-flex tw-flex-col tw-items-stretch tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-px-4 tw-pt-3 tw-pb-4 tw-shadow-sm hover:tw-shadow transition-shadow"
//       aria-label={`${name} temperature card`}
//     >
//       {/* header */}
//       <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
//         <div className="tw-flex tw-items-center tw-gap-2 min-w-0">
//           <span className="tw-font-medium tw-text-blue-gray-800 tw-truncate tw-mb-3" title={name}>
//             {name}
//           </span>
//         </div>
//       </div>

//       {/* image (แทนวงกลม) */}
//       <div className="tw-flex tw-justify-center tw-my-2 tw-mb-3">
//         <div className="tw-w-28 tw-h-28 md:tw-w-32 md:tw-h-32 tw-rounded-xl tw-bg-blue-gray-50 tw-border tw-border-blue-gray-100 tw-overflow-hidden tw-grid tw-place-items-center">
//           {imgSrc ? (
//             <img src={imgSrc} alt={name} className="tw-w-full tw-h-full tw-object-contain" />
//           ) : (
//             <span className="tw-text-blue-gray-500 tw-text-4xl">
//               <Icon name={name} />
//             </span>
//           )}
//         </div>
//       </div>

//       {/* footer */}
//       <div className="tw-mt-2 tw-flex tw-flex-col tw-items-center">
//         <span className={`tw-text-[11px] tw-mb-3 tw-rounded-full tw-px-2 tw-py-[2px] ${tone.badge}`}>
//           {tone.label}
//         </span>
//         <div className="tw-text-2xl tw-font-semibold tw-text-blue-gray-900">
//           {temp}°C
//         </div>
//         <div className="tw-text-xs tw-text-blue-gray-500">
//           Target &lt; {target}°C
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ---------- main (no outer Card) ---------- */
// export default function DeviceTempsStrip({
//   title = "Edge/PI/Router Temperatures",
//   updatedAt,
//   devices,
// }: Props) {
//   const list = useMemo(() => devices.slice(0, 3), [devices]);

//   return (
//     <section className="tw-w-full">
//       {/* grid mini-cards */}
//       <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4">
//         {list.map((d) => (
//           <DeviceTile
//             key={d.id}
//             name={d.name}
//             temp={d.temp}
//             target={d.target ?? (d.name.toLowerCase().includes("router") ? 70 : 60)}
//             imgSrc={d.imgSrc}
//           />
//         ))}
//       </div>
//     </section>
//   );
// }



"use client";

import React, { useMemo } from "react";
import { Typography } from "@material-tailwind/react";

type Device = {
  id: string;
  name: "EdgeBox" | "Raspberry Pi" | "Router" | string;
  temp: number;     // °C
  target?: number;  // เกณฑ์ < อุณหภูมิ
  imgSrc?: string;  // ถ้ามีจะใช้รูปนี้แทน
};

/* ---------- utils ---------- */
function statusColor(temp: number) {
  if (temp > 65)
    return { ring: "tw-text-red-500", badge: "tw-bg-red-50 tw-text-red-700 tw-ring-1 tw-ring-red-100", label: "Hot" };
  if (temp >= 45)
    return { ring: "tw-text-amber-500", badge: "tw-bg-amber-50 tw-text-amber-700 tw-ring-1 tw-ring-amber-100", label: "Warm" };
  return { ring: "tw-text-green-500", badge: "tw-bg-green-50 tw-text-green-700 tw-ring-1 tw-ring-green-100", label: "Normal" };
}

/* ---------- mini card ---------- */
function DeviceTile({
  name,
  temp,
  target = 60,
  imgSrc,
}: {
  name: string;
  temp: number;
  target?: number;
  imgSrc?: string;
}) {
  const tone = statusColor(temp);

  // เลือกรูปภาพอัตโนมัติ (ถ้าไม่ส่ง imgSrc มา)
  const n = name.toLowerCase();
  let defaultImg = "/img/default-device.png";
  if (n.includes("edge")) defaultImg = "/img/edgebox.jpg";
  else if (n.includes("pi")) defaultImg = "/img/pi5.png";
  else if (n.includes("router")) defaultImg = "/img/router.png";

  const finalImg = imgSrc || defaultImg;

  return (
    <div
      className="tw-flex tw-flex-col tw-items-stretch tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-px-4 tw-pt-3 tw-pb-4 tw-shadow-sm hover:tw-shadow transition-shadow"
      aria-label={`${name} temperature card`}
    >
      {/* header */}
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
        <div className="tw-flex tw-items-center tw-gap-2 min-w-0">
          <span className="tw-font-medium tw-text-blue-gray-800 tw-truncate" title={name}>
            {name}
          </span>
        </div>
      </div>

      {/* image */}
      <div className="tw-flex tw-justify-center">
        <div className="tw-w-30 tw-h-30 md:tw-w-44 md:tw-h-44 tw-rounded-xl tw-overflow-hidden tw-grid tw-place-items-center">
          <img
            src={finalImg}
            alt={name}
            className="tw-w-full tw-h-full tw-object-contain tw-object-center"
          />
        </div>
      </div>


      {/* footer */}
      <div className="tw-flex tw-flex-col tw-items-center">
        <span className={`tw-text-[11px] tw-mb-3 tw-rounded-full tw-px-2 tw-py-[2px] ${tone.badge}`}>
          {tone.label}
        </span>
        <div className="tw-text-2xl tw-font-semibold tw-text-blue-gray-900">
          {temp}°C
        </div>
        <div className="tw-text-xs tw-text-blue-gray-500">
          Target &lt; {target}°C
        </div>
      </div>
    </div>
  );
}

/* ---------- main ---------- */
export default function DeviceTempsStrip({
  title = "Edge/PI/Router Temperatures",
  updatedAt,
  devices,
}: {
  title?: string;
  updatedAt?: string;
  devices: Device[];
}) {
  const list = useMemo(() => devices.slice(0, 3), [devices]);

  return (
    <section className="tw-w-full">
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4">
        {list.map((d) => (
          <DeviceTile
            key={d.id}
            name={d.name}
            temp={d.temp}
            target={d.target ?? (d.name.toLowerCase().includes("router") ? 70 : 60)}
            imgSrc={d.imgSrc}
          />
        ))}
      </div>
    </section>
  );
}
