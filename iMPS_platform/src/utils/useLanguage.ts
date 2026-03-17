"use client";
import { useState, useEffect } from "react";

export type Lang = "th" | "en";

/**
 * Custom hook for language management
 */
export function useLanguage() {
  const [lang, setLang] = useState<Lang>("th");

  useEffect(() => {
    const savedLang = localStorage.getItem("app_language") as Lang | null;
    if (savedLang === "th" || savedLang === "en") {
      setLang(savedLang);
    }

    const handleLanguageChange = (e: CustomEvent<{ lang: Lang }>) => {
      setLang(e.detail.lang);
    };

    window.addEventListener("language:change", handleLanguageChange as EventListener);
    return () => {
      window.removeEventListener("language:change", handleLanguageChange as EventListener);
    };
  }, []);

  return { lang };
}

// ==================== MDB PM FORM TRANSLATIONS ====================
export const mdbFormTranslations = {
  // Page titles
  pageTitle: {
    th: "Preventive Maintenance Checklist - Main Distribution Board (MDB)",
    en: "Preventive Maintenance Checklist - Main Distribution Board (MDB)"
  },
  companyName: {
    th: "Electricity Generating Authority of Thailand (EGAT)",
    en: "Electricity Generating Authority of Thailand (EGAT)"
  },
  docName: { th: "Document Name.", en: "Document Name." },
  
  // Form labels
  issueId: { th: "Issue id", en: "Issue ID" },
  location: { th: "Location / สถานที่", en: "Location" },
  inspector: { th: "Inspector / ผู้ตรวจสอบ", en: "Inspector" },
  pmDate: { th: "PM Date / วันที่ตรวจสอบ", en: "PM Date" },
  
  // Buttons
  save: { th: "บันทึก", en: "Save" },
  saving: { th: "กำลังบันทึก...", en: "Saving..." },
  attachPhoto: { th: "แนบรูป / ถ่ายรูป", en: "Attach / Take Photo" },
  na: { th: "N/A", en: "N/A" },
  cancelNA: { th: "ยกเลิก N/A", en: "Cancel N/A" },
  pass: { th: "PASS", en: "PASS" },
  fail: { th: "FAIL", en: "FAIL" },
  
  // Labels
  remark: { th: "หมายเหตุ *", en: "Remark *" },
  testResult: { th: "ผลการทดสอบ", en: "Test Result" },
  comment: { th: "Comment", en: "Comment" },
  summaryResult: { th: "สรุปผลการตรวจสอบ", en: "Summary Result" },
  summaryPassLabel: { th: "Pass : ผ่าน", en: "Pass" },
  summaryFailLabel: { th: "Fail : ไม่ผ่าน", en: "Fail" },
  summaryNALabel: { th: "N/A : ไม่พบ", en: "N/A" },
  
  // Photo
  maxPhotos: { th: "แนบได้สูงสุด", en: "Max" },
  photoSupport: { th: "รูป • รองรับการถ่ายจากกล้องบนมือถือ", en: "photos • Supports mobile camera" },
  noPhotos: { th: "ยังไม่มีรูปแนบ", en: "No photos attached" },
  
  // Measure labels
  prePM: { th: "ก่อน PM", en: "Pre-PM" },
  postPM: { th: "หลัง PM", en: "Post-PM" },
  
  // Dynamic items
  breakerMainCount: { th: "จำนวน Breaker Main:", en: "Breaker Main count:" },
  unit: { th: "ตัว", en: "units" },
  addBreakerMain: { th: "เพิ่ม Breaker Main", en: "Add Breaker Main" },
  chargerCountLabel: { th: "จำนวนตู้ชาร์จใน Station นี้:", en: "Chargers in this station:" },
  chargerUnit: { th: "ตู้", en: "chargers" },
  breakerCCBCount: { th: "จำนวน Breaker CCB:", en: "Breaker CCB count:" },
  breakerCCBMax: { th: "ตัว (สูงสุด 4 ตัว)", en: "units (max 4)" },
  addBreakerCCB: { th: "เพิ่ม Breaker CCB", en: "Add Breaker CCB" },
  rcdCount: { th: "จำนวน RCD (ตามจำนวนตู้ชาร์จ):", en: "RCD count (per charger):" },
  breakerChargerCount: { th: "จำนวน Breaker Charger (ตามจำนวนตู้ชาร์จ):", en: "Breaker Charger (per charger):" },
  
  // Validation sections
  validationPhotoTitle: { th: "1) ตรวจสอบการแนบรูปภาพ (ทุกข้อ)", en: "1) Photo attachment (all items)" },
  validationInputTitle: { th: "2) อินพุตค่าแรงดันไฟฟ้า", en: "2) Voltage input values" },
  validationRemarkTitle: { th: "3) หมายเหตุ (ทุกข้อ)", en: "3) Remarks (all items)" },
  validationPFTitle: { th: "4) สถานะ PASS / FAIL / N/A ทุกข้อ", en: "4) PASS / FAIL / N/A for all" },
  validationSummaryTitle: { th: "5) สรุปผลการตรวจสอบ", en: "5) Summary result" },
  
  // Validation messages
  allComplete: { th: "ครบเรียบร้อย ✅", en: "Complete ✅" },
  missingPhoto: { th: "ยังไม่ได้แนบรูปข้อ:", en: "Missing photos:" },
  missingInput: { th: "ยังขาด:", en: "Missing:" },
  missingRemark: { th: "ยังไม่ได้กรอกหมายเหตุข้อ:", en: "Missing remarks:" },
  missingPF: { th: "ยังไม่ได้เลือกข้อ:", en: "Not selected:" },
  missingSummaryText: { th: "ยังไม่ได้กรอกข้อความสรุปผลการตรวจสอบ", en: "Summary text not filled" },
  missingSummaryStatus: { th: "ยังไม่ได้เลือกสถานะสรุปผล (Pass/Fail/N/A)", en: "Summary status not selected" },
  
  // Alerts
  alertNoStation: { th: "ยังไม่ทราบ station_id", en: "Station ID not found" },
  alertFillVoltage: { th: "กรุณากรอกค่าแรงดันไฟฟ้าให้ครบก่อนบันทึก", en: "Please fill all voltage values" },
  alertFillRemark: { th: "กรุณากรอกหมายเหตุข้อ:", en: "Please fill remarks:" },
  alertFillPreFirst: { th: "กรุณากรอกข้อมูลในส่วน Pre ให้ครบก่อน", en: "Please complete Pre-PM first" },
  alertSaveFailed: { th: "บันทึกไม่สำเร็จ:", en: "Save failed:" },
  
  // Checkbox
  dustFilterChanged: { th: "เปลี่ยนแผ่นกรองระบายอากาศ", en: "Ventilation filter replaced" },
  
  // Tooltips
  photoNotComplete: { th: "กรุณาแนบรูปในส่วน Pre ให้ครบก่อนบันทึก", en: "Please attach all Pre-PM photos" },
  inputNotComplete: { th: "กรุณากรอกค่าข้อ 4-8 ให้ครบก่อนบันทึก", en: "Please fill items 4-8" },
  allNotComplete: { th: "กรุณากรอกข้อมูล / แนบรูป และสรุปผลให้ครบก่อนบันทึก", en: "Please complete all data" },
};

// Questions translations
export const mdbQuestions = {
  q1: { th: "1) ตรวจสอบสภาพทั่วไป", en: "1) General condition inspection" },
  q1_tooltip: { th: "ตรวจสอบโครงสร้างตู้ ระบบล็อกและบานพับรวมถึงป้ายชื่อวงจร (Labeling)", en: "Check cabinet structure, lock system, hinges and circuit labeling" },
  
  q2: { th: "2) ตรวจสอบดักซีล, ซิลิโคนกันซึม", en: "2) Check sealant and silicone" },
  q2_tooltip: { th: "ตรวจสอบสภาพดักซีลที่ปิดหรืออุดตามรอยต่อและช่องทางเข้าสาย", en: "Check sealant condition at joints and cable entry points" },
  
  q3: { th: "3) ตรวจสอบ Power Meter", en: "3) Check Power Meter" },
  q3_tooltip: { th: "ตรวจสอบการแสดงของจอ Power Meter และความถูกต้องของค่าพารามิเตอร์ไฟฟ้า (V, A, Hz, PF)", en: "Check Power Meter display and parameters (V, A, Hz, PF)" },
  
  q4: { th: "4) ตรวจสอบแรงดันไฟฟ้า Breaker Main", en: "4) Check Breaker Main voltage" },
  q4_tooltip: { th: "วัดค่าแรงดันไฟฟ้าด้านเข้าของ Breaker Main", en: "Measure input voltage of Breaker Main" },
  
  q5: { th: "5) ตรวจสอบแรงดันไฟฟ้า Breaker Charger", en: "5) Check Breaker Charger voltage" },
  q5_tooltip: { th: "วัดค่าแรงดันไฟฟ้าด้านเข้าของ Breaker Charger", en: "Measure input voltage of Breaker Charger" },
  
  q6: { th: "6) ตรวจสอบแรงดันไฟฟ้า Breaker CCB", en: "6) Check Breaker CCB voltage" },
  q6_tooltip: { th: "วัดค่าแรงดันไฟฟ้าด้านเข้าของ Breaker CCB", en: "Measure input voltage of Breaker CCB" },
  
  q7: { th: "7) ตรวจสอบแรงดันไฟฟ้า RCD", en: "7) Check RCD voltage" },
  q7_tooltip: { th: "วัดค่าแรงดันไฟฟ้าด้าน Load ของอุปกรณ์ป้องกันไฟรั่ว (RCD)", en: "Measure load side voltage of RCD" },
  
  q8: { th: "8) ทดสอบปุ่ม Trip Test RCD", en: "8) Test RCD Trip button" },
  q8_tooltip: { th: "กดปุ่ม Test เพื่อทดสอบกลไกการตัดกระแสไฟรั่วของ RCD", en: "Press Test button to test RCD trip mechanism" },
  
  q9: { th: "9) ทดสอบปุ่ม Trip Test Breaker CCB", en: "9) Test Breaker CCB Trip button" },
  q9_tooltip: { th: "กดปุ่ม Test เพื่อทดสอบกลไกการตัดวงจรของ Breaker CCB", en: "Press Test button to test Breaker CCB trip mechanism" },
  
  q10: { th: "10) ทดสอบปุ่ม Trip Test Breaker Charger", en: "10) Test Breaker Charger Trip button" },
  q10_tooltip: { th: "กดปุ่ม Test เพื่อทดสอบกลไกการตัดวงจรของ Breaker Charger", en: "Press Test button to test Breaker Charger trip mechanism" },
  
  q11: { th: "11) ทดสอบปุ่ม Trip Test Breaker Main", en: "11) Test Breaker Main Trip button" },
  q11_tooltip: { th: "กดปุ่ม Test เพื่อทดสอบกลไกการตัดวงจรของ Breaker Main", en: "Press Test button to test Breaker Main trip mechanism" },
  
  q12: { th: "12) ตรวจสอบจุดต่อทางไฟฟ้า", en: "12) Check electrical connections" },
  q12_tooltip: { th: "ตรวจสอบการขันแน่นของน็อตและตรวจเช็ครอยไหม้ด้วยกล้องถ่ายภาพความร้อน", en: "Check bolt tightness and inspect for burns with thermal camera" },
  
  q13: { th: "13) ทำความสะอาดตู้ MDB", en: "13) Clean MDB cabinet" },
  q13_tooltip: { th: "ทำความสะอาดโดยการขจัดฝุ่นและสิ่งสกปรกภายในตู้ด้วยเครื่องดูดฝุ่นหรือเป่าลมแห้ง", en: "Clean by removing dust inside cabinet with vacuum or dry air" },
};

// Dynamic item label generators
export const getDynamicLabel = {
  breakerMain: (idx: number, lang: Lang) => 
    lang === "th" ? `4.${idx}) Breaker Main ตัวที่ ${idx}` : `4.${idx}) Breaker Main #${idx}`,
  breakerCharger: (idx: number, lang: Lang) => 
    lang === "th" ? `5.${idx}) Breaker Charger ตัวที่ ${idx}` : `5.${idx}) Breaker Charger #${idx}`,
  breakerCCB: (idx: number, lang: Lang) => 
    lang === "th" ? `6.${idx}) Breaker CCB ตัวที่ ${idx}` : `6.${idx}) Breaker CCB #${idx}`,
  rcd: (idx: number, lang: Lang) => 
    lang === "th" ? `7.${idx}) RCD ตัวที่ ${idx}` : `7.${idx}) RCD #${idx}`,
  tripRCD: (idx: number, lang: Lang) => 
    lang === "th" ? `8.${idx}) Trip Test RCD ตัวที่ ${idx}` : `8.${idx}) Trip Test RCD #${idx}`,
  tripCCB: (idx: number, lang: Lang) => 
    lang === "th" ? `9.${idx}) Trip Test Breaker CCB ตัวที่ ${idx}` : `9.${idx}) Trip Test Breaker CCB #${idx}`,
  tripCharger: (idx: number, lang: Lang) => 
    lang === "th" ? `10.${idx}) Trip Test Breaker Charger ตัวที่ ${idx}` : `10.${idx}) Trip Test Breaker Charger #${idx}`,
  tripMain: (idx: number, lang: Lang) => 
    lang === "th" ? `11.${idx}) Trip Test Breaker Main ตัวที่ ${idx}` : `11.${idx}) Trip Test Breaker Main #${idx}`,
};

// Helper function to get translation
export function tMdb(key: keyof typeof mdbFormTranslations, lang: Lang): string {
  return mdbFormTranslations[key][lang];
}

export function tQuestion(key: keyof typeof mdbQuestions, lang: Lang): string {
  return mdbQuestions[key][lang];
}

// Common translations (shared across components)
export const commonTranslations = {
  save: { th: "บันทึก", en: "Save" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  saving: { th: "กำลังบันทึก...", en: "Saving..." },
  loading: { th: "กำลังโหลด...", en: "Loading..." },
  back: { th: "กลับ", en: "Back" },
  next: { th: "ถัดไป", en: "Next" },
  previous: { th: "ก่อนหน้า", en: "Previous" },
  confirm: { th: "ยืนยัน", en: "Confirm" },
  delete: { th: "ลบ", en: "Delete" },
  edit: { th: "แก้ไข", en: "Edit" },
  add: { th: "เพิ่ม", en: "Add" },
  search: { th: "ค้นหา", en: "Search" },
  filter: { th: "กรอง", en: "Filter" },
  clear: { th: "ล้าง", en: "Clear" },
  submit: { th: "ส่ง", en: "Submit" },
  reset: { th: "รีเซ็ต", en: "Reset" },
  close: { th: "ปิด", en: "Close" },
  yes: { th: "ใช่", en: "Yes" },
  no: { th: "ไม่", en: "No" },
  ok: { th: "ตกลง", en: "OK" },
  error: { th: "ข้อผิดพลาด", en: "Error" },
  success: { th: "สำเร็จ", en: "Success" },
  warning: { th: "คำเตือน", en: "Warning" },
  required: { th: "จำเป็น", en: "Required" },
  optional: { th: "ไม่บังคับ", en: "Optional" },
  noData: { th: "ไม่มีข้อมูล", en: "No data" },
  notFound: { th: "ไม่พบ", en: "Not found" },
  remark: { th: "หมายเหตุ", en: "Remark" },
  photo: { th: "รูปภาพ", en: "Photo" },
  attachPhoto: { th: "แนบรูป / ถ่ายรูป", en: "Attach / Take Photo" },
  maxPhotos: { th: "แนบได้สูงสุด", en: "Max" },
  noPhotos: { th: "ยังไม่มีรูปแนบ", en: "No photos attached" },
  pass: { th: "ผ่าน", en: "Pass" },
  fail: { th: "ไม่ผ่าน", en: "Fail" },
  na: { th: "ไม่มี", en: "N/A" },
  cancelNA: { th: "ยกเลิก N/A", en: "Cancel N/A" },
} as const;

export default useLanguage;