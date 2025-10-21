
// "use client";
// import React, { useEffect, useMemo, useState } from "react";
// import { Card, CardHeader, CardBody, Typography, Switch } from "@material-tailwind/react";

// const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// type LatestPMResp = {
//   pm_date?: string | null;
//   pm_next_date?: string | null;
//   timestamp?: string | null;
// };

// type PMCardProps = {
//   stationId: string; // ⬅️ ส่ง station_id เข้ามา
// };

// function fmtDateTH(d?: string | null) {
//   if (!d) return "-";
//   try {
//     // รองรับ 'YYYY-MM-DD' หรือ ISO
//     const dt = d.length === 10 ? new Date(d + "T00:00:00+07:00") : new Date(d);
//     return new Intl.DateTimeFormat("th-TH", {
//       year: "numeric",
//       month: "short",
//       day: "2-digit",
//     }).format(dt);
//   } catch {
//     return d;
//   }
// }

// export default function PMCard({ stationId }: PMCardProps) {
//   const [isActive, setIsActive] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [pmDate, setPmDate] = useState<string | null>(null);
//   const [pmNextDate, setPmNextDate] = useState<string | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   const token = useMemo(
//     () =>
//       localStorage.getItem("access_token") ||
//       localStorage.getItem("accessToken") ||
//       "",
//     []
//   );

//   // ดึง PM เมื่อเปิดสวิตช์หรือ stationId เปลี่ยน
//   useEffect(() => {
//     if (!isActive) return;
//     if (!stationId || !token) return;

//     let aborted = false;
//     const ctrl = new AbortController();

//     const fetchLatest = async () => {
//       setLoading(true);
//       setError(null);
//       try {
//         // 1) พยายามดึงจาก /pmreport/latest (มี pm_next_date ให้เลย)
//         const res = await fetch(
//           `${API_BASE}/pmreport/latest/?station_id=${encodeURIComponent(stationId)}`,
//           {
//             headers: { Authorization: `Bearer ${token}` },
//             credentials: "include",
//             signal: ctrl.signal,
//           }
//         );

//         if (res.ok) {
//           const data: LatestPMResp = await res.json();
//           if (!aborted) {
//             setPmDate(data.pm_date ?? null);
//             setPmNextDate(data.pm_next_date ?? null);
//           }
//         } else {
//           // 2) ถ้าหาไม่เจอ → fallback ไป /pmurl/list เอา record ล่าสุดหน้าแรก
//           const res2 = await fetch(
//             `${API_BASE}/pmurl/list?station_id=${encodeURIComponent(
//               stationId
//             )}&page=1&pageSize=1`,
//             {
//               headers: { Authorization: `Bearer ${token}` },
//               credentials: "include",
//               signal: ctrl.signal,
//             }
//           );
//           if (res2.ok) {
//             const j = await res2.json();
//             const first = (j?.items ?? [])[0];
//             if (!aborted) {
//               setPmDate(first?.pm_date ?? null);
//               // ถ้าอยากคำนวณนัดครั้งถัดไปเอง (6 เดือน):
//               if (first?.pm_date) {
//                 const d = new Date(first.pm_date + "T00:00:00+07:00");
//                 d.setMonth(d.getMonth() + 6);
//                 setPmNextDate(d.toISOString().slice(0, 10));
//               } else {
//                 setPmNextDate(null);
//               }
//             }
//           } else {
//             throw new Error(`pmurl/list failed: ${res2.status}`);
//           }
//         }
//       } catch (e: any) {
//         if (!aborted) setError(e?.message ?? "fetch error");
//       } finally {
//         if (!aborted) setLoading(false);
//       }
//     };

//     fetchLatest();
//     return () => {
//       aborted = true;
//       ctrl.abort();
//     };
//   }, [isActive, stationId, token]);

//   return (
//     <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-h-full">
//       <CardHeader
//         floated={false}
//         shadow={false}
//         color="transparent"
//         className="tw-overflow-visible tw-rounded-none"
//       >
//         <div className="tw-flex tw-items-center tw-justify-between">
//           <div className="tw-flex tw-items-center tw-gap-3">
//             <i className="fa-fw fa-solid fa-screwdriver-wrench tw-text-xl tw-text-gray-800" aria-hidden="true" />
//             <div>
//               <Typography variant="h6" className="tw-leading-none tw-text-gray-900">
//                 Preventive Maintenance
//               </Typography>
//               <Typography className="!tw-text-xs !tw-font-normal !tw-text-blue-gray-500">
//                 {isActive ? "Enabled" : "Disable"}
//               </Typography>
//             </div>
//           </div>
//           <div className="tw-flex tw-items-center tw-gap-2">
//             <Typography className="tw-text-sm tw-text-blue-gray-600">
//               {isActive ? "Active" : "Inactive"}
//             </Typography>
//             <Switch checked={isActive} onChange={() => setIsActive(v => !v)} />
//           </div>
//         </div>
//       </CardHeader>

//       <CardBody className="tw-flex tw-flex-col tw-gap-2 tw-p-6">
//         {!isActive ? (
//           <Typography color="blue-gray">-</Typography>
//         ) : loading ? (
//           <Typography color="blue-gray">กำลังโหลด...</Typography>
//         ) : error ? (
//           <Typography color="red">เกิดข้อผิดพลาด: {error}</Typography>
//         ) : (
//           <>
//             <div className="tw-flex tw-justify-between">
//               <Typography color="blue-gray" className="tw-font-medium">
//                 PM latest
//               </Typography>
//               <Typography color="blue-gray">{fmtDateTH(pmDate)}</Typography>
//             </div>
//             <div className="tw-flex tw-justify-between">
//               <Typography color="blue-gray" className="tw-font-medium">
//                 PM next
//               </Typography>
//               <Typography color="blue-gray">{fmtDateTH(pmNextDate)}</Typography>
//             </div>
            
//           </>
//         )}
//       </CardBody>
//     </Card>
//   );
// }

"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardBody, Typography, Switch } from "@material-tailwind/react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type LatestPMResp = {
  pm_date?: string | null;
  pm_next_date?: string | null;
  timestamp?: string | null;
};

type PMCardProps = {
  stationId: string;
};

// --- Date utils ---
function parseAsDateLocal(dateStr?: string | null, tzOffsetMinutes = 7 * 60) {
  if (!dateStr) return null;
  try {
    // รับทั้ง 'YYYY-MM-DD' และ ISO
    if (dateStr.length === 10) {
      // สร้างเป็นเวลา 00:00:00 ในโซนเวลาไทย (UTC+7)
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      // ชดเชยให้กลายเป็น "พื้นฐานไทย" โดยลบ offset ออกเพื่อให้เที่ยงคืนไทย
      dt.setUTCMinutes(dt.getUTCMinutes() - tzOffsetMinutes);
      return dt;
    }
    return new Date(dateStr);
  } catch {
    return null;
  }
}

function fmtDateEN(d?: string | null) {
  const dt = parseAsDateLocal(d);
  if (!dt) return "-";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(dt);
  } catch {
    return d ?? "-";
  }
}

function daysUntil(dateStr?: string | null) {
  const target = parseAsDateLocal(dateStr);
  if (!target) return null;

  // วันนี้ (โซนเวลาไทย) ที่เวลา 00:00
  const now = new Date();
  const nowTH = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  // ขยับให้เป็นเที่ยงคืนไทยโดยลบ 7 ชั่วโมงออก
  nowTH.setUTCHours(nowTH.getUTCHours() - 7, 0, 0, 0);

  // ปัดเวลาเป้าหมายให้เป็นเที่ยงคืนไทยด้วย (แค่เอาวันเปล่า ๆ มาเทียบ)
  const tgtTH = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  );
  tgtTH.setUTCHours(tgtTH.getUTCHours() - 7, 0, 0, 0);

  const diffMs = tgtTH.getTime() - nowTH.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays; // อาจเป็นลบถ้าเลยกำหนด
}

function renderDaysLeft(nextDate?: string | null) {
  const d = daysUntil(nextDate);
  if (d === null) return "-";
  if (d > 0) return `in ${d} day${d === 1 ? "" : "s"}`;
  if (d === 0) return "today";
  const overdue = Math.abs(d);
  return `overdue by ${overdue} day${overdue === 1 ? "" : "s"}`;
}

export default function PMCard({ stationId }: PMCardProps) {
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pmDate, setPmDate] = useState<string | null>(null);
  const [pmNextDate, setPmNextDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(
    () =>
      localStorage.getItem("access_token") ||
      localStorage.getItem("accessToken") ||
      "",
    []
  );

  useEffect(() => {
    if (!isActive) return;
    if (!stationId || !token) return;

    let aborted = false;
    const ctrl = new AbortController();

    const fetchLatest = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1) แหล่งหลัก
        const res = await fetch(
          `${API_BASE}/pmreport/latest/?station_id=${encodeURIComponent(stationId)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
            signal: ctrl.signal,
          }
        );

        if (res.ok) {
          const data: LatestPMResp = await res.json();
          if (!aborted) {
            setPmDate(data.pm_date ?? null);
            setPmNextDate(data.pm_next_date ?? null);
          }
        } else {
          // 2) fallback จากไฟล์ PM URL
          const res2 = await fetch(
            `${API_BASE}/pmurl/list?station_id=${encodeURIComponent(
              stationId
            )}&page=1&pageSize=1`,
            {
              headers: { Authorization: `Bearer ${token}` },
              credentials: "include",
              signal: ctrl.signal,
            }
          );
          if (res2.ok) {
            const j = await res2.json();
            const first = (j?.items ?? [])[0];
            if (!aborted) {
              setPmDate(first?.pm_date ?? null);
              if (first?.pm_date) {
                const tmp = new Date(first.pm_date + "T00:00:00+07:00");
                tmp.setMonth(tmp.getMonth() + 6);
                setPmNextDate(tmp.toISOString().slice(0, 10));
              } else {
                setPmNextDate(null);
              }
            }
          } else {
            throw new Error(`pmurl/list failed: ${res2.status}`);
          }
        }
      } catch (e: any) {
        if (!aborted) setError(e?.message ?? "fetch error");
      } finally {
        if (!aborted) setLoading(false);
      }
    };

    fetchLatest();
    return () => {
      aborted = true;
      ctrl.abort();
    };
  }, [isActive, stationId, token]);

  return (
    <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-h-full">
      <CardHeader
        floated={false}
        shadow={false}
        color="transparent"
        className="tw-overflow-visible tw-rounded-none"
      >
        <div className="tw-flex tw-items-center tw-justify-between">
          <div className="tw-flex tw-items-center tw-gap-3">
            <i className="fa-fw fa-solid fa-screwdriver-wrench tw-text-xl tw-text-gray-800" aria-hidden="true" />
            <div>
              <Typography variant="h6" className="tw-leading-none tw-text-gray-900">
                Preventive Maintenance
              </Typography>
              <Typography className="!tw-text-xs !tw-font-normal !tw-text-blue-gray-500">
                {isActive ? "Enabled" : "Disabled"}
              </Typography>
            </div>
          </div>
          <div className="tw-flex tw-items-center tw-gap-2">
            <Typography className="tw-text-sm tw-text-blue-gray-600">
              {isActive ? "Active" : "Inactive"}
            </Typography>
            <Switch checked={isActive} onChange={() => setIsActive(v => !v)} />
          </div>
        </div>
      </CardHeader>

      <CardBody className="tw-flex tw-flex-col tw-gap-2 tw-p-6">
        {!isActive ? (
          <Typography color="blue-gray">-</Typography>
        ) : loading ? (
          <Typography color="blue-gray">Loading…</Typography>
        ) : error ? (
          <Typography color="red">Error: {error}</Typography>
        ) : (
          <>
            <div className="tw-flex tw-justify-between">
              <Typography color="blue-gray" className="tw-font-medium">
                PM Latest
              </Typography>
              <Typography color="blue-gray">{fmtDateEN(pmDate)}</Typography>
            </div>

            <div className="tw-flex tw-justify-between">
              <Typography color="blue-gray" className="tw-font-medium">
                Next PM
              </Typography>
              <Typography color="blue-gray">{fmtDateEN(pmNextDate)}</Typography>
            </div>

            <div className="tw-flex tw-justify-between">
              <Typography color="blue-gray" className="tw-font-medium">
                Days Left
              </Typography>
              <Typography color="blue-gray">
                {renderDaysLeft(pmNextDate)}
              </Typography>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
