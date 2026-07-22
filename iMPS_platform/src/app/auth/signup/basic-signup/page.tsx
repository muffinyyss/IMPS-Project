"use client";

// Public self-signup ถูกปิดใช้งานเพื่อความปลอดภัย (ตามผลทดสอบเจาะระบบ):
// การสร้างผู้ใช้ต้องทำโดย admin ผ่านหน้าจัดการผู้ใช้เท่านั้น (backend: POST /add_users/)
// หน้านี้จึง redirect ไปหน้าเข้าสู่ระบบ

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BasicSignupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth/signin/basic");
  }, [router]);

  return null;
}
