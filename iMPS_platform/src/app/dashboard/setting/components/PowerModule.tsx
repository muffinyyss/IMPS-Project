"use client";

import React, { useEffect, useMemo, useState } from "react";
import Card from "./chargerSetting-card";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type SettingDoc = {
    _id: string;
    timestamp?: string;
    // ตัวอย่างฟิลด์ที่คาดว่าจะมี (เปลี่ยนตามจริงได้)
    measured_voltage1?: string;      // "A" | "B" | ...
    measured_voltage2?: string;
    max_voltage1?: number;
    max_voltage2?: number;
    measured_current1?: number;
    measured_current2?: number;
    max_current1?: number;
    max_current2?: number;
    energy_power_kWh1?: number;
    energy_power_kWh2?: number;
    max_power1?: number;
    max_power2?: number;
    power_limit1?: number;
    power_limit2?: number;
    power_limit0?: number;
    // ฟิลด์อื่น ๆ จาก backend
    [key: string]: any;
};

function Row({
    label,
    value,
    unit,
    zebra = false,
}: {
    label: string;
    value: string | number | undefined | null;
    unit?: string;
    zebra?: boolean;
}) {
    return (
        <div
            className={`tw-grid tw-grid-cols-2 tw-gap-2 tw-py-2 tw-px-3 ${zebra ? "tw-bg-blue-gray-50/60" : "tw-bg-white"
                }`}
        >
            <span className="tw-text-sm tw-text-blue-gray-700">{label}</span>
            <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-900 tw-text-right tw-tabular-nums">
                {value}{unit && (<span className="tw-ml-2 tw-text-sm tw-font-normal tw-text-blue-gray-400">{unit}</span>)}
            </span>
        </div>
    );
}

export default function EvPanel({ head, data }: { head: 1 | 2; data: any }) {



    // helper format
    const toNum = (v: any): number | null => {
        if (v === null || v === undefined) return null;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : null;
    };
    const fmtNum = (v: any, digits = 2) => {
        const n = toNum(v);
        return n === null ? "-" : n.toFixed(digits);
    };
    const fmtStr = (v: any) => (v ?? "-");

    // 1) ดึง station_id จาก URL → ถ้าไม่มีค่อย fallback localStorage
    // useEffect(() => {
    //     const sidFromUrl = searchParams.get("station_id");
    //     if (sidFromUrl) {
    //         setStationId(sidFromUrl);
    //         localStorage.setItem("selected_station_id", sidFromUrl);
    //         return;
    //     }
    //     const sidLocal = localStorage.getItem("selected_station_id");
    //     setStationId(sidLocal);
    // }, [searchParams]);

    // 2) เปิด SSE ไปที่ /setting
    // useEffect(() => {
    //     if (!stationId) return;
    //     setLoading(true);
    //     setErr(null);

    //     const es = new EventSource(
    //         `${API_BASE}/setting?station_id=${encodeURIComponent(stationId)}`,
    //         { withCredentials: true } // สำคัญสำหรับ cookie-auth
    //     );

    //     const onInit = (e: MessageEvent) => {
    //         try {
    //             setData(JSON.parse(e.data));
    //             setLoading(false);
    //             setErr(null);
    //         } catch {
    //             setErr("ผิดรูปแบบข้อมูล init");
    //             setLoading(false);
    //         }
    //     };

        // es.addEventListener("init", onInit);
    //     es.addEventListener("init", (e: MessageEvent) => {
            // console.log("INIT raw:", e.data);
    //         try {
    //             const obj = JSON.parse(e.data);
                // console.log("INIT parsed:", obj);
    //             setData(obj);
    //             setLoading(false);
    //         } catch { }
    //     });

    //     es.onopen = () => setErr(null);

        // es.onmessage = (e) => {
        //   try {
        //     setData(JSON.parse(e.data));
        //     setErr(null);
        //   } catch {
        //     setErr("ผิดรูปแบบข้อมูล message");
        //   }
        // };

    //     es.onmessage = (e) => {
            // console.log("MSG raw:", e.data);
    //         try {
    //             const obj = JSON.parse(e.data);
                // console.log("MSG parsed:", obj);
    //             setData(obj);
    //         } catch { }
    //     };

    //     es.onerror = () => {
    //         setErr("SSE หลุดการเชื่อมต่อ (กำลังพยายามเชื่อมใหม่อัตโนมัติ)");
    //         setLoading(false);
    //         // ไม่ปิด es เพื่อให้ browser retry ตาม retry: 3000 ที่ server ส่งมา
    //     };

    //     return () => {
    //         es.removeEventListener("init", onInit);
    //         es.close();
    //     };
    // }, [stationId]);

    // ถ้าต้องการแปลง CP code -> ตัวอักษร/คำอธิบาย (ปรับตามโปรโตคอลของคุณ)
    // const mapCP = (code: any) => {
    //     const c = String(code ?? "");
        // ตัวอย่าง mapping: 1=A, 2=B, 3=C, 7=F (ปรับตามจริง)
    //     const table: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D", "5": "E", "6": "F", "7": "F" };
    //     return table[c] ?? "-";
    // };

    // 3) เตรียม rows จาก data จริง
    const rows = useMemo(() => {
      const config1 = [
            // รายการข้อมูลสำหรับ Head 1
                { label: "Measured Voltage Head 1", value: fmtNum(data?.measured_voltage1), unit: "V" },
                { label: "Max Voltage Head 1 ", value: fmtNum(data?.max_voltage1), unit: "V" },
                { label: "Measured Current Head 1 ", value: fmtNum(data?.measured_current1), unit: "A" },
                { label: "Max Current Head 1 ", value: fmtNum(data?.max_current1), unit: "A" },
                { label: "Power Head 1 ", value: fmtNum(data?.energy_power_kWh1), unit: "W" },
                { label: "Max Power Head 1 ", value: fmtNum(data?.max_power1), unit: "W" },
                { label: "Power H1 limit ", value: fmtNum(data?.power_limit1), unit: "kW" },
                { label: "Power H0 limit (Shared)", value: fmtNum(data?.power_limit0), unit: "kW" },
            ];
    const config2 = [
            // รายการข้อมูลสำหรับ Head 2

                { label: "Measured Voltage Head 2", value: fmtNum(data?.measured_voltage2) , unit: "V" },
                { label: "Max Voltage Head 2 ", value: fmtNum(data?.max_voltage2), unit: "V" },
                { label: "Measured Current Head 2 ", value: fmtNum(data?.measured_current2), unit: "A" },
                { label: "Max Current Head 2 ", value: fmtNum(data?.max_current2), unit: "A" },
                { label: "Power Head 2 ", value: fmtNum(data?.energy_power_kWh2), unit: "W" },
                { label: "Max Power Head 2 ", value: fmtNum(data?.max_power2), unit: "W" },
                { label: "Power H2 limit ", value: fmtNum(data?.power_limit2) , unit: "kW" },
            ];
        return head === 1 ? config1 : config2;
                // ถ้าอยากโชว์ค่าที่วัดจริงด้วย (แถม)
                    // { label: "Measured Voltage H1 (V)", value: fmtNum(data?.measured_voltage1) },
                    // { label: "Measured Voltage H2 (V)", value: fmtNum(data?.measured_voltage2) },
                    // { label: "Measured Current H1 (A)", value: fmtNum(data?.measured_current1) },
                    // { label: "Measured Current H2 (A)", value: fmtNum(data?.measured_current2) },
    }, [data , head]);

    // ⬇️ ใช้ในหัวการ์ด
    const lastUpdated = data?.timestamp ? new Date(data.timestamp).toLocaleString("th-TH") : null;

    return (
        <Card
            //  ใส่ timestamp ชิดขวาใน title บรรทัดเดียวกับ "PowerModule"
            title={
                <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <span>PowerModule Head {head}</span>
                    {lastUpdated && (
                        <span className="tw-ml-auto tw-text-xs !tw-text-blue-gray-500 tw-whitespace-nowrap">
                            อัปเดตล่าสุด: {lastUpdated}
                        </span>
                    )}
                </div>
            }
        >
            {/* แถบสถานะ
            {(loading || err) && (
                <div className="tw-px-3 tw-py-2">
                    {loading && <div className="tw-text-sm tw-text-blue-gray-600">กำลังโหลด...</div>}
                    {err && <div className="tw-text-sm tw-text-red-600">{err}</div>}
                </div>
            )} */}
            {/* แถบสถานะแบบใหม่ที่จำเป็น */}
            {!data && (
                <div className="tw-px-3 tw-py-2">
                    <div className="tw-text-sm tw-text-blue-gray-600">กำลังโหลดข้อมูล...</div>
                </div>
            )}

            {/* timestamp ล่าสุด (ถ้ามี) — คงโค้ดเดิมไว้ได้ ถ้าไม่อยากแสดงซ้ำให้ซ่อนด้วย tw-hidden */}
            {data?.timestamp && (
                <div className="tw-px-3 tw-py-2 tw-text-xs tw-text-blue-gray-500 tw-hidden">
                    อัปเดตล่าสุด: {new Date(data.timestamp).toLocaleString("th-TH")}
                </div>
            )}

            <div className="tw-rounded-lg tw-overflow-hidden">
                {rows.map((r, i) => (
                    <Row key={i} label={r.label} value={r.value} unit={r.unit} zebra={i % 2 === 1} />
                ))}
            </div>

            {/* ถ้าต้องการเปิด SoC ในอนาคต */}
            {/* <div className="tw-flex tw-flex-col tw-items-center tw-gap-6 tw-pt-6">
        <CircleProgress label="SoC1 :" value={Number(data?.soc_h1 ?? 0)} />
        <CircleProgress label="SoC2 :" value={Number(data?.soc_h2 ?? 0)} />
      </div> */}
        </Card>
    );
}









// "use client";

// import React, { useEffect, useMemo, useState } from "react";
// import Card from "./chargerSetting-card";
// import { useSearchParams } from "next/navigation";

// const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// type SettingDoc = {
//     _id: string;
//     timestamp?: string;
//     // ตัวอย่างฟิลด์ที่คาดว่าจะมี (เปลี่ยนตามจริงได้)
//     measured_voltage1?: string;      // "A" | "B" | ...
//     measured_voltage2?: string;
//     max_voltage1?: number;
//     max_voltage2?: number;
//     measured_current1?: number;
//     measured_current2?: number;
//     max_current1?: number;
//     max_current2?: number;
//     energy_power_kWh1?:  number;
//     energy_power_kWh2?:  number;
//     max_power1?: number;
//     max_power2?:  number;
//     power_limit1?:  number;
//     power_limit2?: number;
//     power_limit0?: number;
//     // ฟิลด์อื่น ๆ จาก backend
//     [key: string]: any;
// };

// function Row({
//     label,
//     value,
//     zebra = false,
// }: {
//     label: string;
//     value: string | number | undefined | null;
//     zebra?: boolean;
// }) {
//     return (
//         <div
//             className={`tw-grid tw-grid-cols-2 tw-gap-2 tw-py-2 tw-px-3 ${zebra ? "tw-bg-blue-gray-50/60" : "tw-bg-white"
//                 }`}
//         >
//             <span className="tw-text-sm tw-text-blue-gray-700">{label}</span>
//             <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-900 tw-text-right tw-tabular-nums">
//                 {value}
//             </span>
//         </div>
//     );
// }

// export default function EvPanel() {
//     const searchParams = useSearchParams();
//     const [stationId, setStationId] = useState<string | null>(null);
//     const [err, setErr] = useState<string | null>(null);
//     const [loading, setLoading] = useState(true);
//     const [data, setData] = useState<SettingDoc | null>(null);

//     // helper format
//     const toNum = (v: any): number | null => {
//         if (v === null || v === undefined) return null;
//         const n = typeof v === "number" ? v : Number(v);
//         return Number.isFinite(n) ? n : null;
//     };
//     const fmtNum = (v: any, digits = 2) => {
//         const n = toNum(v);
//         return n === null ? "-" : n.toFixed(digits);
//     };
//     const fmtStr = (v: any) => (v ?? "-");


//     // 1) ดึง station_id จาก URL → ถ้าไม่มีค่อย fallback localStorage
//     useEffect(() => {
//         const sidFromUrl = searchParams.get("station_id");
//         if (sidFromUrl) {
//             setStationId(sidFromUrl);
//             localStorage.setItem("selected_station_id", sidFromUrl);
//             return;
//         }
//         const sidLocal = localStorage.getItem("selected_station_id");
//         setStationId(sidLocal);
//     }, [searchParams]);

//     // 2) เปิด SSE ไปที่ /setting
//     useEffect(() => {
//         if (!stationId) return;
//         setLoading(true);
//         setErr(null);

//         const es = new EventSource(
//             `${API_BASE}/setting?station_id=${encodeURIComponent(stationId)}`,
//             { withCredentials: true } // สำคัญสำหรับ cookie-auth
//         );

//         const onInit = (e: MessageEvent) => {
//             try {
//                 setData(JSON.parse(e.data));
//                 setLoading(false);
//                 setErr(null);
//             } catch {
//                 setErr("ผิดรูปแบบข้อมูล init");
//                 setLoading(false);
//             }
//         };

//         // es.addEventListener("init", onInit);
//         es.addEventListener("init", (e: MessageEvent) => {
//             console.log("INIT raw:", e.data);
//             try {
//                 const obj = JSON.parse(e.data);
//                 console.log("INIT parsed:", obj);
//                 setData(obj);
//                 setLoading(false);
//             } catch { }
//         });

//         es.onopen = () => setErr(null);

//         // es.onmessage = (e) => {
//         //     try {
//         //         setData(JSON.parse(e.data));
//         //         setErr(null);
//         //     } catch {
//         //         setErr("ผิดรูปแบบข้อมูล message");
//         //     }
//         // };

//         es.onmessage = (e) => {
//             console.log("MSG raw:", e.data);
//             try {
//                 const obj = JSON.parse(e.data);
//                 console.log("MSG parsed:", obj);
//                 setData(obj);
//             } catch { }
//         };

//         es.onerror = () => {
//             setErr("SSE หลุดการเชื่อมต่อ (กำลังพยายามเชื่อมใหม่อัตโนมัติ)");
//             setLoading(false);
//             // ไม่ปิด es เพื่อให้ browser retry ตาม retry: 3000 ที่ server ส่งมา
//         };

//         return () => {
//             es.removeEventListener("init", onInit);
//             es.close();
//         };
//     }, [stationId]);

//     // ถ้าต้องการแปลง CP code -> ตัวอักษร/คำอธิบาย (ปรับตามโปรโตคอลของคุณ)
//     const mapCP = (code: any) => {
//         const c = String(code ?? "");
//         // ตัวอย่าง mapping: 1=A, 2=B, 3=C, 7=F (ปรับตามจริง)
//         const table: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D", "5": "E", "6": "F", "7": "F" };
//         return table[c] ?? "-";
//     };

//     // 3) เตรียม rows จาก data จริง
//     const rows = useMemo(
//         () => [

//             { label: "Measured Voltage Head 1 (V)", value: data?.measured_voltage1 },
//             { label: "Measured Voltage Head 2 (V)", value: data?.measured_voltage2 },
//             { label: "Max Voltage Head 1 (V)", value: data?.max_voltage1 },
//             { label: "Max Voltage Head 2 (V)", value: data?.max_voltage2 },
//             { label: "Measured Current Head 1 (A)", value: data?.measured_current1 },
//             { label: "Measured Current Head 2 (A)", value: data?.measured_current2 },
//             { label: "Max Current Head 1 (A)", value: data?.max_current1 },
//             { label: "Max Current Head 2 (A)", value: data?.max_current2 },
//             { label: "Power Head 1 (W)", value: data?.energy_power_kWh1 },
//             { label: "Power Head 2 (W)", value: data?.energy_power_kWh2 },
//             { label: "Max Power Head 1 (W)", value: data?.max_power1 },
//             { label: "Max Power Head 2 (W)", value: data?.max_power2 },
//             { label: "Power H1 limit (kWh)", value: data?.power_limit1 },
//             { label: "Power H2 limit (kWh)", value: data?.power_limit2 },
//             { label: "Power H0 limit (kWh)", value: data?.power_limit0 },
//             // ถ้าอยากโชว์ค่าที่วัดจริงด้วย (แถม)
//             // { label: "Measured Voltage H1 (V)", value: fmtNum(data?.measured_voltage1) },
//             // { label: "Measured Voltage H2 (V)", value: fmtNum(data?.measured_voltage2) },
//             // { label: "Measured Current H1 (A)", value: fmtNum(data?.measured_current1) },
//             // { label: "Measured Current H2 (A)", value: fmtNum(data?.measured_current2) },
//         ],
//         [data]
//     );

//     return (
//         <Card title="PowerModule">
//             {/* แถบสถานะ */}
//             {(loading || err) && (
//                 <div className="tw-px-3 tw-py-2">
//                     {loading && <div className="tw-text-sm tw-text-blue-gray-600">กำลังโหลด...</div>}
//                     {err && <div className="tw-text-sm tw-text-red-600">{err}</div>}
//                 </div>
//             )}

//             {/* timestamp ล่าสุด (ถ้ามี) */}
//             {data?.timestamp && (
//                 <div className="tw-px-3 tw-py-2 tw-text-xs tw-text-blue-gray-500">
//                     อัปเดตล่าสุด: {new Date(data.timestamp).toLocaleString("th-TH")}
//                 </div>
//             )}

//             <div className="tw-rounded-lg tw-overflow-hidden">
//                 {rows.map((r, i) => (
//                     <Row key={i} label={r.label} value={r.value} zebra={i % 2 === 1} />
//                 ))}
//             </div>

//             {/* ถ้าต้องการเปิด SoC ในอนาคต */}
//             {/* <div className="tw-flex tw-flex-col tw-items-center tw-gap-6 tw-pt-6">
//         <CircleProgress label="SoC1 :" value={Number(data?.soc_h1 ?? 0)} />
//         <CircleProgress label="SoC2 :" value={Number(data?.soc_h2 ?? 0)} />
//       </div> */}
//         </Card>
//     );
// }
