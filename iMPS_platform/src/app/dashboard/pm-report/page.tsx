// PM
"use client";

/**
 * หน้า PM report — ไม่มีแท็บแล้ว
 *
 * เดิมหน้านี้แบ่งเป็นแท็บ Charger / Station (ซึ่งรวม MDB/CCB/CB_BOX ไว้แล้ว)
 * ตอนนี้ Charger ถูกย้ายเข้าไปเป็น "ส่วนที่ 5" ของใบ PM สถานี จึงเหลือหน้าจอเดียว
 * คือตาราง/ฟอร์มของใบ PM สถานีที่รวมครบทั้ง 5 ส่วนในเอกสารเลขที่เดียวกัน
 *
 * ลิงก์เก่าที่ยังส่ง ?tab=… มา (หน้า PM List) ไม่พัง — StationPmJobTables
 * อ่าน tab ไว้ใช้เลือกชนิดฟอร์มของเอกสารใบเดี่ยวรุ่นก่อนรวมใบเท่านั้น
 */

import React from "react";

// แท็บเดียวที่เหลือ = ใบ PM สถานีใบเดียวที่รวม สถานี/MDB/CCB/CB_BOX/ตู้ชาร์จ เป็น 5 ส่วน
import StationPmJobTables from "@/app/dashboard/pm-report/components/StationPmJobTables";
import { useSearchParams } from "next/navigation";
import useLanguage from "@/utils/useLanguage";

import { ChevronDoubleUpIcon, ChevronDoubleDownIcon } from "@heroicons/react/24/solid";

export default function DataTablesPage() {
  const searchParams = useSearchParams();
  const { lang } = useLanguage();

  const editId = searchParams.get("edit_id") ?? "";
  const mode: "list" | "form" =
    searchParams.get("view") === "form" || !!editId ? "form" : "list";

  // เลื่อนขึ้นสุด/ลงสุดของหน้า (ใช้บนมือถือ)
  const scrollToTop = () =>
    window.scrollTo({ top: 0, behavior: "smooth" });
  const scrollToBottom = () =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });

  return (
    <div className="tw-w-full">
      <StationPmJobTables />

      {/* ปุ่มเลื่อนขึ้นสุด/ลงสุด — แสดงเฉพาะตอนกรอกเอกสาร PM (ทั้ง PC และมือถือ) */}
      {mode === "form" && (
      <div className="tw-fixed tw-bottom-5 tw-right-4 tw-z-40 tw-flex tw-flex-col tw-gap-2">
        <button
          type="button"
          onClick={scrollToTop}
          title={lang === "th" ? "เลื่อนขึ้นสุด" : "Scroll to top"}
          aria-label={lang === "th" ? "เลื่อนขึ้นสุด" : "Scroll to top"}
          className="tw-flex tw-items-center tw-justify-center tw-w-11 tw-h-11
                     tw-rounded-full tw-bg-gray-900 tw-text-white
                     tw-shadow-lg tw-shadow-gray-900/30
                     hover:tw-bg-gray-700 active:tw-scale-95
                     tw-transition-all tw-duration-200"
        >
          <ChevronDoubleUpIcon className="tw-h-5 tw-w-5" />
        </button>
        <button
          type="button"
          onClick={scrollToBottom}
          title={lang === "th" ? "เลื่อนลงสุด" : "Scroll to bottom"}
          aria-label={lang === "th" ? "เลื่อนลงสุด" : "Scroll to bottom"}
          className="tw-flex tw-items-center tw-justify-center tw-w-11 tw-h-11
                     tw-rounded-full tw-bg-gray-900 tw-text-white
                     tw-shadow-lg tw-shadow-gray-900/30
                     hover:tw-bg-gray-700 active:tw-scale-95
                     tw-transition-all tw-duration-200"
        >
          <ChevronDoubleDownIcon className="tw-h-5 tw-w-5" />
        </button>
      </div>
      )}
    </div>
  );
}
