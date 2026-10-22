"use client";

/**
 * หน้า PM report — "ใบเดียว 2 ส่วนหลัก"
 *
 * เดิมแท็บ Charger / Station / MDB / CCB / CB_BOX แยกกัน 5 แท็บ 5 เอกสาร
 * ตอนนี้ไม่มีแท็บแล้ว รวมเป็นเอกสารใบเดียว (1 เลขที่ / 1 PDF / อนุมัติครั้งเดียว)
 * ที่ข้างในแบ่งเป็น 2 ส่วนหลัก — Station รวม Station/MDB/CCB/CB_BOX และ Charger
 * มีใบย่อยตู้ละ 1 ใบ เพราะสถานีหนึ่งมีหลายตู้ แต่ยังใช้เลขที่เอกสารใบเดียวกัน
 *
 * 3 หน้าจออยู่ในไฟล์เดียว เลือกด้วย query string:
 *   ไม่มีอะไร                       → ตารางใบ PM ของสถานีนี้
 *   ?view=form&job_id=              → หน้ารวม 2 ส่วนหลักของใบนั้น (hub)
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
  ArrowLeftIcon, CheckCircleIcon, ClipboardDocumentListIcon, DocumentArrowDownIcon, LockClosedIcon, PencilSquareIcon, PlusIcon, XMarkIcon,
} from "@heroicons/react/24/outline";
import { discardOpenFormDraft } from "@/app/dashboard/pm-report/lib/discardDraft";
import { sectionLockPath, useEditLock } from "@/app/dashboard/pm-report/lib/lock";
import PmLockBanner from "@/app/dashboard/pm-report/components/PmLockBanner";
import { PmCancelEditContext, PmReviewActionContext } from "@/app/dashboard/pm-report/lib/reviewAction";
import { apiFetch } from "@/utils/api";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import LoadingOverlay from "@/app/dashboard/components/Loadingoverlay";
import { PM_APPROVE_ROLES, PmStatusBadge, toPmFlow } from "@/app/dashboard/pm-report/components/flow";
import PmPlanForm from "@/app/dashboard/pm-report/components/PmPlanForm";
import PmWorkOrderInfo from "@/app/dashboard/pm-report/components/PmWorkOrderInfo";
import { usePmConfirm } from "@/app/dashboard/pm-report/components/PmConfirmDialog";
import { pmBackRoute } from "@/app/dashboard/pm-report/lib/origin";

// ฟอร์มกรอกของแต่ละส่วน — ของเดิมทั้งหมด ไม่ได้แก้เนื้อ checklist
import StationPMForm from "@/app/dashboard/pm-report/station/input_PMreport/components/checkList";
import MDBPMForm from "@/app/dashboard/pm-report/mdb/input_PMreport/components/checkList";
import CCBPMForm from "@/app/dashboard/pm-report/ccb/input_PMreport/components/checkList";
import CBBOXPMForm from "@/app/dashboard/pm-report/cb-box/input_PMreport/components/checkList";
import ChargerPMForm from "@/app/dashboard/pm-report/charger/input_PMreport/components/checkList";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type SectionId = "station" | "mdb" | "ccb" | "cbbox" | "charger";

type SectionGroupId = "station" | "charger";

/** หน้าเว็บยุบฟอร์มจริง 5 ชนิดให้เหลือ 2 ส่วนหลัก โดยไม่เปลี่ยนโครงสร้างข้อมูล/PDF เดิม */
const SECTION_GROUPS: Array<{ id: SectionGroupId; sectionIds: SectionId[] }> = [
  { id: "station", sectionIds: ["station", "mdb", "ccb", "cbbox"] },
  { id: "charger", sectionIds: ["charger"] },
];

/** ส่วนที่ผูกกับตู้ (มีใบย่อยได้หลายใบ) ไม่ใช่กับสถานี */
const CHARGER_SECTION: SectionId = "charger";

/** role ที่กด "แก้ไข" ส่วนที่ส่งแล้วได้ — ต้องตรงกับ backend (pmreport_station_job.EDIT_SENT_ROLES) */
const PM_EDIT_SENT_ROLES = ["technician", "planner", "admin", "super_admin"];

const SECTION_FORMS: Record<SectionId, React.ComponentType> = {
  station: StationPMForm,
  mdb: MDBPMForm,
  ccb: CCBPMForm,
  cbbox: CBBOXPMForm,
  charger: ChargerPMForm,
};

const SECTION_TITLE: Record<SectionId, { th: string; en: string }> = {
  station: { th: "Station", en: "Station" },
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

const SECTION_GROUP_HINT: Record<SectionGroupId, { th: string; en: string }> = {
  station: {
    th: "รวมแบบตรวจ Station, MDB, CCB และ CB_BOX",
    en: "Includes the Station, MDB, CCB and CB_BOX checklists",
  },
  charger: SECTION_HINT.charger,
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
  /** ช่างกด N/A ไว้ — ส่วนนี้ไม่ต้องกรอก (มีได้เฉพาะส่วนที่ยังไม่มีเอกสาร) */
  na?: boolean;
  /**
   * บริษัทเจ้าของส่วนนี้ เมื่อใบงานแบ่งตู้ให้ vendor (เช่น EDS) — ว่าง = ไม่ได้แบ่งงาน
   * editable=false = คนที่ login อยู่กรอกส่วนนี้ไม่ได้ (เป็นงานของบริษัทอื่น)
   * backend เป็นคนคิดให้ (routers/pm_scope.py) และบังคับซ้ำตอนบันทึก
   */
  owner?: string;
  editable?: boolean;
  /** คนที่กำลังเปิดฟอร์มของส่วนนี้ในโหมดกรอกอยู่ (ล็อกรายส่วน) — ว่าง = ไม่มีใคร */
  locked_by?: string;
  /** planner ตีกลับส่วนนี้ (รายฟอร์ม) — หายเองเมื่อช่างส่งฟอร์มใหม่ */
  reject_remark?: string;
  rejected_by?: string;
  /**
   * ฟอร์มตู้ชาร์จของ vendor ที่มี planner ของตัวเอง (เช่น EDS) ต้องผ่าน planner ของ vendor ก่อน
   * "" = ไม่ต้องผ่าน | waiting = ฝ่ายยังไม่ส่งงาน | pending = รอ planner ของ vendor | approved = ผ่านแล้ว
   */
  vendor_review?: VendorReview;
};

type VendorReview = "" | "waiting" | "pending" | "approved";

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
  /** ส่งครบทุกส่วนในแผนแล้ว ช่างกด "ปิดใบงาน" ได้ */
  ready_to_submit?: boolean;
  /** ส่วนที่ยังขาดก่อนกด "ปิดใบงาน" ได้ */
  missing?: { th: string; en: string }[];
  submitted_by?: string;
  /** เวลาที่ช่างกด "เริ่ม PM" (รับงาน) — เป็นค่าเริ่มต้นของเวลาเริ่ม PM ตอนปิดใบงาน */
  createdAt?: string;
  /** กรอกตอนกด "ปิดใบงาน" — เติมกลับให้ตอนกดใหม่หลังโดนตีกลับ */
  work_start?: string;
  work_finish?: string;
  maximo_labor?: string[];
  maximo_contractor?: string;
  /** ใบที่ไม่ได้ผูกกับ Maximo — ผู้ปฏิบัติงานเป็นบัญชี iMPS แทน laborcode */
  imps_labor?: string[];
  /**
   * ใบงานที่ Maximo เปิดมา (ไม่ใช่ใบงานที่เปิดเองใน iMPS) — ปิดใบงานลงเวลาด้วย laborcode
   * และตอนอนุมัติ backend ยิง IN03 → IN09 → IN02 CLOSED เข้า Maximo
   */
  from_maximo?: boolean;
  /** ผลการยิงชุดปิดงานเข้า Maximo ของทั้งใบ */
  maximo_sync?: Record<string, MaximoStep>;
  /**
   * ฝ่ายที่ต้องส่งงานในใบ (แบ่งตามผู้ทำ PM ที่ planner เลือก) — ใบที่ไม่ได้แบ่งงานมีฝ่ายเดียว
   * แต่ละฝ่ายกด "ส่งงาน" พร้อมเวลาทำงาน/ผู้ลงเวลาของตัวเอง ครบทุกฝ่ายใบจึงรออนุมัติ
   */
  parties?: JobParty[];
  /** ฝ่ายของคนที่ login อยู่ (key ของ parties) */
  my_party?: string;
  split?: boolean;
  work_entries?: WorkEntry[];
  /** คนที่ login เป็น planner ของ vendor ในใบนี้ → key ฝ่ายที่ต้องตรวจฟอร์มตู้ชาร์จ ("" = ไม่ใช่) */
  vendor_reviewer?: string;
  /** อนุมัติ/ตีกลับทั้งใบได้ (planner ต้นทาง / admin) — planner ของ vendor ไม่ได้ */
  can_approve?: boolean;
};

type JobParty = {
  key: string;
  name: string;
  /** ทุกส่วนของฝ่ายนี้ส่งครบแล้ว กดส่งงานได้ */
  ready: boolean;
  missing: { th: string; en: string }[];
  submitted: boolean;
  /** ฟอร์มตู้ชาร์จของฝ่ายนี้ต้องผ่าน planner ของ vendor ก่อน (ดู SectionState.vendor_review) */
  vendor_review?: VendorReview;
  vendor_approved_by?: string;
};

type WorkEntry = {
  key: string;
  party: string;
  work_start: string;
  work_finish: string;
  maximo_labor: string[];
  maximo_contractor: string;
  imps_labor: string[];
  submitted: boolean;
  submitted_by: string;
  submitted_at: string;
};

/** role ที่ส่งงานแทนฝ่ายอื่นได้ — ต้องตรงกับ pm_scope.BYPASS_ROLES */
const PM_SUBMIT_FOR_ANY_ROLES = ["admin", "owner"];

type MaximoStep = { ok: boolean; at?: string; status?: string; error?: string; errors?: string[] };

/** ขั้นของชุดปิดงานที่โชว์ในหน้าใบ — เรียงตามลำดับที่ยิงจริง */
const MAXIMO_CLOSE_STEPS: { key: string; th: string; en: string }[] = [
  { key: "IN03", th: "แนบ PDF", en: "Attach PDF" },
  { key: "IN09", th: "ลงเวลาช่าง", en: "Labor time" },
  { key: "IN02", th: "ปิด WO", en: "Close WO" },
];
const PM_RESYNC_ROLES = ["admin", "owner", "planner"];

/** อนุมัติแล้วชุดปิดงานผ่านครบไหม — IN02 CLOSED ผ่าน = ปิด WO ใน Maximo แล้ว */
function maximoClosed(sync: Record<string, MaximoStep> | undefined) {
  return !!sync?.IN02?.ok && String(sync.IN02.status ?? "").toUpperCase() !== "INPRG";
}

type LaborOption = { laborcode: string; name: string; needs_name?: boolean };

type Me = { username: string; role: string };

const T = {
  pageTitle: { th: "Preventive Maintenance Checklist - Station", en: "Preventive Maintenance Checklist - Station" },
  pageSubtitle: {
    th: "ใบ PM ของสถานี — 2 ส่วนหลัก: Station และ Charger",
    en: "Station PM document — two main sections: Station and Charger",
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
    th: "2 ส่วนหลักอยู่ในเอกสารเลขที่เดียวกัน — MDB, CCB และ CB_BOX รวมอยู่ใน Station",
    en: "Both sections share one document number — MDB, CCB and CB_BOX are grouped under Station",
  },
  edit: { th: "แก้ไข", en: "Edit" },
  cancelEdit: { th: "ยกเลิกการแก้ไข", en: "Cancel edit" },
  cancelEditConfirm: {
    th: "สิ่งที่แก้ไขไว้ รวมถึงรูปที่แนบใหม่ จะถูกทิ้ง และเอกสารจะกลับเป็นข้อมูลที่บันทึกไว้ก่อนหน้า ต้องการยกเลิกการแก้ไขใช่หรือไม่?",
    en: "Your changes, including newly attached photos, will be discarded and the document will return to its previously saved version. Do you want to cancel editing?",
  },
  continueEdit: { th: "แก้ไขต่อ", en: "Continue editing" },
  confirmCancelEdit: { th: "ยืนยันยกเลิก", en: "Confirm cancel" },
  cancellingEdit: { th: "กำลังยกเลิก…", en: "Cancelling…" },
  view: { th: "ดู", en: "View" },
  notFilled: { th: "ยังไม่กรอก", en: "Not filled" },
  downloadPdf: { th: "PDF ทั้งใบ", en: "Full PDF" },
  // PDF รายการ์ด — Station (รวม MDB/CCB/CB_BOX) / ตู้ชาร์จทุกตู้: checklist ก่อน รูปตามหลัง
  cardPdf: { th: "PDF", en: "PDF" },
  cardPdfTitle: { th: "PDF ของส่วนนี้ — checklist ทุกฟอร์มก่อน แล้วตามด้วยรูป", en: "PDF of this part — all checklists first, then photos" },
  cardPdfEmpty: { th: "ยังไม่มีฟอร์มที่กรอกแล้ว", en: "No filled forms yet" },
  pdfClosedOnly: { th: "โหลด PDF ได้หลังอนุมัติใบงานแล้ว (Closed)", en: "PDF is available once the document is approved (Closed)" },
  closeJob: { th: "ปิดใบงาน", en: "Close work order" },
  submitParty: { th: "ส่งงานของ {p}", en: "Submit {p} work" },
  resubmitParty: { th: "แก้ไขงานที่ส่ง ({p})", en: "Edit submitted work ({p})" },
  submitAs: { th: "ส่งงานของฝ่าย", en: "Submit for" },
  partiesTitle: { th: "การส่งงานแต่ละฝ่าย", en: "Work submitted by each party" },
  partySent: { th: "ส่งแล้ว", en: "Submitted" },
  partyWaiting: { th: "รอส่งงาน", en: "Waiting" },
  partyNotReady: { th: "ยังกรอกไม่ครบ", en: "Not complete" },
  ownTeam: { th: "ทีมต้นทาง", en: "Origin team" },
  submitPartyHint: {
    th: "ใบนี้แบ่งงานหลายฝ่าย — แต่ละฝ่ายส่งงานพร้อมเวลาทำงานของตัวเอง ครบทุกฝ่ายแล้วใบจึงส่งให้อนุมัติ",
    en: "This document is split between parties — each submits its own work time; it goes for approval once all have submitted",
  },
  closingJob: { th: "กำลังปิดใบงาน…", en: "Closing…" },
  closeJobHint: {
    th: "กรอกเวลาทำงานจริงและช่างที่ลงเวลาเข้า Maximo แล้วส่งให้ผู้อนุมัติ — หลังจากนี้แก้ไขเอกสารไม่ได้ จนกว่าจะถูกตีกลับ",
    en: "Enter the actual work time and the technicians to log in Maximo, then send for approval. The document can't be edited afterwards unless it is sent back.",
  },
  closeJobHintNoMaximo: {
    th: "กรอกเวลาทำงานจริงและผู้ปฏิบัติงาน แล้วส่งให้ผู้อนุมัติ — หลังจากนี้แก้ไขเอกสารไม่ได้ จนกว่าจะถูกตีกลับ",
    en: "Enter the actual work time and who did the work, then send for approval. The document can't be edited afterwards unless it is sent back.",
  },
  impsLabor: { th: "ผู้ปฏิบัติงาน (บัญชี iMPS)", en: "Technicians (iMPS accounts)" },
  impsLaborEmpty: { th: "ไม่พบบัญชี iMPS ในบริษัทของคุณ", en: "No iMPS accounts found in your company" },
  errImpsLabor: { th: "กรุณาเลือกผู้ปฏิบัติงานอย่างน้อย 1 คน", en: "Select at least one technician" },
  workStart: { th: "วันที่เวลาเริ่ม PM", en: "PM start" },
  workFinish: { th: "วันที่เวลา PM เสร็จ", en: "PM finish" },
  maximoLabor: { th: "ช่างที่ลงเวลากับ Maximo", en: "Technicians to log in Maximo" },
  maximoLaborEmpty: { th: "โหลดรายชื่อช่างจาก Maximo ไม่ได้", en: "Could not load technicians from Maximo" },
  contractorName: { th: "ชื่อผู้รับเหมา", en: "Contractor name" },
  errWorkTime: { th: "กรุณากรอกวันที่เวลาเริ่มและเสร็จ", en: "Please enter the start and finish time" },
  errWorkOrder: { th: "เวลาเสร็จต้องไม่ก่อนเวลาเริ่ม", en: "Finish must not be before start" },
  errWorkFuture: {
    th: "เวลาทำงานต้องไม่เป็นเวลาในอนาคต — Maximo ไม่รับเวลาที่ยังมาไม่ถึง",
    en: "Work time cannot be in the future — Maximo rejects times that have not happened yet",
  },
  errLabor: { th: "กรุณาเลือกช่างที่ลงเวลากับ Maximo อย่างน้อย 1 คน", en: "Select at least one technician" },
  errContractor: { th: "กรุณาระบุชื่อผู้รับเหมา", en: "Please enter the contractor name" },
  confirmClose: { th: "ปิดใบงาน", en: "Close work order" },
  closeJobMissing: { th: "ยังกรอกไม่ครบ:", en: "Still missing:" },
  closeJobEmpty: { th: "ยังไม่มีส่วนไหนถูกกรอก", en: "No section has been filled yet" },
  sectionSent: { th: "กรอกแล้ว", en: "Done" },
  back: { th: "ย้อนกลับ", en: "Back" },
  lockedSection: {
    th: "ส่วนนี้เป็นงานของ {owner} — บริษัทของคุณกรอกส่วนนี้ไม่ได้",
    en: "This section is assigned to {owner} — your company cannot fill it in",
  },

  approve: { th: "อนุมัติทั้งใบ", en: "Approve document" },
  reject: { th: "ตีกลับ", en: "Send back" },
  rejectReason: { th: "เหตุผลที่ตีกลับ", en: "Reason" },
  rejected: { th: "ถูกตีกลับให้แก้:", en: "Sent back for fixes:" },
  approved: { th: "อนุมัติแล้วโดย", en: "Approved by" },
  maximoTitle: { th: "ส่งเข้า Maximo", en: "Sent to Maximo" },
  maximoPending: { th: "ยังไม่ได้ส่ง", en: "Not sent" },
  maximoResync: { th: "ส่งเข้า Maximo ใหม่", en: "Resend to Maximo" },
  maximoResyncing: { th: "กำลังส่ง…", en: "Sending…" },
  maximoFailedAlert: {
    th: "อนุมัติแล้ว แต่ส่งเข้า Maximo ยังไม่สำเร็จ ({steps}) — กด \"ส่งเข้า Maximo ใหม่\" ที่หน้าใบ PM ได้",
    en: "Approved, but sending to Maximo did not complete ({steps}) — press \"Resend to Maximo\" on the PM document",
  },
  rejectConfirm: {
    th: "ตีกลับทั้งใบให้ช่างแก้ — ระบุเหตุผลให้ช่างรู้ว่าต้องแก้อะไร",
    en: "Send the whole document back for fixes. Tell the technician what to change.",
  },
  rejecting: { th: "กำลังตีกลับ…", en: "Sending back…" },
  rejectAll: { th: "ตีกลับทั้งใบ", en: "Send back all" },
  rejectSection: { th: "ตีกลับฟอร์มนี้", en: "Send back this form" },
  rejectSectionConfirm: {
    th: "ตีกลับเฉพาะฟอร์มนี้ให้ช่างแก้ — ฟอร์มอื่นยังรออนุมัติอยู่ ไม่ต้องส่งใหม่ ระบุเหตุผลให้ช่างรู้ว่าต้องแก้อะไร",
    en: "Send only this form back for fixes — the other forms stay waiting for approval. Tell the technician what to change.",
  },
  sectionRejected: { th: "ตีกลับ", en: "Sent back" },
  // อนุมัติชั้นแรกโดย planner ของ vendor (ฟอร์มตู้ชาร์จที่มอบให้ vendor เช่น EDS)
  vendorApprove: { th: "อนุมัติงานของ {p}", en: "Approve {p} work" },
  vendorApproving: { th: "กำลังอนุมัติ…", en: "Approving…" },
  vendorApproveTitle: { th: "อนุมัติงานตู้ชาร์จของ {p}", en: "Approve {p} charger work" },
  vendorApproveConfirm: {
    th: "ตรวจฟอร์มตู้ชาร์จของ {p} ครบแล้ว — อนุมัติแล้วจะส่งต่อให้ planner ต้นทางอนุมัติทั้งใบ (ฟอร์มที่ต้องแก้ให้เปิดฟอร์มแล้วกด \"ตีกลับฟอร์มนี้\" ก่อน)",
    en: "All {p} charger forms reviewed — approving passes them on to the origin planner for final approval (send back any form that needs fixing first)",
  },
  vendorReviewHint: {
    th: "ฟอร์มตู้ชาร์จของ {p} รอคุณตรวจ — เปิดดูแต่ละฟอร์มเพื่อตีกลับรายฟอร์ม หรือกด \"อนุมัติงานของ {p}\" เพื่อส่งต่อให้ planner ต้นทาง",
    en: "{p} charger forms are waiting for your review — open a form to send it back, or approve to pass them on to the origin planner",
  },
  // planner ของ vendor ตรวจ/อนุมัติจากในฟอร์มตู้ชาร์จ — หน้ารวมเหลือแค่ข้อความบอกทาง
  vendorReviewOpenForm: {
    th: "ฟอร์มตู้ชาร์จของ {p} รอคุณตรวจ — เปิดฟอร์มตู้ชาร์จเพื่ออนุมัติหรือตีกลับ",
    en: "{p} charger forms are waiting for your review — open a charger form to approve or send it back",
  },
  vendorPending: { th: "รอ planner {p} อนุมัติ", en: "Waiting for {p} planner" },
  vendorApproved: { th: "{p} อนุมัติแล้ว", en: "Approved by {p}" },
  vendorRejectSectionConfirm: {
    th: "ตีกลับเฉพาะฟอร์มนี้ให้ช่างแก้ — ช่างต้องส่งงานใหม่ แล้วกลับมาให้คุณอนุมัติอีกครั้ง ระบุเหตุผลให้ช่างรู้ว่าต้องแก้อะไร",
    en: "Send only this form back — the technicians resubmit and it comes back to you for approval. Tell them what to change.",
  },

  errLoad: { th: "โหลดใบ PM ไม่สำเร็จ", en: "Failed to load PM documents" },
  errCreate: { th: "เปิดใบใหม่ไม่สำเร็จ", en: "Failed to create document" },
  errAction: { th: "ทำรายการไม่สำเร็จ", en: "Action failed" },

  noChargers: { th: "สถานีนี้ยังไม่มีตู้ชาร์จในระบบ", en: "No chargers registered at this station" },
  chargersDone: { th: "กรอกแล้ว", en: "filled" },
  na: { th: "N/A", en: "N/A" },
  ownedBy: { th: "งานของ", en: "Assigned to" },
  inUseBy: { th: "กำลังกรอก:", en: "In use:" },
  viewOnly: { th: "ดูอย่างเดียว", en: "View only" },
  lockChecking: { th: "กำลังตรวจสอบว่ามีคนกรอกส่วนนี้อยู่หรือไม่…", en: "Checking whether someone else is filling in this section…" },
  otherTeam: { th: "บริษัทอื่น", en: "another company" },
  markNa: { th: "ไม่ต้องกรอกส่วนนี้ (N/A)", en: "Mark as N/A (no need to fill)" },
  undoNa: { th: "ยกเลิก N/A — กลับไปต้องกรอก", en: "Undo N/A — fill this section" },
  naTitle: { th: "ไม่ต้องกรอกส่วนนี้ (N/A)", en: "Mark as N/A" },
  confirmNa: {
    th: "ส่วนที่ N/A ไม่ต้องกรอก และจะไม่อยู่ใน PDF — ยกเลิก N/A ได้จนกว่าจะกดปิดใบงาน",
    en: "This section won't need to be filled and won't appear in the PDF. You can undo N/A until the job is closed.",
  },
  confirmNaButton: { th: "ยืนยัน N/A", en: "Confirm N/A" },
  savingNa: { th: "กำลังบันทึก…", en: "Saving…" },
} as const;

const t = (k: keyof typeof T, lang: Lang) => T[k][lang === "en" ? "en" : "th"];
const pick = (v: { th: string; en: string }, lang: Lang) => (lang === "en" ? v.en : v.th);

function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Date → ค่าของ input datetime-local ตามเวลาเครื่อง "YYYY-MM-DDTHH:MM" */
function toLocalDatetimeInput(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/**
 * ค่าเริ่มต้นของเวลาเริ่ม PM = วันนี้ + เวลาที่กดรับงาน (createdAt ของใบ)
 * ถ้ารับงานไว้ตั้งแต่วันก่อนแล้วเวลานั้นของวันนี้ยังมาไม่ถึง ใช้วันเวลารับงานจริงแทน (Maximo ไม่รับเวลาอนาคต)
 */
function defaultWorkStart(createdAt: string | undefined, now: Date) {
  if (!createdAt) return "";
  // backend ส่ง datetime ของ Mongo เป็น UTC ไม่มี offset ต่อท้าย — ต้องบอกเองว่าเป็น UTC
  const accepted = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(createdAt) ? createdAt : `${createdAt}Z`);
  if (Number.isNaN(accepted.getTime())) return "";
  const today = new Date(now);
  today.setHours(accepted.getHours(), accepted.getMinutes(), 0, 0);
  return toLocalDatetimeInput(today <= now ? today : accepted);
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
function sectionStatusLabel(status: string, lang: Lang, jobClosedByTech = true) {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return t("notFilled", lang);
  if (s === "na") return t("na", lang);
  // ส่วนที่ช่างส่งจากฟอร์มแล้ว แต่ยังไม่ได้กด "ปิดใบงาน" — ยังไม่ได้รออนุมัติจริง
  if (s === "wait for approve") return jobClosedByTech ? "Wait for approve" : t("sectionSent", lang);
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
function aggregateStatus(allRows: SectionState[]): string {
  if (!allRows.length) return "";
  // ส่วนที่ N/A ไม่ต้องกรอก — ไม่เอามาคิดสถานะ, N/A ทั้งหมด = "na"
  const rows = allRows.filter((r) => !r.na);
  if (!rows.length) return "na";
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
  if (s === "na") return "tw-bg-gray-100 tw-text-gray-500 tw-border-gray-300";
  if (s === "wait for approve") return "tw-bg-purple-50 tw-text-purple-700 tw-border-purple-200";
  if (s === "draft") return "tw-bg-amber-50 tw-text-amber-700 tw-border-amber-200";
  return "tw-bg-green-50 tw-text-green-700 tw-border-green-200";
}

/**
 * ปุ่มชื่ออุปกรณ์ของใบลูก 1 ใบ — ไอคอนบอกว่าเปิดกรอก/แก้ไขหรือดู
 * ข้าง ๆ มีปุ่ม N/A ให้กดว่าส่วนนี้ไม่ต้องกรอก (เฉพาะส่วนที่ยังไม่มีเอกสาร และใบยังไม่ได้ปิดใบงาน)
 */
function SectionFillButton({
  job, state, lang, onOpen, onToggleNa, busy = false, inUseBy = "",
}: {
  job: Job;
  state: SectionState;
  lang: Lang;
  onOpen: (job: Job, s: SectionState) => void;
  onToggleNa: (job: Job, s: SectionState, na: boolean) => void;
  busy?: boolean;
  /** คนอื่นกำลังกรอกส่วนนี้อยู่ (ชื่อ) — กดเข้าไปได้แค่ดู */
  inUseBy?: string;
}) {
  const filled = !!state.report_id;
  const status = String(state.status).trim().toLowerCase();
  const sent = filled && ["closed", "submitted", "wait for approve"].includes(status);
  const label = pick(state.label, lang);
  const action = sent ? t("view", lang) : filled ? t("edit", lang) : label;
  // ไอคอนหน้าชื่ออุปกรณ์บอกสถานะของฟอร์ม:
  //   ยังไม่กรอก = แบบฟอร์ม | ส่งแล้ว (เสร็จ) = เครื่องหมายถูกสีเขียว | กลับไปแก้ไข (บันทึกไว้แต่ยังไม่ส่ง) = ดินสอ
  const Icon = sent ? CheckCircleIcon : filled ? PencilSquareIcon : ClipboardDocumentListIcon;
  const iconClass = sent ? "tw-text-green-600" : filled ? "tw-text-amber-600" : "";
  const na = !!state.na;
  // เป็นงานของบริษัทอื่น (ใบงานแบ่งตู้ให้ vendor) — ยังไม่กรอกก็กดไม่ได้ กรอกแล้วเปิดดูได้อย่างเดียว
  const locked = state.editable === false;
  const ownerText = `${t("ownedBy", lang)} ${state.owner || t("otherTeam", lang)}`;
  // ปิดใบงานแล้ว (รออนุมัติ/ปิด) เปลี่ยน N/A ไม่ได้ — ปุ่มหายไป เหลือแค่ป้าย N/A
  const canToggleNa = job.status === "draft" && !filled && !locked && !inUseBy;
  // planner ตีกลับฟอร์มนี้ และยังไม่ได้ส่งใหม่
  const rejectedRemark = filled && !sent ? (state.reject_remark ?? "") : "";
  return (
    // ไม่ยืดเต็มการ์ด — กว้างพอดีชื่ออุปกรณ์ + ปุ่ม N/A (มือถือยังเต็มความกว้างให้กดง่าย)
    <div className="tw-flex tw-w-full tw-items-stretch tw-gap-1.5 sm:tw-max-w-[15rem]">
      {na ? (
        <div
          title={`${label}: ${t("na", lang)}`}
          className="tw-flex tw-min-w-0 tw-flex-1 tw-items-center tw-justify-center tw-gap-1.5 tw-rounded-lg tw-border tw-border-dashed tw-border-gray-300 tw-bg-gray-50 tw-px-3 tw-py-2 tw-text-xs tw-font-bold tw-uppercase tw-text-gray-400"
        >
          <span className="tw-truncate tw-line-through">{label}</span>
          <span className="tw-rounded tw-bg-gray-200 tw-px-1.5 tw-py-0.5 tw-text-[10px] tw-text-gray-600">
            {t("na", lang)}
          </span>
        </div>
      ) : locked && !filled ? (
        <div
          title={`${label}: ${ownerText}`}
          aria-label={`${label}: ${ownerText}`}
          className="tw-flex tw-min-w-0 tw-flex-1 tw-items-center tw-justify-center tw-gap-1.5 tw-rounded-lg tw-border tw-border-dashed tw-border-gray-300 tw-bg-gray-50 tw-px-3 tw-py-1.5 tw-text-xs tw-font-bold tw-uppercase tw-text-gray-400"
        >
          <LockClosedIcon className="tw-h-4 tw-w-4 tw-shrink-0" />
          <span className="tw-flex tw-min-w-0 tw-flex-col tw-items-start tw-leading-tight">
            <span className="tw-truncate">{label}</span>
            <span className="tw-truncate tw-text-[10px] tw-font-medium tw-normal-case tw-text-gray-500">{ownerText}</span>
          </span>
        </div>
      ) : (
        <Button
          size="sm"
          variant={filled ? "outlined" : "filled"}
          onClick={() => onOpen(job, state)}
          title={locked
            ? `${t("view", lang)}: ${label} (${ownerText})`
            : `${action}: ${label}${rejectedRemark ? ` — ${t("rejected", lang)} ${rejectedRemark}` : ""}`}
          aria-label={locked ? `${t("view", lang)}: ${label} (${ownerText})` : `${action}: ${label}`}
          className="tw-flex tw-min-w-0 tw-flex-1 tw-items-center tw-justify-center tw-gap-1.5"
        >
          {locked
            ? <LockClosedIcon className="tw-h-4 tw-w-4 tw-shrink-0" />
            : <Icon className={`tw-h-4 tw-w-4 tw-shrink-0 ${iconClass}`} />}{" "}
          <span className="tw-truncate">{label}</span>
          {rejectedRemark && (
            <span className="tw-shrink-0 tw-rounded tw-bg-amber-100 tw-px-1.5 tw-py-0.5 tw-text-[10px] tw-font-semibold tw-normal-case tw-text-amber-800">
              {t("sectionRejected", lang)}
            </span>
          )}
          {state.owner && <span className="tw-shrink-0 tw-text-[10px] tw-font-medium tw-normal-case tw-opacity-70">· {state.owner}</span>}
          {inUseBy && (
            <span className="tw-shrink-0 tw-rounded tw-bg-amber-100 tw-px-1.5 tw-py-0.5 tw-text-[10px] tw-font-semibold tw-normal-case tw-text-amber-800">
              {t("inUseBy", lang)} {inUseBy}
            </span>
          )}
        </Button>
      )}
      {canToggleNa && (
        <Button
          size="sm"
          variant={na ? "filled" : "outlined"}
          color="gray"
          disabled={busy}
          onClick={() => onToggleNa(job, state, !na)}
          title={`${label}: ${na ? t("undoNa", lang) : t("markNa", lang)}`}
          aria-label={`${label}: ${na ? t("undoNa", lang) : t("markNa", lang)}`}
          aria-pressed={na}
          className="tw-shrink-0 tw-px-3"
        >
          {t("na", lang)}
        </Button>
      )}
    </div>
  );
}

export default function StationPmJobTables() {
  const { lang } = useLanguage();
  // ยืนยันก่อนกดปุ่มที่เปลี่ยนข้อมูล (อนุมัติทั้งใบ / ส่ง Maximo ใหม่) — แบบเดียวกับหน้า CM
  const { ask: askConfirm, dialog: confirmDialog } = usePmConfirm(lang);
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
  const [cancelEditOpen, setCancelEditOpen] = useState(false);
  const [cancellingEdit, setCancellingEdit] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newDate, setNewDate] = useState(todayISO);
  const [newWonum, setNewWonum] = useState("");

  // ปิดใบงาน: เวลาทำงานจริง + ช่างที่ลงเวลา Maximo กรอกครั้งเดียวที่นี่ (ฟอร์มแต่ละส่วนไม่มีแล้ว)
  const [closeOpen, setCloseOpen] = useState(false);
  // ฝ่ายที่กำลังส่งงานในหน้าต่างปิดใบงาน (key ของ parties)
  const [closeParty, setCloseParty] = useState("");
  const [workStart, setWorkStart] = useState("");
  const [workFinish, setWorkFinish] = useState("");
  const [maximoLabor, setMaximoLabor] = useState<string[]>([]);
  const [maximoContractor, setMaximoContractor] = useState("");
  const [laborOptions, setLaborOptions] = useState<LaborOption[]>([]);
  // ใบที่ไม่ได้ผูกกับ Maximo: เลือกผู้ปฏิบัติงานจากบัญชี iMPS ใน company เดียวกับคนที่ login
  const [impsLabor, setImpsLabor] = useState<string[]>([]);
  const [coworkers, setCoworkers] = useState<string[]>([]);
  const [closeError, setCloseError] = useState("");

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRemark, setRejectRemark] = useState("");

  // ส่วนที่กำลังจะกด N/A — รอยืนยันใน pop-up
  const [naConfirm, setNaConfirm] = useState<{ job: Job; state: SectionState } | null>(null);
  const [naError, setNaError] = useState("");

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

  // laborcode ฝั่ง Maximo — username ใน iMPS ใช้แทนกันไม่ได้ ต้องให้เลือกเอง
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch("/cm-maximo/labor-codes");
        if (!res.ok) return;
        const data = await res.json();
        if (alive && Array.isArray(data?.items)) setLaborOptions(data.items);
      } catch { /* โหลดไม่ได้ = ไม่บังคับเลือก ไม่บล็อกการปิดใบงาน */ }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch("/companies/coworkers");
        if (!res.ok) return;
        const data = await res.json();
        if (alive && Array.isArray(data?.users)) setCoworkers(data.users);
      } catch (err) {
        console.error("load coworkers error:", err);
      }
    })();
    return () => { alive = false; };
  }, []);

  const loadJobs = useCallback(async () => {
    if (!stationId) { setJobs([]); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/stationpmjob/list?station_id=${encodeURIComponent(stationId)}`, { cache: "no-store" });
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

  // ฟอร์มกับหน้ารวมใช้ route เดียวกัน จึงต้องโหลดสถานะใหม่เมื่อเปลี่ยนส่วน/กลับจากฟอร์ม
  useEffect(() => { void loadJobs(); }, [loadJobs, jobId, section]);

  const currentJob = useMemo(
    () => jobs.find((j) => j.id === jobId) ?? null,
    [jobs, jobId]
  );

  // อนุมัติ/ตีกลับทั้งใบ = planner ต้นทาง / admin — backend บอกมาต่อใบ (planner ของ vendor ไม่ได้)
  const roleCanApprove = PM_APPROVE_ROLES.includes(me?.role ?? "");
  const jobCanApprove = (j?: Job | null) => (j?.can_approve ?? roleCanApprove);
  const canApprove = jobCanApprove(currentJob);

  // ── ล็อกกันกรอกชนกัน (ทีละส่วน — routers/pm_lock.py) ──
  // จองสิทธิ์เฉพาะตอนเปิดฟอร์มของส่วนนั้นในโหมดกรอก (ดูอย่างเดียวไม่จอง จะได้ไม่ไปกันคนอื่น)
  // หลายฝ่ายกรอกคนละส่วนพร้อมกันได้ ชนกันเฉพาะคนที่เปิดส่วนเดียวกัน
  const formSn = section === CHARGER_SECTION ? (searchParams.get("sn") ?? "") : "";
  const formViewing = searchParams.get("review") === "1";
  const formState = currentJob?.sections.find(
    (x) => x.section === section && (section !== CHARGER_SECTION || x.sn === formSn)
  );
  const sectionLockWanted = isFormView && !!section && !!currentJob && !formViewing && formState?.editable !== false;
  const { lockedBy: sectionLockedBy, checking: sectionLockChecking } = useEditLock(
    sectionLockWanted && currentJob && section
      ? sectionLockPath(currentJob.id, currentJob.station_id, section, formSn || null)
      : null,
    sectionLockWanted,
  );
  /** คนอื่น (ไม่ใช่เรา) กำลังกรอกส่วนนี้อยู่ — ตามข้อมูลล่าสุดของหน้ารวม */
  const inUseByOther = (s?: SectionState) => {
    const who = String(s?.locked_by ?? "").trim();
    return who && who.toLowerCase() !== String(me?.username ?? "").trim().toLowerCase() ? who : "";
  };

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
      // ส่วนที่เป็นงานของบริษัทอื่นก็เปิดดูได้อย่างเดียวเช่นกัน
      review: closed || waiting || s.editable === false || !!inUseByOther(s) ? "1" : null,
      action: null, pmtab: null,
    });
  };

  /** กด/ยกเลิก N/A ของส่วนหนึ่ง — ส่วนที่ N/A ไม่ต้องกรอก ไม่นับเป็นส่วนที่ขาดตอนปิดใบงาน */
  // กด N/A ต้องยืนยันใน pop-up ก่อน (ยกเลิก N/A ทำได้ทันที ไม่ต้องถาม)
  const toggleNa = (job: Job, s: SectionState, na: boolean) => {
    if (acting) return;
    if (na) { setNaError(""); setNaConfirm({ job, state: s }); return; }
    void saveNa(job, s, false);
  };

  const saveNa = async (job: Job, s: SectionState, na: boolean) => {
    if (acting) return;
    setActing(true);
    try {
      const res = await apiFetch(
        `/stationpmjob/${encodeURIComponent(job.id)}/section-na?station_id=${encodeURIComponent(job.station_id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section: s.section, sn: s.sn || "", na }),
        }
      );
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.detail || t("errAction", lang));
      if (json?.job) setJobs((prev) => prev.map((j) => (j.id === json.job.id ? json.job : j)));
      else await loadJobs();
      setNaConfirm(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("errAction", lang);
      // กด N/A ผ่าน pop-up → ขึ้น error ใน pop-up เลย, ยกเลิก N/A ไม่มี pop-up จึงใช้ alert
      if (na) setNaError(msg); else alert(msg);
    } finally {
      setActing(false);
    }
  };

  /** ออกจากหน้าใบงาน — มาจาก PM List ก็กลับไปหน้านั้น */
  const leaveWo = useCallback(() => {
    const back = pmBackRoute(searchParams);
    if (back) { router.push(back); return; }
    goto({ view: null, planning: null, wo_info: null, wonum: null, started: null, pmtab: null, edit_id: null });
  }, [goto, router, searchParams]);

  /**
   * ช่างกด "เริ่ม PM" จากใบงาน → เปิด (หรือหยิบ) ใบ PM สถานีของใบงานนั้น
   * แล้วพาไปหน้ารวม 2 ส่วนหลัก ให้เลือกเองว่าจะกรอกส่วนไหนก่อน
   *
   * ใบงานของตู้ก็ลงหน้ารวมเหมือนกัน ไม่กระโดดเข้าส่วน Charger ให้ — ช่างต้องเห็นภาพรวม
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

  /**
   * ช่างกด "ปิดใบงาน" → เปิดหน้าต่างกรอกเวลาทำงาน + ช่างที่ลงเวลา Maximo (เติมค่าเดิมถ้าเคยกรอก)
   * ยังไม่เคยกรอก: เริ่ม = วันนี้ + เวลาที่กดรับงาน, เสร็จ = ตอนนี้
   */
  const fillCloseForm = (job: Job, partyKey: string) => {
    const now = new Date();
    // ฝ่ายนี้เคยส่งแล้ว (แก้ / โดนตีกลับ) = เติมค่าที่ส่งไว้ ไม่งั้นใช้ค่าของใบ (ใบฝ่ายเดียวรุ่นก่อน)
    const e = job.work_entries?.find((x) => x.key === partyKey);
    const fallback = job.split ? undefined : job;
    setWorkStart(e?.work_start || fallback?.work_start || defaultWorkStart(job.createdAt, now));
    setWorkFinish(e?.work_finish || fallback?.work_finish || toLocalDatetimeInput(now));
    setMaximoLabor(e?.maximo_labor || fallback?.maximo_labor || []);
    setMaximoContractor(e?.maximo_contractor || fallback?.maximo_contractor || "");
    setImpsLabor(e?.imps_labor || fallback?.imps_labor || []);
  };

  const openCloseJob = () => {
    if (!currentJob || acting) return;
    const parties = currentJob.parties ?? [];
    const mine = parties.find((p) => p.key === currentJob.my_party);
    // ส่งแทนฝ่ายอื่นได้เฉพาะ admin/owner — ฝ่ายตัวเองยังไม่พร้อม/ไม่มี ก็เลือกฝ่ายแรกที่พร้อม
    const canPickAny = PM_SUBMIT_FOR_ANY_ROLES.includes(me?.role ?? "");
    const party = mine?.ready ? mine : canPickAny ? parties.find((p) => p.ready) : undefined;
    if (parties.length > 0 && !party) return;
    if (parties.length === 0 && !currentJob.ready_to_submit) return;
    const key = party?.key ?? currentJob.my_party ?? "";
    setCloseParty(key);
    fillCloseForm(currentJob, key);
    setCloseError("");
    setCloseOpen(true);
  };

  const contractorPicked = laborOptions.some((o) => o.needs_name && maximoLabor.includes(o.laborcode));
  // ไม่มีเลขใบงาน Maximo = ไม่มีอะไรให้ลงเวลาใน Maximo (IN09) — ใช้บัญชี iMPS แทน
  // ใบงานที่ Maximo เปิดมาเท่านั้น — ใบงานที่เปิดเองใน iMPS มีเลขใบงานแต่ไม่มีใน Maximo
  const isMaximoJob = currentJob?.from_maximo ?? !!currentJob?.wonum;

  /** ตรวจแบบเดียวกับ backend (pm_flow.validate_work_time) — บอกให้แก้ก่อนยิง */
  const closeJobProblem = (): string => {
    if (!workStart || !workFinish) return t("errWorkTime", lang);
    if (workFinish < workStart) return t("errWorkOrder", lang);
    const nowLocal = toLocalDatetimeInput(new Date());
    if (workStart > nowLocal || workFinish > nowLocal) return t("errWorkFuture", lang);
    if (!isMaximoJob) return impsLabor.length === 0 ? t("errImpsLabor", lang) : "";
    if (laborOptions.length > 0 && maximoLabor.length === 0) return t("errLabor", lang);
    if (contractorPicked && !maximoContractor.trim()) return t("errContractor", lang);
    return "";
  };

  /** ส่งทั้งใบเข้าคิวอนุมัติ พร้อมเวลาทำงาน/ช่าง — backend เขียนลงทุกส่วนให้ */
  const submitCloseJob = async () => {
    if (!currentJob || acting) return;
    const problem = closeJobProblem();
    if (problem) { setCloseError(problem); return; }
    setActing(true);
    setCloseError("");
    try {
      const res = await apiFetch(
        `/stationpmjob/${encodeURIComponent(currentJob.id)}/submit?station_id=${encodeURIComponent(currentJob.station_id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            party: closeParty,
            work_start: workStart,
            work_finish: workFinish,
            ...(isMaximoJob
              ? { maximo_labor: maximoLabor, maximo_contractor: contractorPicked ? maximoContractor.trim() : "" }
              : { imps_labor: impsLabor }),
          }),
        }
      );
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.detail || t("errAction", lang));
      setCloseOpen(false);
      await loadJobs();
    } catch (err) {
      setCloseError(err instanceof Error ? err.message : t("errAction", lang));
    } finally {
      setActing(false);
    }
  };

  /** คืน true เมื่อสำเร็จ — หน้าฟอร์มใช้พากลับหน้ารวมหลังอนุมัติ/ตีกลับ */
  const approveJob = async (): Promise<boolean> => {
    if (!currentJob || acting) return false;
    setActing(true);
    try {
      const res = await apiFetch(
        `/stationpmjob/${encodeURIComponent(currentJob.id)}/approve?station_id=${encodeURIComponent(currentJob.station_id)}`,
        { method: "POST" }
      );
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.detail || t("errAction", lang));
      await loadJobs();
      // ใบงานจาก Maximo: บอกทันทีถ้ายิงชุดปิดงานไม่ผ่าน (ใบใน iMPS ปิดแล้ว แต่ WO ใน Maximo ยังไม่ปิด)
      const mx = json?.maximo;
      if (mx && !mx.skipped && !maximoClosed(mx)) {
        const failed = MAXIMO_CLOSE_STEPS.filter((s) => !mx?.[s.key]?.ok).map((s) => s.key);
        alert(t("maximoFailedAlert", lang).replace("{steps}", (failed.length ? failed : ["error"]).join(", ")));
      }
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : t("errAction", lang));
      return false;
    } finally {
      setActing(false);
    }
  };

  /** ยิงชุดปิดงานเข้า Maximo ใหม่ (ใบที่อนุมัติแล้วแต่รอบก่อนส่งไม่ผ่าน) */
  const resyncMaximo = async () => {
    if (!currentJob || acting) return;
    setActing(true);
    try {
      const res = await apiFetch(
        `/stationpmjob/${encodeURIComponent(currentJob.id)}/maximo-sync?station_id=${encodeURIComponent(currentJob.station_id)}`,
        { method: "POST" }
      );
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.detail || t("errAction", lang));
      if (json?.job) setJobs((prev) => prev.map((j) => (j.id === json.job.id ? json.job : j)));
    } catch (err) {
      alert(err instanceof Error ? err.message : t("errAction", lang));
    } finally {
      setActing(false);
    }
  };

  const rejectJob = async (): Promise<boolean> => {
    if (!currentJob || acting || !rejectRemark.trim()) return false;
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
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : t("errAction", lang));
      return false;
    } finally {
      setActing(false);
    }
  };

  /** ตีกลับเฉพาะส่วนที่เปิดตรวจอยู่ — ส่วนอื่นยังรออนุมัติ (backend: reject-section) */
  const rejectSection = async (s: SectionState | undefined): Promise<boolean> => {
    if (!currentJob || !s || acting || !rejectRemark.trim()) return false;
    setActing(true);
    try {
      const res = await apiFetch(
        `/stationpmjob/${encodeURIComponent(currentJob.id)}/reject-section?station_id=${encodeURIComponent(currentJob.station_id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section: s.section, sn: s.sn || "", remark: rejectRemark.trim() }),
        }
      );
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.detail || t("errAction", lang));
      setRejectOpen(false);
      setRejectRemark("");
      await loadJobs();
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : t("errAction", lang));
      return false;
    } finally {
      setActing(false);
    }
  };

  /** planner ของ vendor อนุมัติงานตู้ชาร์จของฝ่ายตัวเองทีเดียว → ส่งต่อให้ planner ต้นทาง (backend: vendor-approve) */
  const [vendorApproveParty, setVendorApproveParty] = useState<JobParty | null>(null);
  const vendorApprove = async (party: JobParty, onDone?: () => void) => {
    if (!currentJob || acting) return;
    setActing(true);
    try {
      const res = await apiFetch(
        `/stationpmjob/${encodeURIComponent(currentJob.id)}/vendor-approve?station_id=${encodeURIComponent(currentJob.station_id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ party: party.name }),
        }
      );
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.detail || t("errAction", lang));
      setVendorApproveParty(null);
      await loadJobs();
      onDone?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("errAction", lang));
    } finally {
      setActing(false);
    }
  };

  // หน้าต่างยืนยัน — ใช้ทั้งหน้ารวม (admin อนุมัติแทน) และในฟอร์มตู้ชาร์จ (planner ของ vendor)
  const vendorApproveDialog = (onDone?: () => void) => {
    const label = vendorApproveParty?.name || t("ownTeam", lang);
    return (
      <Dialog open={!!vendorApproveParty} handler={() => { if (!acting) setVendorApproveParty(null); }} size="sm">
        <DialogHeader>{t("vendorApproveTitle", lang).replace("{p}", label)}</DialogHeader>
        <DialogBody>
          <p className="tw-text-sm tw-text-gray-600">
            {t("vendorApproveConfirm", lang).replaceAll("{p}", label)}
          </p>
        </DialogBody>
        <DialogFooter className="tw-gap-2">
          <Button variant="text" disabled={acting} onClick={() => setVendorApproveParty(null)}>{t("cancel", lang)}</Button>
          <Button color="green" disabled={acting} onClick={() => { if (vendorApproveParty) void vendorApprove(vendorApproveParty, onDone); }}>
            {acting ? t("vendorApproving", lang) : t("vendorApprove", lang).replace("{p}", label)}
          </Button>
        </DialogFooter>
      </Dialog>
    );
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
    const openedSection = currentJob?.sections.find(
      (x) => x.section === section && (section !== CHARGER_SECTION || x.sn === (searchParams.get("sn") ?? ""))
    );
    // เปิดดูส่วนที่ส่งแล้ว → แก้ไขได้จนกว่าจะกด "ปิดใบงาน" (ใบยังเป็น In Progress)
    // เฉพาะ technician / planner / admin (super admin ได้ role admin) — ส่วนที่ปิดแล้ว / ใบที่ส่งอนุมัติแล้ว / หน้าอนุมัติ ดูได้อย่างเดียว
    const viewing = searchParams.get("review") === "1";
    const sectionStatus = String(openedSection?.status ?? "").trim().toLowerCase();
    // ผู้อนุมัติ (planner/admin) เปิดดูส่วนหนึ่งของใบที่ช่างกดปิดใบงานแล้ว → ย้อนกลับ / ตีกลับ / แก้ไข ได้จากในฟอร์มเลย
    // ตีกลับในฟอร์ม = ตีกลับเฉพาะฟอร์มนี้ (ฟอร์มอื่นยังรออนุมัติ) — ตีกลับทั้งใบ / อนุมัติ กดที่หน้ารวม
    // ใบที่เพิ่งตีกลับบางฟอร์มไป (In Progress + มีเหตุผลตีกลับ) ยังตีกลับฟอร์มอื่นที่รออนุมัติเพิ่มได้
    const inReview = currentJob?.status === "Wait for approve"
      || (currentJob?.status === "draft" && !!currentJob?.reject_remark);
    // ฟอร์มตู้ชาร์จของ vendor ที่รอ planner ของ vendor — ชั้นแรกเป็นของ planner vendor (ต้นทางยังตรวจไม่ได้)
    const vendorPending = openedSection?.vendor_review === "pending";
    const vendorReviewing = viewing && !!currentJob?.vendor_reviewer && vendorPending
      && String(openedSection?.owner ?? "").trim().toLowerCase() === currentJob.vendor_reviewer
      && !!openedSection?.report_id && sectionStatus === "wait for approve";
    // ฝ่ายที่ planner vendor คนนี้กำลังตรวจ — อนุมัติจากในฟอร์มตู้ชาร์จได้เลย (อนุมัติทุกฟอร์มตู้ชาร์จของฝ่ายนี้ทีเดียว)
    const vendorParty = vendorReviewing
      ? currentJob?.parties?.find((p) => p.key === currentJob.vendor_reviewer && p.vendor_review === "pending")
      : undefined;
    const approving = vendorReviewing || (viewing && canApprove && inReview && !vendorPending
      && !!openedSection?.report_id && sectionStatus === "wait for approve");
    // ส่วนนี้โดนตีกลับและยังไม่ได้ส่งใหม่ — บอกช่างว่าต้องแก้อะไร
    const sectionRejectRemark = sectionStatus === "draft" ? (openedSection?.reject_remark ?? "") : "";
    const canEditSent = viewing && PM_EDIT_SENT_ROLES.includes(me?.role ?? "") && !!openedSection?.report_id
      && openedSection?.editable !== false
      // planner ของ vendor อนุมัติฟอร์มตู้ชาร์จนี้แล้ว — ช่างแก้ไม่ได้จนกว่าจะถูกตีกลับ (backend กันซ้ำ)
      && !(openedSection?.vendor_review === "approved" && !roleCanApprove)
      && !inUseByOther(openedSection)
      && !["closed", "submitted"].includes(sectionStatus)
      && (currentJob?.status === "draft" || approving);
    // ตัด review ออก = ฟอร์มเดิมในโหมดแก้ไข (key ใหม่ให้โหลดเอกสารใหม่ทั้งหมด พร้อมรูปเดิม)
    const startEdit = () => goto({ review: null, approve: null });
    const backToHub = () => goto({ section: null, sn: null, edit_id: null, review: null, approve: null });
    // มีคนอื่นกำลังกรอกส่วนนี้อยู่ — ไม่เปิดฟอร์มกรอก (กรอกไปก็บันทึกไม่ได้) ให้ดูอย่างเดียวแทน
    // ระบบขอสิทธิ์ใหม่ทุก 15 วิ คนแรกออกเมื่อไหร่ฟอร์มกรอกจะขึ้นเองโดยไม่ต้องรีเฟรช
    if (sectionLockWanted && sectionLockedBy) {
      return (
        <div className="tw-mx-auto tw-mt-4 tw-max-w-xl">
          <PmLockBanner lockedBy={sectionLockedBy} kind="section" lang={lang}>
            <Button size="sm" onClick={() => goto({ review: "1", approve: null })} className="tw-bg-gray-800">
              {t("viewOnly", lang)}
            </Button>
            <Button size="sm" variant="outlined" onClick={backToHub} className="tw-flex tw-items-center tw-gap-1.5">
              <ArrowLeftIcon className="tw-h-4 tw-w-4" /> {t("back", lang)}
            </Button>
          </PmLockBanner>
        </div>
      );
    }
    if (sectionLockWanted && sectionLockChecking) {
      return <p className="tw-mt-10 tw-text-center tw-text-sm tw-text-gray-500">{t("lockChecking", lang)}</p>;
    }
    // เข้าฟอร์มกรอกของส่วนที่เป็นงานของบริษัทอื่นตรง ๆ (เช่นลิงก์เก่า) — ไม่ให้กรอกเสียเวลาแล้วไปโดนปฏิเสธตอนบันทึก
    if (openedSection?.editable === false && !viewing) {
      return (
        <Card className="tw-mx-auto tw-mt-4 tw-max-w-xl tw-border tw-border-gray-200 tw-shadow-sm">
          <CardBody className="tw-flex tw-flex-col tw-items-center tw-gap-4 tw-p-6 tw-text-center">
            <LockClosedIcon className="tw-h-8 tw-w-8 tw-text-gray-400" />
            <Typography className="tw-text-sm tw-text-gray-700">
              {t("lockedSection", lang).replace("{owner}", openedSection.owner || t("otherTeam", lang))}
            </Typography>
            <Button type="button" variant="outlined" onClick={backToHub} className="tw-flex tw-items-center tw-gap-1.5 tw-text-sm">
              <ArrowLeftIcon className="tw-h-4 tw-w-4" /> {t("back", lang)}
            </Button>
          </CardBody>
        </Card>
      );
    }
    // ฟอร์มวางปุ่มนี้ตรงตำแหน่งปุ่ม "บันทึก" ของหน้ากรอก (ผ่าน PmReviewActionContext) หน้าตาเดียวกับปุ่มบันทึก
    const editButton = canEditSent ? (
      <Button type="button" onClick={startEdit} className="tw-text-sm tw-py-2.5 tw-bg-gray-800 hover:tw-bg-gray-900 tw-w-full sm:tw-w-auto tw-flex tw-items-center tw-justify-center tw-gap-1.5">
        <PencilSquareIcon className="tw-h-4 tw-w-4" /> {t("edit", lang)}
      </Button>
    ) : null;
    const vendorApproveButton = vendorParty ? (
      <Button
        type="button"
        disabled={acting}
        onClick={() => setVendorApproveParty(vendorParty)}
        className="tw-text-sm tw-py-2.5 tw-w-full sm:tw-w-auto tw-bg-green-600 hover:tw-bg-green-700 tw-flex tw-items-center tw-justify-center tw-gap-1.5"
      >
        <CheckCircleIcon className="tw-h-4 tw-w-4" /> {t("vendorApprove", lang).replace("{p}", vendorParty.name || t("ownTeam", lang))}
      </Button>
    ) : null;
    // ปุ่มชุดผู้อนุมัติ: ย้อนกลับ · ตีกลับ · แก้ไข · อนุมัติ (planner vendor) (เรียงซ้าย→ขวา)
    const reviewActions = approving ? (
      <>
        <Button
          type="button"
          variant="outlined"
          disabled={acting}
          onClick={backToHub}
          className="tw-text-sm tw-py-2.5 tw-w-full sm:tw-w-auto tw-border-blue-gray-300 tw-text-blue-gray-700 hover:tw-border-blue-gray-500 hover:tw-bg-blue-gray-50 tw-flex tw-items-center tw-justify-center tw-gap-1.5"
        >
          <ArrowLeftIcon className="tw-h-4 tw-w-4" /> {t("back", lang)}
        </Button>
        <Button
          type="button"
          variant="outlined"
          color="red"
          disabled={acting}
          onClick={() => { setRejectRemark(""); setRejectOpen(true); }}
          className="tw-text-sm tw-py-2.5 tw-w-full sm:tw-w-auto"
        >
          {t("rejectSection", lang)}
        </Button>
        {editButton}
        {vendorApproveButton}
      </>
    ) : editButton;
    // กำลังแก้ส่วนที่ส่งแล้ว (เข้ามาจากปุ่ม "แก้ไข") — ยกเลิกได้ ทิ้งสิ่งที่แก้ในเครื่องแล้วกลับหน้าดู
    // (ส่วนที่ยังเป็น draft เช่นโดนตีกลับ ไม่ได้มาจากปุ่มนี้ ใช้ปุ่มย้อนกลับตามเดิม)
    const editingSent = !viewing && !!openedSection?.report_id && sectionStatus === "wait for approve";
    const cancelEdit = async () => {
      if (cancellingEdit) return;
      setCancellingEdit(true);
      try {
        try { await discardOpenFormDraft(); } catch (err) { console.error("discard draft failed:", err); }
        setCancelEditOpen(false);
        goto({ review: "1", approve: null });
      } finally {
        setCancellingEdit(false);
      }
    };
    const cancelButton = editingSent && (
      <Button
        type="button"
        variant="outlined"
        onClick={() => setCancelEditOpen(true)}
        className="tw-text-sm tw-py-2.5 tw-w-full sm:tw-w-auto tw-border-blue-gray-300 tw-text-blue-gray-700 hover:tw-border-blue-gray-500 hover:tw-bg-blue-gray-50 tw-transition-all"
      >
        {t("cancelEdit", lang)}
      </Button>
    );
    return (
      <div className="tw-mt-4 sm:tw-mt-6 lg:tw-mt-8">
        {/* เปิดดูอยู่ระหว่างที่มีคนอื่นกรอกส่วนนี้ — บอกไว้ ข้อมูลที่เห็นอาจยังไม่ใช่ล่าสุด */}
        {viewing && inUseByOther(openedSection) && (
          <div className="tw-mx-auto tw-max-w-6xl">
            <PmLockBanner lockedBy={inUseByOther(openedSection)} kind="section" lang={lang} />
          </div>
        )}
        {sectionRejectRemark && (
          <div className="tw-mx-auto tw-mb-4 tw-max-w-6xl tw-rounded-lg tw-border tw-border-amber-200 tw-bg-amber-50 tw-px-4 tw-py-3 tw-text-sm tw-text-amber-800 [overflow-wrap:anywhere]">
            {t("rejected", lang)} {sectionRejectRemark}
            {openedSection?.rejected_by && <span className="tw-text-amber-700/80"> — {openedSection.rejected_by}</span>}
          </div>
        )}
        <PmReviewActionContext.Provider value={reviewActions}>
          <PmCancelEditContext.Provider value={cancelButton}>
            <SectionForm key={viewing ? "view" : "edit"} />
          </PmCancelEditContext.Provider>
        </PmReviewActionContext.Provider>
        {vendorParty && vendorApproveDialog(backToHub)}
        {/* modal รูปแบบเดียวกับหน้า CM (overlay + กล่อง max-w-md) — ไม่ใช้ Dialog ของ Material Tailwind ที่บังคับความกว้าง/ฟอนต์เอง */}
        {cancelEditOpen && editingSent && (
          <div
            className="tw-fixed tw-inset-0 tw-z-[9999] tw-flex tw-items-center tw-justify-center tw-bg-black/50 tw-p-4"
            onClick={() => { if (!cancellingEdit) setCancelEditOpen(false); }}
          >
            <div className="tw-w-full tw-max-w-md tw-rounded-2xl tw-bg-white tw-p-6 tw-shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="tw-flex tw-items-center tw-gap-2 tw-text-lg tw-font-bold tw-text-blue-gray-800 tw-mb-2">
                <XMarkIcon className="tw-h-5 tw-w-5 tw-text-amber-600" />
                {t("cancelEdit", lang)}
              </h3>
              <p className="tw-text-sm tw-text-blue-gray-600">
                {t("cancelEditConfirm", lang)}
              </p>
              <div className="tw-flex tw-items-center tw-justify-end tw-gap-3 tw-mt-5">
                <Button
                  type="button"
                  variant="outlined"
                  disabled={cancellingEdit}
                  onClick={() => setCancelEditOpen(false)}
                  className="tw-border-blue-gray-200 tw-text-blue-gray-700 hover:tw-border-blue-gray-300"
                >
                  {t("continueEdit", lang)}
                </Button>
                <Button
                  type="button"
                  disabled={cancellingEdit}
                  onClick={() => { void cancelEdit(); }}
                  className="tw-bg-amber-500 hover:tw-bg-amber-600 tw-text-white tw-font-semibold disabled:tw-opacity-50 disabled:tw-cursor-not-allowed"
                >
                  {t(cancellingEdit ? "cancellingEdit" : "confirmCancelEdit", lang)}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ตีกลับเฉพาะฟอร์มนี้ — ต้องมีเหตุผล */}
        {rejectOpen && approving && (
          <div
            className="tw-fixed tw-inset-0 tw-z-[9999] tw-flex tw-items-center tw-justify-center tw-bg-black/50 tw-p-4"
            onClick={() => { if (!acting) setRejectOpen(false); }}
          >
            <div role="dialog" aria-modal="true" className="tw-w-full tw-max-w-md tw-rounded-2xl tw-bg-white tw-p-6 tw-shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="tw-flex tw-items-center tw-gap-2 tw-text-lg tw-font-bold tw-text-blue-gray-800 tw-mb-2">
                <XMarkIcon className="tw-h-5 tw-w-5 tw-text-red-600" />
                {t("rejectSection", lang)}
                {openedSection && <span className="tw-font-semibold tw-text-blue-gray-500">· {pick(openedSection.label, lang)}</span>}
              </h3>
              <p className="tw-mb-3 tw-text-sm tw-text-blue-gray-600">
                {t(vendorReviewing ? "vendorRejectSectionConfirm" : "rejectSectionConfirm", lang)}
              </p>
              <label className="tw-mb-1 tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800">
                {t("rejectReason", lang)} <span className="tw-text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectRemark}
                autoFocus
                onChange={(e) => setRejectRemark(e.target.value)}
                className="tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-px-3 tw-py-2 tw-text-sm tw-text-blue-gray-800 focus:tw-border-blue-500 focus:tw-outline-none"
              />
              <div className="tw-flex tw-items-center tw-justify-end tw-gap-3 tw-mt-5">
                <Button
                  type="button"
                  variant="outlined"
                  disabled={acting}
                  onClick={() => setRejectOpen(false)}
                  className="tw-border-blue-gray-200 tw-text-blue-gray-700 hover:tw-border-blue-gray-300"
                >
                  {t("cancel", lang)}
                </Button>
                <Button
                  type="button"
                  color="red"
                  disabled={acting || !rejectRemark.trim()}
                  onClick={async () => { if (await rejectSection(openedSection)) backToHub(); }}
                  className="tw-font-semibold disabled:tw-opacity-50 disabled:tw-cursor-not-allowed"
                >
                  {t(acting ? "rejecting" : "rejectSection", lang)}
                </Button>
              </div>
            </div>
          </div>
        )}
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
        <LegacyForm />
      </div>
    );
  }

  // ══════════════ หน้ารวม 2 ส่วนหลักของใบเดียว (hub) ══════════════
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
    const closeJobHint = job.ready_to_submit
      ? undefined
      : job.missing?.length
        ? `${t("closeJobMissing", lang)} ${job.missing.map((m) => pick(m, lang)).join(", ")}`
        : t("closeJobEmpty", lang);
    const completedGroups = SECTION_GROUPS.filter((group) => {
      const rows = job.sections.filter((item) => group.sectionIds.includes(item.section));
      const hasEverySection = group.sectionIds.every((sectionId) =>
        rows.some((item) => item.section === sectionId)
      );
      return hasEverySection && rows.length > 0 && rows.every((item) => !!item.report_id || !!item.na);
    }).length;
    // ปิดใบงาน — มีเฉพาะใบที่ยังทำอยู่ กดได้เมื่อส่งครบทุกส่วนในแผนแล้ว
    // ยังไม่ครบ: ปุ่มจาง ชี้ค้างเห็นว่าขาดส่วนไหน
    // ปุ่มเดียวท้ายหน้า (ตำแหน่งเดียวกับปุ่มอนุมัติ/ตีกลับ) — ส่งงาน/ปิดใบเป็นการกระทำระดับทั้งใบ ไม่ใช่รายการ์ด
    // ใบที่แบ่งงานหลายฝ่าย: ปุ่มเป็น "ส่งงานของ <ฝ่ายตัวเอง>" กดได้เมื่อส่วนของฝ่ายตัวเองส่งครบ
    // admin/owner ที่ไม่มีส่วนของตัวเอง ส่งแทนฝ่ายที่พร้อมแล้วได้ (เลือกฝ่ายในหน้าต่าง)
    const myParty = job.parties?.find((p) => p.key === job.my_party);
    const partyLabel = (p?: JobParty) => (p?.name || t("ownTeam", lang));
    const canPickAny = PM_SUBMIT_FOR_ANY_ROLES.includes(me?.role ?? "");
    const closeEnabled = job.split
      ? (myParty?.ready ?? false) || (canPickAny && !!job.parties?.some((p) => p.ready))
      : !!job.ready_to_submit;
    const closeLabel = !job.split
      ? t("closeJob", lang)
      : myParty
        ? t(myParty.submitted ? "resubmitParty" : "submitParty", lang).replace("{p}", partyLabel(myParty))
        : t("submitParty", lang).replace("{p}", "…");
    const closeHint = !job.split
      ? closeJobHint
      : myParty && !myParty.ready
        ? `${t("closeJobMissing", lang)} ${myParty.missing.map((m) => pick(m, lang)).join(", ")}`
        : undefined;
    // ฝ่าย vendor ที่ส่งงานแล้ว รอ planner ของ vendor คนนี้ (หรือ admin) อนุมัติ
    const vendorTargets = (job.parties ?? []).filter((p) => p.vendor_review === "pending"
      && (job.vendor_reviewer ? p.key === job.vendor_reviewer : me?.role === "admin"));
    // planner ของ vendor ที่กำลังตรวจงานฝ่ายตัวเองอยู่ — เหลือแค่ปุ่มอนุมัติ ไม่ต้องมีปุ่ม "แก้ไขงานที่ส่ง" ซ้อน
    // (ถ้าต้องให้แก้ ใช้ตีกลับรายฟอร์มแทน)
    const reviewingOwnParty = !!myParty && vendorTargets.some((p) => p.key === myParty.key);
    const showCloseButton = job.status === "draft" && !reviewingOwnParty
      && (!job.split || !!myParty || canPickAny);
    const closeJobButton = showCloseButton && (
      <span title={closeHint}>
        <Button
          size="sm"
          disabled={!closeEnabled || acting}
          onClick={openCloseJob}
          className="tw-flex tw-items-center tw-gap-1.5 tw-bg-green-600 disabled:tw-pointer-events-none"
        >
          <CheckCircleIcon className="tw-h-4 tw-w-4" />
          {acting ? t("closingJob", lang) : closeLabel}
        </Button>
      </span>
    );
    return (
      <div className="tw-mt-4 sm:tw-mt-6 lg:tw-mt-8 tw-mx-auto tw-max-w-5xl">
        <div className="tw-mb-4 tw-flex tw-items-center tw-justify-between tw-gap-3">
          <Button variant="outlined" size="sm" onClick={backToList} className="tw-flex tw-items-center tw-gap-2">
            <ArrowLeftIcon className="tw-h-4 tw-w-4" /> {t("back", lang)}
          </Button>
          <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-end tw-gap-2">
          {/* PDF ทั้งใบ — โหลดได้เฉพาะใบที่อนุมัติแล้ว (Closed) เหมือนปุ่ม PDF ในหน้า PM List
              ยังไม่ปิด: ปุ่มจาง ชี้ค้างเห็นเหตุผล */}
          {toPmFlow({ status: job.status, reject_remark: job.reject_remark }) === "closed" ? (
            <a
              href={`${API_BASE}/stationpmjob/${encodeURIComponent(job.id)}/pdf?station_id=${encodeURIComponent(job.station_id)}&lang=${lang}`}
              target="_blank"
              rel="noreferrer"
              className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-lg tw-border tw-border-gray-300 tw-px-3 tw-py-2 tw-text-sm tw-font-semibold tw-text-gray-700 hover:tw-bg-gray-50"
            >
              <DocumentArrowDownIcon className="tw-h-4 tw-w-4" /> {t("downloadPdf", lang)}
            </a>
          ) : (
            <span
              title={t("pdfClosedOnly", lang)}
              aria-disabled="true"
              className="tw-inline-flex tw-cursor-not-allowed tw-items-center tw-gap-1.5 tw-rounded-lg tw-border tw-border-gray-300 tw-px-3 tw-py-2 tw-text-sm tw-font-semibold tw-text-gray-700 tw-opacity-50"
            >
              <DocumentArrowDownIcon className="tw-h-4 tw-w-4" /> {t("downloadPdf", lang)}
            </span>
          )}
          </div>
        </div>

        {/* หัวเอกสาร */}
        <Card className="tw-mb-5 tw-border tw-border-gray-200 tw-shadow-sm">
          <CardBody className="tw-p-4 sm:tw-p-5">
            <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
              <div className="tw-min-w-0 tw-flex-1">
                <Typography variant="h5" className="tw-text-gray-900">{t("jobTitle", lang)}</Typography>
                <Typography className="tw-mt-1 tw-text-sm tw-text-gray-500 tw-break-words">
                  {job.station_name || job.station_id}
                </Typography>
              </div>
              <div className="tw-shrink-0">
                <PmStatusBadge flow={toPmFlow({ status: job.status, reject_remark: job.reject_remark })} />
              </div>
            </div>

            {/* ช่องกว้างตามข้อความ ไม่ตัดบรรทัด — ที่ไม่พอทั้งช่องย้ายลงแถวใหม่แทน
                (เดิมเป็น grid กว้างคงที่ เลขที่/ชื่อเอกสารยาว ๆ เลยล้นไปทับช่องข้าง ๆ)
                จอแคบกว่าข้อความจริง ๆ ค่อยตัดท้ายเป็น … ชี้ค้างดูค่าเต็มได้
                ที่ว่างที่เหลือกระจายเท่า ๆ กันรอบทุกช่อง (space-evenly) — gap-x คือระยะห่างขั้นต่ำ */}
            {/* มือถือ: grid 2 คอลัมน์ ชิดซ้าย — เลขที่ | วันที่ PM / ชื่อเอกสาร (เต็มแถว ตัดบรรทัดได้) / ใบงาน Maximo
                sm ขึ้นไป: กลับเป็นแถว flex แบบเดิม (order ตามลำดับ array) */}
            <div className="tw-mt-4 tw-grid tw-grid-cols-2 tw-gap-x-4 tw-gap-y-3 tw-border-t tw-border-gray-100 tw-pt-4 tw-text-sm sm:tw-flex sm:tw-flex-wrap sm:tw-justify-evenly sm:tw-gap-x-10 sm:tw-border-t-0 sm:tw-pt-0">
              {[
                { label: t("docNo", lang), value: job.issue_id || "-", cls: "tw-order-1" },
                { label: t("docName", lang), value: job.doc_name || "-", cls: "tw-order-3 tw-col-span-2" },
                { label: t("pmDate", lang), value: fmtDate(job.pm_date, lang), cls: "tw-order-2" },
                { label: t("wonum", lang), value: job.wonum || "-", cls: "tw-order-4" },
              ].map((f) => (
                <div key={f.label} className={`tw-min-w-0 ${f.cls} sm:tw-order-none sm:tw-max-w-full sm:tw-whitespace-nowrap`}>
                  <div className="tw-text-xs tw-text-gray-500 sm:tw-text-sm">{f.label}</div>
                  <div className="tw-font-semibold tw-text-gray-800 [overflow-wrap:anywhere] sm:tw-truncate" title={f.value}>{f.value}</div>
                </div>
              ))}
            </div>

            {(() => {
              // ฟอร์มที่โดนตีกลับและยังไม่ได้ส่งใหม่ — แยกรายฟอร์ม (ตีกลับรายฟอร์ม / ทั้งใบ ใช้ที่เดียวกัน)
              const rejectedRows = job.sections.filter((s) =>
                !!s.reject_remark && !!s.report_id && String(s.status).trim().toLowerCase() === "draft");
              if (rejectedRows.length === 0 && !(job.reject_remark && job.status === "draft")) return null;
              return (
                <div className="tw-mt-4 tw-rounded-lg tw-border tw-border-amber-200 tw-bg-amber-50 tw-px-4 tw-py-3 tw-text-sm tw-text-amber-800 [overflow-wrap:anywhere]">
                  {rejectedRows.length === 0 ? (
                    <>{t("rejected", lang)} {job.reject_remark}</>
                  ) : (
                    <>
                      <div className="tw-font-semibold">{t("rejected", lang)}</div>
                      <ul className="tw-mt-1 tw-list-disc tw-space-y-0.5 tw-pl-5">
                        {rejectedRows.map((s) => (
                          <li key={`${s.section}:${s.sn}`}>
                            <span className="tw-font-semibold">{pick(s.label, lang)}</span> — {s.reject_remark}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              );
            })()}
            {job.status === "Closed" && job.approved_by && (
              <div className="tw-mt-4 tw-flex tw-items-start tw-gap-2 tw-text-sm tw-text-green-700">
                <CheckCircleIcon className="tw-h-5 tw-w-5 tw-shrink-0" />
                <span className="tw-min-w-0 [overflow-wrap:anywhere]">{t("approved", lang)} {job.approved_by}</span>
              </div>
            )}
            {/* ใบที่แบ่งงานหลายฝ่าย — ใครส่งงานแล้วบ้าง */}
            {(job.split || job.parties?.some((p) => !!p.vendor_review)) && job.status === "draft" && (
              <div className="tw-mt-4">
                <div className="tw-mb-1.5 tw-text-xs tw-font-semibold tw-text-gray-600">{t("partiesTitle", lang)}</div>
                <div className="tw-flex tw-flex-wrap tw-gap-2 tw-text-xs">
                  {(job.parties ?? []).map((p) => {
                    const entry = job.work_entries?.find((e) => e.key === p.key);
                    const state = p.submitted ? "sent" : p.ready ? "waiting" : "notReady";
                    // ส่งแล้วแต่ยังรอ planner ของ vendor = ยังไม่ถึง planner ต้นทาง (สีเหลือง)
                    const vendorWait = state === "sent" && p.vendor_review === "pending";
                    const cls = vendorWait
                      ? "tw-border-amber-200 tw-bg-amber-50 tw-text-amber-800"
                      : state === "sent"
                      ? "tw-border-green-200 tw-bg-green-50 tw-text-green-700"
                      : state === "waiting"
                        ? "tw-border-amber-200 tw-bg-amber-50 tw-text-amber-800"
                        : "tw-border-gray-200 tw-bg-gray-50 tw-text-gray-600";
                    const title = state === "sent"
                      ? `${entry?.submitted_by ?? ""} · ${entry?.work_start?.replace("T", " ") ?? ""} – ${entry?.work_finish?.replace("T", " ") ?? ""}`
                      : state === "notReady"
                        ? p.missing.map((m) => pick(m, lang)).join(", ")
                        : "";
                    return (
                      <span key={p.key} title={title} className={`tw-rounded-full tw-border tw-px-2.5 tw-py-1 tw-font-semibold ${cls}`}>
                        {state === "sent" && !vendorWait ? "✓" : "⏳"} {partyLabel(p)} ·{" "}
                        {t(state === "sent" ? "partySent" : state === "waiting" ? "partyWaiting" : "partyNotReady", lang)}
                        {vendorWait && <> · {t("vendorPending", lang).replace("{p}", partyLabel(p))}</>}
                        {state === "sent" && p.vendor_review === "approved" && (
                          <> · {t("vendorApproved", lang).replace("{p}", partyLabel(p))}</>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {/* ใบงานจาก Maximo ที่อนุมัติแล้ว — ชุดปิดงานผ่านแต่ละขั้นหรือยัง (ใบที่เปิดเองใน iMPS ไม่ส่ง) */}
            {job.status === "Closed" && job.from_maximo && (
              <div className="tw-mt-3 tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-text-xs">
                <span className="tw-font-semibold tw-text-gray-600">{t("maximoTitle", lang)}</span>
                {MAXIMO_CLOSE_STEPS.map((step) => {
                  const r = job.maximo_sync?.[step.key];
                  // IN02 ของใบ = CLOSED เท่านั้น (INPRG จดไว้ที่ใบงาน ไม่ใช่ที่ใบ PM)
                  const cls = !r
                    ? "tw-border-gray-200 tw-bg-gray-50 tw-text-gray-500"
                    : r.ok
                      ? "tw-border-green-200 tw-bg-green-50 tw-text-green-700"
                      : "tw-border-red-200 tw-bg-red-50 tw-text-red-700";
                  const detail = r?.error || r?.errors?.join(" | ") || "";
                  return (
                    <span
                      key={step.key}
                      title={detail || (r ? "" : t("maximoPending", lang))}
                      className={`tw-rounded-full tw-border tw-px-2 tw-py-0.5 tw-font-semibold ${cls}`}
                    >
                      {r ? (r.ok ? "✓" : "✗") : "–"} {step.key} {lang === "en" ? step.en : step.th}
                    </span>
                  );
                })}
                {!maximoClosed(job.maximo_sync) && PM_RESYNC_ROLES.includes(me?.role ?? "") && (
                  <Button size="sm" variant="outlined" disabled={acting} onClick={() => askConfirm("maximoResync", resyncMaximo)} className="tw-py-1 tw-px-2.5 tw-text-[11px]">
                    {acting ? t("maximoResyncing", lang) : t("maximoResync", lang)}
                  </Button>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* 2 ส่วนหลัก — Station รวม 4 แบบตรวจเดิม ส่วน Charger แตกเป็นใบย่อยรายตู้ */}
        {/* หัวข้อ + ตัวนับอยู่แถวเดียวกันเสมอ — คำอธิบายลงบรรทัดใหม่บนมือถือ (เดิมตัวนับหลุดไปอยู่บรรทัดเดี่ยว) */}
        <div className="tw-mb-3 tw-flex tw-items-baseline tw-gap-3">
          <div className="tw-flex tw-min-w-0 tw-flex-1 tw-flex-col tw-gap-y-0.5 sm:tw-flex-row sm:tw-flex-wrap sm:tw-items-baseline sm:tw-gap-x-3">
            <Typography variant="h6" className="tw-text-gray-800">{t("sectionsTitle", lang)}</Typography>
            <span className="tw-min-w-0 tw-text-xs tw-text-gray-500">{t("sectionsHint", lang)}</span>
          </div>
          <span className="tw-shrink-0 tw-rounded-full tw-bg-gray-100 tw-px-2 tw-py-0.5 tw-text-xs tw-font-semibold tw-text-gray-600">
            {completedGroups}/{SECTION_GROUPS.length}
          </span>
        </div>

        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
          {SECTION_GROUPS.map((group, idx) => {
            const rows = job.sections.filter((x) => group.sectionIds.includes(x.section));
            const groupStatus = aggregateStatus(rows);
            const isCharger = group.id === CHARGER_SECTION;
            const doneCount = rows.filter((x) => !!x.report_id || !!x.na).length;
            return (
              <Card
                key={group.id}
                className="tw-h-full tw-border tw-border-gray-200 tw-shadow-sm"
              >
                {/* การ์ดสูงเท่ากันทั้งแถว (grid stretch) */}
                <CardBody className="tw-flex tw-h-full tw-flex-col tw-p-3 sm:tw-p-4">
                  {/* หัวการ์ด: เลขลำดับ | ชื่อ+สถานะ+คำอธิบาย | ปุ่ม PDF (มุมขวาบนเสมอ ไม่หลุดไปบรรทัดใหม่) */}
                  <div className="tw-flex tw-items-start tw-gap-3">
                    <div className="tw-flex tw-h-8 tw-w-8 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-full tw-bg-gray-800 tw-text-sm tw-font-bold tw-text-white">
                      {idx + 1}
                    </div>
                    <div className="tw-min-w-0 tw-flex-1">
                      <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-x-2 tw-gap-y-1">
                        <span className="tw-font-semibold tw-text-gray-900">
                          {pick(SECTION_TITLE[group.id], lang)}
                        </span>
                        <span className={`tw-whitespace-nowrap tw-rounded-full tw-border tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-semibold ${sectionChipClass(groupStatus)}`}>
                          {sectionStatusLabel(groupStatus, lang, job.status !== "draft")}
                        </span>
                        {rows.length > 0 && (
                          <span className="tw-whitespace-nowrap tw-text-[11px] tw-font-semibold tw-text-gray-500">
                            {doneCount}/{rows.length} {t("chargersDone", lang)}
                          </span>
                        )}
                      </div>
                      <p className="tw-mt-1 tw-text-xs tw-text-gray-500">{pick(SECTION_GROUP_HINT[group.id], lang)}</p>
                    </div>
                    {/* PDF ของการ์ดนี้ — เหมือน PDF ทั้งใบ: โหลดได้เฉพาะใบที่อนุมัติแล้ว (Closed) และการ์ดมีฟอร์มที่กรอกแล้ว */}
                    {toPmFlow({ status: job.status, reject_remark: job.reject_remark }) === "closed" && rows.some((x) => !!x.report_id) ? (
                      <a
                        href={`${API_BASE}/stationpmjob/${encodeURIComponent(job.id)}/pdf?station_id=${encodeURIComponent(job.station_id)}&lang=${lang}&part=${group.id}`}
                        target="_blank"
                        rel="noreferrer"
                        title={t("cardPdfTitle", lang)}
                        className="tw-inline-flex tw-shrink-0 tw-items-center tw-gap-1 tw-rounded-md tw-border tw-border-gray-300 tw-px-2 tw-py-1 tw-text-xs tw-font-semibold tw-text-gray-700 hover:tw-bg-gray-50"
                      >
                        <DocumentArrowDownIcon className="tw-h-3.5 tw-w-3.5" /> {t("cardPdf", lang)}
                      </a>
                    ) : (
                      <span
                        title={toPmFlow({ status: job.status, reject_remark: job.reject_remark }) === "closed"
                          ? t("cardPdfEmpty", lang) : t("pdfClosedOnly", lang)}
                        aria-disabled="true"
                        className="tw-inline-flex tw-shrink-0 tw-cursor-not-allowed tw-items-center tw-gap-1 tw-rounded-md tw-border tw-border-gray-300 tw-px-2 tw-py-1 tw-text-xs tw-font-semibold tw-text-gray-700 tw-opacity-50"
                      >
                        <DocumentArrowDownIcon className="tw-h-3.5 tw-w-3.5" /> {t("cardPdf", lang)}
                      </span>
                    )}
                  </div>

                  {/* ปุ่มกรอกแต่ละส่วน — มือถือใช้ความกว้างเต็มการ์ด, sm ขึ้นไปเยื้องตรงกับชื่อการ์ด (w-8 + gap-3) */}
                  <div className="tw-flex-1 sm:tw-pl-11">
                    {/* Station — แสดงเฉพาะปุ่มของ Station/MDB/CCB/CB_BOX เรียงต่อกันลงมาทีละปุ่ม */}
                    {!isCharger && (
                      <div className="tw-mt-3 tw-grid tw-grid-cols-1 tw-gap-2">
                        {group.sectionIds.map((sectionId) => {
                          const state = job.sections.find((item) => item.section === sectionId);
                          if (!state) return null;
                          return (
                            <SectionFillButton
                              key={sectionId}
                              job={job}
                              state={state}
                              lang={lang}
                              inUseBy={inUseByOther(state)}
                              onOpen={openSection}
                              onToggleNa={toggleNa}
                              busy={acting}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* ส่วนที่ผูกกับตู้ — ตู้ละ 1 ใบ แต่ยังเป็นส่วนเดียวกัน */}
                    {isCharger && (
                      rows.length === 0 ? (
                        <p className="tw-mt-3 tw-text-xs tw-text-gray-400">{t("noChargers", lang)}</p>
                      ) : (
                        <div className="tw-mt-3 tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-2">
                          {rows.map((c) => (
                            <SectionFillButton
                              key={c.sn}
                              job={job}
                              state={c}
                              lang={lang}
                              inUseBy={inUseByOther(c)}
                              onOpen={openSection}
                              onToggleNa={toggleNa}
                              busy={acting}
                            />
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>

        {/* ส่งงาน / ปิดใบงาน — ปุ่มเดียวของทั้งใบ อยู่ท้ายหน้าหลังตรวจครบทุกส่วน */}
        {closeJobButton && (
          <div className="tw-mt-6 tw-flex tw-justify-end">{closeJobButton}</div>
        )}

        {/* planner ของ vendor (เช่น EDS) ตรวจแค่ฟอร์มตู้ชาร์จ — ปุ่มอนุมัติอยู่ในฟอร์มตู้ชาร์จ (ข้างปุ่มแก้ไข) หน้ารวมบอกทางอย่างเดียว
            admin อนุมัติแทนได้ทุกราย จากหน้ารวมนี้ */}
        {job.status === "draft" && vendorTargets.length > 0 && (
          <div className="tw-mt-6 tw-flex tw-flex-col tw-items-end tw-gap-2">
            {vendorTargets.map((p) => job.vendor_reviewer ? (
              <p key={p.key} className="tw-text-right tw-text-xs tw-text-amber-800">
                {t("vendorReviewOpenForm", lang).replaceAll("{p}", partyLabel(p))}
              </p>
            ) : (
              <React.Fragment key={p.key}>
                <p className="tw-text-right tw-text-xs tw-text-amber-800">
                  {t("vendorReviewHint", lang).replaceAll("{p}", partyLabel(p))}
                </p>
                <Button size="sm" disabled={acting} onClick={() => setVendorApproveParty(p)} className="tw-flex tw-items-center tw-gap-1.5 tw-bg-green-600">
                  <CheckCircleIcon className="tw-h-4 tw-w-4" />
                  {t("vendorApprove", lang).replace("{p}", partyLabel(p))}
                </Button>
              </React.Fragment>
            ))}
          </div>
        )}

        {vendorApproveDialog()}

        {/* ปุ่มอนุมัติ/ตีกลับ — ทั้งใบพร้อมกัน (มีแค่ปุ่ม ไม่มีแถบข้อความ) */}
        {waiting && jobCanApprove(job) && (
          <div className="tw-mt-6 tw-flex tw-justify-end tw-gap-2">
            <Button size="sm" variant="outlined" disabled={acting} onClick={() => { setRejectRemark(""); setRejectOpen(true); }}>
              {t("rejectAll", lang)}
            </Button>
            <Button size="sm" disabled={acting} onClick={() => askConfirm("approveJob", approveJob)} className="tw-bg-green-600">
              {t("approve", lang)}
            </Button>
          </div>
        )}

        {/* ปิดใบงาน — เวลาทำงานจริง + ช่างที่ลงเวลา Maximo (ใช้ส่ง IN09) */}
        <Dialog open={closeOpen} handler={() => { if (!acting) setCloseOpen(false); }} size="sm">
          <DialogHeader>
            {currentJob?.split
              ? t("submitParty", lang).replace(
                "{p}",
                currentJob.parties?.find((p) => p.key === closeParty)?.name || t("ownTeam", lang),
              )
              : t("closeJob", lang)}
          </DialogHeader>
          <DialogBody className="tw-flex tw-max-h-[70vh] tw-flex-col tw-gap-4 tw-overflow-y-auto">
            {currentJob?.split && <p className="tw-text-sm tw-text-gray-600">{t("submitPartyHint", lang)}</p>}
            {/* admin/owner ส่งแทนฝ่ายอื่นได้ — เลือกฝ่าย (เฉพาะฝ่ายที่ส่วนของตัวเองส่งครบแล้ว) */}
            {currentJob?.split && PM_SUBMIT_FOR_ANY_ROLES.includes(me?.role ?? "") && (
              <label className="tw-block">
                <span className="tw-mb-1.5 tw-block tw-text-xs tw-font-semibold tw-text-gray-700">{t("submitAs", lang)}</span>
                <select
                  value={closeParty}
                  onChange={(e) => { setCloseParty(e.target.value); if (currentJob) fillCloseForm(currentJob, e.target.value); }}
                  className="tw-w-full tw-rounded-lg tw-border tw-border-gray-300 tw-px-3 tw-py-2 tw-text-sm"
                >
                  {(currentJob.parties ?? []).map((p) => (
                    <option key={p.key} value={p.key} disabled={!p.ready}>
                      {p.name || t("ownTeam", lang)}{p.submitted ? ` (${t("partySent", lang)})` : ""}{!p.ready ? ` (${t("partyNotReady", lang)})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="tw-text-sm tw-text-gray-600">{t(isMaximoJob ? "closeJobHint" : "closeJobHintNoMaximo", lang)}</p>
            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-3">
              <label className="tw-block">
                <span className="tw-mb-1.5 tw-block tw-text-xs tw-font-semibold tw-text-gray-700">
                  {t("workStart", lang)} <span className="tw-text-red-500">*</span>
                </span>
                <input
                  type="datetime-local"
                  value={workStart}
                  onChange={(e) => setWorkStart(e.target.value)}
                  className="tw-w-full tw-rounded-lg tw-border tw-border-gray-300 tw-px-3 tw-py-2 tw-text-sm focus:tw-border-blue-500 focus:tw-outline-none"
                />
              </label>
              <label className="tw-block">
                <span className="tw-mb-1.5 tw-block tw-text-xs tw-font-semibold tw-text-gray-700">
                  {t("workFinish", lang)} <span className="tw-text-red-500">*</span>
                </span>
                <input
                  type="datetime-local"
                  value={workFinish}
                  min={workStart || undefined}
                  onChange={(e) => setWorkFinish(e.target.value)}
                  className="tw-w-full tw-rounded-lg tw-border tw-border-gray-300 tw-px-3 tw-py-2 tw-text-sm focus:tw-border-blue-500 focus:tw-outline-none"
                />
              </label>
            </div>

            {!isMaximoJob ? (
            <div>
              <div className="tw-mb-1.5 tw-text-xs tw-font-semibold tw-text-gray-700">
                {t("impsLabor", lang)} <span className="tw-text-red-500">*</span>
              </div>
              {coworkers.length === 0 ? (
                <p className="tw-text-xs tw-text-orange-600">{t("impsLaborEmpty", lang)}</p>
              ) : (
                <div className="tw-max-h-56 tw-divide-y tw-divide-gray-100 tw-overflow-y-auto tw-rounded-lg tw-border tw-border-gray-200">
                  {coworkers.map((name) => (
                    <label key={name} className="tw-flex tw-cursor-pointer tw-items-center tw-gap-2.5 tw-px-3 tw-py-2 hover:tw-bg-gray-50">
                      <input
                        type="checkbox"
                        checked={impsLabor.includes(name)}
                        onChange={() => setImpsLabor((prev) =>
                          prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name])}
                        className="tw-h-4 tw-w-4 tw-shrink-0"
                      />
                      <span className="tw-min-w-0 tw-truncate tw-text-sm tw-text-gray-800">{name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            ) : (
            <div>
              <div className="tw-mb-1.5 tw-text-xs tw-font-semibold tw-text-gray-700">
                {t("maximoLabor", lang)} {laborOptions.length > 0 && <span className="tw-text-red-500">*</span>}
              </div>
              {laborOptions.length === 0 ? (
                <p className="tw-text-xs tw-text-orange-600">{t("maximoLaborEmpty", lang)}</p>
              ) : (
                <div className="tw-max-h-56 tw-divide-y tw-divide-gray-100 tw-overflow-y-auto tw-rounded-lg tw-border tw-border-gray-200">
                  {laborOptions.map((o) => (
                    <label key={o.laborcode} className="tw-flex tw-cursor-pointer tw-items-center tw-gap-2.5 tw-px-3 tw-py-2 hover:tw-bg-gray-50">
                      <input
                        type="checkbox"
                        checked={maximoLabor.includes(o.laborcode)}
                        onChange={() => setMaximoLabor((prev) =>
                          prev.includes(o.laborcode) ? prev.filter((c) => c !== o.laborcode) : [...prev, o.laborcode])}
                        className="tw-h-4 tw-w-4 tw-shrink-0"
                      />
                      <span className="tw-min-w-0 tw-truncate tw-text-sm tw-text-gray-800">{o.name || o.laborcode}</span>
                      <span className="tw-ml-auto tw-shrink-0 tw-text-xs tw-text-gray-400">{o.laborcode}</span>
                    </label>
                  ))}
                </div>
              )}
              {contractorPicked && (
                <input
                  type="text"
                  value={maximoContractor}
                  placeholder={t("contractorName", lang)}
                  onChange={(e) => setMaximoContractor(e.target.value)}
                  className="tw-mt-2 tw-w-full tw-rounded-lg tw-border tw-border-gray-300 tw-px-3 tw-py-2 tw-text-sm focus:tw-border-blue-500 focus:tw-outline-none"
                />
              )}
            </div>
            )}

            {closeError && (
              <div className="tw-rounded-lg tw-border tw-border-red-200 tw-bg-red-50 tw-px-3 tw-py-2 tw-text-sm tw-text-red-700">
                {closeError}
              </div>
            )}
          </DialogBody>
          <DialogFooter className="tw-gap-2">
            <Button variant="text" disabled={acting} onClick={() => setCloseOpen(false)}>{t("cancel", lang)}</Button>
            <Button className="tw-bg-green-600" disabled={acting} onClick={submitCloseJob}>
              {acting ? t("closingJob", lang) : t("confirmClose", lang)}
            </Button>
          </DialogFooter>
        </Dialog>

        {/* ยืนยัน N/A — pop-up แบบเดียวกับยืนยันยกเลิกการแก้ไขของแพลตฟอร์ม */}
        {naConfirm && (
          <div
            className="tw-fixed tw-inset-0 tw-z-[9999] tw-flex tw-items-center tw-justify-center tw-bg-black/50 tw-p-4"
            onClick={() => { if (!acting) setNaConfirm(null); }}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="tw-w-full tw-max-w-md tw-rounded-2xl tw-bg-white tw-p-6 tw-shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="tw-mb-2 tw-flex tw-items-center tw-gap-2 tw-text-lg tw-font-bold tw-text-blue-gray-800">
                <span className="tw-rounded tw-bg-gray-200 tw-px-1.5 tw-py-0.5 tw-text-xs tw-font-bold tw-text-gray-700">
                  {t("na", lang)}
                </span>
                {t("naTitle", lang)}
              </h3>
              <p className="tw-mb-1 tw-text-sm tw-font-semibold tw-text-blue-gray-800">
                {pick(naConfirm.state.label, lang)}
                {naConfirm.state.sn && naConfirm.state.charger_no && (
                  <span className="tw-ml-2 tw-font-mono tw-text-xs tw-font-normal tw-text-blue-gray-400">{naConfirm.state.sn}</span>
                )}
              </p>
              <p className="tw-text-sm tw-text-blue-gray-600">{t("confirmNa", lang)}</p>
              {naError && (
                <div className="tw-mt-3 tw-rounded-lg tw-border tw-border-red-200 tw-bg-red-50 tw-px-3 tw-py-2 tw-text-sm tw-text-red-700">
                  {naError}
                </div>
              )}
              <div className="tw-mt-5 tw-flex tw-items-center tw-justify-end tw-gap-3">
                <Button
                  type="button"
                  variant="outlined"
                  disabled={acting}
                  onClick={() => setNaConfirm(null)}
                  className="tw-border-blue-gray-200 tw-text-blue-gray-700 hover:tw-border-blue-gray-300"
                >
                  {t("cancel", lang)}
                </Button>
                <Button
                  type="button"
                  disabled={acting}
                  onClick={() => { void saveNa(naConfirm.job, naConfirm.state, true); }}
                  className="tw-bg-gray-800 tw-text-white tw-font-semibold hover:tw-bg-gray-900 disabled:tw-cursor-not-allowed disabled:tw-opacity-50"
                >
                  {t(acting ? "savingNa" : "confirmNaButton", lang)}
                </Button>
              </div>
            </div>
          </div>
        )}

        <Dialog open={rejectOpen} handler={() => setRejectOpen(false)} size="sm">
          <DialogHeader>{t("rejectAll", lang)}</DialogHeader>
          <DialogBody className="tw-flex tw-flex-col tw-gap-3">
            <p className="tw-text-sm tw-text-gray-600">{t("rejectConfirm", lang)}</p>
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
              {t("rejectAll", lang)}
            </Button>
          </DialogFooter>
        </Dialog>

        {confirmDialog}
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
                          {SECTION_GROUPS.map((group) => {
                            const rows = job.sections.filter((x) => group.sectionIds.includes(x.section));
                            const st = aggregateStatus(rows);
                            const filled = rows.filter((x) => !!x.report_id).length;
                            return (
                              <span
                                key={group.id}
                                title={sectionStatusLabel(st, lang, job.status !== "draft")}
                                className={`tw-rounded tw-border tw-px-1.5 tw-py-0.5 tw-text-[10px] tw-font-semibold ${sectionChipClass(st)}`}
                              >
                                {pick(SECTION_TITLE[group.id], lang)}
                                {rows.length > 1 ? ` ${filled}/${rows.length}` : ""}
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
