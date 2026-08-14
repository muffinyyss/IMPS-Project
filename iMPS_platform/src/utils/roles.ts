// cs = เปิดใบงาน CM, planner = อนุมัติ SR + วางแผน
export type UserRole = "owner" | "admin" | "technician" | "cs" | "planner";

// role สายปฏิบัติงาน — UI แบบเดียวกับ technician (ซ่อนปุ่มจัดการสถานี/กระดิ่ง, เข้าตู้แล้วไป PM report)
// เฉพาะ technician เท่านั้นที่ต้องเลือกสถานี — cs/planner เห็นทุกสถานี
export const STAFF_ROLES: UserRole[] = ["technician", "cs", "planner"];

export const isStaffRole = (role?: string | null) =>
    STAFF_ROLES.includes((role ?? "").toLowerCase() as UserRole);

// หน้าที่พาไปหลังคลิกตู้ชาร์จของ role สายปฏิบัติงาน — cs เห็นแค่ CM report ส่วน technician/planner ไป PM report
export const staffChargerPath = (role?: string | null) =>
    ["cs"].includes((role ?? "").toLowerCase())
        ? "/dashboard/cm-report"
        : "/dashboard/pm-report";
