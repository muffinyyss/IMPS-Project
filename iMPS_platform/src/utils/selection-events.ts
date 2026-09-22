"use client";

/**
 * แหล่งเดียวของ event "ตู้/สถานีที่เลือกอยู่เปลี่ยนไปแล้ว"
 *
 * เดิมหลายที่แก้ปัญหานี้ด้วย setInterval (routes.jsx ทุก 500 ms, navbar ทุก 1 s,
 * useStation ทุก 3 s) เพราะมีช่องโหว่ 2 อย่างที่ event ปกติจับไม่ได้:
 *   1. Next.js เปลี่ยน URL ด้วย history.pushState ซึ่งไม่ยิง "popstate"
 *   2. localStorage.setItem/removeItem ใน tab เดียวกันไม่ยิง "storage"
 * ที่นี่จึง patch ทั้งสองอย่าง "ครั้งเดียวต่อหน้า" แล้วแจ้งผู้ติดตาม — ไม่ต้องเดินนาฬิกาทิ้งไว้
 *
 * patch ติดตั้งระดับ module (อายุเท่าหน้าเว็บ) ไม่ถอดตอน component unmount
 * เพราะถ้าถอด ผู้ติดตามรายอื่นจะเงียบไปด้วย ซึ่งเป็นเหตุผลเดิมที่ต้องมี polling fallback
 */

const EVENT = "imps:selection-change";

/** คีย์ที่บอกว่า "เลือกตู้/สถานีไหนอยู่" — ตรงกับที่ dashboard-navbar เคยเฝ้า */
const WATCHED_KEYS = [
  "selected_sn",
  "selected_station_id",
  "selected_station_name",
  "selected_charger_no",
];

let installed = false;

function emit() {
  window.dispatchEvent(new Event(EVENT));
}

/** ยิง "localStorageChange" ต่อ เพื่อไม่ให้ผู้ฟังเดิม (test-report, ai/useStation) เงียบไป */
function emitLegacy(key: string, value: string | null) {
  window.dispatchEvent(new CustomEvent("localStorageChange", { detail: { key, value } }));
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // ── URL: pushState/replaceState ไม่ยิง event ในตัวเอง ──
  const patchHistory = (name: "pushState" | "replaceState") => {
    const original = history[name];
    history[name] = function (this: History, ...args: unknown[]) {
      const result = (original as (...a: unknown[]) => unknown).apply(this, args);
      emit();
      return result;
    } as History[typeof name];
  };
  patchHistory("pushState");
  patchHistory("replaceState");

  // ── localStorage: การเขียนใน tab เดียวกันไม่ยิง "storage" ──
  const setItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key: string, value: string) => {
    setItem(key, value);
    if (WATCHED_KEYS.includes(key)) { emitLegacy(key, value); emit(); }
  };
  const removeItem = localStorage.removeItem.bind(localStorage);
  localStorage.removeItem = (key: string) => {
    removeItem(key);
    if (WATCHED_KEYS.includes(key)) { emitLegacy(key, null); emit(); }
  };

  // ── event ที่โค้ดเดิมยิง/เบราว์เซอร์ยิงอยู่แล้ว ──
  for (const name of ["popstate", "charger:selected", "charger:deselected", "station:selected"]) {
    window.addEventListener(name, emit);
  }

  // แก้จาก tab อื่น — สนใจเฉพาะคีย์ที่เกี่ยวกับการเลือกตู้ ไม่ใช่ทุกคีย์ใน localStorage
  window.addEventListener("storage", (e) => {
    if (!e.key || WATCHED_KEYS.includes(e.key)) emit();
  });
}

/** ติดตามการเปลี่ยนตู้/สถานีที่เลือก — คืนฟังก์ชันเลิกติดตาม (ใช้ใน cleanup ของ useEffect) */
export function onSelectionChange(callback: () => void): () => void {
  if (typeof window === "undefined") return () => { };
  install();
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}
