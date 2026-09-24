/**
 * หน้าที่ขอไว้ก่อนถูกส่งมา login (middleware / session หมดอายุ) — คืน "" ถ้าไม่ใช่ path ภายในเว็บ
 *
 * กัน open redirect: "//evil.com" หรือ URL เต็มจะพาผู้ใช้ที่เพิ่งกรอกรหัสผ่านออกไปเว็บอื่น
 * เบราว์เซอร์ตีความ "/\evil.com" เหมือน "//evil.com" จึงปฏิเสธ backslash ด้วย
 * และไม่ส่งกลับไปหน้า /auth/* (วน login)
 */
export function safeNextPath(next: string | null | undefined): string {
  const v = (next || "").trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return "";
  if (v === "/auth" || v.startsWith("/auth/")) return "";
  return v;
}
