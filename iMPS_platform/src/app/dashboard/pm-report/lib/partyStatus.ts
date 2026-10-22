// สรุปสถานะรายฝ่ายของใบ PM สถานีที่แบ่งงานหลายฝ่าย (2026-10-22)
//   สถานะหลักของใบยังเป็นชุดเดิม (In Progress / Wait for approve / Closed) ตรงกับ Maximo
//   บรรทัดรองบอกว่า "ติดอยู่ที่ใคร" — ข้อมูลจาก backend: parties[].state
//   (routers/pmreport_station_job.py → party_summaries / _party_state)

export type PartyState =
  | "not_started"   // ยังไม่กดเริ่ม PM และยังไม่ได้กรอกอะไร
  | "in_progress"   // กำลังกรอก
  | "ready"         // กรอกครบทุกส่วนแล้ว ยังไม่กด "ส่งงานของ <ฝ่าย>"
  | "rejected"      // มีฟอร์มของฝ่ายนี้โดนตีกลับ รอแก้
  | "vendor_review" // ส่งแล้ว รอ planner ของ vendor อนุมัติงานตู้ชาร์จ
  | "submitted";    // ส่งครบ (และผ่าน planner ของ vendor แล้ว ถ้าต้องผ่าน)

export type PartySummary = {
  key: string;
  name: string;
  state?: PartyState;
  /** จำนวนส่วนของฝ่ายนี้ที่ส่งแล้ว / ทั้งหมด */
  done?: number;
  total?: number;
};

type Lang = "th" | "en";

const TEXT = {
  th: {
    sent: "ส่งแล้ว {n}/{t} ฝ่าย",
    waiting: "รอ: ",
    ownTeam: "ทีมต้นทาง",
    state: {
      not_started: "{p} ยังไม่เริ่ม",
      in_progress: "{p} กรอก {d}/{t}",
      ready: "{p} รอกดส่งงาน",
      rejected: "{p} แก้ฟอร์มที่ตีกลับ",
      vendor_review: "planner {p} อนุมัติ",
      submitted: "{p} ส่งแล้ว",
    },
    chip: {
      not_started: "ยังไม่เริ่ม PM",
      in_progress: "กำลังกรอก {d}/{t}",
      ready: "กรอกครบ รอกดส่งงาน",
      rejected: "ตีกลับ รอแก้",
      vendor_review: "รอ planner {p} อนุมัติ",
      submitted: "ส่งแล้ว",
    },
  },
  en: {
    sent: "{n}/{t} parties submitted",
    waiting: "Waiting: ",
    ownTeam: "Origin team",
    state: {
      not_started: "{p} not started",
      in_progress: "{p} filling {d}/{t}",
      ready: "{p} to submit",
      rejected: "{p} fixing rejected form",
      vendor_review: "{p} planner approval",
      submitted: "{p} submitted",
    },
    chip: {
      not_started: "Not started",
      in_progress: "Filling {d}/{t}",
      ready: "Complete, not submitted",
      rejected: "Rejected, to fix",
      vendor_review: "Waiting for {p} planner",
      submitted: "Submitted",
    },
  },
} as const;

function fill(tpl: string, p: PartySummary, lang: Lang): string {
  return tpl
    .replace("{p}", partyName(p, lang))
    .replace("{d}", String(p.done ?? 0))
    .replace("{t}", String(p.total ?? 0));
}

export function partyName(p: PartySummary, lang: Lang): string {
  return (p.name || "").trim() || TEXT[lang].ownTeam;
}

/** ข้อความในชิปของฝ่าย (หน้ารวมใบ PM) */
export function partyChipText(p: PartySummary, lang: Lang): string {
  return p.state ? fill(TEXT[lang].chip[p.state], p, lang) : "";
}

/** สีของชิป/ข้อความตาม state — แดง = ต้องแก้, เหลือง = รอคนอื่น/รอส่ง, เขียว = เสร็จ */
export function partyTone(state?: PartyState): "red" | "amber" | "green" | "gray" {
  if (state === "rejected") return "red";
  if (state === "submitted") return "green";
  if (state === "vendor_review" || state === "ready" || state === "in_progress") return "amber";
  return "gray";
}

/** แสดงบรรทัดรองไหม — ใบหลายฝ่าย หรือฝ่ายเดียวที่ต้องรอ planner ของ vendor */
export function showPartyLine(parties?: PartySummary[]): boolean {
  if (!parties?.length || !parties.every((p) => !!p.state)) return false;
  return parties.length > 1 || parties.some((p) => p.state === "vendor_review");
}

/**
 * บรรทัดรองใต้สถานะหลัก เช่น "ส่งแล้ว 1/2 ฝ่าย · รอ: EDS กรอก 1/3"
 * คืน null = ไม่ต้องแสดง (ใบฝ่ายเดียว / ทุกฝ่ายส่งครบแล้ว / ข้อมูลไม่ครบ)
 */
export function partyLine(
  parties: PartySummary[] | undefined, lang: Lang,
): { text: string; tone: "red" | "amber" } | null {
  if (!showPartyLine(parties)) return null;
  const list = parties as PartySummary[];
  const pending = list.filter((p) => p.state !== "submitted");
  if (!pending.length) return null;
  const T = TEXT[lang];
  const parts: string[] = [];
  if (list.length > 1) {
    parts.push(T.sent.replace("{n}", String(list.length - pending.length)).replace("{t}", String(list.length)));
  }
  // ฝ่ายที่ต้องแก้ขึ้นก่อน แล้วตามด้วยที่รออนุมัติ / กำลังทำ / ยังไม่เริ่ม
  const order: PartyState[] = ["rejected", "vendor_review", "ready", "in_progress", "not_started"];
  const sorted = [...pending].sort(
    (a, b) => order.indexOf(a.state as PartyState) - order.indexOf(b.state as PartyState),
  );
  parts.push(T.waiting + sorted.map((p) => fill(T.state[p.state as PartyState], p, lang)).join(", "));
  return { text: parts.join(" · "), tone: pending.some((p) => p.state === "rejected") ? "red" : "amber" };
}
