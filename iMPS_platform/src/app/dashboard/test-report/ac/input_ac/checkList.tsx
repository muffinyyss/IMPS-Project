"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button, Input, Textarea } from "@material-tailwind/react";
import { useRouter, useSearchParams } from "next/navigation";

// components
import ACFormHeader from "@/app/dashboard/test-report/ac/input_ac/components/ACFormHeader";
import ACFormMeta from "@/app/dashboard/test-report/ac/input_ac/components/ACFormMeta";
import EquipmentSection from "@/app/dashboard/test-report/ac/input_ac/components/ACEquipmentSection";
import ACFormActions from "@/app/dashboard/test-report/ac/input_ac/components/ACFormActions";
import ACTest1Grid, { mapToElectricalPayload, type TestResults } from "@/app/dashboard/test-report/ac/input_ac/components/ACTest1Grid";
import ACTest2Grid, { mapToChargerPayload, type TestCharger } from "@/app/dashboard/test-report/ac/input_ac/components/ACTest2Grid";
import ACPhotoSection from "@/app/dashboard/test-report/ac/input_ac/components/ACPhotoSection";
import ACMasterValidation, { isFormComplete } from "@/app/dashboard/test-report/ac/input_ac/components/ACMasterValidation";

// draft utilities
import {
  draftKey,
  saveDraftLocal,
  loadDraftLocal,
  clearDraftLocal,
  type DraftData,
} from "@/app/dashboard/test-report/ac/input_ac/lib/draft";
import {
  clearPhotosForDraft,
  putPhoto,
  getPhotoByDbKey,
  type PhotoRef,
} from "@/app/dashboard/test-report/ac/input_ac/lib/draftPhotos";

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
  document_name: string;  // ★ เพิ่มบรรทัดนี้
  inspection_date: string;
  location: string;
  inspector: string;      // ★ เปลี่ยนจาก optional เป็น required
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
  PIFirmware?: string;  // ★★★ เพิ่มบรรทัดนี้ ★★★
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
  document_name: "",  // ★ เพิ่มบรรทัดนี้
  inspection_date: "",
  location: "",
  inspector: "",
  manufacturer: "",
  model: "",
  power: "",
  firmware_version: "",
  serial_number: "",
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

export default function ACForm() {
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
  const [acTest1Results, setACTest1Results] = useState<TestResults | null>(null);
  const [acChargerTest, setACChargerTest] = useState<TestCharger | null>(null);
  // ★★★ FIXED: Initialize with 6 empty photo categories to match ACPhotoSection ★★★
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>(() => 
    Array(6).fill(null).map(() => ({ text: "", images: [] }))
  );
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
        // ★ Load chargerNo from draft if exists
        if (draft.chargerNo) {
          setChargerNo(draft.chargerNo);
        }
        setEquipment(draft.equipment || INITIAL_EQUIPMENT);
        setACTest1Results(draft.acTest1Results);
        setACChargerTest(draft.acChargerTest);
        setPhaseSequence(draft.phaseSequence || "");
        setTestRemark(draft.testRemark || "");
        setImgRemark(draft.imgRemark || "");
        if (draft.photoRefs && Object.keys(draft.photoRefs).length > 0) {
          const items = await loadPhotosFromIndexedDB(draft.photoRefs);
          // ★★★ FIXED: Merge with default 6 items to ensure all categories exist ★★★
          const defaultItems: PhotoItem[] = Array(6).fill(null).map(() => ({ text: "", images: [] }));
          items.forEach((item, idx) => {
            if (item && idx < defaultItems.length) {
              defaultItems[idx] = item;
            } else if (item) {
              defaultItems.push(item);
            }
          });
          setPhotoItems(defaultItems);
        }
        console.log("[AC Draft] Auto-loaded");
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
      chargerNo?.trim() ||
      equipment.manufacturers.some(m => m.trim()) ||
      acTest1Results !== null ||
      acChargerTest !== null ||
      phaseSequence.trim() ||
      testRemark.trim() ||
      imgRemark.trim() ||
      photoItems.some(p => p?.images?.length > 0);

    if (hasData) {
      (async () => {
        const photoRefs = await savePhotosToIndexedDB(photoItems);
        saveDraftLocal(currentDraftKey, {
          chargerNo: chargerNo || "",  // ★ Save chargerNo to draft
          equipment,
          acTest1Results,
          acChargerTest,
          phaseSequence,
          testRemark,
          imgRemark,
          photoRefs,
        });
      })();
    }
  }, [sn, currentDraftKey, chargerNo, equipment, acTest1Results, acChargerTest, phaseSequence, testRemark, imgRemark, photoItems, savePhotosToIndexedDB]);

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
    const tab = searchParams.get("tab") ?? "AC";
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
      const res = await fetch(`${API_BASE}/actestreport/${encodeURIComponent(reportId)}/photos`, {
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
      chargerNo: chargerNo || "",  // ★ Save chargerNo
      equipment,
      acTest1Results,
      acChargerTest,
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
    setACTest1Results(null);
    setACChargerTest(null);
    setPhaseSequence("");
    setTestRemark("");
    setImgRemark("");
    // ★★★ FIXED: Reset to 6 empty items instead of empty array ★★★
    setPhotoItems(Array(6).fill(null).map(() => ({ text: "", images: [] })));
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
      if (!acTest1Results) { alert(t.alertNoElectricalTest); return; }
      if (!acChargerTest) { alert(t.alertNoChargerTest); return; }

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

      const electrical_safety = mapToElectricalPayload(acTest1Results).electricalSafety;
      const charger_safety = mapToChargerPayload(acChargerTest).chargerSafety;

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

      const res = await fetch(`${API_BASE}/acreport/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      
      // Try to parse response as JSON
      let data: any = null;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch (jsonErr) {
          console.error("Failed to parse JSON:", jsonErr);
        }
      } else {
        // If not JSON, try to get text
        const text = await res.text();
        console.error("Non-JSON response:", text);
        data = { detail: text || `HTTP ${res.status}` };
      }
      
      if (!res.ok) {
        // FastAPI validation errors have "detail" array
        let errorMsg = `HTTP ${res.status}`;
        if (data?.detail) {
          if (Array.isArray(data.detail)) {
            // FastAPI validation error format: [{loc: [...], msg: "...", type: "..."}]
            errorMsg = data.detail.map((err: any) => {
              const field = err.loc?.join(".") || "unknown";
              return `${field}: ${err.msg}`;
            }).join(", ");
          } else if (typeof data.detail === "string") {
            errorMsg = data.detail;
          } else {
            errorMsg = JSON.stringify(data.detail);
          }
        } else if (data?.message) {
          errorMsg = data.message;
        }
        throw new Error(errorMsg);
      }

      const { report_id, issue_id, document_name } = data;
      console.log("Created report:", { report_id, issue_id, document_name });

      await uploadPhotosForReport(report_id);
      await uploadPhotoSection(report_id, photoItems);

      clearDraftLocal(currentDraftKey);
      clearPhotosForDraft(currentDraftKey);

      router.replace(buildListUrl());
    } catch (e: any) {
      console.error("Save error:", e);
      console.error("Error type:", typeof e);
      console.error("Error keys:", e ? Object.keys(e) : "null");
      console.error("Error stringified:", JSON.stringify(e, null, 2));
      
      let errorMsg = t.alertSaveFailed;
      if (typeof e === "string") {
        errorMsg += `: ${e}`;
      } else if (e instanceof Error) {
        errorMsg += `: ${e.message}`;
      } else if (e?.message) {
        errorMsg += `: ${e.message}`;
      } else if (e?.detail) {
        errorMsg += `: ${e.detail}`;
      } else {
        errorMsg += `: ${JSON.stringify(e)}`;
      }
      
      alert(errorMsg);
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
          // ★★★ เพิ่ม PIFirmware ★★★
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
        const url = `${API_BASE}/acreport/next-ids?sn=${encodeURIComponent(sn)}&chargerNo=${encodeURIComponent(chargerNo)}&inspection_date=${todayStr}`;

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

        console.log("[AC] Preview IDs loaded:", data);
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
      const res = await fetch(`${API_BASE}/actestreport/${encodeURIComponent(reportId)}/photos`, {
        method: "POST", body: fd, credentials: "include",
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(`${t.alertUploadFailed} ${i + 1} ${t.alertUploadFailedSuffix}: ${msg}`);
      }
    }
  }

  // ★★★ FIXED: เพิ่ม chargerNo ใน isFormComplete ★★★
  const formComplete = React.useMemo(() => {
    return isFormComplete(
      head,
      chargerNo || "",  // ★ เพิ่ม chargerNo
      phaseSequence,
      equipment,
      acTest1Results,
      acChargerTest,
      photoItems
    );
  }, [head, chargerNo, phaseSequence, equipment, acTest1Results, acChargerTest, photoItems]);

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
          <ACFormHeader
            headerLabel="AC Report"
            issueId={previewIssueId || head.issue_id}
            documentName={previewDocName}
          />

          <div className="tw-mt-8 tw-space-y-8">
            {/* META - ★ ส่ง previewIssueId */}
            <ACFormMeta
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
              {/* Phase Sequence - Input field */}
              <div id="ac-phase-sequence-input" className="tw-flex tw-items-center tw-gap-3 tw-p-2 tw--m-2 tw-rounded-lg tw-transition-all tw-duration-300">
                <span className="tw-text-sm tw-font-semibold tw-text-gray-800 tw-whitespace-nowrap">
                  {t.phaseSequence}
                </span>
                <span className="tw-font-semibold tw-text-base">:</span>
                <div className="tw-flex-1 md:tw-flex-none md:tw-w-48">
                  <Input
                    value={phaseSequence}
                    onChange={(e) => setPhaseSequence(e.target.value)}
                    placeholder={t.phaseSequencePlaceholder}
                    crossOrigin=""
                    className="!tw-border-gray-300"
                    containerProps={{ className: "!tw-min-w-0" }}
                  />
                </div>
              </div>
              <ACTest1Grid onResultsChange={setACTest1Results} initialResults={acTest1Results || undefined} />
            </div>

            <div className="tw-space-y-4">
              <h3 className="tw-text-lg tw-font-semibold tw-text-blue-gray-800">
                <span className="tw-underline tw-font-bold">{t.chargingProcessTitle}</span>
              </h3>
              <ACTest2Grid onResultsChange={setACChargerTest} initialResults={acChargerTest || undefined} />
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
              <ACPhotoSection initialItems={photoItems} onItemsChange={setPhotoItems} title={t.photoSectionTitle} />
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

            {/* ★★★ FIXED: เพิ่ม chargerNo ใน ACMasterValidation ★★★ */}
            <ACMasterValidation
              head={head}
              chargerNo={chargerNo || ""}
              phaseSequence={phaseSequence}
              equipment={equipment}
              acTest1Results={acTest1Results}
              acChargerTest={acChargerTest}
              photoItems={photoItems}
              lang={lang}
            />

            <ACFormActions
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