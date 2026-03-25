"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { aiApi, MonitorOverviewResponse, StationRow } from "../lib/api";
import { MODULES, getHealthColor, getHealthGrade } from "../lib/constants";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { HealthPill, GradeBadge, CoverageBar } from "../components/ui";
import "../ai-theme.css";
import { useStation } from "../hooks/useStation";
import { ChevronUpDownIcon } from "@heroicons/react/24/solid";

function KpiSummaryCards({ data }: { data: MonitorOverviewResponse | null }) {
    const cards = [
        { label: "Total Stations", value: data?.total ?? "—", valueStyle: { color: "#fff" }, iconBg: "rgba(255,255,255,.10)", iconRing: "rgba(255,255,255,.15)", icon: <span className="tw-text-base">📍</span> },
        { label: "Full Coverage", value: data?.full_coverage ?? "—", valueStyle: { color: "#34d399" }, iconBg: "rgba(16,185,129,.15)", iconRing: "rgba(52,211,153,.25)", icon: (<span className="tw-relative tw-flex tw-h-2.5 tw-w-2.5"><span className="tw-animate-ping tw-absolute tw-inline-flex tw-h-full tw-w-full tw-rounded-full tw-opacity-75" style={{ background: "#34d399" }} /><span className="tw-relative tw-inline-flex tw-rounded-full tw-h-2.5 tw-w-2.5" style={{ background: "#34d399" }} /></span>) },
        { label: "Partial", value: data?.partial ?? "—", valueStyle: { color: "#fbbf24" }, iconBg: "rgba(234,179,8,.15)", iconRing: "rgba(251,191,36,.25)", icon: <span className="tw-text-base">⚠️</span> },
        { label: "No Data", value: data?.no_data ?? "—", valueStyle: { color: "#f87171" }, iconBg: "rgba(239,68,68,.15)", iconRing: "rgba(248,113,113,.25)", icon: <span className="tw-h-2.5 tw-w-2.5 tw-rounded-full tw-inline-block" style={{ background: "#f87171" }} /> },
    ];
    return (
        <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-4 tw-gap-2 sm:tw-gap-2.5 tw-mb-4 sm:tw-mb-5">
            {cards.map((card) => (
                <div key={card.label}
                    className="tw-group tw-relative tw-overflow-hidden tw-rounded-xl sm:tw-rounded-2xl tw-bg-gradient-to-br tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-3 sm:tw-px-5 tw-py-3 sm:tw-py-4 tw-ring-1 tw-ring-white/10 tw-shadow-lg hover:tw-shadow-xl tw-transition-all tw-duration-300 hover:tw--translate-y-0.5">
                    <div className="tw-absolute tw-inset-0 tw-opacity-[0.03] tw-pointer-events-none"
                        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
                    <div className="tw-relative tw-z-10">
                        <div className="tw-flex tw-items-center tw-gap-1.5 sm:tw-gap-2 tw-mb-2">
                            <div className="tw-h-7 tw-w-7 sm:tw-h-8 sm:tw-w-8 tw-rounded-lg sm:tw-rounded-xl tw-flex tw-items-center tw-justify-center tw-ring-1 tw-flex-shrink-0"
                                style={{ background: card.iconBg, boxShadow: `0 0 0 1px ${card.iconRing}` }}>{card.icon}</div>
                            <span className="tw-text-[9px] sm:tw-text-[11px] tw-font-semibold tw-text-white/40 tw-uppercase tw-tracking-wider tw-leading-tight">{card.label}</span>
                        </div>
                        <div className="tw-text-2xl sm:tw-text-3xl tw-font-black tw-tabular-nums tw-tracking-tight tw-leading-none" style={card.valueStyle}>{card.value}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function StationCard({ row }: { row: StationRow }) {
    const h = typeof row.system_health === "number" ? row.system_health : (row.system_health as any)?.health ?? null;
    const hColor = h == null ? "#9ca3af" : h >= 75 ? "#059669" : h >= 50 ? "#d97706" : "#dc2626";
    const topBar = h == null ? "#e5e7eb" : h >= 75 ? "#22c55e" : h >= 50 ? "#eab308" : "#ef4444";
    return (
        <div className="tw-bg-white tw-rounded-xl tw-border tw-border-gray-100 tw-shadow-sm tw-overflow-hidden">
            <div style={{ height: 3, background: topBar }} />
            <div className="tw-p-3">
                <div className="tw-flex tw-items-center tw-justify-between tw-mb-2.5">
                    <div className="tw-flex tw-items-center tw-gap-2 tw-min-w-0">
                        <div className="tw-h-8 tw-w-8 tw-rounded-lg tw-bg-gradient-to-br tw-from-blue-500 tw-to-indigo-600 tw-flex tw-items-center tw-justify-center tw-shadow-sm tw-flex-shrink-0">
                            <span className="tw-text-white tw-text-xs tw-font-bold">{row.name?.charAt(0)?.toUpperCase()}</span>
                        </div>
                        <div className="tw-min-w-0">
                            <div className="tw-font-semibold tw-text-gray-800 tw-text-sm tw-truncate">{row.name}</div>
                            <div className="tw-text-[10px] tw-text-gray-400 tw-font-mono tw-truncate">{row.sn}{row.province ? ` · ${row.province}` : ""}</div>
                        </div>
                    </div>
                    <div className="tw-flex tw-items-center tw-gap-1.5 tw-flex-shrink-0 tw-ml-2">
                        <GradeBadge health={h} />
                        <span className="tw-text-sm tw-font-black tw-tabular-nums" style={{ color: hColor }}>{h ?? "—"}%</span>
                    </div>
                </div>
                <div className="tw-grid tw-grid-cols-7 tw-gap-1 tw-mb-2.5">
                    {MODULES.map((mod) => {
                        const raw = row.modules?.[mod.key];
                        const val = typeof raw === "number" ? raw : (raw as any)?.health ?? null;
                        return (
                            <div key={mod.key} className="tw-flex tw-flex-col tw-items-center tw-gap-0.5">
                                <HealthPill value={val} />
                                <span className="tw-text-[8px] tw-text-gray-400">M{mod.num}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                    <div className="tw-flex-1"><CoverageBar ok={row.ok_count} /></div>
                    <span className="tw-text-[10px] tw-text-gray-400 tw-whitespace-nowrap tw-flex-shrink-0">
                        {row.updated ? new Date(row.updated).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </span>
                </div>
            </div>
        </div>
    );
}

type FilterType = "all" | "full" | "partial" | "none";

export default function MonitorPage() {
    const [overview, setOverview]   = useState<MonitorOverviewResponse | null>(null);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState("");
    const [search, setSearch]       = useState("");
    const [filter, setFilter]       = useState<FilterType>("all");
    const [sortKey, setSortKey]     = useState<string>("system_health");
    const [sortAsc, setSortAsc]     = useState(false);
    const [viewMode, setViewMode]   = useState<"table" | "card">("table");

    const { tick, countdown, refresh } = useAutoRefresh(120);
    const { activeSn } = useStation();

    const loadData = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await aiApi.monitorOverview();
            const normalized = {
                stations: Array.isArray(res.stations) ? res.stations : (res as any)?.stations ?? [],
                total:          (res as any)?.summary?.total_stations ?? (res as any)?.total ?? 0,
                full_coverage:  (res as any)?.summary?.full_coverage ?? 0,
                partial:        (res as any)?.summary?.partial ?? 0,
                no_data:        (res as any)?.summary?.no_data ?? 0,
            } as MonitorOverviewResponse;
            setOverview(normalized);
            setLastUpdate(new Date().toLocaleTimeString("th-TH"));
        } catch { setError("ไม่สามารถโหลดข้อมูล Station Monitor ได้"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [tick, loadData]);

    const rows: StationRow[] = useMemo(() => {
        const raw = Array.isArray(overview?.stations) ? overview!.stations : [];
        const filtered = raw.filter((s) => {
            const matchSearch = !search || s.sn.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase()) || (s.province ?? "").toLowerCase().includes(search.toLowerCase());
            const matchFilter = filter === "all" ? true : filter === "full" ? s.ok_count === 7 : filter === "partial" ? s.ok_count > 0 && s.ok_count < 7 : s.ok_count === 0;
            return matchSearch && matchFilter;
        });
        return [...filtered].sort((a, b) => {
            let av: number | string = 0, bv: number | string = 0;
            if (sortKey === "system_health") { av = a.system_health ?? -1; bv = b.system_health ?? -1; }
            else if (sortKey === "ok_count") { av = a.ok_count; bv = b.ok_count; }
            else if (sortKey === "name") { av = a.name; bv = b.name; }
            else if (MODULES.some((m) => m.key === sortKey)) {
                const aR = a.modules?.[sortKey]; const bR = b.modules?.[sortKey];
                av = typeof aR === "number" ? aR : (aR as any)?.health ?? -1;
                bv = typeof bR === "number" ? bR : (bR as any)?.health ?? -1;
            }
            if (av < bv) return sortAsc ? -1 : 1;
            if (av > bv) return sortAsc ? 1 : -1;
            return 0;
        });
    }, [overview, search, filter, sortKey, sortAsc]);

    const handleSort = (key: string) => { if (sortKey === key) setSortAsc((v) => !v); else { setSortKey(key); setSortAsc(false); } };
    const SortIcon = ({ col }: { col: string }) => sortKey === col ? <span className="tw-ml-0.5" style={{ color: "#eab308" }}>{sortAsc ? "↑" : "↓"}</span> : <ChevronUpDownIcon className="tw-h-3 tw-w-3 tw-text-white/40 tw-ml-0.5" />;

    return (
        <div className="ai-root tw-min-h-screen">
            <div className="tw-p-3 sm:tw-p-4 lg:tw-p-6">
                {error && <div className="tw-mb-4 tw-p-3 sm:tw-p-4 tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-xl tw-text-red-700 tw-text-sm">⚠ {error}</div>}

                <KpiSummaryCards data={overview} />

                {/* Toolbar */}
                <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-gap-3 tw-mb-4">
                    <input className="tw-flex-1 tw-px-3 sm:tw-px-4 tw-py-2 tw-text-sm tw-border tw-border-gray-200 tw-rounded-xl tw-outline-none focus:tw-border-gray-900 tw-bg-white"
                        placeholder="🔍 ค้นหาชื่อสถานี, SN หรือจังหวัด..."
                        value={search} onChange={(e) => setSearch(e.target.value)} />
                    <div className="tw-flex tw-items-center tw-gap-2">
                        <select className="tw-flex-1 sm:tw-flex-none tw-px-3 sm:tw-px-4 tw-py-2 tw-text-sm tw-border tw-border-gray-200 tw-rounded-xl tw-outline-none tw-bg-white tw-cursor-pointer"
                            value={filter} onChange={(e) => setFilter(e.target.value as FilterType)}>
                            <option value="all">All Stations</option>
                            <option value="full">Full Coverage (7/7)</option>
                            <option value="partial">Partial Coverage</option>
                            <option value="none">No Data</option>
                        </select>
                        {/* View toggle */}
                        <div className="tw-flex tw-gap-0.5 tw-bg-gray-100 tw-rounded-lg tw-p-0.5">
                            <button onClick={() => setViewMode("table")} className="tw-px-2.5 tw-py-1.5 tw-text-xs tw-rounded-md tw-font-bold tw-transition-all" style={viewMode === "table" ? { background: "#111827", color: "#fff" } : { color: "#6b7280" }}>☰ <span className="tw-hidden sm:tw-inline">Table</span></button>
                            <button onClick={() => setViewMode("card")} className="tw-px-2.5 tw-py-1.5 tw-text-xs tw-rounded-md tw-font-bold tw-transition-all" style={viewMode === "card" ? { background: "#111827", color: "#fff" } : { color: "#6b7280" }}>⊞ <span className="tw-hidden sm:tw-inline">Cards</span></button>
                        </div>
                        <button onClick={refresh} className="tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-text-xs tw-font-bold tw-bg-gray-900 hover:tw-bg-black tw-text-white tw-rounded-lg tw-transition-colors" style={{ fontFamily: "'JetBrains Mono', monospace" }}>↻ {countdown}s</button>
                        <span className="tw-text-xs tw-text-gray-400 tw-whitespace-nowrap tw-hidden sm:tw-inline">{rows.length} สถานี</span>
                    </div>
                </div>

                {viewMode === "card" ? (
                    loading ? (<div className="tw-flex tw-items-center tw-justify-center tw-h-40 tw-gap-3"><div className="tw-w-6 tw-h-6 tw-rounded-full tw-border-2 tw-border-gray-200 tw-border-t-gray-900 tw-animate-spin" /><span className="tw-text-sm tw-text-gray-400">กำลังโหลด...</span></div>)
                    : rows.length === 0 ? (<div className="tw-flex tw-items-center tw-justify-center tw-h-40 tw-text-gray-400 tw-text-sm">ไม่พบข้อมูลสถานี</div>)
                    : (<div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 xl:tw-grid-cols-4 tw-gap-3">{rows.map((row) => <StationCard key={row.sn} row={row} />)}</div>)
                ) : (
                    <div className="tw-border tw-border-gray-100 tw-shadow-sm tw-rounded-2xl tw-overflow-hidden">
                        <div className="tw-overflow-x-auto" style={{ maxHeight: "calc(100vh - 320px)", overflowY: "auto" }}>
                            {loading ? (
                                <table className="tw-w-full tw-border-separate tw-border-spacing-0">
                                    <thead className="tw-bg-gradient-to-r tw-from-gray-900 tw-to-gray-800"><tr>{Array.from({ length: 11 }).map((_, i) => (<th key={i} className="tw-px-3 tw-py-3"><div className="tw-h-3 tw-rounded tw-bg-white/20 tw-animate-pulse" style={{ width: i === 1 ? 80 : 36 }} /></th>))}</tr></thead>
                                    <tbody>{Array.from({ length: 5 }).map((_, i) => (<tr key={i} className="tw-animate-pulse">{Array.from({ length: 11 }).map((_, j) => (<td key={j} className="tw-px-3 tw-py-4"><div className="tw-h-4 tw-rounded-md tw-bg-gray-100" style={{ width: j === 0 ? 24 : "60%" }} /></td>))}</tr>))}</tbody>
                                </table>
                            ) : rows.length === 0 ? (<div className="tw-flex tw-items-center tw-justify-center tw-h-40 tw-text-gray-400 tw-text-sm">ไม่พบข้อมูลสถานี</div>)
                            : (
                                <table className="tw-w-full tw-border-separate tw-border-spacing-0">
                                    <thead className="tw-bg-gradient-to-r tw-from-gray-900 tw-to-gray-800 tw-sticky tw-top-0 tw-z-10">
                                        <tr>
                                            <th className="tw-px-3 sm:tw-px-4 tw-py-3 tw-text-left"><span className="tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-wider tw-text-white/60">#</span></th>
                                            <th className="tw-px-3 sm:tw-px-4 tw-py-3 tw-text-left tw-cursor-pointer" onClick={() => handleSort("name")}><span className="tw-flex tw-items-center tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-wider tw-text-white/80">Station <SortIcon col="name" /></span></th>
                                            {MODULES.map((mod) => (<th key={mod.key} className="tw-px-1 sm:tw-px-2 tw-py-3 tw-text-center tw-cursor-pointer tw-whitespace-nowrap" onClick={() => handleSort(mod.key)}><span className="tw-flex tw-items-center tw-justify-center tw-text-[11px] tw-font-bold tw-text-white/80"><span style={{ color: mod.color }}>{mod.icon}</span><span className="tw-hidden sm:tw-inline tw-ml-0.5">M</span>{mod.num}<SortIcon col={mod.key} /></span></th>))}
                                            <th className="tw-px-3 sm:tw-px-4 tw-py-3 tw-text-center tw-cursor-pointer" onClick={() => handleSort("system_health")}><span className="tw-flex tw-items-center tw-justify-center tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-wider tw-text-white/80">Health <SortIcon col="system_health" /></span></th>
                                            <th className="tw-px-3 sm:tw-px-4 tw-py-3 tw-text-left tw-cursor-pointer" onClick={() => handleSort("ok_count")}><span className="tw-flex tw-items-center tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-wider tw-text-white/80">Cover <SortIcon col="ok_count" /></span></th>
                                            <th className="tw-px-3 sm:tw-px-4 tw-py-3 tw-text-left tw-hidden lg:tw-table-cell"><span className="tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-wider tw-text-white/60">Updated</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, idx) => (
                                            <tr key={row.sn} className="tw-transition-colors odd:tw-bg-white even:tw-bg-blue-gray-50/30 hover:tw-bg-blue-50/40 hover:tw-shadow-[inset_3px_0_0_0_#111827]">
                                                <td className="!tw-border-y !tw-border-x-0 tw-px-3 sm:tw-px-4 tw-py-2 sm:tw-py-3 tw-text-gray-400 tw-text-xs">{idx + 1}</td>
                                                <td className="!tw-border-y !tw-border-x-0 tw-px-3 sm:tw-px-4 tw-py-2 sm:tw-py-3">
                                                    <div className="tw-flex tw-items-center tw-gap-2">
                                                        <div className="tw-h-7 tw-w-7 sm:tw-h-8 sm:tw-w-8 tw-rounded-lg tw-bg-gradient-to-br tw-from-blue-500 tw-to-indigo-600 tw-flex tw-items-center tw-justify-center tw-shadow-sm tw-flex-shrink-0"><span className="tw-text-white tw-text-[10px] sm:tw-text-xs tw-font-bold">{row.name?.charAt(0)?.toUpperCase()}</span></div>
                                                        <div className="tw-min-w-0">
                                                            <div className="tw-font-semibold tw-text-gray-800 tw-text-xs sm:tw-text-sm tw-truncate tw-max-w-[100px] sm:tw-max-w-[160px] lg:tw-max-w-none">{row.name}</div>
                                                            <div className="tw-text-[10px] tw-text-gray-400 tw-font-mono tw-hidden sm:tw-block">{row.sn}{row.province ? ` · ${row.province}` : ""}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {MODULES.map((mod) => { const raw = row.modules?.[mod.key]; const val = typeof raw === "number" ? raw : (raw as any)?.health ?? null; return (<td key={mod.key} className="!tw-border-y !tw-border-x-0 tw-px-1 sm:tw-px-2 tw-py-2 sm:tw-py-3 tw-text-center"><HealthPill value={val} /></td>); })}
                                                <td className="!tw-border-y !tw-border-x-0 tw-px-3 sm:tw-px-4 tw-py-2 sm:tw-py-3 tw-text-center">{(() => { const h = typeof row.system_health === "number" ? row.system_health : (row.system_health as any)?.health ?? null; return (<div className="tw-flex tw-items-center tw-justify-center tw-gap-1 sm:tw-gap-2"><GradeBadge health={h} /><span className="tw-text-xs tw-text-gray-500 tw-hidden sm:tw-inline">{h ?? "—"}%</span></div>); })()}</td>
                                                <td className="!tw-border-y !tw-border-x-0 tw-px-3 sm:tw-px-4 tw-py-2 sm:tw-py-3 tw-min-w-[70px]"><CoverageBar ok={row.ok_count} /></td>
                                                <td className="!tw-border-y !tw-border-x-0 tw-px-3 sm:tw-px-4 tw-py-2 sm:tw-py-3 tw-text-xs tw-text-gray-400 tw-whitespace-nowrap tw-hidden lg:tw-table-cell">{row.updated ? new Date(row.updated).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}