"use client";
import React from "react";

/**
 * แถวโครงร่างระหว่างโหลดตาราง
 *
 * จำนวนแถวต้องเท่ากับขนาดหน้าจริง (table.getState().pagination.pageSize)
 * ไม่งั้นตารางจะเปลี่ยนความสูงตอนข้อมูลมาถึง แล้วดันทุกอย่างข้างล่างลง — วัดได้เป็น
 * layout shift 0.13 บนหน้า Stations ก่อนแก้ (เกณฑ์ที่ยอมรับได้คือ 0.1)
 */
export default function TableSkeletonRows({ rows, cols }: { rows: number; cols: number }) {
  return (
    <>
      {Array.from({ length: Math.max(1, rows) }).map((_, r) => (
        <tr key={r} className="tw-animate-pulse">
          {Array.from({ length: Math.max(1, cols) }).map((_, c) => (
            <td key={c} className="tw-px-3 tw-py-4">
              <div
                className="tw-h-4 tw-rounded-md tw-bg-blue-gray-100/60"
                // ความกว้างคงที่ตามตำแหน่ง — Math.random() ตอน render จะเปลี่ยนทุกครั้งที่ re-render
                style={{ width: c === 0 ? 32 : `${55 + ((r * 7 + c * 13) % 35)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
