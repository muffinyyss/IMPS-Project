/**
 * Export CSV des tables (PM List, CM List, Test List).
 *
 * On exporte les lignes APRÈS filtres, recherche et tri — toutes les pages, pas
 * seulement celle affichée — pour que le fichier corresponde à ce que l'écran annonce.
 */

export type CsvValue = string | number | null | undefined;

export type CsvColumn<T> = {
  header: string;
  value: (row: T, index: number) => CsvValue;
};

/** Début de cellule qu'Excel/Sheets interprète comme une formule */
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // กัน CSV injection: "=HYPERLINK(...)" ที่ช่างพิมพ์ลงช่องข้อความจะไม่กลายเป็นสูตรตอนเปิดไฟล์
  // (ตัวเลขติดลบกับเครื่องหมายเดี่ยว ๆ อย่าง "-" ไม่ใช่สูตร ปล่อยไว้ตามเดิม)
  if (s.length > 1 && FORMULA_START.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  rows.forEach((row, i) => {
    lines.push(columns.map((c) => csvCell(c.value(row, i))).join(","));
  });
  return lines.join("\r\n");
}

/** `pm-list-2026-09-14.csv` — date locale, celle que l'utilisateur a sous les yeux */
export function csvFilename(prefix: string, now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`;
}

/** Date "YYYY-MM-DD" (ou ISO) → "YYYY-MM-DD", vide si absente — format trié correctement par Excel */
export function csvDate(raw?: string | null): string {
  const s = String(raw ?? "").trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (m) return m[1];
  if (!s || s === "-") return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM UTF-8 : sans lui Excel ouvre le fichier en ANSI et le thaï devient illisible
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
