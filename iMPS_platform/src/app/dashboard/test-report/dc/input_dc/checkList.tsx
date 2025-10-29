"use client";

import React, { useState, useEffect } from "react";
import { Button, Input, Textarea } from "@material-tailwind/react";
import { useRouter, useSearchParams } from "next/navigation";

// Import the new components
import CMFormHeader from "@/app/dashboard/test-report/components/dc/DCFormHeader";
// import CMFormHeader1 from "@/app/dashboard/test-report/components/dc/DCFormHeader1";
import DCFormMeta from "@/app/dashboard/test-report/components/dc/DCFormMeta";
import EquipmentSection from "@/app/dashboard/test-report/components/dc/DCEquipmentSection";
import ACFormActions from "@/app/dashboard/test-report/components/dc/DCFormActions";
// import DCTest1Grid from "@/app/dashboard/test-report/components/dc/DCTest1Grid";
import DCTest1Grid, { mapToElectricalPayload, type TestResults } from "@/app/dashboard/test-report/components/dc/DCTest1Grid";
import ACTest2Grid, { mapToChargerPayload, type TestCharger } from "@/app/dashboard/test-report/components/dc/DCTest2Grid";
import ACPhotoSection from "@/app/dashboard/test-report/components/dc/DCPhotoSection";
import ACSignatureSection from "@/app/dashboard/test-report/components/dc/DCSignatureSection";
import ACSignatureSection1 from "@/app/dashboard/test-report/components/dc/DCSignatureSection1";

type Severity = "" | "Low" | "Medium" | "High" | "Critical";
type Status = "" | "DC" | "AC";

type CorrectiveItem = {
  text: string;
  images: { file: File; url: string }[];
};

type Job = {
  issue_id: string;
  inspection_date: string;
  location: string;
  equipment_list: string[];
  problem_details: string;
  problem_type: string;
  severity: Severity;
  reported_by: string[];
  assignee: string;
  initial_cause: string;
  corrective_actions: CorrectiveItem[];
  resolved_date: string;
  repair_result: RepairOption | "";
  preventive_action: string[];
  status: Status;
  // remarks: string;
  manufacturer?: string;
  model?: string;
  power?: string;
  brand?: string;
  firmware_version?: string;
  serial_number?: string;
};

type Head = {
  issue_id: string;            // ← เพิ่ม
  inspection_date: string;     // ← เพิ่ม
  location: string;
  manufacturer?: string;
  model?: string;
  power?: string;
  firmware_version?: string;
  serial_number?: string;
};

type EquipmentBlock = {
  manufacturers: string[];
  models: string[];
  serialNumbers: string[];
};


type RepairOption = (typeof REPAIR_OPTIONS)[number];


type SymbolPick = "pass" | "notPass" | "notTest" | "";
type PhasePick = "L1L2L3" | "L3L2L1" | "";

type ResponsibilityData = {
  performed: { name: string; signature: string; date: string; company: string };
  approved: { name: string; signature: string; date: string; company: string };
  witnessed: { name: string; signature: string; date: string; company: string };
};

const PHOTO_GROUP_KEYS = [
  "nameplate",       // index 0
  "charger",         // index 1
  "circuit_breaker", // index 2
  "rcd",             // index 3
  "gun1",            // index 4
  "gun2",            // index 5
] as const;




const REPAIR_OPTIONS = [
  "แก้ไขสำเร็จ",
  "แก้ไขไม่สำเร็จ",
  "อยู่ระหว่างการติดตามผล",
  "อยู่ระหว่างการรออะไหล่",
] as const;

const LIST_ROUTE = "/dashboard/test-report";

/* ค่าตั้งต้นของฟอร์ม (ใช้สำหรับ reset ด้วย) */
const INITIAL_JOB: Job = {
  issue_id: "",
  inspection_date: "",
  location: "",
  equipment_list: [""],
  problem_details: "",
  problem_type: "",
  severity: "",
  reported_by: [""],
  assignee: "",
  initial_cause: "",
  corrective_actions: [{ text: "", images: [] }],
  resolved_date: "",
  repair_result: "",
  preventive_action: [""],
  status: "",
  // remarks: "",
  model: "",
  brand: "",
};

const INITIAL_HEAD: Head = {
  issue_id: "",                // ← เพิ่ม
  inspection_date: "",         // ← เพิ่ม
  location: "",
  manufacturer: "",
  model: "",
  power: "",
  firmware_version: "",
  serial_number: "",
};

type StationPublic = {
  station_id: string;
  station_name: string;
  SN?: string;
  WO?: string;
  chargeBoxID?: string;
  model?: string;
  status?: boolean;
  brand?: string;
};

const INITIAL_EQUIPMENT: EquipmentBlock = {
  manufacturers: [""],
  models: [""],
  serialNumbers: [""],
};

type PhotoItem = { text: string; images: { file: File; url: string }[] };


const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function DCForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stationId = searchParams.get("station_id");

  async function uploadPhotoSection(reportId: string, items: PhotoItem[]) {
    if (!stationId) return; // ใช้ stationId จาก useSearchParams()

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const files = (it?.images || []).map(im => im.file).filter(Boolean) as File[];
      if (!files.length) continue;

      const fd = new FormData();
      fd.append("station_id", stationId);
      fd.append("item_index", String(i));     // <<-- ส่ง index
      if (it.text) fd.append("remark", it.text);
      files.forEach(f => fd.append("files", f, f.name));

      const res = await fetch(`${API_BASE}/dctestreport/${encodeURIComponent(reportId)}/photos`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(`อัปโหลดรูป index ${i} ล้มเหลว: ${msg}`);
      }
    }
  }

  const buildListUrl = () => {
    const params = new URLSearchParams();
    if (stationId) params.set("station_id", stationId);
    const tab = (searchParams.get("tab") ?? "DC"); // กลับแท็บเดิม (default = open)
    params.set("tab", tab);
    return `${LIST_ROUTE}?${params.toString()}`;
  };

  const [job, setJob] = useState<Job>({ ...INITIAL_JOB });
  const [head, setHead] = useState<Head>({ ...INITIAL_HEAD });
  const [equipment, setEquipment] = useState<EquipmentBlock>({ ...INITIAL_EQUIPMENT });
  const [dcTest1Results, setDCTest1Results] = useState<TestResults | null>(null);
  const [dcChargerTest, setDCChargerTest] = useState<TestCharger | null>(null);

  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([]);

  const [sigRemark, setSigRemark] = useState<string>("");
  const [sigSymbol, setSigSymbol] = useState<SymbolPick>("");
  const [sigPhase, setSigPhase] = useState<PhasePick>("");
  const [sigResp, setSigResp] = useState<ResponsibilityData>({
    performed: { name: "", signature: "", date: "", company: "" },
    approved: { name: "", signature: "", date: "", company: "" },
    witnessed: { name: "", signature: "", date: "", company: "" },
  });

  const [testRemark, setTestRemark] = useState<string>("");
  const [imgRemark, setImgRemark] = useState<string>("");


  const onHeadChange = (updates: Partial<Head>) =>
    setHead((prev) => ({ ...prev, ...updates }));
  const [summary, setSummary] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const onSave = () => {
    console.log({ job, summary });
    alert("บันทึกชั่วคราว (เดโม่) – ดูข้อมูลใน console");
  };

  // ตัวช่วยสำหรับ equipment (อัปเดตเป็นรายแถว)
  const updateManufacturer = (i: number, val: string) =>
    setEquipment(prev => {
      const arr = [...prev.manufacturers];
      arr[i] = val;
      return { ...prev, manufacturers: arr };
    });

  const updateModel = (i: number, val: string) =>
    setEquipment(prev => {
      const arr = [...prev.models];
      arr[i] = val;
      return { ...prev, models: arr };
    });

  const updateSerial = (i: number, val: string) =>
    setEquipment(prev => {
      const arr = [...prev.serialNumbers];
      arr[i] = val;
      return { ...prev, serialNumbers: arr };
    });

  const addEquipmentRow = () =>
    setEquipment(prev => ({
      manufacturers: [...prev.manufacturers, ""],
      models: [...prev.models, ""],
      serialNumbers: [...prev.serialNumbers, ""],
    }));

  const removeEquipmentRow = (i: number) =>
    setEquipment(prev => {
      const man = [...prev.manufacturers];
      const mod = [...prev.models];
      const ser = [...prev.serialNumbers];

      if (man.length <= 1) {
        return { manufacturers: [""], models: [""], serialNumbers: [""] };
      }
      man.splice(i, 1);
      mod.splice(i, 1);
      ser.splice(i, 1);
      return { manufacturers: man, models: mod, serialNumbers: ser };
    });




  const onFinalSave = async () => {
    try {
      if (!stationId) {
        alert("ไม่พบ station_id ใน URL");
        return;
      }

      if (!dcTest1Results) {
        alert("ยังไม่ได้กรอกผลทดสอบ (Electrical Safety)");
        return;
      }

      if (!dcChargerTest) {
        alert("ยังไม่ได้กรอกผลทดสอบ (Electrical Safety)");
        return;
      }

      setSaving(true);

      const {
        inspection_date: headInspectionDate,
        issue_id: headIssueId,
        ...headWithoutDatesAndIssue
      } = head;

      // 👉 รวมค่า head ลงใน job ก่อนส่ง (ให้ head มีสิทธิ์ override)
      const mergedJob: Job = {
        ...job,
        issue_id: headIssueId || job.issue_id,
        inspection_date: headInspectionDate || job.inspection_date,
        location: head.location || job.location,
        manufacturer: head.manufacturer || job.manufacturer,
        model: head.model || job.model,
        power: head.power || job.power,
        firmware_version: head.firmware_version || job.firmware_version,
        serial_number: head.serial_number || job.serial_number,
      };

      // ✅ แปลงผล Electrical Safety (แยกรอบ r1/r2/r3, rcd, ฯลฯ)
      const electricalTest = mapToElectricalPayload(dcTest1Results);
      const electrical_safety = electricalTest.electricalSafety;

      const chargerTest = mapToChargerPayload(dcChargerTest);
      const charger_safety = chargerTest.electricalSafety;

      // 1) สร้างรายงานหลัก
      // const payload = {
      //   station_id: stationId,
      //   issue_id: headIssueId,
      //   inspection_date: headInspectionDate,
      //   summary,
      //   job: {
      //     ...job,
      //     // ฝั่งหลักเก็บแค่ชื่อไฟล์ (optional) แต่รูปจริงไปอัปโหลดในขั้นตอนถัดไป
      //     corrective_actions: job.corrective_actions.map((c) => ({
      //       text: c.text,
      //       images: c.images.map((img) => ({ name: img.file?.name ?? "" })),
      //     })),
      //   },
      //   head: headWithoutDatesAndIssue,
      //   equipment,
      // };

      const payload = {
        station_id: stationId,
        issue_id: mergedJob.issue_id,
        inspection_date: mergedJob.inspection_date,
        // summary,
        job: {
          ...mergedJob,
          corrective_actions: mergedJob.corrective_actions.map((c) => ({
            text: c.text,
            images: c.images.map((img) => ({ name: img.file?.name ?? "" })),
          })),
        },
        head: headWithoutDatesAndIssue,
        equipment,
        electrical_safety, // ⬅️ แนบข้อมูลจาก DCTest1Grid
        charger_safety,
        remarks: {
          testRematk: testRemark,       // remark ด้านบน
          imgRemark: imgRemark // remark หลังรูป
        },
        signature: {
          // remark: sigRemark,
          symbol: sigSymbol,
          phaseSequence: sigPhase,
          responsibility: sigResp,
        },
      };

      const res = await fetch(`${API_BASE}/dcreport/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error((await res.json()).detail || `HTTP ${res.status}`);

      const { report_id } = await res.json();

      // 2) อัปโหลดรูปตาม group (g1,g2,...) จาก Corrective Action
      await uploadPhotosForReport(report_id);
      await uploadPhotoSection(report_id, photoItems);

      // 3) (ถ้าต้องการ) finalize รายงาน
      // await fetch(`${API_BASE}/cmreport/${encodeURIComponent(report_id)}/finalize`, {
      //   method: "POST",
      //   credentials: "include",
      // });

      // 4) กลับหน้า list พร้อมพารามิเตอร์สถานี
      // const listUrl = `${LIST_ROUTE}?station_id=${encodeURIComponent(
      //   stationId
      // )}`;
      // router.replace(listUrl);

      router.replace(buildListUrl());
    } catch (e: any) {
      console.error(e);
      alert(`บันทึกไม่สำเร็จ: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const onCancelLocal = () => {
    const evt = new CustomEvent("dcform:cancel", { cancelable: true });
    const wasPrevented = !window.dispatchEvent(evt); // false = มีคนเรียก preventDefault()
    if (!wasPrevented) {
      router.replace(LIST_ROUTE);
    }
  };

  const handlePrint = () => window.print();

  /* -------------------- Helpers: ลดความซ้ำซ้อน -------------------- */
  type StringListKey = "equipment_list" | "preventive_action" | "reported_by";

  const setStringItem = (key: StringListKey) => (i: number, val: string) =>
    setJob((prev) => {
      const list = [...prev[key]];
      list[i] = val;
      return { ...prev, [key]: list };
    });

  const addStringItem = (key: StringListKey) => () =>
    setJob((prev) => ({ ...prev, [key]: [...prev[key], ""] }));

  const removeStringItem = (key: StringListKey) => (i: number) =>
    setJob((prev) => {
      const list = [...prev[key]];
      if (list.length <= 1) return { ...prev, [key]: [""] }; // อย่างน้อย 1 ช่อง
      list.splice(i, 1);
      return { ...prev, [key]: list };
    });

  const patchCorrective = (i: number, patch: Partial<CorrectiveItem>) =>
    setJob((prev) => {
      const list = [...prev.corrective_actions];
      list[i] = { ...list[i], ...patch };
      return { ...prev, corrective_actions: list };
    });

  const addCorrective = () =>
    setJob((prev) => ({
      ...prev,
      corrective_actions: [
        ...prev.corrective_actions,
        { text: "", images: [] },
      ],
    }));

  const removeCorrective = (i: number) =>
    setJob((prev) => {
      const list = [...prev.corrective_actions];
      if (list.length <= 1)
        return { ...prev, corrective_actions: [{ text: "", images: [] }] };
      list.splice(i, 1);
      return { ...prev, corrective_actions: list };
    });

  const addCorrectiveImages = (i: number, files: FileList | null) => {
    if (!files?.length) return;
    const imgs = Array.from(files).map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    const current = job.corrective_actions[i];
    patchCorrective(i, { images: [...current.images, ...imgs] });
  };

  const removeCorrectiveImage = (i: number, j: number) => {
    const imgs = [...job.corrective_actions[i].images];
    const url = imgs[j]?.url;
    if (url) URL.revokeObjectURL(url);
    imgs.splice(j, 1);
    patchCorrective(i, { images: imgs });
  };

  // Memoized handlers to prevent re-creating functions on every render
  const handleRemarkChange = React.useCallback((key: string, value: string) => {
    console.log("Remark changed:", key, value);
  }, []);

  const handlePFChange = React.useCallback((key: string, value: string) => {
    console.log("PF changed:", key, value);
  }, []);

  /* ---------- renderers ---------- */
  const renderMeasureGrid = (no: number) => {
    return <div></div>;
  };

  const renderQuestionBlock = (q: any) => {
    return <div></div>;
  };

  type NextIssueIdParams = {
    latestId?: string | null; // รหัสล่าสุดของเดือนนั้น (ถ้ามี)
    date?: Date | string; // วันที่อ้างอิง (เช่น found_date)
    prefix?: string; // ค่าเริ่มต้น "EL"
    pad?: number; // จำนวนหลักของเลขรัน (เริ่มต้น 2 => 01, 02, ...)
    start?: number; // เริ่มนับที่เลขไหน (เริ่มต้น 1)
  };

  function makeNextIssueId({
    latestId = null,
    date = new Date(),
    prefix = "EL",
    pad = 2,
    start = 1,
  }: NextIssueIdParams = {}): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const base = `${prefix}-${y}-${m}`;

    let seq = start;

    if (latestId) {
      // รองรับรูปแบบ EL-YYYY-MMNN...
      const rx = new RegExp(`^${prefix}-(\\d{4})-(\\d{2})(\\d+)$`);
      const m2 = latestId.match(rx);
      if (m2) {
        const [_, yy, mm, tail] = m2;
        if (Number(yy) === y && mm === m) {
          seq = Math.max(Number(tail) + 1, start);
        }
      }
    }

    const tail = String(seq).padStart(pad, "0");
    return `${base}${tail}`;
  }

  function localTodayISO(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // ⭐ ดึง station_name จาก API แล้วอัปเดตช่อง "สถานที่"
  useEffect(() => {
    let alive = true;
    if (!stationId) return;

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/station/info/public?station_id=${encodeURIComponent(
            stationId
          )}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { station: StationPublic } = await res.json();

        if (!alive) return;
        setHead((prev) => ({
          ...prev,
          location: data.station.station_name || prev.location, // 👈 เซ็ตสถานที่ = station_name
        }));
      } catch (err) {
        console.error("โหลดข้อมูลสถานีไม่สำเร็จ:", err);
        // จะ alert ก็ได้ถ้าต้องการ
      }
    })();

    return () => {
      alive = false;
    };
  }, [stationId]);

  useEffect(() => {
    function makeNextIssueId({
      latestId = null,
      date = new Date(),
      prefix = "EL",
      pad = 2,
      start = 1,
    }: NextIssueIdParams = {}): string {
      const d = typeof date === "string" ? new Date(date) : date;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const base = `${prefix}-${y}-${m}`;

      let seq = start;

      if (latestId) {
        // รองรับรูปแบบ EL-YYYY-MMNN...
        const rx = new RegExp(`^${prefix}-(\\d{4})-(\\d{2})(\\d+)$`);
        const m2 = latestId.match(rx);
        if (m2) {
          const [_, yy, mm, tail] = m2;
          if (Number(yy) === y && mm === m) {
            seq = Math.max(Number(tail) + 1, start);
          }
        }
      }

      const tail = String(seq).padStart(pad, "0");
      return `${base}${tail}`;
    }

    let alive = true;

    (async () => {
      const todayStr = localTodayISO(); // เช่น 2025-10-17
      const [y, m] = todayStr.split("-");

      let latestId: string | null = null;
      try {
        const res = await fetch(`/api/dc/latest-id?y=${y}&m=${m}`);
        if (res.ok) {
          const data = await res.json();
          latestId = data?.id ?? null; // เช่น "EL-2025-1007"
        }
      } catch {
        /* fallback: เริ่ม 01 */
      }

      const nextId = makeNextIssueId({ latestId, date: todayStr });

      if (!alive) return;
      setHead((prev) => ({
        ...prev,
        inspection_date: todayStr,
        issue_id: nextId,
      }));
    })();

    return () => {
      alive = false;
    };
  }, []); // ⭐ รันครั้งเดียวตอน mount

  async function uploadPhotosForReport(reportId: string) {
    if (!stationId) return;

    // loop แต่ละข้อของ Corrective Action → map เป็น group=g1,g2,...
    for (let i = 0; i < job.corrective_actions.length; i++) {
      const item = job.corrective_actions[i];
      const files = item.images.map((im) => im.file).filter(Boolean) as File[];
      if (!files.length) continue; // ข้อนี้ไม่มีรูปก็ข้าม

      const group = `g${i + 1}`; // g1, g2, ... (อย่าเกินที่ backend รองรับ)
      const fd = new FormData();
      fd.append("station_id", stationId);
      fd.append("group", group);
      if (item.text) fd.append("remark", item.text); // จะไม่ส่งก็ได้

      // แนบหลายไฟล์ด้วย key "files" ซ้ำ ๆ
      files.forEach((f) => fd.append("files", f, f.name));

      const res = await fetch(
        `${API_BASE}/dctestreport/${encodeURIComponent(reportId)}/photos`,
        {
          method: "POST",
          body: fd,
          credentials: "include", // ถ้าใช้ cookie httpOnly
          // ถ้าใช้ Bearer token ให้ใส่ headers.Authorization แทน
        }
      );

      if (!res.ok) {
        const msg = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(`อัปโหลดรูปข้อที่ ${i + 1} ล้มเหลว: ${msg}`);
      }
    }
  }
  /* ----------------------------------------------------------------- */

  return (
    <section className="tw-pb-24">
      <form
        action="#"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          return false;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
      >
        <div className="tw-mx-auto tw-max-w-4xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-sm tw-p-6 md:tw-p-8 tw-print:tw-shadow-none tw-print:tw-border-0">
          {/* HEADER */}
          <CMFormHeader headerLabel="DC Report" />

          {/* BODY */}
          <div className="tw-mt-8 tw-space-y-8">
            {/* META – การ์ดหัวเรื่อง */}
            <DCFormMeta
              head={head} onHeadChange={onHeadChange}
            />

            {/* Equipment Identification Details */}
            <EquipmentSection
              equipmentList={equipment.manufacturers}
              reporterList={equipment.models}
              serialNumbers={equipment.serialNumbers}
              onAdd={addEquipmentRow}
              onUpdateEquipment={updateManufacturer}
              onUpdateReporter={updateModel}
              onUpdateSerial={updateSerial}
              onRemove={removeEquipmentRow}
            />

            {/* AC Test Results Grid */}
            <div className="tw-space-y-4">
              <h3 className="tw-text-lg tw-font-semibold tw-text-blue-gray-800">
                <span className="tw-underline">
                  Testing Topics for Safety (Specifically Power Supply/Input
                  Side)
                </span>
              </h3>
              <DCTest1Grid onResultsChange={setDCTest1Results} />
            </div>
            <div className="tw-space-y-4">
              <h3 className="tw-text-lg tw-font-semibold tw-text-blue-gray-800">
                <span className="tw-underline tw-font-bold">
                  CHARGING PROCESS TESTING
                </span>
              </h3>
              <ACTest2Grid onResultsChange={setDCChargerTest} />
            </div>

            <div className="tw-mb-3">
              <span className="tw-text-sm tw-font-semibold tw-text-gray-800">
                Remark
              </span>
            </div>
            <div className="tw-space-y-2">
              <Textarea
                value={testRemark}
                onChange={(e) => setTestRemark(e.target.value)}
                className="!tw-border-gray-400"
                containerProps={{ className: "!tw-min-w-0" }}
              // placeholder=""
              />
            </div>

            {/* Signature Section */}
            {/* <div className="tw-space-y-4">
              <ACSignatureSection1
                // onRemarkChange={(v) => setSigRemark(v)}
                onSymbolChange={(sym, checked) => checked && setSigSymbol(sym)}
                onPhaseSequenceChange={(ph, checked) => checked && setSigPhase(ph)}
                onResponsibilityChange={(field, who, val) => {
                  setSigResp(prev => ({
                    ...prev,
                    [who]: { ...prev[who], [field]: val }
                  }));
                }} />
            </div> */}
            {/* HEADER */}
            {/* <CMFormHeader1 headerLabel="DC Report" /> */}

            {/* META – การ์ดหัวเรื่อง */}
            {/* <DCFormMeta
              head={head} onHeadChange={onHeadChange}
            /> */}


            <ACPhotoSection initialItems={photoItems}
              onItemsChange={setPhotoItems}
              title="แนบรูปถ่ายประกอบ (Nameplate / Charger / CB / RCD / GUN1 / GUN2 + อื่นๆ)"
            />

            <div className="tw-mb-3">
              <span className="tw-text-sm tw-font-semibold tw-text-gray-800">
                Remark
              </span>
            </div>
            <div className="tw-space-y-2">
              <Textarea
                value={imgRemark}
                onChange={(e) => setImgRemark(e.target.value)}
                className="!tw-border-gray-400"
                containerProps={{ className: "!tw-min-w-0" }}
              // placeholder=""
              />
            </div>


            {/* Signature Section */}
            <div className="tw-space-y-4">
              <ACSignatureSection1 />
            </div>
            {/* FOOTER + ปุ่มบันทึก */}
            <ACFormActions
              onSave={onSave}
              onSubmit={onFinalSave}
              onReset={() => setJob({ ...INITIAL_JOB })}
              isSaving={saving}
            />
          </div>

        </div>
      </form>

      {/* print styles */}
      <style jsx global>
        {`
          @media print {
            body {
              background: white !important;
            }
            .tw-print\\:tw-hidden {
              display: none !important;
            }
          }
        `}
      </style>
    </section>
  );
}
