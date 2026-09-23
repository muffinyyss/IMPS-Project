"use client";

/**
 * หน้า PM report — "ใบเดียว 5 ส่วน"
 *
 * เดิมแท็บ Charger / Station / MDB / CCB / CB_BOX แยกกัน 5 แท็บ 5 เอกสาร
 * ตอนนี้ไม่มีแท็บแล้ว รวมเป็นเอกสารใบเดียว (1 เลขที่ / 1 PDF / อนุมัติครั้งเดียว)
 * ที่ข้างในแบ่งเป็น 5 ส่วน — ส่วนที่ 5 (ตู้ชาร์จ) มีใบย่อยตู้ละ 1 ใบ เพราะสถานี
 * หนึ่งมีหลายตู้ แต่ยังนับเป็นส่วนเดียวและใช้เลขที่เอกสารใบเดียวกัน
 *
 * 3 หน้าจออยู่ในไฟล์เดียว เลือกด้วย query string:
 *   ไม่มีอะไร                       → ตารางใบ PM ของสถานีนี้
 *   ?view=form&job_id=              → หน้ารวม 5 ส่วนของใบนั้น (hub)
 *   ?view=form&job_id=&section=     → ฟอร์มกรอกของส่วนนั้น (ใช้ฟอร์มเดิมทั้งดุ้น)
 *                                     ส่วน charger ส่ง &sn= ของตู้ไปด้วย
 *   ?view=form&edit_id= (ไม่มี job_id) → ลิงก์เก่าจากหน้า PM List ที่ชี้ไปเอกสาร
 *                                     ใบเดี่ยวก่อนรวมใบ — เปิดฟอร์มของชนิดนั้นตรง ๆ
 *
 * backend: routers/pmreport_station_job.py
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Button, Card, CardBody, CardHeader, Dialog, DialogBody, DialogFooter, DialogHeader, Input, Typography,
} from "@material-tailwind/react";
import {
  ArrowLeftIcon, CheckCircleIcon, DocumentArrowDownIcon, PencilSquareIcon, PlusIcon,
} from "@heroicons/react/24/outline";
import { apiFetch } from "@/utils/api";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import LoadingOverlay from "@/app/dashboard/components/Loadingoverlay";
import { PM_APPROVE_ROLES, PmStatusBadge, toPmFlow } from "@/app/dashboard/pm-report/components/flow";
import PmPlanForm from "@/app/dashboard/pm-report/components/PmPlanForm";
import PmWorkOrderInfo from "@/app/dashboard/pm-report/components/PmWorkOrderInfo";
import { pmBackRoute } from "@/app/dashboard/pm-report/lib/origin";

// ฟอร์มกรอกของแต่ละส่วน — ของเดิมทั้งหมด ไม่ได้แก้เนื้อ checklist
import StationPMForm from "@/app/dashboard/pm-report/station/input_PMreport/components/checkList";
import MDBPMForm from "@/app/dashboard/pm-report/mdb/input_PMreport/components/checkList";
import CCBPMForm from "@/app/dashboard/pm-report/ccb/input_PMreport/components/checkList";
import CBBOXPMForm from "@/app/dashboard/pm-report/cb-box/input_PMreport/components/checkList";
import ChargerPMForm from "@/app/dashboard/pm-report/charger/input_PMreport/components/checkList";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type SectionId = "station" | "mdb" | "ccb" | "cbbox" | "charger";

/** ลำดับส่วนในใบ — ตรงกับ SECTIONS ฝั่ง backend และลำดับหน้าใน PDF */
const SECTION_ORDER: SectionId[] = ["station", "mdb", "ccb", "cbbox", "charger"];

/** ส่วนที่ผูกกับตู้ (มีใบย่อยได้หลายใบ) ไม่ใช่กับสถานี */
const CHARGER_SECTION: SectionId = "charger";

const SECTION_FORMS: Record<SectionId, React.ComponentType> = {
  station: StationPMForm,
  mdb: MDBPMForm,
  ccb: CCBPMForm,
  cbbox: CBBOXPMForm,
  charger: ChargerPMForm,
};

const SECTION_TITLE: Record<SectionId, { th: string; en: string }> = {
  station: { th: "สถานี", en: "Station" },
  mdb: { th: "MDB", en: "MDB" },
  ccb: { th: "CCB", en: "CCB" },
  cbbox: { th: "CB_BOX", en: "CB_BOX" },
  charger: { th: "ตู้ชาร์จ", en: "Charger" },
};

const SECTION_HINT: Record<SectionId, { th: string; en: string }> = {
  station: { th: "โครงสร้างสถานี ป้าย ไฟส่องสว่าง ถังดับเพลิง", en: "Structure, signs, lighting, fire extinguisher" },
  mdb: { th: "ตู้ MDB เบรกเกอร์ แรงดันไฟฟ้า Trip test", en: "MDB cabinet, breakers, voltage, trip tests" },
  ccb: { th: "ตู้ CCB เบรกเกอร์ย่อย แรงดันไฟฟ้า", en: "CCB cabinet, sub-breakers, voltage" },
  cbbox: { th: "CB Box จุดต่อ และอุปกรณ์ป้องกัน", en: "CB Box, connections and protection devices" },
  charger: { th: "ตู้ชาร์จทุกตู้ในสถานี — กรอกทีละตู้", en: "Every charger at this station — one checklist each" },
};

/** slug ที่ลิงก์เก่า (tab=… ของหน้า PM List) ใช้ → ส่วนในใบรวม */
const SLUG_TO_SECTION: Record<string, SectionId> = {
  station: "station",
  mdb: "mdb",
  ccb: "ccb",
  "cb-box": "cbbox",
  cbbox: "cbbox",
  charger: "charger",
};

type SectionState = {
  section: SectionId;
  label: { th: string; en: string };
  /** ส่วน charger เท่านั้น — SN ของตู้ที่ใบย่อยนี้ผูกอยู่ */
  sn: string;
  charger_no: string;
  report_id: string;
  status: string;
  side: string;
  inspector: string;
};

type Job = {
  id: string;
  station_id: string;
  station_name: string;
  issue_id: string;
  doc_name: string;
  pm_date: string;
  wonum: string;
  inspector: string;
  status: string;
  sections: SectionState[];
  sections_done: number;
  sections_total: number;
  approved_by?: string;
  reject_remark?: string;
};

type Me = { username: string; role: string };

const T = {
  pageTitle: { th: "Preventive Maintenance Checklist - Station", en: "Preventive Maintenance Checklist - Station" },
  pageSubtitle: {
    th: "ใบ PM ของสถานี — 1 ใบรวม สถานี / MDB / CCB / CB_BOX / ตู้ชาร์จ",
    en: "Station PM document — Station / MDB / CCB / CB_BOX / Chargers in one",
  },
  newDoc: { th: "+ เปิดใบใหม่", en: "+ New document" },
  colNo: { th: "ลำดับ", en: "No." },
  colDocName: { th: "ชื่อเอกสาร", en: "Document" },
  colIssueId: { th: "รหัสเอกสาร", en: "Issue ID" },
  colPmDate: { th: "วันที่", en: "Date" },
  colSections: { th: "ส่วนที่กรอกแล้ว", en: "Sections filled" },
  colStatus: { th: "สถานะ", en: "Status" },
  colPdf: { th: "PDF", en: "PDF" },
  search: { th: "ค้นหา", en: "Search" },
  loading: { th: "กำลังโหลด…", en: "Loading…" },
  noData: { th: "ยังไม่มีใบ PM ของสถานีนี้", en: "No PM documents for this station yet" },
  selectStationFirst: { th: "กรุณาเลือกสถานีจากแถบบนก่อน", en: "Please select a station first" },

  dialogTitle: { th: "เปิดใบ PM ใหม่", en: "New PM document" },
  pmDateLabel: { th: "วันที่ตรวจสอบ", en: "PM date" },
  wonumLabel: { th: "เลขใบงาน Maximo (ถ้ามี)", en: "Maximo work order (optional)" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  create: { th: "เปิดใบ", en: "Create" },

  jobTitle: { th: "ใบบำรุงรักษาสถานี (PM)", en: "Station PM document" },
  station: { th: "สถานี", en: "Station" },
  docNo: { th: "เลขที่เอกสาร", en: "Issue ID" },
  docName: { th: "ชื่อเอกสาร", en: "Document" },
  pmDate: { th: "วันที่ PM", en: "PM date" },
  wonum: { th: "ใบงาน Maximo", en: "Maximo WO" },
  sectionsTitle: { th: "ส่วนของเอกสาร", en: "Document sections" },
  sectionsHint: {
    th: "กรอกทีละส่วนได้ ทั้ง 5 ส่วนอยู่ในเอกสารเลขที่เดียวกัน",
    en: "Fill one section at a time — all five share one document number",
  },
  fill: { th: "กรอก", en: "Fill in" },
  edit: { th: "แก้ไข", en: "Edit" },
  view: { th: "ดู", en: "View" },
  notFilled: { th: "ยังไม่กรอก", en: "Not filled" },
  downloadPdf: { th: "PDF ทั้งใบ", en: "Full PDF" },
  back: { th: "ย้อนกลับ", en: "Back" },

  approve: { th: "อนุมัติทั้งใบ", en: "Approve document" },
  reject: { th: "ตีกลับ", en: "Send back" },
  rejectReason: { th: "เหตุผลที่ตีกลับ", en: "Reason" },
  waitingApprove: { th: "รออนุมัติ — ตรวจครบแล้วกดอนุมัติได้เลย", en: "Waiting for approval" },
  rejected: { th: "ถูกตีกลับให้แก้:", en: "Sent back for fixes:" },
  approved: { th: "อนุมัติแล้วโดย", en: "Approved by" },

  errLoad: { th: "โหลดใบ PM ไม่สำเร็จ", en: "Failed to load PM documents" },
  errCreate: { th: "เปิดใบใหม่ไม่สำเร็จ", en: "Failed to create document" },
  errAction: { th: "ทำรายการไม่สำเร็จ", en: "Action failed" },

  noChargers: { th: "สถานีนี้ยังไม่มีตู้ชาร์จในระบบ", en: "No chargers registered at this station" },
  chargersDone: { th: "กรอกแล้ว", en: "filled" },
} as const;

const t = (k: keyof typeof T, lang: Lang) => T[k][lang === "en" ? "en" : "th"];
const pick = (v: { th: string; en: string }, lang: Lang) => (lang === "en" ? v.en : v.th);

function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmtDate(iso: string, lang: Lang) {
  if (!iso) return "-";
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "th-TH-u-ca-gregory", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  });
}

/** ชื่อสถานะของ 1 ส่วนที่คนอ่านรู้เรื่อง — ใบเก่าเก็บเป็น "submitted" */
function sectionStatusLabel(status: string, lang: Lang) {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return t("notFilled", lang);
  if (s === "wait for approve") return "Wait for approve";
  if (s === "draft") return lang === "en" ? "Draft" : "กำลังกรอก";
  return "Closed";
}

/**
 * สถานะรวมของ 1 ส่วน — ส่วน charger มีหลายใบย่อย จึงต้องยุบให้เหลือสถานะเดียว
 *
 * ยังไม่มีใบไหนถูกกรอก = ""  (ยังไม่กรอก)
 * มีใบที่ยังกรอกไม่เสร็จ หรือกรอกไม่ครบทุกตู้ = draft
 * ส่งครบแล้วแต่ยังมีใบรออนุมัติ = wait for approve
 * ปิดครบทุกใบ = closed
 */
function aggregateStatus(rows: SectionState[]): string {
  if (!rows.length) return "";
  const filled = rows.filter((r) => !!r.report_id);
  if (!filled.length) return "";
  const statuses = filled.map((r) => String(r.status || "").trim().toLowerCase());
  if (filled.length < rows.length) return "draft";
  if (statuses.some((x) => x === "draft")) return "draft";
  if (statuses.some((x) => x === "wait for approve")) return "wait for approve";
  return "closed";
}

/** สถานะของ 1 ส่วน → ป้ายสีในหน้า hub และในตาราง */
function sectionChipClass(status: string) {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return "tw-bg-gray-100 tw-text-gray-400 tw-border-gray-200";
  if (s === "wait for approve") return "tw-bg-purple-50 tw-text-purple-700 tw-border-purple-200";
  if (s === "draft") return "tw-bg-amber-50 tw-text-amber-700 tw-border-amber-200";
  return "tw-bg-green-50 tw-text-green-700 tw-border-green-200";
}

/** ปุ่ม กรอก/แก้ไข/ดู ของใบลูก 1 ใบ — ส่วนที่ผูกกับสถานีและรายตู้ใช้ตัวเดียวกัน */
function SectionFillButton({
  job, state, lang, onOpen, compact,
}: {
  job: Job;
  state: SectionState;
  lang: Lang;
  onOpen: (job: Job, s: SectionState) => void;
  compact?: boolean;
}) {
  const filled = !!state.report_id;
  const closed = ["closed", "submitted"].includes(String(state.status).trim().toLowerCase());
  const label = filled ? (closed ? t("view", lang) : t("edit", lang)) : t("fill", lang);
  return (
    <Button
      size="sm"
      variant={filled ? "outlined" : "filled"}
      onClick={() => onOpen(job, state)}
      className={`tw-flex tw-items-center tw-gap-1.5 ${compact ? "" : "tw-mt-3"}`}
    >
      <PencilSquareIcon className="tw-h-4 tw-w-4" /> {label}
    </Button>
  );
}

export default function StationPmJobTables() {
  const { lang } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [stationId, setStationId] = useState<string | null>(null);
  const [sn, setSn] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtering, setFiltering] = useState("");
  const [acting, setActing] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newDate, setNewDate] = useState(todayISO);
  const [newWonum, setNewWonum] = useState("");

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRemark, setRejectRemark] = useState("");

  const jobId = searchParams.get("job_id") ?? "";
  // ทางเข้าจากใบงาน Maximo (หน้า PM List ส่งมา) — ทุกชนิดเข้าทางนี้หมดแล้ว
  const planningWonum = searchParams.get("planning") === "1" ? (searchParams.get("wonum") ?? "") : "";
  const woInfoWonum = searchParams.get("wo_info") === "1" ? (searchParams.get("wonum") ?? "") : "";
  // ช่างกด "เริ่ม PM" ได้จากทั้งสองทางเข้า — หน้าวางแผน (planning=1) คือทางเข้าปกติของช่างแล้ว
  // ส่วน wo_info=1 เหลือไว้ให้ลิงก์เก่าที่ผู้ใช้ bookmark ไว้ยังเปิดได้
  const openWonum = planningWonum || woInfoWonum;
  const section = (searchParams.get("section") ?? "") as SectionId | "";
  const editId = searchParams.get("edit_id") ?? "";
  const isFormView = searchParams.get("view") === "form" && !!jobId;
  // ใบงาน Maximo ของตู้ผูกกับ SN ไม่ใช่ station_id — ต้องบอก PmPlanForm/PmWorkOrderInfo ให้ถูก
  const woSource = SLUG_TO_SECTION[searchParams.get("tab") ?? ""] === CHARGER_SECTION ? "charger" : "station";

  // ── สถานีที่เลือกอยู่ — กติกาเดียวกับตาราง PM ตัวอื่น ──
  useEffect(() => {
    const fromUrl = searchParams.get("station_id");
    if (fromUrl) {
      setStationId(fromUrl);
      localStorage.setItem("selected_station_id", fromUrl);
      return;
    }
    setStationId(localStorage.getItem("selected_station_id"));
  }, [searchParams]);

  // ── ตู้ที่เลือกอยู่ — ใช้กับใบงาน Maximo ของ charger เท่านั้น
  // ส่วน charger ในใบรวมเลือกตู้จากการ์ดในหน้า hub ไม่ได้ใช้ค่านี้
  useEffect(() => {
    const fromUrl = searchParams.get("sn");
    if (fromUrl) {
      setSn(fromUrl);
      localStorage.setItem("selected_sn", fromUrl);
      return;
    }
    setSn(localStorage.getItem("selected_sn"));
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/me");
        if (!res.ok) return;
        const u = await res.json();
        setMe({ username: u?.username ?? "", role: String(u?.role ?? "").trim().toLowerCase() });
      } catch (err) {
        console.error("fetch /me error:", err);
      }
    })();
  }, []);

  const loadJobs = useCallback(async () => {
    if (!stationId) { setJobs([]); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/stationpmjob/list?station_id=${encodeURIComponent(stationId)}`);
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.detail || `HTTP ${res.status}`);
      setJobs(Array.isArray(json?.items) ? json.items : []);
    } catch (err) {
      console.error("load station pm jobs error:", err);
      setError(err instanceof Error ? err.message : t("errLoad", lang));
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [stationId, lang]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const currentJob = useMemo(
    () => jobs.find((j) => j.id === jobId) ?? null,
    [jobs, jobId]
  );

  const canApprove = PM_APPROVE_ROLES.includes(me?.role ?? "");

  const goto = useCallback((params: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("tab");
    Object.entries(params).forEach(([k, v]) => (v === null ? next.delete(k) : next.set(k, v)));
    router.push(`${pathname}?${next.toString()}`, { scroll: true });
  }, [pathname, router, searchParams]);

  const openJob = (job: Job) => goto({ view: "form", job_id: job.id, section: null, sn: null, edit_id: null, station_id: job.station_id });
  // เข้าหน้ารวมมาจาก PM List → ย้อนกลับไปหน้านั้น ไม่ใช่ตารางใบ PM ของสถานี
  const backToList = () => {
    const back = pmBackRoute(searchParams);
    if (back) { router.push(back); return; }
    goto({ view: null, job_id: null, section: null, sn: null, edit_id: null, review: null, action: null, pmtab: null });
  };
  const backToHub = () => goto({ section: null, sn: null, edit_id: null, review: null, action: null, pmtab: null });

  /** เปิดฟอร์มของส่วนนั้น — มีเอกสารแล้วส่ง edit_id ไปให้ฟอร์มโหลดของเดิม */
  const openSection = (job: Job, s: SectionState) => {
    const closed = ["closed", "submitted"].includes(String(s.status).trim().toLowerCase());
    const waiting = String(s.status).trim().toLowerCase() === "wait for approve";
    goto({
      view: "form",
      job_id: job.id,
      section: s.section,
      station_id: job.station_id,
      // ฟอร์มของตู้อ่าน SN จาก URL — ส่วนอื่นไม่ต้องมี ลบทิ้งกันค้างจากส่วนก่อนหน้า
      sn: s.section === CHARGER_SECTION ? (s.sn || null) : null,
      edit_id: s.report_id || null,
      // ใบที่ปิดแล้ว/รออนุมัติ เปิดเป็นโหมดตรวจอ่านอย่างเดียว เหมือนที่ตารางเดิมทำ
      review: closed || waiting ? "1" : null,
      action: null, pmtab: null,
    });
  };

  /** ออกจากหน้าใบงาน — มาจาก PM List ก็กลับไปหน้านั้น */
  const leaveWo = useCallback(() => {
    const back = pmBackRoute(searchParams);
    if (back) { router.push(back); return; }
    goto({ view: null, planning: null, wo_info: null, wonum: null, started: null, pmtab: null, edit_id: null });
  }, [goto, router, searchParams]);

  /**
   * ช่างกด "เริ่ม PM" จากใบงาน → เปิด (หรือหยิบ) ใบ PM สถานีของใบงานนั้น
   * แล้วพาไปหน้ารวม 5 ส่วน ให้เลือกเองว่าจะกรอกส่วนไหนก่อน
   *
   * ใบงานของตู้ก็ลงหน้ารวมเหมือนกัน ไม่กระโดดเข้าส่วนที่ 5 ให้ — ช่างต้องเห็นภาพรวม
   * ของใบก่อนว่ามีส่วนไหนต้องทำบ้าง (หน้ารวมมีตัวเลือกตู้ให้อยู่แล้ว)
   */
  const startPmFromWo = useCallback(async () => {
    if (!stationId || !openWonum) return;
    setActing(true);
    try {
      // วันที่ PM ของใบงานนั้น — หาไม่เจอก็ใช้วันนี้
      let pmDate = todayISO();
      try {
        const woRes = await apiFetch(
          `/maximo/pm/open?station_id=${encodeURIComponent(stationId)}&only_open=true&verify=false&limit=200`
        );
        const woJson = await woRes.json().catch(() => ({} as any));
        const hit = (Array.isArray(woJson?.items) ? woJson.items : [])
          .find((w: any) => String(w?.wonum ?? "") === openWonum);
        if (hit?.pm_date) pmDate = String(hit.pm_date).slice(0, 10);
      } catch { /* ใช้วันนี้แทน */ }

      const res = await apiFetch("/stationpmjob/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ station_id: stationId, pm_date: pmDate, wonum: openWonum }),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.detail || t("errCreate", lang));
      await loadJobs();
      goto({
        view: "form", job_id: json?.job?.id ?? null, station_id: stationId,
        section: null, sn: null,
        wo_info: null, planning: null, started: null, pmtab: null,
        edit_id: null, review: null, action: null,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : t("errCreate", lang));
    } finally {
      setActing(false);
    }
  }, [stationId, openWonum, goto, loadJobs, lang]);

  const createJob = async () => {
    if (!stationId || acting) return;
    setActing(true);
    try {
      const res = await apiFetch("/stationpmjob/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ station_id: stationId, pm_date: newDate, wonum: newWonum.trim() || null }),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.detail || t("errCreate", lang));
      setNewOpen(false);
      setNewWonum("");
      await loadJobs();
      if (json?.job?.id) goto({ view: "form", job_id: json.job.id, section: null, station_id: stationId });
    } catch (err) {
      alert(err instanceof Error ? err.message : t("errCreate", lang));
    } finally {
      setActing(false);
    }
  };

  const approveJob = async () => {
    if (!currentJob || acting) return;
    setActing(true);
    try {
      const res = await apiFetch(
        `/stationpmjob/${encodeURIComponent(currentJob.id)}/approve?station_id=${encodeURIComponent(currentJob.station_id)}`,
        { method: "POST" }
      );
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.detail || t("errAction", lang));
      await loadJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("errAction", lang));
    } finally {
      setActing(false);
    }
  };

  const rejectJob = async () => {
    if (!currentJob || acting || !rejectRemark.trim()) return;
    setActing(true);
    try {
      const res = await apiFetch(
        `/stationpmjob/${encodeURIComponent(currentJob.id)}/reject?station_id=${encodeURIComponent(currentJob.station_id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remark: rejectRemark.trim() }),
        }
      );
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.detail || t("errAction", lang));
      setRejectOpen(false);
      setRejectRemark("");
      await loadJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("errAction", lang));
    } finally {
      setActing(false);
    }
  };

  // ══════════════ ทางเข้าจากใบงาน Maximo ══════════════
  // ทุก role เข้าหน้าเดียวกันจาก PM List — ผู้วางแผนได้ฟอร์มวางแผน
  // ช่างได้หน้าเดียวกันแบบอ่านอย่างเดียว + ปุ่ม "เริ่ม PM" ท้ายหน้า
  if (planningWonum) {
    return (
      <PmPlanForm
        source={woSource}
        identifier={woSource === "charger" ? sn : stationId}
        wonum={planningWonum}
        onSaved={leaveWo}
        onCancel={leaveWo}
        onStart={() => { void startPmFromWo(); }}
      />
    );
  }
  // ช่างกดจาก PM List → ดูข้อมูลใบงานก่อน แล้วค่อยกด "เริ่ม PM"
  if (woInfoWonum) {
    return (
      <PmWorkOrderInfo
        source={woSource}
        identifier={woSource === "charger" ? sn : stationId}
        wonum={woInfoWonum}
        onStart={() => { void startPmFromWo(); }}
        onCancel={leaveWo}
      />
    );
  }

  // ══════════════ ฟอร์มของส่วนที่เลือก — ฟอร์มเดิมทั้งดุ้น ══════════════
  if (isFormView && section && SECTION_FORMS[section]) {
    const SectionForm = SECTION_FORMS[section];
    // ส่วนตู้ใช้ชื่อตู้บนปุ่มย้อนกลับ จะได้รู้ว่ากำลังกรอกตู้ไหนอยู่
    const openedSection = currentJob?.sections.find(
      (x) => x.section === section && (section !== CHARGER_SECTION || x.sn === (searchParams.get("sn") ?? ""))
    );
    const backLabel = openedSection && section === CHARGER_SECTION
      ? `${pick(SECTION_TITLE[section], lang)} · ${pick(openedSection.label, lang)}`
      : pick(SECTION_TITLE[section], lang);
    return (
      <div className="tw-mt-4 sm:tw-mt-6 lg:tw-mt-8">
        <div className="tw-mb-3 tw-flex tw-items-center tw-gap-2">
          <Button variant="outlined" size="sm" onClick={backToHub} className="tw-flex tw-items-center tw-gap-2">
            <ArrowLeftIcon className="tw-h-4 tw-w-4" />
            {backLabel} · {t("back", lang)}
          </Button>
        </div>
        <SectionForm />
      </div>
    );
  }

  // ══════════════ ลิงก์เก่าที่ชี้ไปเอกสารใบเดี่ยว (ก่อนรวมใบ) ══════════════
  // หน้า PM List ส่ง ?tab=<ชนิด>&view=form&edit_id=… มาโดยไม่มี job_id
  // เอกสารพวกนี้ไม่ได้ผูกกับใบแม่ ยังต้องเปิดฟอร์มของชนิดนั้นตรง ๆ ได้เหมือนเดิม
  if (!jobId && searchParams.get("view") === "form" && editId) {
    const legacySection = SLUG_TO_SECTION[searchParams.get("tab") ?? ""] ?? "charger";
    const LegacyForm = SECTION_FORMS[legacySection];
    return (
      <div className="tw-mt-4 sm:tw-mt-6 lg:tw-mt-8">
        <div className="tw-mb-3 tw-flex tw-items-center tw-gap-2">
          <Button variant="outlined" size="sm" onClick={leaveWo} className="tw-flex tw-items-center tw-gap-2">
            <ArrowLeftIcon className="tw-h-4 tw-w-4" />
            {pick(SECTION_TITLE[legacySection], lang)} · {t("back", lang)}
          </Button>
        </div>
        <LegacyForm />
      </div>
    );
  }

  // ══════════════ หน้ารวม 5 ส่วนของใบเดียว (hub) ══════════════
  if (isFormView) {
    const job = currentJob;
    if (loading) return <LoadingOverlay show text={t("loading", lang)} />;
    if (!job) {
      return (
        <div className="tw-mt-6">
          <Button variant="outlined" size="sm" onClick={backToList}>{t("back", lang)}</Button>
          <p className="tw-mt-4 tw-text-sm tw-text-gray-500">{t("noData", lang)}</p>
        </div>
      );
    }

    const waiting = job.status === "Wait for approve";
    return (
      <div className="tw-mt-4 sm:tw-mt-6 lg:tw-mt-8 tw-mx-auto tw-max-w-5xl">
        <div className="tw-mb-4 tw-flex tw-items-center tw-justify-between tw-gap-3">
          <Button variant="outlined" size="sm" onClick={backToList} className="tw-flex tw-items-center tw-gap-2">
            <ArrowLeftIcon className="tw-h-4 tw-w-4" /> {t("back", lang)}
          </Button>
          <a
            href={`${API_BASE}/stationpmjob/${encodeURIComponent(job.id)}/pdf?station_id=${encodeURIComponent(job.station_id)}&lang=${lang}`}
            target="_blank"
            rel="noreferrer"
            className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-lg tw-border tw-border-gray-300 tw-px-3 tw-py-2 tw-text-sm tw-font-semibold tw-text-gray-700 hover:tw-bg-gray-50"
          >
            <DocumentArrowDownIcon className="tw-h-4 tw-w-4" /> {t("downloadPdf", lang)}
          </a>
        </div>

        {/* หัวเอกสาร */}
        <Card className="tw-mb-5 tw-border tw-border-gray-200 tw-shadow-sm">
          <CardBody className="tw-p-5">
            <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-3">
              <div>
                <Typography variant="h5" className="tw-text-gray-900">{t("jobTitle", lang)}</Typography>
                <Typography className="tw-mt-1 tw-text-sm tw-text-gray-500">
                  {job.station_name || job.station_id}
                </Typography>
              </div>
              <PmStatusBadge flow={toPmFlow({ status: job.status, reject_remark: job.reject_remark })} />
            </div>

            <div className="tw-mt-4 tw-grid tw-grid-cols-2 md:tw-grid-cols-4 tw-gap-4 tw-text-sm">
              <div>
                <div className="tw-text-gray-500">{t("docNo", lang)}</div>
                <div className="tw-font-semibold tw-text-gray-800">{job.issue_id || "-"}</div>
              </div>
              <div>
                <div className="tw-text-gray-500">{t("docName", lang)}</div>
                <div className="tw-font-semibold tw-text-gray-800">{job.doc_name || "-"}</div>
              </div>
              <div>
                <div className="tw-text-gray-500">{t("pmDate", lang)}</div>
                <div className="tw-font-semibold tw-text-gray-800">{fmtDate(job.pm_date, lang)}</div>
              </div>
              <div>
                <div className="tw-text-gray-500">{t("wonum", lang)}</div>
                <div className="tw-font-semibold tw-text-gray-800">{job.wonum || "-"}</div>
              </div>
            </div>

            {job.reject_remark && (
              <div className="tw-mt-4 tw-rounded-lg tw-border tw-border-amber-200 tw-bg-amber-50 tw-px-4 tw-py-3 tw-text-sm tw-text-amber-800">
                {t("rejected", lang)} {job.reject_remark}
              </div>
            )}
            {job.status === "Closed" && job.approved_by && (
              <div className="tw-mt-4 tw-flex tw-items-center tw-gap-2 tw-text-sm tw-text-green-700">
                <CheckCircleIcon className="tw-h-5 tw-w-5" /> {t("approved", lang)} {job.approved_by}
              </div>
            )}
          </CardBody>
        </Card>

        {/* 5 ส่วนของเอกสาร — ส่วนที่ 5 (ตู้ชาร์จ) แตกเป็นใบย่อยรายตู้ */}
        <div className="tw-mb-2 tw-flex tw-items-baseline tw-gap-3">
          <Typography variant="h6" className="tw-text-gray-800">{t("sectionsTitle", lang)}</Typography>
          <span className="tw-text-xs tw-text-gray-500">{t("sectionsHint", lang)}</span>
          <span className="tw-ml-auto tw-text-xs tw-font-semibold tw-text-gray-500">
            {job.sections_done}/{job.sections_total}
          </span>
        </div>

        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
          {SECTION_ORDER.map((id, idx) => {
            const rows = job.sections.filter((x) => x.section === id);
            const groupStatus = aggregateStatus(rows);
            const isCharger = id === CHARGER_SECTION;
            const doneCount = rows.filter((x) => !!x.report_id).length;
            return (
              <Card
                key={id}
                className={`tw-border tw-border-gray-200 tw-shadow-sm ${isCharger ? "md:tw-col-span-2" : ""}`}
              >
                <CardBody className="tw-p-4">
                  <div className="tw-flex tw-items-start tw-gap-3">
                    <div className="tw-flex tw-h-8 tw-w-8 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-full tw-bg-gray-800 tw-text-sm tw-font-bold tw-text-white">
                      {idx + 1}
                    </div>
                    <div className="tw-min-w-0 tw-flex-1">
                      <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                        <span className="tw-font-semibold tw-text-gray-900">
                          {pick(SECTION_TITLE[id], lang)}
                        </span>
                        <span className={`tw-rounded-full tw-border tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-semibold ${sectionChipClass(groupStatus)}`}>
                          {sectionStatusLabel(groupStatus, lang)}
                        </span>
                        {isCharger && rows.length > 0 && (
                          <span className="tw-text-[11px] tw-font-semibold tw-text-gray-500">
                            {doneCount}/{rows.length} {t("chargersDone", lang)}
                          </span>
                        )}
                      </div>
                      <p className="tw-mt-1 tw-text-xs tw-text-gray-500">{pick(SECTION_HINT[id], lang)}</p>

                      {/* ส่วนที่ผูกกับสถานี — ใบเดียวจบ */}
                      {!isCharger && rows[0] && (
                        <SectionFillButton job={job} state={rows[0]} lang={lang} onOpen={openSection} />
                      )}

                      {/* ส่วนที่ผูกกับตู้ — ตู้ละ 1 ใบ แต่ยังเป็นส่วนเดียวกัน */}
                      {isCharger && (
                        rows.length === 0 ? (
                          <p className="tw-mt-3 tw-text-xs tw-text-gray-400">{t("noChargers", lang)}</p>
                        ) : (
                          <div className="tw-mt-3 tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-2">
                            {rows.map((c) => (
                              <div
                                key={c.sn}
                                className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-rounded-lg tw-border tw-border-gray-200 tw-px-3 tw-py-2"
                              >
                                <div className="tw-min-w-0 tw-flex-1">
                                  <div className="tw-truncate tw-text-sm tw-font-semibold tw-text-gray-800">
                                    {pick(c.label, lang)}
                                  </div>
                                  <div className="tw-truncate tw-text-[11px] tw-text-gray-400">{c.sn}</div>
                                </div>
                                <span className={`tw-rounded-full tw-border tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-semibold ${sectionChipClass(c.status)}`}>
                                  {sectionStatusLabel(c.status, lang)}
                                </span>
                                <SectionFillButton job={job} state={c} lang={lang} onOpen={openSection} compact />
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>

        {/* แถบอนุมัติ — ทั้งใบพร้อมกัน */}
        {waiting && canApprove && (
          <div className="tw-mt-6 tw-flex tw-flex-wrap tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-purple-200 tw-bg-purple-50 tw-px-4 tw-py-3">
            <span className="tw-text-sm tw-text-purple-800">{t("waitingApprove", lang)}</span>
            <div className="tw-ml-auto tw-flex tw-gap-2">
              <Button size="sm" variant="outlined" disabled={acting} onClick={() => setRejectOpen(true)}>
                {t("reject", lang)}
              </Button>
              <Button size="sm" disabled={acting} onClick={approveJob} className="tw-bg-green-600">
                {t("approve", lang)}
              </Button>
            </div>
          </div>
        )}

        <Dialog open={rejectOpen} handler={() => setRejectOpen(false)} size="sm">
          <DialogHeader>{t("reject", lang)}</DialogHeader>
          <DialogBody>
            <Input
              crossOrigin=""
              label={t("rejectReason", lang)}
              value={rejectRemark}
              onChange={(e) => setRejectRemark(e.target.value)}
            />
          </DialogBody>
          <DialogFooter className="tw-gap-2">
            <Button variant="text" onClick={() => setRejectOpen(false)}>{t("cancel", lang)}</Button>
            <Button color="red" disabled={!rejectRemark.trim() || acting} onClick={rejectJob}>
              {t("reject", lang)}
            </Button>
          </DialogFooter>
        </Dialog>
      </div>
    );
  }

  // ══════════════ ตารางใบ PM ของสถานี ══════════════
  const filtered = jobs.filter((j) => {
    const q = filtering.trim().toLowerCase();
    if (!q) return true;
    return [j.doc_name, j.issue_id, j.pm_date, j.wonum, j.status].some((v) =>
      String(v ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="tw-mt-4 sm:tw-mt-6 lg:tw-mt-8">
      <LoadingOverlay show={loading} text={t("loading", lang)} />
      <Card className="tw-border tw-border-gray-200 tw-shadow-sm">
        <CardHeader floated={false} shadow={false} className="tw-rounded-none tw-px-5 tw-pt-5">
          <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-3">
            <div>
              <Typography variant="h5" className="tw-text-gray-900">{t("pageTitle", lang)}</Typography>
              <Typography className="tw-mt-1 tw-text-sm tw-text-gray-500">{t("pageSubtitle", lang)}</Typography>
            </div>
            <div className="tw-flex tw-items-center tw-gap-2">
              <div className="tw-w-56">
                <Input
                  crossOrigin=""
                  label={t("search", lang)}
                  value={filtering}
                  onChange={(e) => setFiltering(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                disabled={!stationId}
                onClick={() => { setNewDate(todayISO()); setNewOpen(true); }}
                className="tw-flex tw-items-center tw-gap-1.5 tw-bg-gray-900"
              >
                <PlusIcon className="tw-h-4 tw-w-4" /> {t("newDoc", lang)}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardBody className="tw-px-5 tw-pb-5 tw-pt-4">
          {error && (
            <div className="tw-mb-3 tw-rounded-lg tw-border tw-border-red-200 tw-bg-red-50 tw-px-4 tw-py-3 tw-text-sm tw-text-red-700">
              {error}
            </div>
          )}
          {!stationId ? (
            <p className="tw-py-10 tw-text-center tw-text-sm tw-text-gray-500">{t("selectStationFirst", lang)}</p>
          ) : filtered.length === 0 && !loading ? (
            <p className="tw-py-10 tw-text-center tw-text-sm tw-text-gray-500">{t("noData", lang)}</p>
          ) : (
            <div className="tw-overflow-x-auto">
              <table className="tw-w-full tw-min-w-[760px] tw-table-auto tw-text-left">
                <thead>
                  <tr className="tw-border-b tw-border-gray-200 tw-bg-gray-50/60">
                    {[t("colNo", lang), t("colDocName", lang), t("colIssueId", lang), t("colPmDate", lang),
                      t("colSections", lang), t("colStatus", lang), t("colPdf", lang)].map((h) => (
                      <th key={h} className="tw-px-3 tw-py-2.5 tw-text-xs tw-font-semibold tw-text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((job, i) => (
                    <tr
                      key={job.id}
                      onClick={() => openJob(job)}
                      className="tw-cursor-pointer tw-border-b tw-border-gray-100 hover:tw-bg-blue-50/40"
                    >
                      <td className="tw-px-3 tw-py-3 tw-text-sm tw-text-gray-500">{i + 1}</td>
                      <td className="tw-px-3 tw-py-3 tw-text-sm tw-font-semibold tw-text-gray-800">{job.doc_name || "-"}</td>
                      <td className="tw-px-3 tw-py-3 tw-text-sm tw-text-gray-700">{job.issue_id || "-"}</td>
                      <td className="tw-px-3 tw-py-3 tw-text-sm tw-text-gray-700">{fmtDate(job.pm_date, lang)}</td>
                      <td className="tw-px-3 tw-py-3">
                        <div className="tw-flex tw-flex-wrap tw-gap-1">
                          {SECTION_ORDER.map((id) => {
                            const rows = job.sections.filter((x) => x.section === id);
                            const st = aggregateStatus(rows);
                            const filled = rows.filter((x) => !!x.report_id).length;
                            return (
                              <span
                                key={id}
                                title={sectionStatusLabel(st, lang)}
                                className={`tw-rounded tw-border tw-px-1.5 tw-py-0.5 tw-text-[10px] tw-font-semibold ${sectionChipClass(st)}`}
                              >
                                {pick(SECTION_TITLE[id], lang)}
                                {id === CHARGER_SECTION && rows.length > 1 ? ` ${filled}/${rows.length}` : ""}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="tw-px-3 tw-py-3">
                        <PmStatusBadge flow={toPmFlow({ status: job.status, reject_remark: job.reject_remark })} />
                      </td>
                      <td className="tw-px-3 tw-py-3" onClick={(e) => e.stopPropagation()}>
                        {/* PDF ให้โหลดได้เฉพาะใบที่อนุมัติปิดแล้ว (Closed) */}
                        {toPmFlow({ status: job.status, reject_remark: job.reject_remark }) === "closed"
                          && job.sections.some((x) => !!x.report_id) ? (
                          <a
                            href={`${API_BASE}/stationpmjob/${encodeURIComponent(job.id)}/pdf?station_id=${encodeURIComponent(job.station_id)}&lang=${lang}`}
                            target="_blank"
                            rel="noreferrer"
                            className="tw-inline-flex tw-items-center tw-gap-1 tw-text-sm tw-text-blue-600 hover:tw-underline"
                          >
                            <DocumentArrowDownIcon className="tw-h-4 tw-w-4" /> PDF
                          </a>
                        ) : (
                          <span className="tw-text-xs tw-text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* เปิดใบใหม่ */}
      <Dialog open={newOpen} handler={() => setNewOpen(false)} size="xs">
        <DialogHeader>{t("dialogTitle", lang)}</DialogHeader>
        <DialogBody className="tw-flex tw-flex-col tw-gap-4">
          <Input
            crossOrigin=""
            type="date"
            label={t("pmDateLabel", lang)}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
          <Input
            crossOrigin=""
            label={t("wonumLabel", lang)}
            value={newWonum}
            onChange={(e) => setNewWonum(e.target.value)}
          />
        </DialogBody>
        <DialogFooter className="tw-gap-2">
          <Button variant="text" onClick={() => setNewOpen(false)}>{t("cancel", lang)}</Button>
          <Button disabled={!newDate || acting} onClick={createJob} className="tw-bg-gray-900">
            {t("create", lang)}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
