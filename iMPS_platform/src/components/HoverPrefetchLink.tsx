"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * ลิงก์ที่ไม่ prefetch อัตโนมัติ
 *
 * ค่า default ของ App Router คือ prefetch ทุก <Link> ที่โผล่เข้ามาในจอ
 * ทำให้หน้าอย่าง Solar Plant / Power Plant / Users ถูกดาวน์โหลดมาทั้งที่ยังไม่มีใครกด
 * ตัวนี้เลื่อนไป prefetch ตอนผู้ใช้ชี้เมาส์ / โฟกัสด้วยคีย์บอร์ด / แตะหน้าจอแทน
 * ได้ความเร็วตอนคลิกเท่าเดิม แต่ไม่โหลดหน้าที่ไม่มีใครขอ
 */
export default function HoverPrefetchLink({
  href,
  children,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...rest
}: React.ComponentProps<typeof Link>) {
  const router = useRouter();
  const warmed = React.useRef(false);

  const warm = React.useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    try {
      router.prefetch(String(href));
    } catch {
      /* prefetch เป็นแค่ optimization — พังก็แค่โหลดตอนคลิกตามปกติ */
    }
  }, [href, router]);

  return (
    <Link
      {...rest}
      href={href}
      prefetch={false}
      onMouseEnter={(e) => {
        warm();
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        warm();
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        warm();
        onTouchStart?.(e);
      }}
    >
      {children}
    </Link>
  );
}
