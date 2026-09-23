import { useEffect, useRef, type DependencyList } from "react";

/**
 * useEffect ที่รอให้ deps นิ่งก่อนค่อยทำงาน — ฟอร์ม PM ใช้ autosave draft ลงเครื่อง
 *
 * ถ้ายังมีรอบที่ค้างอยู่ตอนออกจากหน้า (กดย้อนกลับ / เปลี่ยนหน้า / ปิดแท็บ) จะทำทันที
 * ไม่ทิ้งไปเฉย ๆ — เดิมแนบรูปแล้วกดออกภายใน 800ms รูปนั้นไม่ทันลง draft เลยหายตอนกลับมา
 *
 * ทำเฉพาะรอบที่ยังค้าง: ถ้า autosave ทำไปแล้วจะไม่ยิงซ้ำ (เช่นหลังกดส่งแล้ว clear draft)
 * effect ต้องเช็คเงื่อนไขของตัวเองเหมือนเดิม (restore เสร็จหรือยัง / โหมดตรวจ ฯลฯ)
 */
export function useDebouncedEffect(effect: () => void, deps: DependencyList, delay = 800) {
  const effectRef = useRef(effect);
  effectRef.current = effect;
  const pendingRef = useRef(false);

  useEffect(() => {
    pendingRef.current = true;
    const h = setTimeout(() => {
      pendingRef.current = false;
      effectRef.current();
    }, delay);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const flush = () => {
      if (!pendingRef.current) return;
      pendingRef.current = false;
      effectRef.current();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
}
