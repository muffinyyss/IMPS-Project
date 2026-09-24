/**
 * ปุ่ม "ยกเลิกการแก้ไข" อยู่ที่หน้ารวมของใบ PM สถานี แต่ draft ในเครื่องเป็นของฟอร์ม
 * (แต่ละฟอร์มตั้ง key คนละสูตร) — ฟอร์มที่เปิดอยู่ลงทะเบียนตัวล้าง draft ของตัวเองไว้ที่นี่
 * หน้ารวมเรียก discardOpenFormDraft() ได้โดยไม่ต้องรู้สูตร key ของฟอร์มไหน
 *
 * ยกเลิก = ทิ้งสิ่งที่แก้ในเครื่องทั้งหมด (คำตอบ + รูปที่แนบใหม่) เอกสารบน server ไม่ถูกแตะ
 * รูปเดิมที่กดลบไว้ก็ยังอยู่ เพราะรูปเดิมถูกลบจริงตอนกดบันทึกเท่านั้น
 */

let discard: (() => Promise<void>) | null = null;

/** คืนตัวถอนการลงทะเบียน — ใช้เป็น cleanup ของ useEffect ได้เลย */
export function registerDraftDiscard(fn: () => Promise<void>): () => void {
  discard = fn;
  return () => {
    if (discard === fn) discard = null;
  };
}

export async function discardOpenFormDraft(): Promise<void> {
  if (discard) await discard();
}
