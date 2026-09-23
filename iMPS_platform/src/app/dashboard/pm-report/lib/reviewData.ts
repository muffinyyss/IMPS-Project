/**
 * ข้อมูลของเอกสารที่ส่งแล้ว → state ของฟอร์ม — ใช้ตอนเปิดดูอย่างเดียว (?review=1 / ?approve=1)
 * หน้าดูใช้ฟอร์มตัวเดียวกับตอนกรอก (ล็อกด้วย fieldset) จึงต้องเติมรูปและค่าที่วัดจากตัวเอกสาร
 *
 * รูป:
 * ปกติ state รูปของฟอร์มมาจาก draft ในเครื่องที่กรอกอยู่เท่านั้น เปิดดูเอกสารที่ส่งแล้ว
 * (หรือเปิดจากเครื่องอื่น) ช่องรูปจึงว่าง ตัวนี้เอารูปจาก server มาวางลงช่องของข้อนั้นแทน
 *
 * backend เก็บรูปตาม "กลุ่ม" (g16, g10_1, r7 …) ส่วนฟอร์มเก็บตาม photo key ของตัวเอง
 * แต่ละฟอร์มตั้งสูตรคนละแบบ จึงให้ฟอร์มส่งตัวแปลง กลุ่ม → photo key เข้ามา
 */

export type ServerPhoto = { url?: string; remark?: string };

/** รูปที่แสดงในโหมดดู — ไม่มีไฟล์ในเครื่อง มีแค่ลิงก์ และถือว่าอยู่บน server แล้ว */
export type ViewPhoto = { id: string; preview: string; remark: string; uploaded: true };

export function serverPhotosToForm(
  server: Record<string, ServerPhoto[] | undefined> | undefined | null,
  formKeyOf: (group: string) => string | number | null | undefined,
  apiBase: string,
): Record<string, ViewPhoto[]> {
  const out: Record<string, ViewPhoto[]> = {};
  for (const [group, list] of Object.entries(server ?? {})) {
    const key = formKeyOf(group);
    if (key === null || key === undefined || key === "") continue;
    (list ?? []).forEach((p, i) => {
      if (!p?.url) return;
      const url = p.url.startsWith("http") ? p.url : `${apiBase}${p.url}`;
      (out[String(key)] ??= []).push({ id: `server-${group}-${i}`, preview: url, remark: p.remark ?? "", uploaded: true });
    });
  }
  return out;
}

/**
 * ตัวแปลง กลุ่ม → photo key จากสูตรขาไปของฟอร์ม (photo key → กลุ่ม)
 * หลาย photo key ลงกลุ่มเดียวกันได้ (เช่น Station ข้อ 7.1/7.2 → r7) — วางไว้ที่ key แรกของกลุ่ม
 * เพราะ server ไม่ได้จำว่ารูปไหนเป็นของข้อย่อยไหน
 */
export function formKeyFromForward(
  formKeys: (string | number)[],
  toGroup: (formKey: string | number) => string | null | undefined,
): (group: string) => string | number | null {
  const map = new Map<string, string | number>();
  for (const k of formKeys) {
    const g = toGroup(k);
    if (g && !map.has(g)) map.set(g, k);
  }
  return (group) => map.get(group) ?? null;
}

/**
 * ค่าที่วัดของเอกสาร → state ช่องกรอกค่า
 * ตอนบันทึกบางฟอร์มแปลงค่าเป็นตัวเลข (CCB) แต่ช่องกรอกรับข้อความ ต้องแปลงกลับ
 */
export function measureAsText<T>(saved: Record<string, { value?: unknown; unit?: string } | undefined> | undefined | null): T {
  return Object.fromEntries(
    Object.entries(saved ?? {}).map(([k, v]) => [
      k,
      { ...(v ?? {}), value: v?.value === null || v?.value === undefined ? "" : String(v.value) },
    ]),
  ) as T;
}
