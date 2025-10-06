// Server Component (default)
import DcChargerDashboardClient from "./components/DcChargerDashboardClient";

export default function Page() {
  // ถ้ามีการ fetch ข้อมูลฝั่ง server ก็ทำที่นี่ แล้วส่งเป็น props ไปยัง Client ได้
  return <DcChargerDashboardClient />;
}
