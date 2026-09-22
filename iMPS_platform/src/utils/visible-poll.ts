"use client";

/**
 * setInterval ที่ไม่ทำงานเมื่อ tab อยู่เบื้องหลัง และดึงข้อมูลทันทีเมื่อผู้ใช้กลับมา
 *
 * หน้า dashboard ถูกเปิดค้างไว้ทั้งวัน ถ้า poll ต่อไปในแท็บที่ไม่มีใครดู
 * backend ต้องรับโหลดนั้นโดยไม่มีใครเห็นผลลัพธ์ — กับ 355 สถานีคูณจำนวนแท็บที่เปิดค้าง
 * นี่คือโหลดถาวรที่ตัดออกได้ทั้งหมด
 *
 * คืนฟังก์ชันหยุด — เรียกใน cleanup ของ useEffect
 */
export function startVisiblePoll(fn: () => void, intervalMs: number): () => void {
  if (typeof window === "undefined") return () => { };

  let lastRun = Date.now();
  const run = () => { lastRun = Date.now(); fn(); };

  const id = setInterval(() => {
    if (document.visibilityState === "visible") run();
  }, intervalMs);

  const onVisibilityChange = () => {
    // กลับมาดูอีกครั้งและข้อมูลเก่ากว่า 1 รอบแล้ว → ดึงทันที ไม่ต้องรอรอบถัดไป
    if (document.visibilityState === "visible" && Date.now() - lastRun >= intervalMs) run();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
