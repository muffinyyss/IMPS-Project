"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * ปุ่มจากหน้ารวมใบ PM สถานี (เช่น "แก้ไข") ที่ส่งเข้าไปให้ฟอร์ม PM วาง
 * ตรงตำแหน่งเดียวกับปุ่ม "บันทึก" ของหน้ากรอก เวลาเปิดดูข้อมูล (review=1)
 * ฟอร์มต้องวางไว้นอก <fieldset disabled> ไม่งั้นปุ่มถูกปิดตามไปด้วย
 */
export const PmReviewActionContext = createContext<ReactNode>(null);

export function usePmReviewAction(): ReactNode {
    return useContext(PmReviewActionContext);
}
