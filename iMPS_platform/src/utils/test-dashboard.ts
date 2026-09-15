/**
 * Test Dashboard / Test List — งาน Test = คำขอจากภายนอกที่ EGAT รับไปดำเนินการ
 * (เช่น บริษัทอื่นขอให้ EGAT ไปทดสอบ/ซ่อมตู้ชาร์จ EV)
 *
 * Source unique : GET /test-reports/all-stations (Test Report DC + AC de toutes les
 * stations). Pas de Maximo ici — ces demandes n'ont pas d'ordre de travail Maximo.
 *
 * Les lignes sont converties au format PmRow pour réutiliser tels quels les helpers
 * du PM Dashboard (étapes, buckets, filtres date/société/marque, graphe mensuel) :
 * les deux écrans comptent donc exactement de la même façon.
 */

import type { PmRow } from "./pm-dashboard";

export const TEST_LIST_ROUTE = "/dashboard/test-list";
export const TEST_DASHBOARD_ROUTE = "/dashboard/test-dashboard";

/** Plafond par collection accepté par l'endpoint */
export const TEST_LIMIT_PER_SOURCE = 200;

export const TEST_TYPES = ["DC", "AC"] as const;
export type TestType = (typeof TEST_TYPES)[number];

/** Une ligne telle que renvoyée par /test-reports/all-stations */
export type TestApiReport = {
  id: string;
  /** "report" = formulaire rempli dans iMPS · "upload" = PDF téléversé */
  source?: "report" | "upload";
  document_name?: string;
  issue_id?: string;
  test_type?: string;
  test_date?: string;
  status?: string;
  technician?: string;
  sn?: string;
  station_id?: string;
  station_name?: string;
  company?: string;
  charger_brand?: string;
  created_at?: string;
  file_url?: string;
};

export type TestRow = PmRow & { source?: "report" | "upload" };

export function toTestRow(r: TestApiReport): TestRow {
  const type = String(r.test_type ?? "").trim().toUpperCase();
  return {
    id: String(r.id ?? ""),
    kind: "report",
    source: r.source === "upload" ? "upload" : "report",
    document_name: r.document_name ?? "",
    issue_id: r.issue_id ?? "",
    pm_type: (TEST_TYPES as readonly string[]).includes(type) ? type : "DC",
    pm_date: r.test_date ?? "",
    status: r.status ?? "",
    technician: r.technician && r.technician !== "-" ? r.technician : "",
    sn: r.sn && r.sn !== "-" ? r.sn : "",
    station_id: r.station_id ?? "",
    station_name: r.station_name && r.station_name !== "-" ? r.station_name : "",
    company: r.company ?? "",
    charger_brand: r.charger_brand ?? "",
    created_at: r.created_at ?? "",
    file_url: r.file_url ?? "",
  };
}

/**
 * Lien PDF absolu. Le PDF généré (/pdf/dc|ac/<id>/export) a besoin de la langue et
 * de dl=0 pour s'ouvrir dans l'onglet — même règle que la table Test Report d'origine.
 */
export function testPdfHref(fileUrl: string | undefined, apiBase: string, lang: "th" | "en"): string {
  const raw = String(fileUrl ?? "").trim();
  if (!raw) return "";
  const abs = /^https?:\/\//i.test(raw) ? raw : `${apiBase}${raw.startsWith("/") ? "" : "/"}${raw}`;
  if (!/\/pdf\/(dc|ac)\/[A-Fa-f0-9]{24}\/export/.test(abs)) return abs;
  const url = new URL(abs);
  if (!url.searchParams.has("lang")) url.searchParams.set("lang", lang);
  if (!url.searchParams.has("dl")) url.searchParams.set("dl", "0");
  return url.toString();
}
