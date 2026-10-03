import { apiFetch } from "@/utils/api";
import { CMRow, mergeCmRows } from "@/utils/cm-dashboard";

async function fetchList(query: string): Promise<{ items: CMRow[]; total: number }> {
  const res = await apiFetch(`/cmreport/list-all?${query}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.detail || `HTTP ${res.status}`);
  return { items: Array.isArray(json?.items) ? json.items : [], total: json?.total ?? 0 };
}

/**
 * ใบ CM สำหรับหน้า CM List / CM Dashboard: ใบล่าสุด `limit` ใบ + ใบที่คนเปิดทุกใบ
 * total = จำนวนใบทั้งหมดในฐานข้อมูล (ใช้เตือนว่าใบ auto ถูกตัด)
 */
export async function fetchCmRows(limit: number): Promise<{ rows: CMRow[]; total: number }> {
  const [latest, userCreated] = await Promise.all([
    fetchList(`limit=${limit}`),
    fetchList("origin=user&limit=50000"),
  ]);
  return { rows: mergeCmRows(latest.items, userCreated.items), total: latest.total };
}
