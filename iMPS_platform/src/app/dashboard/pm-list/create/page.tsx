"use client";

/**
 * หน้าเปิดใบงาน PM เอง — ปลายทางของปุ่ม "เพิ่มใบงาน" ในหน้า PM List
 * หน้าตาเดียวกับหน้าวางแผนของใบงาน Maximo (PmPlanForm) แต่เลือกสถานีเองได้
 */

import React from "react";
import { useRouter } from "next/navigation";
import PmCreateWoForm from "@/app/dashboard/pm-report/components/PmCreateWoForm";
import { PM_LIST_ROUTE } from "@/app/dashboard/pm-report/lib/origin";

export default function PmCreateWorkOrderPage() {
  const router = useRouter();
  const backToList = () => router.push(PM_LIST_ROUTE);

  return (
    <div className="tw-mt-4 sm:tw-mt-6 lg:tw-mt-8">
      <PmCreateWoForm
        // กลับไปหน้ารายการพร้อมบอกเลขใบงานที่เพิ่งเปิด — ตารางโหลดใหม่ตอน mount อยู่แล้ว
        onSaved={(wonum) =>
          router.push(wonum ? `${PM_LIST_ROUTE}?created=${encodeURIComponent(wonum)}` : PM_LIST_ROUTE)
        }
        onCancel={backToList}
      />
    </div>
  );
}
