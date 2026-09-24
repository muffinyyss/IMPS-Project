// Material Tailwind 2.1 ประกาศ props ของทุก component ด้วย Pick<Props, "...รายชื่อคีย์...">
// ที่สร้างจาก @types/react รุ่นเก่า @types/react 19 ถอดคีย์ข้างล่างออกจาก interface กลาง
// Pick ของคีย์ที่ไม่มีอยู่จริงจึงทิ้งเครื่องหมาย "?" แล้วทุก <Input>, <Checkbox>, <ListItemPrefix>…
// ในโปรเจกต์ถูกบังคับให้ส่ง crossOrigin / placeholder / onPointerEnterCapture ฯลฯ (TS2741, TS2739)
//
// ประกาศคืนเป็น optional ตามรุ่นเดิม — ไม่มีผลตอน runtime ช่วยแค่ให้ชนิดข้อมูลตรงกับที่ Material
// Tailwind ถูก build มา ลบไฟล์นี้ได้เมื่อ Material Tailwind ออกรุ่นที่รองรับ @types/react 19
import "react";

declare module "react" {
  interface InputHTMLAttributes<T> {
    crossOrigin?: CrossOrigin;
  }
  interface HTMLAttributes<T> {
    placeholder?: string | undefined;
  }
  interface DOMAttributes<T> {
    onResize?: ReactEventHandler<T> | undefined;
    onResizeCapture?: ReactEventHandler<T> | undefined;
    onPointerEnterCapture?: PointerEventHandler<T> | undefined;
    onPointerLeaveCapture?: PointerEventHandler<T> | undefined;
  }
}
