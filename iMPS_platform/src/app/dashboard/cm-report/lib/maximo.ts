// Master data ของ Maximo ที่ฟอร์ม CM ใช้ (ผ่าน backend — ไม่ได้ยิง Maximo ตรงจากเบราว์เซอร์)
//   IN04 GET /cm-maximo/failure-codes  → failure class → problem → cause → remedy
//   IN08 GET /cm-maximo/labor          → รายชื่อช่างสำหรับมอบหมายงาน
//
// ตัวเลือกทุก dropdown ของฟอร์ม CM มาจาก Maximo ล้วน ไม่มีตาราง hardcode แล้ว
// backend cache ตารางไว้ใน MongoDB (sync ตอน start) ฟอร์มจึงไม่ได้ยิง Maximo ทุกครั้ง
import { useEffect, useState } from "react";
import { apiFetch } from "@/utils/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE || "";

export type MaximoCode = { code: string; description: string };
export type MaximoCause = MaximoCode & { remedies: MaximoCode[] };
export type MaximoProblem = MaximoCode & { causes: MaximoCause[] };
export type MaximoFailureClass = MaximoCode & { problems: MaximoProblem[] };

/** บทบาทของ failure class — หน้า open ใช้เลือกว่าสถานีนี้ควรเห็นตัวไหน */
export type FailureClassRoles = { dc: string; ac: string; station: string };

export type FailureCodeTree = {
  classes: MaximoFailureClass[];
  /** [failureClass, problem, cause, remedy] — แบนไว้ให้ค้นเร็ว */
  matrix: string[][];
  roles: FailureClassRoles;
  syncedAt: string | null;
  stale: boolean;
  error?: string | null;
};

export type MaximoPerson = {
  personid: string;
  displayname: string;
  email?: string;
  status?: string;
};

// ใบงานที่เปิดก่อนต่อ Maximo เก็บรหัสชุดเก่าของ iMPS ไว้ (DCCHARFC/ACCHARFC/STATFC)
// ใบใหม่เก็บรหัสจริงของ Maximo — ตารางนี้ทำให้ใบเก่ายังหา option ใน Maximo เจอ
const IMPS_TO_MAXIMO_CLASS: Record<string, string> = {
  DCCHARFC: "DCCHARGER",
  ACCHARFC: "ACCHARGER",
  STATFC: "STATION",
};
/** รหัสของฟอร์ม (เก่าหรือใหม่) → รหัส failure class ของ Maximo */
export const maximoClassOf = (faultyEquipment: string): string => {
  const code = (faultyEquipment || "").trim().toUpperCase();
  return IMPS_TO_MAXIMO_CLASS[code] || code;
};

const DEFAULT_ROLES: FailureClassRoles = {
  dc: "DCCHARGER", ac: "ACCHARGER", station: "STATION",
};

const EMPTY_TREE: FailureCodeTree = {
  classes: [], matrix: [], roles: DEFAULT_ROLES, syncedAt: null, stale: false,
};

/** ตาราง failure code จาก Maximo — ล้มเหลวคืนโครงว่าง ให้ผู้เรียก fallback เอง */
export async function fetchFailureCodes(refresh = false): Promise<FailureCodeTree> {
  try {
    const res = await apiFetch(
      `${API_BASE}/cm-maximo/failure-codes${refresh ? "?refresh=1" : ""}`,
      { credentials: "include" },
    );
    if (!res.ok) return EMPTY_TREE;
    const data = await res.json();
    return {
      classes: Array.isArray(data.classes) ? data.classes : [],
      matrix: Array.isArray(data.matrix) ? data.matrix : [],
      roles: { ...DEFAULT_ROLES, ...(data.roles ?? {}) },
      syncedAt: data.syncedAt ?? null,
      stale: !!data.stale,
      error: data.error ?? null,
    };
  } catch {
    return EMPTY_TREE;
  }
}

/** รายชื่อช่างฝั่ง Maximo (IN08) */
export async function fetchMaximoLabor(refresh = false): Promise<MaximoPerson[]> {
  try {
    const res = await apiFetch(
      `${API_BASE}/cm-maximo/labor${refresh ? "?refresh=1" : ""}`,
      { credentials: "include" },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

// ==================== ตัวช่วยทำ dropdown ต่อกัน ====================

const findClass = (tree: FailureCodeTree, faultyEquipment: string) =>
  tree.classes.find((c) => c.code === maximoClassOf(faultyEquipment));

/** ปัญหาที่เลือกได้ภายใต้ FAILURECODE นี้ */
export function maximoProblemOptions(
  tree: FailureCodeTree, faultyEquipment: string,
): MaximoCode[] | null {
  const cls = findClass(tree, faultyEquipment);
  if (!cls?.problems?.length) return null;
  return cls.problems.map(({ code, description }) => ({ code, description }));
}

/** สาเหตุภายใต้ปัญหาที่เลือก (รวมทุกปัญหาที่เลือกไว้) */
export function maximoCauseOptions(
  tree: FailureCodeTree, faultyEquipment: string, problems: string[],
): MaximoCode[] | null {
  const cls = findClass(tree, faultyEquipment);
  if (!cls) return null;
  const picked = new Set(problems.filter(Boolean));
  const out: MaximoCode[] = [];
  const seen = new Set<string>();
  for (const p of cls.problems) {
    if (picked.size && !picked.has(p.code)) continue;
    for (const c of p.causes) {
      if (seen.has(c.code)) continue;
      seen.add(c.code);
      out.push({ code: c.code, description: c.description });
    }
  }
  return out.length ? out : null;
}

/** การแก้ไข (remedy) ภายใต้ปัญหา+สาเหตุที่เลือก */
export function maximoRemedyOptions(
  tree: FailureCodeTree, faultyEquipment: string, problems: string[], causes: string[],
): MaximoCode[] | null {
  const cls = findClass(tree, faultyEquipment);
  if (!cls) return null;
  const pickedP = new Set(problems.filter(Boolean));
  const pickedC = new Set(causes.filter(Boolean));
  const out: MaximoCode[] = [];
  const seen = new Set<string>();
  for (const p of cls.problems) {
    if (pickedP.size && !pickedP.has(p.code)) continue;
    for (const c of p.causes) {
      if (pickedC.size && !pickedC.has(c.code)) continue;
      for (const r of c.remedies) {
        if (seen.has(r.code)) continue;
        seen.add(r.code);
        out.push({ code: r.code, description: r.description });
      }
    }
  }
  return out.length ? out : null;
}

// ==================== React hook ====================

// ตารางเดียวกันทั้งแอป — ฟอร์มใบงานมีหลายจุดที่ต้องใช้ ไม่ควรยิงซ้ำทุกจุด
let treeCache: FailureCodeTree | null = null;
let treePromise: Promise<FailureCodeTree> | null = null;

function loadTreeOnce(): Promise<FailureCodeTree> {
  if (treeCache) return Promise.resolve(treeCache);
  if (!treePromise) {
    treePromise = fetchFailureCodes().then((t) => {
      treeCache = t;
      treePromise = null;
      return t;
    });
  }
  return treePromise;
}

/** ตาราง failure code จาก Maximo — ระหว่างรอโหลดคืนโครงว่าง (dropdown จะขึ้นทีหลัง) */
export function useMaximoFailureTree(): FailureCodeTree {
  const [tree, setTree] = useState<FailureCodeTree>(treeCache ?? EMPTY_TREE);
  useEffect(() => {
    let alive = true;
    loadTreeOnce().then((t) => { if (alive) setTree(t); });
    return () => { alive = false; };
  }, []);
  return tree;
}

export type SelectOption = { value: string; label: string };

/**
 * failure class นี้เป็นของตู้ DC / ตู้ AC / ระดับสถานี — หรือไม่เข้าพวกเลย (null)
 *
 * ฟอร์มซ่อมใช้ตัดสินว่าจะไปดึงรายการอุปกรณ์จากตู้ไหน รับได้ทั้งรหัส Maximo
 * และรหัสชุดเก่าของ iMPS (ใบงานเดิมใน DB)
 */
export function failureClassRole(
  tree: FailureCodeTree, faultyEquipment: string,
): "dc" | "ac" | "station" | null {
  const code = maximoClassOf(faultyEquipment);
  const { dc, ac, station } = tree.roles;
  if (code === dc) return "dc";
  if (code === ac) return "ac";
  if (code === station) return "station";
  return null;
}

/**
 * ตัวเลือก "อุปกรณ์ที่เสียหาย" (FAILURECODE) ของหน้า open
 *
 * กรองตามชนิดตู้ที่สถานีนั้นมีจริง — สถานีที่มีแต่ตู้ DC ไม่ต้องเห็น AC Charger Failure
 * ส่วน class ระดับสถานีโชว์เสมอ. Maximo ยังไม่พร้อมคืน null ให้ผู้เรียก fallback
 */
export function failureClassOptions(
  tree: FailureCodeTree,
  opts: { hasDC: boolean; hasAC: boolean },
): SelectOption[] | null {
  if (!tree.classes.length) return null;
  const { dc, ac, station } = tree.roles;
  const out: SelectOption[] = [];
  for (const c of tree.classes) {
    const code = (c.code || "").toUpperCase();
    if (code === dc && !opts.hasDC) continue;
    if (code === ac && !opts.hasAC) continue;
    out.push({ value: c.code, label: c.description || c.code });
  }
  // คงลำดับเดิมที่ผู้ใช้ชินอยู่: DC → AC → อื่น ๆ → ระดับสถานีท้ายสุด
  // (Maximo คืนมาแบบไม่เรียง)
  const rank = (v: string) => {
    const code = v.toUpperCase();
    if (code === dc) return 0;
    if (code === ac) return 1;
    return code === station ? 3 : 2;
  };
  out.sort((a, b) => rank(a.value) - rank(b.value));
  return out.length ? out : null;
}

// ==================== ค้นป้ายชื่อจากรหัส (เรียกได้นอก React) ====================

// รหัส → คำอธิบาย ประกอบจากต้นไม้ที่โหลดมาแล้ว
// ใช้ในจุดที่เป็นฟังก์ชันธรรมดา (การ์ดประวัติ, สรุปใบงาน) ซึ่งใช้ hook ไม่ได้
let labelIndex: Map<string, string> | null = null;

function buildLabelIndex(tree: FailureCodeTree): Map<string, string> {
  const m = new Map<string, string>();
  for (const cls of tree.classes) {
    m.set(cls.code, cls.description || cls.code);
    for (const p of cls.problems) {
      m.set(p.code, p.description || p.code);
      for (const c of p.causes) {
        m.set(c.code, c.description || c.code);
        for (const r of c.remedies) m.set(r.code, r.description || r.code);
      }
    }
  }
  return m;
}

/**
 * รหัส Maximo → คำอธิบาย (ใช้ได้กับทั้ง problem / cause / remedy / failure class)
 *
 * อ่านจากต้นไม้ที่ hook โหลดไว้แล้ว — ยังโหลดไม่เสร็จหรือเป็นค่าที่ผู้ใช้พิมพ์เอง
 * จะคืนค่าเดิมกลับไป (ตารางจึงไม่เคยว่าง แค่แสดงเป็นรหัสชั่วคราว)
 */
export function maximoCodeLabel(code?: string | null): string {
  const key = (code || "").trim();
  if (!key) return "";
  if (!labelIndex && treeCache) labelIndex = buildLabelIndex(treeCache);
  return labelIndex?.get(key) ?? key;
}
