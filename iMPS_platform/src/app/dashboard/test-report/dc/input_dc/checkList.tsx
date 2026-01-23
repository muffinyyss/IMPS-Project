"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button, Input, Textarea } from "@material-tailwind/react";
import { useRouter, useSearchParams } from "next/navigation";

// components
import CMFormHeader from "@/app/dashboard/test-report/dc/input_dc/components/DCFormHeader";
import DCFormMeta from "@/app/dashboard/test-report/dc/input_dc/components/DCFormMeta";
import EquipmentSection from "@/app/dashboard/test-report/dc/input_dc/components/DCEquipmentSection";
import DCFormActions from "@/app/dashboard/test-report/dc/input_dc/components/DCFormActions";
import DCTest1Grid, { mapToElectricalPayload, type TestResults } from "@/app/dashboard/test-report/dc/input_dc/components/DCTest1Grid";
import DCTest2Grid, { mapToChargerPayload, type TestCharger } from "@/app/dashboard/test-report/dc/input_dc/components/DCTest2Grid";
import DCPhotoSection from "@/app/dashboard/test-report/dc/input_dc/components/DCPhotoSection";
import DCMasterValidation, { isFormComplete } from "@/app/dashboard/test-report/dc/input_dc/components/DCMasterValidation";

// draft utilities
import {
  draftKey,
  saveDraftLocal,
  loadDraftLocal,
  clearDraftLocal,
  type DraftData,
} from "@/app/dashboard/test-report/dc/input_dc/lib/draft";
import {
  clearPhotosForDraft,
  putPhoto,
  getPhotoByDbKey,
  type PhotoRef,
} from "@/app/dashboard/test-report/dc/input_dc/lib/draftPhotos";

// ===== Types =====
type Lang = "th" | "en";

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
  manufacturer?: string;
  model?: string;
  power?: string;
  brand?: string;
  firmware_version?: string;
  serial_number?: string;
};

type Head = {
  issue_id: string;
  inspection_date: string;
  location: string;
  manufacturer?: string;
  model?: string;
  power?: string;
  firmware_version?: string;
  serial_number?: string;
  inspector?: string;
};

type EquipmentBlock = {
  manufacturers: string[];
  models: string[];
  serialNumbers: string[];
};

type RepairOption = (typeof REPAIR_OPTIONS)[number];

type PhotoItem = { text: string; images: { file: File; url: string }[] };

type StationPublic = {
  station_name: string;
  SN?: string;
  WO?: string;
  chargerNo?: string;
  chargeBoxID?: string;
  model?: string;
  status?: boolean;
  brand?: string;
  manufacturer?: string;
  power?: string;
  serial_number?: string;
  serialNumber?: string;
  firmware_version?: string;
  firmwareVersion?: string;
  PIFirmware?: string;
};

// ===== Translations =====
const translations = {
  th: {
    testingTopicsTitle: "หัวข้อทดสอบความปลอดภัย (ด้านแหล่งจ่ายไฟ/อินพุต)",
    chargingProcessTitle: "การทดสอบกระบวนการชาร์จ",
    remark: "หมายเหตุ",
    photoSectionTitle: "แนบรูปถ่ายประกอบ (Nameplate / Charger / CB / RCD / GUN1 / GUN2 + อื่นๆ)",
    phaseSequence: "ลำดับเฟส",
    phaseSequencePlaceholder: "เช่น L1-L2-L3",
    alertNoSn: "ไม่พบ sn - กรุณาเลือกตู้ชาร์จจาก Navbar ก่อน",
    alertNoChargerNo: "ไม่พบ chargerNo - กรุณาเลือกตู้ชาร์จที่มี chargerNo",
    alertNoElectricalTest: "ยังไม่ได้กรอกผลทดสอบ (Electrical Safety)",
    alertNoChargerTest: "ยังไม่ได้กรอกผลทดสอบ (Charger Safety)",
    alertSaveFailed: "บันทึกไม่สำเร็จ",
    alertUploadFailed: "อัปโหลดรูปข้อที่",
    alertUploadFailedSuffix: "ล้มเหลว",
    alertUploadPhotoFailed: "อัปโหลดรูป index",
  },
  en: {
    testingTopicsTitle: "Testing Topics for Safety (Specifically Power Supply/Input Side)",
    chargingProcessTitle: "CHARGING PROCESS TESTING",
    remark: "Remark",
    photoSectionTitle: "Attach Photos (Nameplate / Charger / CB / RCD / GUN1 / GUN2 + Others)",
    phaseSequence: "Phase Sequence",
    phaseSequencePlaceholder: "e.g. L1-L2-L3",
    alertNoSn: "SN not found - Please select a charger from Navbar first",
    alertNoChargerNo: "chargerNo not found - Please select a charger with chargerNo",
    alertNoElectricalTest: "Electrical Safety test results not filled",
    alertNoChargerTest: "Charger Safety test results not filled",
    alertSaveFailed: "Save failed",
    alertUploadFailed: "Upload photo item",
    alertUploadFailedSuffix: "failed",
    alertUploadPhotoFailed: "Upload photo index",
  },
};

// ===== Constants =====
const REPAIR_OPTIONS = [
  "แก้ไขสำเร็จ",
  "แก้ไขไม่สำเร็จ",
  "อยู่ระหว่างการติดตามผล",
  "อยู่ระหว่างการรออะไหล่",
] as const;

const LIST_ROUTE = "/dashboard/test-report";

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
  model: "",
  brand: "",
};

const INITIAL_HEAD: Head = {
  issue_id: "",
  inspection_date: "",
  location: "",
  manufacturer: "",
  model: "",
  power: "",
  firmware_version: "",
  serial_number: "",
  inspector: "",
};

const INITIAL_EQUIPMENT: EquipmentBlock = {
  manufacturers: [""],
  models: [""],
  serialNumbers: [""],
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// ===== Helper Functions =====
function localTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ===== Photo ID Generator =====
let photoIdCounter = 0;
function generatePhotoId(): string {
  return `photo_${Date.now()}_${++photoIdCounter}`;
}

export default function DCForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ===== Language =====
  const [lang, setLang] = useState<Lang>("th");

  useEffect(() => {
    const savedLang = localStorage.getItem("app_language") as Lang | null;
    if (savedLang === "th" || savedLang === "en") setLang(savedLang);

    const handleLangChange = (e: CustomEvent<{ lang: Lang }>) => setLang(e.detail.lang);
    window.addEventListener("language:change", handleLangChange as EventListener);
    return () => window.removeEventListener("language:change", handleLangChange as EventListener);
  }, []);

  const t = translations[lang];

  // ===== SN =====
  const [sn, setSn] = useState<string | null>(null);
  const [chargerNo, setChargerNo] = useState<string | null>(null);

  // ★★★ NEW: Preview IDs from backend ★★★
  const [previewIssueId, setPreviewIssueId] = useState<string>("");
  const [previewDocName, setPreviewDocName] = useState<string>("");

  const loadSn = useCallback(() => {
    const snFromUrl = searchParams.get("sn");
    if (snFromUrl) { setSn(snFromUrl); return; }
    const snLocal = localStorage.getItem("selected_sn");
    setSn(snLocal);
  }, [searchParams]);

  useEffect(() => { loadSn(); }, [loadSn]);

  useEffect(() => {
    const handleChargerEvent = () => requestAnimationFrame(loadSn);
    window.addEventListener("charger:selected", handleChargerEvent);
    window.addEventListener("charger:deselected", handleChargerEvent);
    return () => {
      window.removeEventListener("charger:selected", handleChargerEvent);
      window.removeEventListener("charger:deselected", handleChargerEvent);
    };
  }, [loadSn]);

  // ===== Form State =====
  const [job, setJob] = useState<Job>({ ...INITIAL_JOB });
  const [head, setHead] = useState<Head>({ ...INITIAL_HEAD });
  const [equipment, setEquipment] = useState<EquipmentBlock>({ ...INITIAL_EQUIPMENT });
  const [dcTest1Results, setDCTest1Results] = useState<TestResults | null>(null);
  const [dcChargerTest, setDCChargerTest] = useState<TestCharger | null>(null);
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([]);
  const [phaseSequence, setPhaseSequence] = useState<string>("");
  const [testRemark, setTestRemark] = useState<string>("");
  const [imgRemark, setImgRemark] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // ===== Draft State =====
  const [draftChecked, setDraftChecked] = useState(false);
  const skipAutoSaveRef = useRef(true);

  // ===== Get current draft key =====
  const currentDraftKey = draftKey(sn);

  // ============================================================
  // ★★★ PHOTO HELPERS ★★★
  // ============================================================
  const savePhotosToIndexedDB = useCallback(async (items: PhotoItem[]): Promise<Record<number, PhotoRef[]>> => {
    const photoRefs: Record<number, PhotoRef[]> = {};
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item?.images?.length) continue;
      photoRefs[i] = [];
      for (const img of item.images) {
        if (img.file) {
          const photoId = generatePhotoId();
          const ref = await putPhoto(currentDraftKey, photoId, img.file, item.text);
          photoRefs[i].push(ref);
        }
      }
    }
    return photoRefs;
  }, [currentDraftKey]);

  const loadPhotosFromIndexedDB = useCallback(async (
    photoRefs: Record<number | string, (PhotoRef | { isNA: true })[]>
  ): Promise<PhotoItem[]> => {
    const items: PhotoItem[] = [];
    const indices = Object.keys(photoRefs).map(Number).sort((a, b) => a - b);
    for (const idx of indices) {
      const refs = photoRefs[idx];
      const images: { file: File; url: string }[] = [];
      let remark = "";
      for (const ref of refs) {
        if ("isNA" in ref) continue;
        const file = await getPhotoByDbKey(ref.dbKey);
        if (file) {
          const url = URL.createObjectURL(file);
          images.push({ file, url });
          if (ref.remark) remark = ref.remark;
        }
      }
      if (images.length > 0) {
        items[idx] = { text: remark, images };
      }
    }
    return items;
  }, []);

  // ============================================================
  // ★★★ DRAFT: AUTO-LOAD ON MOUNT ★★★
  // ============================================================
  useEffect(() => {
    if (!sn || draftChecked) return;
    const loadDraft = async () => {
      const draft = loadDraftLocal<DraftData>(currentDraftKey);
      if (draft) {
        setEquipment(draft.equipment || INITIAL_EQUIPMENT);
        setDCTest1Results(draft.dcTest1Results);
        setDCChargerTest(draft.dcChargerTest);
        setPhaseSequence(draft.phaseSequence || "");
        setTestRemark(draft.testRemark || "");
        setImgRemark(draft.imgRemark || "");
        if (draft.photoRefs && Object.keys(draft.photoRefs).length > 0) {
          const items = await loadPhotosFromIndexedDB(draft.photoRefs);
          setPhotoItems(items);
        }
        console.log("[DC Draft] Auto-loaded");
      }
      setDraftChecked(true);
      skipAutoSaveRef.current = true;
      setTimeout(() => { skipAutoSaveRef.current = false; }, 1000);
    };
    loadDraft();
  }, [sn, draftChecked, currentDraftKey, loadPhotosFromIndexedDB]);

  // ============================================================
  // ★★★ DRAFT: AUTO-SAVE ★★★
  // ============================================================
  useEffect(() => {
    if (!sn || skipAutoSaveRef.current) return;
    const hasData =
      equipment.manufacturers.some(m => m.trim()) ||
      dcTest1Results !== null ||
      dcChargerTest !== null ||
      phaseSequence.trim() ||
      testRemark.trim() ||
      imgRemark.trim() ||
      photoItems.some(p => p?.images?.length > 0);

    if (hasData) {
      (async () => {
        const photoRefs = await savePhotosToIndexedDB(photoItems);
        saveDraftLocal(currentDraftKey, {
          equipment,
          dcTest1Results,
          dcChargerTest,
          phaseSequence,
          testRemark,
          imgRemark,
          photoRefs,
        });
      })();
    }
  }, [sn, currentDraftKey, equipment, dcTest1Results, dcChargerTest, phaseSequence, testRemark, imgRemark, photoItems, savePhotosToIndexedDB]);

  useEffect(() => {
    if (draftChecked) {
      const timer = setTimeout(() => { skipAutoSaveRef.current = false; }, 500);
      return () => clearTimeout(timer);
    }
  }, [draftChecked]);

  // ===== Handlers =====
  const buildListUrl = () => {
    const params = new URLSearchParams();
    if (sn) params.set("sn", sn);
    const tab = searchParams.get("tab") ?? "DC";
    params.set("tab", tab);
    return `${LIST_ROUTE}?${params.toString()}`;
  };

  async function uploadPhotoSection(reportId: string, items: PhotoItem[]) {
    if (!sn) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const files = (it?.images || []).map(im => im.file).filter(Boolean) as File[];
      if (!files.length) continue;
      const fd = new FormData();
      fd.append("sn", sn);
      fd.append("item_index", String(i));
      if (it.text) fd.append("remark", it.text);
      files.forEach(f => fd.append("files", f, f.name));
      const res = await fetch(`${API_BASE}/dctestreport/${encodeURIComponent(reportId)}/photos`, {
        method: "POST", body: fd, credentials: "include",
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(`${t.alertUploadPhotoFailed} ${i} ${t.alertUploadFailedSuffix}: ${msg}`);
      }
    }
  }

  const onHeadChange = (updates: Partial<Head>) => setHead(prev => ({ ...prev, ...updates }));

  const onSave = async () => {
    const photoRefs = await savePhotosToIndexedDB(photoItems);
    saveDraftLocal(currentDraftKey, {
      equipment,
      dcTest1Results,
      dcChargerTest,
      phaseSequence,
      testRemark,
      imgRemark,
      photoRefs,
    });
  };

  const updateManufacturer = (i: number, val: string) =>
    setEquipment(prev => { const arr = [...prev.manufacturers]; arr[i] = val; return { ...prev, manufacturers: arr }; });

  const updateModel = (i: number, val: string) =>
    setEquipment(prev => { const arr = [...prev.models]; arr[i] = val; return { ...prev, models: arr }; });

  const updateSerial = (i: number, val: string) =>
    setEquipment(prev => { const arr = [...prev.serialNumbers]; arr[i] = val; return { ...prev, serialNumbers: arr }; });

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
      if (man.length <= 1) return { manufacturers: [""], models: [""], serialNumbers: [""] };
      man.splice(i, 1); mod.splice(i, 1); ser.splice(i, 1);
      return { manufacturers: man, models: mod, serialNumbers: ser };
    });

  const onReset = () => {
    setJob({ ...INITIAL_JOB });
    setHead({ ...INITIAL_HEAD });
    setEquipment({ ...INITIAL_EQUIPMENT });
    setDCTest1Results(null);
    setDCChargerTest(null);
    setPhaseSequence("");
    setTestRemark("");
    setImgRemark("");
    setPhotoItems([]);
    setPreviewIssueId("");
    setPreviewDocName("");
    clearDraftLocal(currentDraftKey);
    clearPhotosForDraft(currentDraftKey);
  };

  // ============================================================
  // ★★★ FINAL SAVE ★★★
  // ============================================================
  const onFinalSave = async () => {
    try {
      if (!sn) { alert(t.alertNoSn); return; }
      if (!chargerNo) { alert(t.alertNoChargerNo); return; }
      if (!dcTest1Results) { alert(t.alertNoElectricalTest); return; }
      if (!dcChargerTest) { alert(t.alertNoChargerTest); return; }

      setSaving(true);

      const { inspection_date: headInspectionDate, issue_id: _, ...headWithoutIssue } = head;

      const mergedJob: Job = {
        ...job,
        inspection_date: headInspectionDate || job.inspection_date || localTodayISO(),
        location: head.location || job.location,
        manufacturer: head.manufacturer || job.manufacturer,
        model: head.model || job.model,
        power: head.power || job.power,
        firmware_version: head.firmware_version || job.firmware_version,
        serial_number: head.serial_number || job.serial_number,
      };

      const electrical_safety = mapToElectricalPayload(dcTest1Results).electricalSafety;
      const charger_safety = mapToChargerPayload(dcChargerTest).ChargerSafety;

      // ★★★ ไม่ส่ง issue_id และ document_name - ให้ backend generate ★★★
      const payload = {
        sn,
        chargerNo,
        inspection_date: mergedJob.inspection_date,
        job: {
          ...mergedJob,
          corrective_actions: mergedJob.corrective_actions.map(c => ({
            text: c.text,
            images: c.images.map(img => ({ name: img.file?.name ?? "" })),
          })),
        },
        head: headWithoutIssue,
        equipment,
        electrical_safety,
        charger_safety,
        remarks: { testRemark, imgRemark },
        phaseSequence,
      };

      const res = await fetch(`${API_BASE}/dcreport/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);

      const { report_id, issue_id, document_name } = await res.json();
      console.log("Created report:", { report_id, issue_id, document_name });

      await uploadPhotosForReport(report_id);
      await uploadPhotoSection(report_id, photoItems);

      clearDraftLocal(currentDraftKey);
      clearPhotosForDraft(currentDraftKey);

      router.replace(buildListUrl());
    } catch (e: any) {
      console.error(e);
      alert(`${t.alertSaveFailed}: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  // ===== Load station info =====
  useEffect(() => {
  let alive = true;
  if (!sn || !draftChecked) return;

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/station/info/public?sn=${encodeURIComponent(sn)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { station: StationPublic } = await res.json();
      if (!alive) return;
      const station = data.station;

      setChargerNo(station.chargerNo ? String(station.chargerNo) : null);

      setHead(prev => ({
        ...prev,
        inspection_date: prev.inspection_date || localTodayISO(),
        location: prev.location || station.station_name || "",
        manufacturer: prev.manufacturer || station.manufacturer || station.brand || "",
        model: prev.model || station.model || "",
        power: prev.power || station.power || "",
        serial_number: prev.serial_number || station.serial_number || station.serialNumber || station.SN || sn || "",
        // ★★★ เพิ่ม PIFirmware และถ้าเป็น "-" ให้เป็นค่าว่าง ★★★
        firmware_version: prev.firmware_version || (() => {
          const fw = station.firmware_version || station.firmwareVersion || station.PIFirmware || "";
          return fw === "-" ? "" : fw;
        })(),
      }));
    } catch (err) {
      console.error("โหลดข้อมูลสถานีไม่สำเร็จ:", err);
    }
  })();

  return () => { alive = false; };
}, [sn, draftChecked]);

  // ============================================================
  // ★★★ NEW: Fetch preview IDs from backend ★★★
  // ============================================================
  useEffect(() => {
    let alive = true;
    if (!sn || !chargerNo || !draftChecked) return;

    (async () => {
      try {
        const todayStr = localTodayISO();
        const url = `${API_BASE}/dcreport/next-ids?sn=${encodeURIComponent(sn)}&chargerNo=${encodeURIComponent(chargerNo)}&inspection_date=${todayStr}`;

        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!alive) return;

        // ★ Set preview values
        setPreviewIssueId(data.issue_id || "");
        setPreviewDocName(data.document_name || "");

        // ★ Update head.issue_id for display
        setHead(prev => ({
          ...prev,
          issue_id: data.issue_id || prev.issue_id,
          inspection_date: prev.inspection_date || todayStr,
        }));

        console.log("[DC] Preview IDs loaded:", data);
      } catch (err) {
        console.error("โหลด preview IDs ไม่สำเร็จ:", err);
      }
    })();

    return () => { alive = false; };
  }, [sn, chargerNo, draftChecked]);

  async function uploadPhotosForReport(reportId: string) {
    if (!sn) return;
    for (let i = 0; i < job.corrective_actions.length; i++) {
      const item = job.corrective_actions[i];
      const files = item.images.map(im => im.file).filter(Boolean) as File[];
      if (!files.length) continue;
      const group = `g${i + 1}`;
      const fd = new FormData();
      fd.append("sn", sn);
      fd.append("group", group);
      if (item.text) fd.append("remark", item.text);
      files.forEach(f => fd.append("files", f, f.name));
      const res = await fetch(`${API_BASE}/dctestreport/${encodeURIComponent(reportId)}/photos`, {
        method: "POST", body: fd, credentials: "include",
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(`${t.alertUploadFailed} ${i + 1} ${t.alertUploadFailedSuffix}: ${msg}`);
      }
    }
  }

  const formComplete = React.useMemo(() => {
    return isFormComplete(head, phaseSequence, equipment, dcTest1Results, dcChargerTest, photoItems);
  }, [head, phaseSequence, equipment, dcTest1Results, dcChargerTest, photoItems]);

  return (
    <section className="tw-pb-24">
      <form
        action="#"
        noValidate
        onSubmit={(e) => { e.preventDefault(); return false; }}
        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
      >
        <div className="tw-mx-auto tw-w-full tw-max-w-[1000px] lg:tw-max-w-[1100px] tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-sm tw-p-6 md:tw-p-8 tw-print:tw-shadow-none tw-print:tw-border-0">

          {/* HEADER - ★ ส่ง previewDocName สำหรับแสดง */}
          <CMFormHeader
            headerLabel="DC Report"
            issueId={previewIssueId || head.issue_id}
            documentName={previewDocName}
          />

          <div className="tw-mt-8 tw-space-y-8">
            {/* META - ★ ส่ง previewIssueId */}
            <DCFormMeta
              head={{ ...head, issue_id: previewIssueId || head.issue_id }}
              onHeadChange={onHeadChange}
            />

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

            <div className="tw-space-y-4">
              <h3 className="tw-text-lg tw-font-semibold tw-text-blue-gray-800">
                <span className="tw-underline">{t.testingTopicsTitle}</span>
              </h3>
              {/* ★★★ FIXED: Phase Sequence - same line on mobile ★★★ */}
              <div className="tw-flex tw-items-center tw-gap-3">
                <span className="tw-text-sm tw-font-semibold tw-text-gray-800 tw-whitespace-nowrap">
                  {t.phaseSequence}
                </span>
                <span className="tw-font-semibold tw-text-base">:</span>
                <div className="tw-flex-1 md:tw-flex-none md:tw-w-48">
                  <Input
                    id="phase-sequence-input"
                    value={phaseSequence}
                    onChange={(e) => setPhaseSequence(e.target.value)}
                    placeholder={t.phaseSequencePlaceholder}
                    crossOrigin=""
                    className="!tw-border-gray-300"
                    containerProps={{ className: "!tw-min-w-0" }}
                  />
                </div>
              </div>
              <DCTest1Grid onResultsChange={setDCTest1Results} initialResults={dcTest1Results || undefined} />
            </div>

            <div className="tw-space-y-4">
              <h3 className="tw-text-lg tw-font-semibold tw-text-blue-gray-800">
                <span className="tw-underline tw-font-bold">{t.chargingProcessTitle}</span>
              </h3>
              <DCTest2Grid onResultsChange={setDCChargerTest} initialResults={dcChargerTest || undefined} />
            </div>

            <div className="tw-mb-3">
              <span className="tw-text-sm tw-font-semibold tw-text-gray-800">{t.remark}</span>
            </div>
            <div className="tw-space-y-2">
              <Textarea
                value={testRemark}
                onChange={(e) => setTestRemark(e.target.value)}
                className="!tw-border-gray-400"
                containerProps={{ className: "!tw-min-w-0" }}
              />
            </div>

            <div className="tw-mb-3">
              <DCPhotoSection initialItems={photoItems} onItemsChange={setPhotoItems} title={t.photoSectionTitle} />
            </div>

            <div className="tw-mb-3">
              <span className="tw-text-sm tw-font-semibold tw-text-gray-800">{t.remark}</span>
            </div>
            <div className="tw-space-y-2">
              <Textarea
                value={imgRemark}
                onChange={(e) => setImgRemark(e.target.value)}
                className="!tw-border-gray-400"
                containerProps={{ className: "!tw-min-w-0" }}
              />
            </div>

            <DCMasterValidation
              head={head}
              phaseSequence={phaseSequence}
              equipment={equipment}
              dcTest1Results={dcTest1Results}
              dcChargerTest={dcChargerTest}
              photoItems={photoItems}
              lang={lang}
            />

            <DCFormActions
              onSave={onSave}
              onSubmit={onFinalSave}
              onReset={onReset}
              isSaving={saving}
              isComplete={formComplete}
            />
          </div>

        </div>
      </form>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .tw-print\\:tw-hidden { display: none !important; }
        }
      `}</style>
    </section>
  );
}
