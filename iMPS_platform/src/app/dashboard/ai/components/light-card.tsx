

// "use client";
// import React, { useEffect, useState, useCallback } from "react";
// import { Card, CardBody, CardHeader, Switch, Typography } from "@material-tailwind/react";
// import CircleProgress from "./CircleProgress";
// import { useSearchParams } from "next/navigation";

// type AiItem = {
//   id: string;
//   title: string;
//   iconClass: string;
//   defaultEnabled?: boolean;
//   progress?: number; // fallback ถ้าไม่มีค่าจาก API
// };

// const AI_ITEMS: AiItem[] = [
//   { id: "mdb_filters", title: "MDB Dust Filters Prediction", iconClass: "fa-solid fa-filter", defaultEnabled: false, progress: 20 },
//   { id: "charger_filters", title: "Charger Dust Filters Prediction", iconClass: "fa-solid fa-charging-station", defaultEnabled: false, progress: 43 },
//   { id: "on_off", title: "Online / Offline Prediction", iconClass: "fa-solid fa-wifi", defaultEnabled: false, progress: 58 },
//   { id: "abnormal_powersupply", title: "AB Normal Power Supply Prediction", iconClass: "fa-solid fa-bolt", defaultEnabled: false, progress: 36 },
//   { id: "network", title: "Network Prediction", iconClass: "fa-solid fa-signal", defaultEnabled: false, progress: 64 },
//   { id: "rul", title: "The Remainning Useful Life (RUL) Prediction", iconClass: "fa-regular fa-clock", defaultEnabled: false, progress: 43 },
//   { id: "analysis", title: "Root Cause Analysis Prediction", iconClass: "fa-solid fa-magnifying-glass", defaultEnabled: false, progress: 43 },
// ];

// /* -------- Reusable card -------- */
// function AiItemCard({
//   item,
//   enabled,
//   onToggle,
//   disabled,
// }: {
//   item: AiItem;
//   enabled?: boolean;
//   onToggle?: (next: boolean) => void;
//   disabled?: boolean;
// }) {
//   const isControlled = typeof enabled === "boolean";
//   const [localEnabled, setLocalEnabled] = React.useState(!!item.defaultEnabled);
//   const value = isControlled ? enabled : localEnabled;

//   const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
//     const next = e.target.checked;
//     // console.log("[AiItemCard] toggle:", { id: item.id, next });   // 👈 ดูค่าที่นี่
//     if (isControlled) onToggle?.(next);
//     else setLocalEnabled(next);
//   };

//   // const handleChange = (arg: any) => {
//   //   const next =
//   //     typeof arg === "boolean"
//   //       ? arg
//   //       : !!arg?.target?.checked;

//   //   if (isControlled) onToggle?.(next);
//   //   else setLocalEnabled(next);
//   // };

//   return (
//     <Card
//       variant="gradient"
//       className={`tw-flex tw-h-full tw-flex-col tw-justify-between tw-border tw-shadow-sm ${value ? "!tw-bg-gray-800 !tw-text-white" : "!tw-bg-white"
//         }`}
//     >
//       <CardHeader floated={false} shadow={false} color="transparent" className="tw-overflow-visible tw-rounded-none">
//         <div className="tw-flex tw-items-center tw-justify-between">
//           <div className="tw-flex tw-items-center tw-gap-3">
//             <i className={`fa-fw ${item.iconClass} tw-text-xl ${value ? "tw-text-white" : "tw-text-gray-800"}`} />
//             <div>
//               <Typography variant="h6" className={`tw-leading-none ${value ? "tw-text-white" : "tw-text-gray-900"}`}>
//                 {item.title}
//               </Typography>
//               <Typography className={`!tw-text-xs !tw-font-normal ${value ? "tw-text-white/80" : "!tw-text-blue-gray-500"}`}>
//                 {value ? "Enabled" : "Disabled"}
//               </Typography>
//             </div>
//           </div>

//           <div className="tw-flex tw-items-center tw-gap-2">
//             <Typography className={`!tw-text-sm tw-hidden sm:tw-block ${value ? "tw-text-white/90" : "!tw-text-blue-gray-500"}`}>
//               {value ? "On" : "Off"}
//             </Typography>
//             <Switch
//               checked={value}
//               onChange={handleChange}
//               disabled={disabled}
//               color={value ? "blue-gray" : "blue"}
//               aria-label={`Enable ${item.title}`}
//             />
//           </div>
//         </div>
//       </CardHeader>

//       <CardBody className="tw-p-4">
//         <div className={value ? "" : "tw-opacity-50"}>
//           <div className="tw-mx-auto tw-max-w-[220px] tw-w-full">
//             <CircleProgress
//               label="Health Index"
//               value={item.progress ?? 0}
//               valueClassName={value ? "tw-text-white" : "tw-text-blue-gray-900"}
//               labelClassName={value ? "tw-text-white/80" : "tw-text-blue-gray-600"}
//               colorClass={value ? undefined : "tw-text-blue-gray-400"}
//             />
//           </div>
//         </div>
//       </CardBody>
//     </Card>
//   );
// }


// type StationInfoResponse = {
//   station?: {
//     module1_isActive?: boolean;
//     module2_isActive?: boolean;
//     module3_isActive?: boolean;
//     module4_isActive?: boolean;
//     module5_isActive?: boolean;
//     module6_isActive?: boolean;
//     module7_isActive?: boolean;
//   };
// };

// type Prediction = {
//   RUL_days?: number;  // กำหนดว่า RUL_days อาจมีหรือไม่ก็ได้
// };

// type Data = {
//   predictions: Record<string, Prediction>; // predictions เป็นอ็อบเจกต์ที่มี key เป็น string และ value เป็น Prediction
//   source_id: number;  // หรือประเภทที่เหมาะสมกับ source_id
// };

// const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// /* -------- Section -------- */
// export default function AiSection() {
//   const searchParams = useSearchParams();

//   const [stationId, setStationId] = useState<string | null>(null);
//   // const [loading, setLoading] = useState<boolean>(false);
//   const [loadingInfo, setLoadingInfo] = useState(false);
//   const [loadingOutput, setLoadingOutput] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   // health index จาก API (ใช้กับการ์ดทั้งหมดเป็นตัวอย่าง)
//   const [healthIndex, setHealthIndex] = useState<number | null>(null);
//   const [rulData, setRulData] = useState<Record<string, number>>({});
//   const [module1IsActive, setModule1IsActive] = useState(false);
//   const [module2IsActive, setModule2IsActive] = useState(false);
//   const [module3IsActive, setModule3IsActive] = useState(false);
//   const [module4IsActive, setModule4IsActive] = useState(false);
//   const [module5IsActive, setModule5IsActive] = useState(false);
//   const [module6IsActive, setModule6IsActive] = useState(false);
//   const [module7IsActive, setModule7IsActive] = useState(false);
//   const [savingModule6, setSavingModule6] = useState(false);



//   const refetchStationInfo = useCallback(async (sid: string) => {
//     setLoadingInfo(true);
//     try {
//       const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
//       // const res = await fetch(`${API_BASE}/station/info?station_id=${encodeURIComponent(sid)}`, {
//       //   headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Cache-Control": "no-cache", Pragma: "no-cache" },
//       //   credentials: token ? "omit" : "include",
//       //   cache: "no-store",
//       // });

//       const res = await fetch(
//         `${API_BASE}/station/info?station_id=${encodeURIComponent(sid)}&ts=${Date.now()}`,
//         {
//           headers: {
//             ...(token ? { Authorization: `Bearer ${token}` } : {}),
//             "Cache-Control": "no-cache",
//             Pragma: "no-cache",
//           },
//           credentials: token ? "omit" : "include",
//           cache: "no-store",
//         }
//       );
//       // console.log("res",res)
//       if (!res.ok) throw new Error(`HTTP ${res.status}`);
//       const json: StationInfoResponse = await res.json();
//       setModule1IsActive(Boolean(json?.station?.module1_isActive));
//       setModule2IsActive(Boolean(json?.station?.module2_isActive));
//       setModule3IsActive(Boolean(json?.station?.module3_isActive));
//       setModule4IsActive(Boolean(json?.station?.module4_isActive));
//       setModule5IsActive(Boolean(json?.station?.module5_isActive));
//       setModule6IsActive(Boolean(json?.station?.module6_isActive));
//       setModule7IsActive(Boolean(json?.station?.module7_isActive));
//     } finally {
//       setLoadingInfo(false);
//     }
//   }, []);



//   const toggleModule6 = useCallback(async (next: boolean) => {
//     if (!stationId) return;
//     if (module6IsActive === next) return;

//     const sid = stationId;        // ล็อกค่าไว้
//     setSavingModule6(true);
//     const prev = module6IsActive;
//     setModule6IsActive(next);     // optimistic
//     // console.log("sid",sid)
//     try {
//       const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
//       const res = await fetch(`${API_BASE}/station/${encodeURIComponent(sid)}/module6`, {
//         method: "PATCH",
//         headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), "Cache-Control": "no-cache" },
//         credentials: token ? "omit" : "include",
//         body: JSON.stringify({ enabled: next }),
//       });
//       console.log(res)
//       if (!res.ok) throw new Error(`HTTP ${res.status}`);
//       await refetchStationInfo(sid); // ใช้ sid เดิมที่ล็อกไว้
//     } catch (e) {
//       setModule6IsActive(prev);   // rollback
//       // console.error(e);
//     } finally {
//       setSavingModule6(false);
//     }
//   }, [module6IsActive, stationId, refetchStationInfo]);


//   // เก็บ ETag ไว้ใช้ If-None-Match
//   const [etag, setEtag] = useState<string | null>(null);

//   // 1) ดึง station_id จาก URL → fallback localStorage
//   useEffect(() => {
//     const sidFromUrl = searchParams.get("station_id");
//     if (sidFromUrl) {
//       setStationId(sidFromUrl);
//       if (typeof window !== "undefined") {
//         localStorage.setItem("selected_station_id", sidFromUrl);
//       }
//       return;
//     }
//     const sidLocal = typeof window !== "undefined" ? localStorage.getItem("selected_station_id") : null;
//     setStationId(sidLocal);
//   }, [searchParams]);


//   useEffect(() => {
//     if (!stationId) return;
//     refetchStationInfo(stationId)
//       .catch((e) => setError(e?.message || "fetch failed"));
//   }, [stationId, refetchStationInfo]);





//   // ผูก healthIndex จาก API ไปยังการ์ด (ตัวอย่าง: ใช้ตัวเดียวกันทุกการ์ด)
//   // const itemsForRender = AI_ITEMS.map((item) => ({
//   //   ...item,
//   //   progress: Number.isFinite(healthIndex as number) ? (healthIndex as number) : item.progress ?? 0,
//   // }));
//   // คำนวณค่าเฉลี่ยจาก rulData ทั้งหมด
//   const rulAvg = Object.values(rulData).length
//     ? Math.round(Object.values(rulData).reduce((a, b) => a + b, 0) / Object.values(rulData).length)
//     : 0;

//   // console.log("avg",rulAvg)

//   // สร้าง items ที่ผูก progress ตามจริง
//   const itemsForRender = AI_ITEMS.map((item) => {

//     if (item.id === "rul") {
//       return { ...item, progress: rulAvg }; // ใช้ค่าเฉลี่ย RUL
//     }
//     return item; // การ์ดอื่นคงเดิม
//   });



//   return (
//     <section className="tw-space-y-4">
//       <div className="tw-flex tw-items-center tw-gap-3">
//         {!stationId ? (
//           "ยังไม่ได้เลือกสถานี"
//         ) : loadingInfo ? (
//           "กำลังโหลด..."
//         ) : error ? (
//           <span className="tw-text-red-600">{error}</span>
//         ) : (
//           // <span>Health Index: {healthIndex ? healthIndex : "—"}</span>
//           <span>
//             ai1:  {String(module1IsActive)} <br />
//             ai2:  {String(module2IsActive)} <br />
//             ai3:  {String(module3IsActive)} <br />
//             ai4:  {String(module4IsActive)} <br />
//             ai5:  {String(module5IsActive)} <br />
//             ai6:  {String(module6IsActive)} <br />
//             ai7:  {String(module7IsActive)}
//           </span>

//         )}

//         {/* ปุ่ม Refresh เผื่อผู้ใช้กดเอง */}
//         <button
//           className="tw-ml-auto tw-text-sm tw-rounded-md tw-border tw-px-3 tw-py-1 hover:tw-bg-gray-50"
//           onClick={() => {
//             // รีเซ็ต etag เพื่อบังคับให้ดึงบอดีใหม่รอบถัดไป
//             setEtag(null);
//             // ทริกเกอร์ useEffect ด้วย setStationId เดิม
//             setStationId((s) => (s ? `${s}` : s));
//           }}
//         >
//           Refresh
//         </button>
//       </div>

//       <div className="tw-w-full tw-grid tw-gap-6 tw-grid-cols-1 md:!tw-grid-cols-3">

//         {itemsForRender.map((item) => {
//           const isModule6Card = item.id === "rul";
//           return (
//             <AiItemCard
//               key={`${item.id}-${stationId ?? "na"}`}   // <-- เพิ่ม stationId ใน key
//               item={item}
//               {...(isModule6Card
//                 ? {
//                   enabled: module6IsActive,
//                   onToggle: toggleModule6,
//                   disabled: savingModule6,
//                 }
//                 : {})}
//             />
//           );
//         })}
//       </div>
//     </section>
//   );
// }


// "use client";
// import React, { useEffect, useState, useCallback } from "react";
// import { Card, CardBody, CardHeader, Switch, Typography } from "@material-tailwind/react";
// import CircleProgress from "./CircleProgress";
// import { useSearchParams } from "next/navigation";

// type AiItem = {
//   id: string;
//   title: string;
//   iconClass: string;
//   defaultEnabled?: boolean;
//   progress?: number; // fallback ถ้าไม่มีค่าจาก API
// };

// const AI_ITEMS: AiItem[] = [
//   { id: "mdb_filters", title: "MDB Dust Filters Prediction", iconClass: "fa-solid fa-filter", defaultEnabled: false, progress: 20 },
//   { id: "charger_filters", title: "Charger Dust Filters Prediction", iconClass: "fa-solid fa-charging-station", defaultEnabled: false, progress: 43 },
//   { id: "on_off", title: "Online / Offline Prediction", iconClass: "fa-solid fa-wifi", defaultEnabled: false, progress: 58 },
//   { id: "abnormal_powersupply", title: "AB Normal Power Supply Prediction", iconClass: "fa-solid fa-bolt", defaultEnabled: false, progress: 36 },
//   { id: "network", title: "Network Prediction", iconClass: "fa-solid fa-signal", defaultEnabled: false, progress: 64 },
//   { id: "rul", title: "The Remaining Useful Life (RUL) Prediction", iconClass: "fa-regular fa-clock", defaultEnabled: false, progress: 43 },
//   { id: "analysis", title: "Root Cause Analysis Prediction", iconClass: "fa-solid fa-magnifying-glass", defaultEnabled: false, progress: 43 },
// ];

// /* -------- Reusable card -------- */
// function AiItemCard({
//   item,
//   enabled,
//   onToggle,
//   disabled,
// }: {
//   item: AiItem;
//   enabled?: boolean;
//   onToggle?: (next: boolean) => void;
//   disabled?: boolean;
// }) {
//   const isControlled = typeof enabled === "boolean";
//   const [localEnabled, setLocalEnabled] = React.useState(!!item.defaultEnabled);
//   const value = isControlled ? enabled : localEnabled;

//   const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
//     const next = e.target.checked;
//     if (isControlled) onToggle?.(next);
//     else setLocalEnabled(next);
//   };

//   return (
//     <Card
//       variant="gradient"
//       className={`tw-flex tw-h-full tw-flex-col tw-justify-between tw-border tw-shadow-sm ${value ? "!tw-bg-gray-800 !tw-text-white" : "!tw-bg-white"}`}
//     >
//       <CardHeader floated={false} shadow={false} color="transparent" className="tw-overflow-visible tw-rounded-none">
//         <div className="tw-flex tw-items-center tw-justify-between">
//           <div className="tw-flex tw-items-center tw-gap-3">
//             <i className={`fa-fw ${item.iconClass} tw-text-xl ${value ? "tw-text-white" : "tw-text-gray-800"}`} />
//             <div>
//               <Typography variant="h6" className={`tw-leading-none ${value ? "tw-text-white" : "tw-text-gray-900"}`}>
//                 {item.title}
//               </Typography>
//               <Typography className={`!tw-text-xs !tw-font-normal ${value ? "tw-text-white/80" : "!tw-text-blue-gray-500"}`}>
//                 {value ? "Enabled" : "Disabled"}
//               </Typography>
//             </div>
//           </div>

//           <div className="tw-flex tw-items-center tw-gap-2">
//             <Typography className={`!tw-text-sm tw-hidden sm:tw-block ${value ? "tw-text-white/90" : "!tw-text-blue-gray-500"}`}>
//               {value ? "On" : "Off"}
//             </Typography>
//             <Switch
//               checked={value}
//               onChange={handleChange}
//               disabled={disabled}
//               color={value ? "blue-gray" : "blue"}
//               aria-label={`Enable ${item.title}`}
//             />
//           </div>
//         </div>
//       </CardHeader>

//       <CardBody className="tw-p-4">
//         <div className={value ? "" : "tw-opacity-50"}>
//           <div className="tw-mx-auto tw-max-w-[220px] tw-w-full">
//             <CircleProgress
//               label="Health Index"
//               value={item.progress ?? 0}
//               valueClassName={value ? "tw-text-white" : "tw-text-blue-gray-900"}
//               labelClassName={value ? "tw-text-white/80" : "tw-text-blue-gray-600"}
//               colorClass={value ? undefined : "tw-text-blue-gray-400"}
//             />
//           </div>
//         </div>
//       </CardBody>
//     </Card>
//   );
// }

// type StationInfoResponse = {
//   station?: {
//     module1_isActive?: boolean;
//     module2_isActive?: boolean;
//     module3_isActive?: boolean;
//     module4_isActive?: boolean;
//     module5_isActive?: boolean;
//     module6_isActive?: boolean;
//     module7_isActive?: boolean;
//   };
// };

// const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
// export default function AiSection() {
//   const searchParams = useSearchParams();
//   const [stationId, setStationId] = useState<string | null>(null);
//   const [loadingInfo, setLoadingInfo] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [etag, setEtag] = useState<string | null>(null);

//   const [modulesStatus, setModulesStatus] = useState<{
//     [key: string]: boolean;
//   }>({
//     module1IsActive: false,
//     module2IsActive: false,
//     module3IsActive: false,
//     module4IsActive: false,
//     module5IsActive: false,
//     module6IsActive: false,
//     module7IsActive: false,
//   });

//   const refetchStationInfo = useCallback(async (sid: string) => {
//     setLoadingInfo(true); // เริ่มการโหลดข้อมูล
//     try {
//       const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
//       const res = await fetch(
//         `${API_BASE}/station/info?station_id=${encodeURIComponent(sid)}`,
//         {
//           headers: {
//             ...(token ? { Authorization: `Bearer ${token}` } : {}),
//             "Cache-Control": "no-cache",
//             Pragma: "no-cache",
//           },
//           credentials: token ? "omit" : "include",
//           cache: "no-store",
//         }
//       );

//       if (!res.ok) throw new Error(`HTTP ${res.status}`);

//       const json: StationInfoResponse = await res.json();
//       console.log("Station Info:", json);
//       setModulesStatus({
//         module1IsActive: Boolean(json?.station?.module1_isActive),
//         module2IsActive: Boolean(json?.station?.module2_isActive),
//         module3IsActive: Boolean(json?.station?.module3_isActive),
//         module4IsActive: Boolean(json?.station?.module4_isActive),
//         module5IsActive: Boolean(json?.station?.module5_isActive),
//         module6IsActive: Boolean(json?.station?.module6_isActive),
//         module7IsActive: Boolean(json?.station?.module7_isActive),
//       });

//        console.log("modulesStatus:", modulesStatus);
//     } catch (e) {
//       if (e instanceof Error) {
//         setError(e.message || "fetch failed");
//       } else {
//         setError("Unknown error occurred");
//       }
//     } finally {
//       setLoadingInfo(false); // ไม่ว่าจะเกิดอะไรขึ้น ต้องปิดการโหลด
//     }
//   }, []);

//   const toggleModule = useCallback(async (moduleId: string, next: boolean) => {
//     if (!stationId) return;

//     const fieldName = `${moduleId}IsActive`;

//     if (modulesStatus[fieldName] === next) return; // No need to update if same state

//     setModulesStatus((prevState) => ({
//       ...prevState,
//       [fieldName]: next, // Optimistically update the state
//     }));

//     try {
//       const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
//       const res = await fetch(`${API_BASE}/station/${encodeURIComponent(stationId)}/${moduleId}`, {
//         method: "PATCH",
//         headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
//         credentials: token ? "omit" : "include",
//         body: JSON.stringify({ enabled: next }),
//       });
//       if (!res.ok) throw new Error(`HTTP ${res.status}`);
//       await refetchStationInfo(stationId);
//     } catch (e) {
//       setModulesStatus((prevState) => ({
//         ...prevState,
//         [fieldName]: !next, // Rollback if API fails
//       }));
//     }
//   }, [stationId, modulesStatus, refetchStationInfo]);

//   useEffect(() => {
//     const sidFromUrl = searchParams.get("station_id");
//     if (sidFromUrl) {
//       setStationId(sidFromUrl);
//       if (typeof window !== "undefined") {
//         localStorage.setItem("selected_station_id", sidFromUrl);
//       }
//       return;
//     }
//     const sidLocal = typeof window !== "undefined" ? localStorage.getItem("selected_station_id") : null;
//     setStationId(sidLocal);
//   }, [searchParams]);

//   useEffect(() => {
//     if (!stationId) return;
//     refetchStationInfo(stationId).catch((e) => setError(e?.message || "fetch failed"));
//   }, [stationId, refetchStationInfo]);

//   const itemsForRender = AI_ITEMS.map((item) => ({
//     ...item,
//     progress: item.id === "rul" ? 43 : item.progress, // Example of setting RUL prediction progress
//   }));

//   return (
//     <section className="tw-space-y-4">
//       <div className="tw-flex tw-items-center tw-gap-3">
//         {!stationId ? (
//           "ยังไม่ได้เลือกสถานี"
//         ) : loadingInfo ? (
//           "กำลังโหลด..."
//         ) : error ? (
//           <span className="tw-text-red-600">{error}</span>
//         ) : (
//           <span>
//             ai1: {String(modulesStatus.module1IsActive)} <br />
//             ai2: {String(modulesStatus.module2IsActive)} <br />
//             ai3: {String(modulesStatus.module3IsActive)} <br />
//             ai4: {String(modulesStatus.module4IsActive)} <br />
//             ai5: {String(modulesStatus.module5IsActive)} <br />
//             ai6: {String(modulesStatus.module6IsActive)} <br />
//             ai7: {String(modulesStatus.module7IsActive)}
//           </span>
//         )}

//         <button
//           className="tw-ml-auto tw-text-sm tw-rounded-md tw-border tw-px-3 tw-py-1 hover:tw-bg-gray-50"
//           onClick={() => {
//             setEtag(null);
//             setStationId((s) => (s ? `${s}` : s));
//           }}
//         >
//           Refresh
//         </button>
//       </div>

//       <div className="tw-w-full tw-grid tw-gap-6 tw-grid-cols-1 md:!tw-grid-cols-3">
//         {itemsForRender.map((item) => {
//           return (
//             <AiItemCard
//               key={item.id}
//               item={item}
//               enabled={modulesStatus[`${item.id}IsActive`]}
//               onToggle={(next: boolean) => toggleModule(item.id, next)}
//              disabled={!modulesStatus[`${item.id}IsActive`]} // Correctly disable based on status
//             />
//           );
//         })}
//       </div>
//     </section>
//   );
// }


// "use client";
// import React, { useEffect, useState, useCallback } from "react";
// import { Card, CardBody, CardHeader, Switch, Typography } from "@material-tailwind/react";
// import CircleProgress from "./CircleProgress";
// import { useSearchParams } from "next/navigation";

// type AiItem = {
//   id: string;
//   title: string;
//   iconClass: string;
//   defaultEnabled?: boolean;
//   progress?: number;
// };

// // Mapping ระหว่าง module ID กับชื่อที่แสดง
// const AI_ITEMS: AiItem[] = [
//   { id: "module1", title: "MDB Dust Filters Prediction", iconClass: "fa-solid fa-filter", defaultEnabled: false, progress: 20 },
//   { id: "module2", title: "Charger Dust Filters Prediction", iconClass: "fa-solid fa-charging-station", defaultEnabled: false, progress: 43 },
//   { id: "module3", title: "Online / Offline Prediction", iconClass: "fa-solid fa-wifi", defaultEnabled: false, progress: 58 },
//   { id: "module4", title: "AB Normal Power Supply Prediction", iconClass: "fa-solid fa-bolt", defaultEnabled: false, progress: 36 },
//   { id: "module5", title: "Network Prediction", iconClass: "fa-solid fa-signal", defaultEnabled: false, progress: 64 },
//   { id: "module6", title: "The Remaining Useful Life (RUL) Prediction", iconClass: "fa-regular fa-clock", defaultEnabled: false, progress: 43 },
//   { id: "module7", title: "Root Cause Analysis Prediction", iconClass: "fa-solid fa-magnifying-glass", defaultEnabled: false, progress: 43 },
// ];

// /* -------- Reusable card -------- */
// function AiItemCard({
//   item,
//   enabled,
//   onToggle,
//   disabled,
// }: {
//   item: AiItem;
//   enabled?: boolean;
//   onToggle?: (next: boolean) => void;
//   disabled?: boolean;
// }) {
//   const isControlled = typeof enabled === "boolean";
//   const [localEnabled, setLocalEnabled] = React.useState(!!item.defaultEnabled);
//   const value = isControlled ? enabled : localEnabled;

//   const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
//     const next = e.target.checked;
//     if (isControlled) onToggle?.(next);
//     else setLocalEnabled(next);
//   };

//   return (
//     <Card
//       variant="gradient"
//       className={`tw-flex tw-h-full tw-flex-col tw-justify-between tw-border tw-shadow-sm ${value ? "!tw-bg-gray-800 !tw-text-white" : "!tw-bg-white"}`}
//     >
//       <CardHeader floated={false} shadow={false} color="transparent" className="tw-overflow-visible tw-rounded-none">
//         <div className="tw-flex tw-items-center tw-justify-between">
//           <div className="tw-flex tw-items-center tw-gap-3">
//             <i className={`fa-fw ${item.iconClass} tw-text-xl ${value ? "tw-text-white" : "tw-text-gray-800"}`} />
//             <div>
//               <Typography variant="h6" className={`tw-leading-none ${value ? "tw-text-white" : "tw-text-gray-900"}`}>
//                 {item.title}
//               </Typography>
//               <Typography className={`!tw-text-xs !tw-font-normal ${value ? "tw-text-white/80" : "!tw-text-blue-gray-500"}`}>
//                 {value ? "Enabled" : "Disabled"}
//               </Typography>
//             </div>
//           </div>

//           <div className="tw-flex tw-items-center tw-gap-2">
//             <Typography className={`!tw-text-sm tw-hidden sm:tw-block ${value ? "tw-text-white/90" : "!tw-text-blue-gray-500"}`}>
//               {value ? "On" : "Off"}
//             </Typography>
//             <Switch
//               checked={value}
//               onChange={handleChange}
//               disabled={disabled}
//               color={value ? "blue-gray" : "blue"}
//               aria-label={`Enable ${item.title}`}
//             />
//           </div>
//         </div>
//       </CardHeader>

//       <CardBody className="tw-p-4">
//         <div className={value ? "" : "tw-opacity-50"}>
//           <div className="tw-mx-auto tw-max-w-[220px] tw-w-full">
//             <CircleProgress
//               label="Health Index"
//               value={item.progress ?? 0}
//               valueClassName={value ? "tw-text-white" : "tw-text-blue-gray-900"}
//               labelClassName={value ? "tw-text-white/80" : "tw-text-blue-gray-600"}
//               colorClass={value ? undefined : "tw-text-blue-gray-400"}
//             />
//           </div>
//         </div>
//       </CardBody>
//     </Card>
//   );
// }

// type StationInfoResponse = {
//   station?: {
//     module1_isActive?: boolean;
//     module2_isActive?: boolean;
//     module3_isActive?: boolean;
//     module4_isActive?: boolean;
//     module5_isActive?: boolean;
//     module6_isActive?: boolean;
//     module7_isActive?: boolean;
//   };
// };

// const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// export default function AiSection() {
//   const searchParams = useSearchParams();
//   const [stationId, setStationId] = useState<string | null>(null);
//   const [loadingInfo, setLoadingInfo] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [etag, setEtag] = useState<string | null>(null);

//   const [modulesStatus, setModulesStatus] = useState<{
//     [key: string]: boolean;
//   }>({
//     module1IsActive: false,
//     module2IsActive: false,
//     module3IsActive: false,
//     module4IsActive: false,
//     module5IsActive: false,
//     module6IsActive: false,
//     module7IsActive: false,
//   });

//   const refetchStationInfo = useCallback(async (sid: string) => {
//     setLoadingInfo(true);
//     setError(null);
//     try {
//       const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
//       const res = await fetch(
//         `${API_BASE}/station/info?station_id=${encodeURIComponent(sid)}`,
//         {
//           headers: {
//             ...(token ? { Authorization: `Bearer ${token}` } : {}),
//             "Cache-Control": "no-cache",
//             Pragma: "no-cache",
//           },
//           credentials: token ? "omit" : "include",
//           cache: "no-store",
//         }
//       );

//       if (!res.ok) throw new Error(`HTTP ${res.status}`);

//       const json: StationInfoResponse = await res.json();
//       console.log("Station Info:", json);
      
//       const newStatus = {
//         module1IsActive: Boolean(json?.station?.module1_isActive),
//         module2IsActive: Boolean(json?.station?.module2_isActive),
//         module3IsActive: Boolean(json?.station?.module3_isActive),
//         module4IsActive: Boolean(json?.station?.module4_isActive),
//         module5IsActive: Boolean(json?.station?.module5_isActive),
//         module6IsActive: Boolean(json?.station?.module6_isActive),
//         module7IsActive: Boolean(json?.station?.module7_isActive),
//       };
      
//       setModulesStatus(newStatus);
//       console.log("modulesStatus updated:", newStatus);
//     } catch (e) {
//       if (e instanceof Error) {
//         setError(e.message || "fetch failed");
//       } else {
//         setError("Unknown error occurred");
//       }
//     } finally {
//       setLoadingInfo(false);
//     }
//   }, []);

//   const toggleModule = useCallback(async (moduleId: string, next: boolean) => {
//     if (!stationId) return;

//     const fieldName = `${moduleId}IsActive`;

//     if (modulesStatus[fieldName] === next) return;

//     // Optimistic update
//     setModulesStatus((prevState) => ({
//       ...prevState,
//       [fieldName]: next,
//     }));

//     try {
//       const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
//       const res = await fetch(`${API_BASE}/station/${encodeURIComponent(stationId)}/${moduleId}`, {
//         method: "PATCH",
//         headers: { 
//           "Content-Type": "application/json", 
//           ...(token ? { Authorization: `Bearer ${token}` } : {}) 
//         },
//         credentials: token ? "omit" : "include",
//         body: JSON.stringify({ enabled: next }),
//       });
      
//       if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
//       // Refetch to get the latest data
//       await refetchStationInfo(stationId);
//     } catch (e) {
//       console.error("Toggle module error:", e);
//       // Rollback on error
//       setModulesStatus((prevState) => ({
//         ...prevState,
//         [fieldName]: !next,
//       }));
//       setError(e instanceof Error ? e.message : "Failed to toggle module");
//     }
//   }, [stationId, modulesStatus, refetchStationInfo]);

//   useEffect(() => {
//     const sidFromUrl = searchParams.get("station_id");
//     if (sidFromUrl) {
//       setStationId(sidFromUrl);
//       if (typeof window !== "undefined") {
//         localStorage.setItem("selected_station_id", sidFromUrl);
//       }
//       return;
//     }
//     const sidLocal = typeof window !== "undefined" ? localStorage.getItem("selected_station_id") : null;
//     setStationId(sidLocal);
//   }, [searchParams]);

//   useEffect(() => {
//     if (!stationId) return;
//     refetchStationInfo(stationId).catch((e) => setError(e?.message || "fetch failed"));
//   }, [stationId, refetchStationInfo]);

//   return (
//     <section className="tw-space-y-4">
//       <div className="tw-flex tw-items-center tw-gap-3">
//         {!stationId ? (
//           <span className="tw-text-gray-600">ยังไม่ได้เลือกสถานี</span>
//         ) : loadingInfo ? (
//           <span className="tw-text-blue-600">กำลังโหลด...</span>
//         ) : error ? (
//           <span className="tw-text-red-600">{error}</span>
//         ) : (
//           <div className="tw-text-sm tw-text-gray-600">
//             <div className="tw-font-semibold tw-mb-1">Module Status:</div>
//             <div className="tw-grid tw-grid-cols-2 tw-gap-x-4">
//               <div>Module 1: <span className={modulesStatus.module1IsActive ? "tw-text-green-600" : "tw-text-red-600"}>{String(modulesStatus.module1IsActive)}</span></div>
//               <div>Module 2: <span className={modulesStatus.module2IsActive ? "tw-text-green-600" : "tw-text-red-600"}>{String(modulesStatus.module2IsActive)}</span></div>
//               <div>Module 3: <span className={modulesStatus.module3IsActive ? "tw-text-green-600" : "tw-text-red-600"}>{String(modulesStatus.module3IsActive)}</span></div>
//               <div>Module 4: <span className={modulesStatus.module4IsActive ? "tw-text-green-600" : "tw-text-red-600"}>{String(modulesStatus.module4IsActive)}</span></div>
//               <div>Module 5: <span className={modulesStatus.module5IsActive ? "tw-text-green-600" : "tw-text-red-600"}>{String(modulesStatus.module5IsActive)}</span></div>
//               <div>Module 6: <span className={modulesStatus.module6IsActive ? "tw-text-green-600" : "tw-text-red-600"}>{String(modulesStatus.module6IsActive)}</span></div>
//               <div>Module 7: <span className={modulesStatus.module7IsActive ? "tw-text-green-600" : "tw-text-red-600"}>{String(modulesStatus.module7IsActive)}</span></div>
//             </div>
//           </div>
//         )}

//         <button
//           className="tw-ml-auto tw-text-sm tw-rounded-md tw-border tw-px-3 tw-py-1 hover:tw-bg-gray-50 tw-transition-colors"
//           onClick={() => {
//             if (stationId) {
//               refetchStationInfo(stationId);
//             }
//           }}
//           disabled={loadingInfo}
//         >
//           {loadingInfo ? "Refreshing..." : "Refresh"}
//         </button>
//       </div>

//       <div className="tw-w-full tw-grid tw-gap-6 tw-grid-cols-1 md:!tw-grid-cols-3">
//         {AI_ITEMS.map((item) => {
//           const statusKey = `${item.id}IsActive`;
//           const isEnabled = modulesStatus[statusKey];
          
//           return (
//             <AiItemCard
//               key={item.id}
//               item={item}
//               enabled={isEnabled}
//               onToggle={(next: boolean) => toggleModule(item.id, next)}
//               disabled={loadingInfo}
//             />
//           );
//         })}
//       </div>
//     </section>
//   );
// }
"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Card, CardBody, CardHeader, Switch, Typography } from "@material-tailwind/react";
import CircleProgress from "./CircleProgress";
import { useSearchParams } from "next/navigation";

type AiItem = {
  id: string;
  title: string;
  iconClass: string;
  defaultEnabled?: boolean;
  progress?: number;
};

// Mapping ระหว่าง module ID กับชื่อที่แสดง
// ค่า progress ที่ตั้งไว้จะเป็นค่า fallback กรณีดึงจาก API ไม่สำเร็จ
const AI_ITEMS: AiItem[] = [
  { id: "module1", title: "MDB Dust Filters Prediction", iconClass: "fa-solid fa-filter", defaultEnabled: false, progress: 0 },
  { id: "module2", title: "Charger Dust Filters Prediction", iconClass: "fa-solid fa-charging-station", defaultEnabled: false, progress: 0 },
  { id: "module3", title: "Online / Offline Prediction", iconClass: "fa-solid fa-wifi", defaultEnabled: false, progress: 0 },
  { id: "module4", title: "AB Normal Power Supply Prediction", iconClass: "fa-solid fa-bolt", defaultEnabled: false, progress: 0 },
  { id: "module5", title: "Network Prediction", iconClass: "fa-solid fa-signal", defaultEnabled: false, progress: 0 },
  { id: "module6", title: "The Remaining Useful Life (RUL) Prediction", iconClass: "fa-regular fa-clock", defaultEnabled: false, progress: 0 },
  { id: "module7", title: "Root Cause Analysis Prediction", iconClass: "fa-solid fa-magnifying-glass", defaultEnabled: false, progress: 0 },
];

/* -------- Reusable card -------- */
function AiItemCard({
  item,
  enabled,
  onToggle,
  disabled,
}: {
  item: AiItem;
  enabled?: boolean;
  onToggle?: (next: boolean) => void;
  disabled?: boolean;
}) {
  const isControlled = typeof enabled === "boolean";
  const [localEnabled, setLocalEnabled] = React.useState(!!item.defaultEnabled);
  const value = isControlled ? enabled : localEnabled;

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const next = e.target.checked;
    if (isControlled) onToggle?.(next);
    else setLocalEnabled(next);
  };

  const displayValue = value ? (Number(item.progress) || 0) : 0;

  return (
    <Card
      variant="gradient"
      className={`tw-flex tw-h-full tw-flex-col tw-justify-between tw-border tw-shadow-sm ${value ? "!tw-bg-gray-800 !tw-text-white" : "!tw-bg-white"}`}
    >
      <CardHeader floated={false} shadow={false} color="transparent" className="tw-overflow-visible tw-rounded-none">
        <div className="tw-flex tw-items-center tw-justify-between">
          <div className="tw-flex tw-items-center tw-gap-3">
            <i className={`fa-fw ${item.iconClass} tw-text-xl ${value ? "tw-text-white" : "tw-text-gray-800"}`} />
            <div>
              <Typography variant="h6" className={`tw-leading-none ${value ? "tw-text-white" : "tw-text-gray-900"}`}>
                {item.title}
              </Typography>
              <Typography className={`!tw-text-xs !tw-font-normal ${value ? "tw-text-white/80" : "!tw-text-blue-gray-500"}`}>
                {value ? "Enabled" : "Disabled"}
              </Typography>
            </div>
          </div>

          <div className="tw-flex tw-items-center tw-gap-2">
            <Typography className={`!tw-text-sm tw-hidden sm:tw-block ${value ? "tw-text-white/90" : "!tw-text-blue-gray-500"}`}>
              {value ? "On" : "Off"}
            </Typography>
            <Switch
              checked={value}
              onChange={handleChange}
              disabled={disabled}
              color={value ? "blue-gray" : "blue"}
              aria-label={`Enable ${item.title}`}
            />
          </div>
        </div>
      </CardHeader>

      <CardBody className="tw-p-4">
        <div className={value ? "" : "tw-opacity-50"}>
          <div className="tw-mx-auto tw-max-w-[220px] tw-w-full">
            <CircleProgress
              label="Health Index"
              // value={item.progress ?? 0}
              value={displayValue}
              valueClassName={value ? "tw-text-white" : "tw-text-blue-gray-900"}
              labelClassName={value ? "tw-text-white/80" : "tw-text-blue-gray-600"}
              colorClass={value ? undefined : "tw-text-blue-gray-400"}
            />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

type StationInfoResponse = {
  station?: {
    module1_isActive?: boolean;
    module2_isActive?: boolean;
    module3_isActive?: boolean;
    module4_isActive?: boolean;
    module5_isActive?: boolean;
    module6_isActive?: boolean;
    module7_isActive?: boolean;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function AiSection() {
  const searchParams = useSearchParams();
  const [stationId, setStationId] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [etag, setEtag] = useState<string | null>(null);

  const [modulesStatus, setModulesStatus] = useState<{
    [key: string]: boolean;
  }>({
    module1IsActive: false,
    module2IsActive: false,
    module3IsActive: false,
    module4IsActive: false,
    module5IsActive: false,
    module6IsActive: false,
    module7IsActive: false,
  });

  const [modulesProgress, setModulesProgress] = useState<{
    [key: string]: number;
  }>({
    module1: 0,
    module2: 0,
    module3: 0,
    module4: 0,
    module5: 0,
    module6: 0,
    module7: 0,
  });

  const refetchModulesProgress = useCallback(async (sid: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
      const res = await fetch(
        `${API_BASE}/modules/progress?station_id=${encodeURIComponent(sid)}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          credentials: token ? "omit" : "include",
          cache: "no-store",
        }
      );

      if (res.ok) {
        const progressData = await res.json();
        console.log("Progress Data:", progressData);
        setModulesProgress(progressData);
      }
    } catch (e) {
      console.error("Failed to fetch progress:", e);
    }
  }, []);

  const refetchStationInfo = useCallback(async (sid: string) => {
    setLoadingInfo(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
      const res = await fetch(
        `${API_BASE}/station/info?station_id=${encodeURIComponent(sid)}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          credentials: token ? "omit" : "include",
          cache: "no-store",
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json: StationInfoResponse = await res.json();
      console.log("Station Info:", json);
      
      const newStatus = {
        module1IsActive: Boolean(json?.station?.module1_isActive),
        module2IsActive: Boolean(json?.station?.module2_isActive),
        module3IsActive: Boolean(json?.station?.module3_isActive),
        module4IsActive: Boolean(json?.station?.module4_isActive),
        module5IsActive: Boolean(json?.station?.module5_isActive),
        module6IsActive: Boolean(json?.station?.module6_isActive),
        module7IsActive: Boolean(json?.station?.module7_isActive),
      };
      
      setModulesStatus(newStatus);
      console.log("modulesStatus updated:", newStatus);

      // ดึงข้อมูล progress หลังจากดึง status เสร็จ
      await refetchModulesProgress(sid);
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message || "fetch failed");
      } else {
        setError("Unknown error occurred");
      }
    } finally {
      setLoadingInfo(false);
    }
  }, [refetchModulesProgress]);

  const toggleModule = useCallback(async (moduleId: string, next: boolean) => {
    if (!stationId) return;

    const fieldName = `${moduleId}IsActive`;

    if (modulesStatus[fieldName] === next) return;

    // Optimistic update
    setModulesStatus((prevState) => ({
      ...prevState,
      [fieldName]: next,
    }));

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
      const res = await fetch(`${API_BASE}/station/${encodeURIComponent(stationId)}/${moduleId}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json", 
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        },
        credentials: token ? "omit" : "include",
        body: JSON.stringify({ enabled: next }),
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      // Refetch to get the latest data
      await refetchStationInfo(stationId);
    } catch (e) {
      console.error("Toggle module error:", e);
      // Rollback on error
      setModulesStatus((prevState) => ({
        ...prevState,
        [fieldName]: !next,
      }));
      setError(e instanceof Error ? e.message : "Failed to toggle module");
    }
  }, [stationId, modulesStatus, refetchStationInfo]);

  useEffect(() => {
    const sidFromUrl = searchParams.get("station_id");
    if (sidFromUrl) {
      setStationId(sidFromUrl);
      if (typeof window !== "undefined") {
        localStorage.setItem("selected_station_id", sidFromUrl);
      }
      return;
    }
    const sidLocal = typeof window !== "undefined" ? localStorage.getItem("selected_station_id") : null;
    setStationId(sidLocal);
  }, [searchParams]);

  useEffect(() => {
    if (!stationId) return;
    refetchStationInfo(stationId).catch((e) => setError(e?.message || "fetch failed"));
  }, [stationId, refetchStationInfo]);

  return (
    <section className="tw-space-y-4">
      <div className="tw-flex tw-items-center tw-gap-3">
        {/* {!stationId ? (
          <span className="tw-text-gray-600">ยังไม่ได้เลือกสถานี</span>
        ) : loadingInfo ? (
          <span className="tw-text-blue-600">กำลังโหลด...</span>
        ) : error ? (
          <span className="tw-text-red-600">{error}</span>
        ) : (
          <div className="tw-text-sm tw-text-gray-600">
            <div className="tw-font-semibold tw-mb-1">Module Status:</div>
            <div className="tw-grid tw-grid-cols-2 tw-gap-x-4">
              <div>Module 1: <span className={modulesStatus.module1IsActive ? "tw-text-green-600" : "tw-text-red-600"}>{String(modulesStatus.module1IsActive)}</span></div>
              <div>Module 2: <span className={modulesStatus.module2IsActive ? "tw-text-green-600" : "tw-text-red-600"}>{String(modulesStatus.module2IsActive)}</span></div>
              <div>Module 3: <span className={modulesStatus.module3IsActive ? "tw-text-green-600" : "tw-text-red-600"}>{String(modulesStatus.module3IsActive)}</span></div>
              <div>Module 4: <span className={modulesStatus.module4IsActive ? "tw-text-green-600" : "tw-text-red-600"}>{String(modulesStatus.module4IsActive)}</span></div>
              <div>Module 5: <span className={modulesStatus.module5IsActive ? "tw-text-green-600" : "tw-text-red-600"}>{String(modulesStatus.module5IsActive)}</span></div>
              <div>Module 6: <span className={modulesStatus.module6IsActive ? "tw-text-green-600" : "tw-text-red-600"}>{String(modulesStatus.module6IsActive)}</span></div>
              <div>Module 7: <span className={modulesStatus.module7IsActive ? "tw-text-green-600" : "tw-text-red-600"}>{String(modulesStatus.module7IsActive)}</span></div>
            </div>
          </div>
        )} */}

        {!stationId ? (
          <span className="tw-text-gray-600">ยังไม่ได้เลือกสถานี</span>
        ) : loadingInfo ? (
          <span className="tw-text-blue-600">กำลังโหลด...</span>
        ) :  (
          <span className="tw-text-red-600">{error}</span>
        
        )}

        <button
          className="tw-ml-auto tw-text-sm tw-rounded-md tw-border tw-px-3 tw-py-1 hover:tw-bg-gray-50 tw-transition-colors"
          onClick={() => {
            if (stationId) {
              refetchStationInfo(stationId);
            }
          }}
          disabled={loadingInfo}
        >
          {loadingInfo ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="tw-w-full tw-grid tw-gap-6 tw-grid-cols-1 md:!tw-grid-cols-3">
        {AI_ITEMS.map((item) => {
          const statusKey = `${item.id}IsActive`;
          const isEnabled = modulesStatus[statusKey];
          const progress = modulesProgress[item.id] || item.progress || 0;
          
          return (
            <AiItemCard
              key={item.id}
              item={{...item, progress}}
              enabled={isEnabled}
              onToggle={(next: boolean) => toggleModule(item.id, next)}
              disabled={loadingInfo}
            />
          );
        })}
      </div>
    </section>
  );
}