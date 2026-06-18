// CM report (All) — รวม CM report จากทุกสถานี (แท็บ Open / In Progress / Closed)
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Card, CardHeader, CardBody, CardFooter, Typography, Input,
  Tabs, TabsHeader, Tab, Button, Chip,
} from "@material-tailwind/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import { DocumentArrowDownIcon } from "@heroicons/react/24/outline";
import { apiFetch } from "@/utils/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

type Lang = "th" | "en";

type CMRow = {
  id: string;
  station_id: string;
  station_name: string;
  doc_name: string;
  issue_id: string;
  cm_date: string | null;
  reported_by: string;
  inspector: string;
  status: string;
  faulty_equipment: string;
  severity: string;
  location: string;
  createdAt: string | null;
  file_url: string;
};

type TabId = "open" | "in-progress" | "closed";

const TABS: { id: TabId; th: string; en: string }[] = [
  { id: "open", th: "เปิด", en: "Open" },
  { id: "in-progress", th: "กำลังดำเนินการ", en: "In Progress" },
  { id: "closed", th: "ปิด", en: "Closed" },
];

// normalize status string → tab bucket
function statusBucket(status: string): TabId | "other" {
  const s = (status || "").trim().toLowerCase().replace(/[_\s-]+/g, " ");
  if (s === "open") return "open";
  if (s === "in progress" || s === "inprogress") return "in-progress";
  if (s === "closed" || s === "close") return "closed";
  return "other";
}

function severityColor(sev: string): "red" | "amber" | "green" | "blue-gray" {
  const s = (sev || "").toLowerCase();
  if (s.includes("high") || s.includes("สูง")) return "red";
  if (s.includes("med") || s.includes("กลาง")) return "amber";
  if (s.includes("low") || s.includes("ต่ำ")) return "green";
  return "blue-gray";
}

const PAGE_SIZE = 10;

export default function CMReportAllPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [rows, setRows] = useState<CMRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [active, setActive] = useState<TabId>("open");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const saved = localStorage.getItem("app_language") as Lang | null;
    if (saved === "th" || saved === "en") setLang(saved);
    const onLang = (e: CustomEvent<{ lang: Lang }>) => setLang(e.detail.lang);
    window.addEventListener("language:change", onLang as EventListener);
    return () => window.removeEventListener("language:change", onLang as EventListener);
  }, []);

  useEffect(() => {
    let stop = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await apiFetch(`/cmreport/list-all`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!stop) setRows(Array.isArray(json?.items) ? json.items : []);
      } catch (e: any) {
        if (!stop) setErr(e?.message || "Failed to load");
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, []);

  const t = (th: string, en: string) => (lang === "th" ? th : en);

  const formatDate = (s: string | null) => {
    if (!s) return "-";
    try {
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      if (lang === "th") {
        const m = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
        return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear() + 543}`;
      }
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch { return s; }
  };

  // counts per tab
  const counts = useMemo(() => {
    const c: Record<TabId, number> = { open: 0, "in-progress": 0, closed: 0 };
    for (const r of rows) {
      const b = statusBucket(r.status);
      if (b !== "other") c[b] += 1;
    }
    return c;
  }, [rows]);

  // filter by tab + search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusBucket(r.status) !== active) return false;
      if (!q) return true;
      return [
        r.station_name, r.doc_name, r.issue_id, r.reported_by,
        r.inspector, r.faulty_equipment, r.location, r.severity,
      ].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [rows, active, search]);

  // reset page when tab/search changes
  useEffect(() => { setPage(1); }, [active, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const fileHref = (url: string) =>
    !url ? "" : url.startsWith("http") ? url : `${API_BASE}${url}`;

  const cols = [
    t("สถานี", "Station"),
    t("ชื่อเอกสาร", "Document"),
    t("Issue ID", "Issue ID"),
    t("วันที่พบ", "Found Date"),
    t("ผู้แจ้ง", "Reported By"),
    t("อุปกรณ์ที่เสีย", "Faulty Equipment"),
    t("ความรุนแรง", "Severity"),
    t("ไฟล์", "File"),
  ];

  return (
    <Card className="tw-h-full tw-w-full">
      <CardHeader floated={false} shadow={false} className="tw-rounded-none tw-px-2 tw-pt-4">
        <div className="tw-mb-4 tw-flex tw-flex-col tw-gap-1 sm:tw-flex-row sm:tw-items-center sm:tw-justify-between">
          <div>
            <Typography variant="h5" color="blue-gray">
              {t("รายงาน CM (ทุกสถานี)", "CM Report (All)")}
            </Typography>
            <Typography color="gray" className="tw-mt-1 tw-text-sm tw-font-normal">
              {t("รวมรายงานการซ่อมบำรุงเชิงแก้ไขจากทุกสถานี", "All corrective-maintenance reports across every station")}
            </Typography>
          </div>
          <div className="tw-w-full sm:tw-w-72">
            <Input
              label={t("ค้นหา", "Search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              crossOrigin={undefined}
            />
          </div>
        </div>

        <Tabs value={active} className="tw-w-full sm:tw-w-max">
          <TabsHeader>
            {TABS.map((tab) => (
              <Tab key={tab.id} value={tab.id} onClick={() => setActive(tab.id)}>
                <div className="tw-flex tw-items-center tw-gap-2">
                  {lang === "th" ? tab.th : tab.en}
                  <Chip
                    value={counts[tab.id]}
                    size="sm"
                    variant="ghost"
                    className="tw-rounded-full"
                  />
                </div>
              </Tab>
            ))}
          </TabsHeader>
        </Tabs>
      </CardHeader>

      <CardBody className="tw-overflow-x-auto tw-px-2 tw-py-2">
        <table className="tw-w-full tw-min-w-[820px] tw-table-auto tw-text-left">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c} className="tw-border-b tw-border-blue-gray-100 tw-bg-blue-gray-50/50 tw-p-3">
                  <Typography variant="small" color="blue-gray" className="tw-font-bold tw-leading-none">
                    {c}
                  </Typography>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={cols.length} className="tw-p-6 tw-text-center tw-text-blue-gray-400">{t("กำลังโหลด...", "Loading...")}</td></tr>
            ) : err ? (
              <tr><td colSpan={cols.length} className="tw-p-6 tw-text-center tw-text-red-500">{err}</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={cols.length} className="tw-p-6 tw-text-center tw-text-blue-gray-400">{t("ไม่พบรายงาน", "No reports found")}</td></tr>
            ) : (
              pageRows.map((r) => (
                <tr key={r.id} className="even:tw-bg-blue-gray-50/30 hover:tw-bg-blue-50/40">
                  <td className="tw-p-3"><Typography variant="small" className="tw-font-semibold tw-text-blue-gray-800">{r.station_name || r.station_id}</Typography></td>
                  <td className="tw-p-3"><Typography variant="small" className="tw-text-blue-gray-700">{r.doc_name || "-"}</Typography></td>
                  <td className="tw-p-3"><Typography variant="small" className="tw-text-blue-gray-600">{r.issue_id || "-"}</Typography></td>
                  <td className="tw-p-3"><Typography variant="small" className="tw-text-blue-gray-600">{formatDate(r.cm_date)}</Typography></td>
                  <td className="tw-p-3"><Typography variant="small" className="tw-text-blue-gray-600">{r.reported_by || "-"}</Typography></td>
                  <td className="tw-p-3"><Typography variant="small" className="tw-text-blue-gray-600">{r.faulty_equipment || "-"}</Typography></td>
                  <td className="tw-p-3">
                    {r.severity
                      ? <Chip size="sm" variant="ghost" color={severityColor(r.severity)} value={r.severity} className="tw-w-fit" />
                      : <span className="tw-text-blue-gray-300">-</span>}
                  </td>
                  <td className="tw-p-3">
                    {r.file_url ? (
                      <a href={fileHref(r.file_url)} target="_blank" rel="noreferrer" className="tw-inline-flex tw-items-center tw-gap-1 tw-text-blue-600 hover:tw-text-blue-800">
                        <DocumentArrowDownIcon className="tw-h-4 tw-w-4" />
                        <span className="tw-text-xs tw-font-medium">{t("ดาวน์โหลด", "Download")}</span>
                      </a>
                    ) : <span className="tw-text-blue-gray-300">-</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardBody>

      <CardFooter className="tw-flex tw-items-center tw-justify-between tw-border-t tw-border-blue-gray-50 tw-p-4">
        <Typography variant="small" color="blue-gray" className="tw-font-normal">
          {t("หน้า", "Page")} {page} {t("จาก", "of")} {totalPages} · {filtered.length} {t("รายการ", "items")}
        </Typography>
        <div className="tw-flex tw-gap-2">
          <Button variant="outlined" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="tw-flex tw-items-center tw-gap-1">
            <ChevronLeftIcon className="tw-h-4 tw-w-4" /> {t("ก่อนหน้า", "Prev")}
          </Button>
          <Button variant="outlined" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="tw-flex tw-items-center tw-gap-1">
            {t("ถัดไป", "Next")} <ChevronRightIcon className="tw-h-4 tw-w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
