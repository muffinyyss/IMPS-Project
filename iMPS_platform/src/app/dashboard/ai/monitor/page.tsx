"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { aiApi, MonitorOverviewResponse, StationRow } from "../lib/api";
import { MODULES, getHealthColor, getHealthGrade } from "../lib/constants";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { HealthPill, GradeBadge, CoverageBar, KpiCard } from "../components/ui";
import "../ai-theme.css";
import { useStation } from "../hooks/useStation";

// ── Sub-components ────────────────────────────────────────────────────────

function NavTabs() {
    const router = useRouter();
    const tabs = [
        { label: "📊 Dashboard", href: "/dashboard/ai" },
        { label: "📡 Station Monitor", href: "/dashboard/ai/monitor" },
        { label: "📈 Health History", href: "/dashboard/ai/history" },
        { label: "🎯 Heatmap", href: "/dashboard/ai/heatmap" },
    ];
    return (
        <div className="tw-bg-white tw-border-b tw-border-gray-100 tw-px-6">
            <nav className="tw-flex tw-gap-1">
                {tabs.map((t) => (
                    <button
                        key={t.href}
                        onClick={() => router.push(t.href)}
                        className={`tw-px-4 tw-py-2.5 tw-text-sm tw-border-b-2 tw-font-medium tw-transition-colors
              ${t.href === "/dashboard/ai/monitor"
                                ? "tw-border-blue-500 tw-text-blue-600"
                                : "tw-border-transparent tw-text-gray-500 hover:tw-text-gray-700"}`}
                    >
                        {t.label}
                    </button>
                ))}
            </nav>
        </div>
    );
}

function KpiSummaryCards({ data }: { data: MonitorOverviewResponse | null }) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
            <KpiCard label="Total Stations" value={data?.total ?? "—"} accentClass="blue" />
            <KpiCard label="Full Coverage" value={data?.full_coverage ?? "—"} accentClass="green" />
            <KpiCard label="Partial" value={data?.partial ?? "—"} accentClass="yellow" />
            <KpiCard label="No Data" value={data?.no_data ?? "—"} accentClass="red" />
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────

type FilterType = "all" | "full" | "partial" | "none";

export default function MonitorPage() {
    const [overview, setOverview] = useState<MonitorOverviewResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState("");

    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<FilterType>("all");
    const [sortKey, setSortKey] = useState<string>("system_health");
    const [sortAsc, setSortAsc] = useState(false);

    const { tick, countdown, refresh } = useAutoRefresh(120);
    const { activeSn, activeName } = useStation();

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await aiApi.monitorOverview();
            // ✅ API return { stations, summary, ... } → normalize ให้ตรง type
            const normalized = {
                stations: Array.isArray(res.stations) ? res.stations : (res as any)?.stations ?? [],
                total: (res as any)?.summary?.total_stations ?? (res as any)?.total ?? 0,
                full_coverage: (res as any)?.summary?.full_coverage ?? 0,
                partial: (res as any)?.summary?.partial ?? 0,
                no_data: (res as any)?.summary?.no_data ?? 0,
            } as MonitorOverviewResponse;
            setOverview(normalized);
            setLastUpdate(new Date().toLocaleTimeString("th-TH"));
        } catch {
            setError("ไม่สามารถโหลดข้อมูล Station Monitor ได้");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [tick, loadData]);

    // ── Filter + Sort ────────────────────────────────────────────
    const rows: StationRow[] = useMemo(() => {
        const raw = Array.isArray(overview?.stations) ? overview!.stations : [];

        const filtered = raw.filter((s) => {
            const matchSearch =
                !search ||
                s.sn.toLowerCase().includes(search.toLowerCase()) ||
                s.name.toLowerCase().includes(search.toLowerCase()) ||
                (s.province ?? "").toLowerCase().includes(search.toLowerCase());

            const matchFilter =
                filter === "all" ? true
                    : filter === "full" ? s.ok_count === 7
                        : filter === "partial" ? s.ok_count > 0 && s.ok_count < 7
                            : s.ok_count === 0;

            return matchSearch && matchFilter;
        });

        return [...filtered].sort((a, b) => {
            let av: number | string = 0;
            let bv: number | string = 0;

            if (sortKey === "system_health") {
                av = a.system_health ?? -1;
                bv = b.system_health ?? -1;
            } else if (sortKey === "ok_count") {
                av = a.ok_count;
                bv = b.ok_count;
            } else if (sortKey === "name") {
                av = a.name;
                bv = b.name;
            } else if (MODULES.some((m) => m.key === sortKey)) {
                const aRaw = a.modules?.[sortKey];
                const bRaw = b.modules?.[sortKey];
                av = typeof aRaw === "number" ? aRaw : (aRaw as any)?.health ?? -1;
                bv = typeof bRaw === "number" ? bRaw : (bRaw as any)?.health ?? -1;
            }

            if (av < bv) return sortAsc ? -1 : 1;
            if (av > bv) return sortAsc ? 1 : -1;
            return 0;
        });
    }, [overview, search, filter, sortKey, sortAsc]);

    const handleSort = (key: string) => {
        if (sortKey === key) setSortAsc((v) => !v);
        else { setSortKey(key); setSortAsc(false); }
    };

    const SortIcon = ({ col }: { col: string }) =>
        sortKey === col
            ? <span className="tw-ml-1 tw-text-blue-500">{sortAsc ? "↑" : "↓"}</span>
            : <span className="tw-ml-1 tw-text-gray-300">↕</span>;

    return (
        <div className="ai-root tw-min-h-screen" style={{ background: "var(--ai-bg)" }}>

            {/* Top bar */}
            <div className="tw-bg-white tw-border-b tw-border-gray-100 tw-px-6 tw-py-3
                      tw-flex tw-items-center tw-justify-between tw-gap-4">
                <div className="tw-flex tw-items-center tw-gap-3">
                    <span className="tw-font-semibold tw-text-gray-800">📡 Station Monitor</span>
                    <span className="tw-text-sm tw-text-gray-400">All stations health overview</span>
                    <div className="tw-w-px tw-h-4 tw-bg-gray-200" />
                    <div style={{ fontSize: ".78em", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>⚡</span>
                        <span style={{ fontWeight: 700 }}>{activeSn || "—"}</span>
                        {activeName && <span style={{ color: "var(--ai-dim)" }}>{activeName}</span>}
                    </div>
                </div>
                <div className="tw-flex tw-items-center tw-gap-3">
                    <button
                        onClick={refresh}
                        className="tw-flex tw-items-center tw-gap-1 tw-px-3 tw-py-1.5 tw-text-xs
                       tw-font-medium tw-border tw-border-gray-200 tw-rounded-lg hover:tw-bg-gray-50"
                    >
                        ↻ <span className="tw-text-gray-400">{countdown}s</span>
                    </button>
                    {lastUpdate && (
                        <span className="tw-text-xs tw-text-gray-400">อัปเดต {lastUpdate}</span>
                    )}
                </div>
            </div>

            <NavTabs />

            <div className="tw-p-6">
                {/* Error */}
                {error && (
                    <div className="tw-mb-4 tw-p-4 tw-bg-red-50 tw-border tw-border-red-200
                          tw-rounded-xl tw-text-red-700 tw-text-sm">
                        ⚠ {error}
                    </div>
                )}

                {/* KPI Summary */}
                <KpiSummaryCards data={overview} />

                {/* Search + Filter bar */}
                <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-3 tw-mb-4">
                    <input
                        className="tw-flex-1 tw-px-4 tw-py-2 tw-text-sm tw-border tw-border-gray-200
                       tw-rounded-xl tw-outline-none focus:tw-border-blue-400 tw-bg-white"
                        placeholder="🔍 ค้นหาชื่อสถานี, SN หรือจังหวัด..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <select
                        className="tw-px-4 tw-py-2 tw-text-sm tw-border tw-border-gray-200
                       tw-rounded-xl tw-outline-none tw-bg-white tw-cursor-pointer"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as FilterType)}
                    >
                        <option value="all">All Stations</option>
                        <option value="full">Full Coverage (7/7)</option>
                        <option value="partial">Partial Coverage</option>
                        <option value="none">No Data</option>
                    </select>
                    <span className="tw-self-center tw-text-sm tw-text-gray-400 tw-whitespace-nowrap">
                        แสดง {rows.length} สถานี
                    </span>
                </div>

                {/* Table */}
                <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm">
                    <div className="tw-overflow-x-auto" style={{ maxHeight: "calc(100vh - 320px)", overflowY: "auto" }}>
                        {loading ? (
                            <div className="tw-flex tw-items-center tw-justify-center tw-h-40 tw-gap-3">
                                <div className="tw-w-6 tw-h-6 tw-rounded-full tw-border-2 tw-border-gray-200
                              tw-border-t-blue-500 tw-animate-spin" />
                                <span className="tw-text-sm tw-text-gray-400">กำลังโหลด...</span>
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="tw-flex tw-items-center tw-justify-center tw-h-40 tw-text-gray-400 tw-text-sm">
                                ไม่พบข้อมูลสถานี
                            </div>
                        ) : (
                            <div className="tw-overflow-x-auto">
                                <table className="tw-w-full tw-text-sm">
                                    <thead>
                                        <tr className="tw-border-b tw-border-gray-100 tw-bg-gray-50 tw-text-xs tw-text-gray-500">
                                            <th className="tw-px-4 tw-py-3 tw-text-left tw-font-medium">#</th>
                                            <th
                                                className="tw-px-4 tw-py-3 tw-text-left tw-font-medium tw-cursor-pointer hover:tw-text-gray-700"
                                                onClick={() => handleSort("name")}
                                            >
                                                Station <SortIcon col="name" />
                                            </th>
                                            {MODULES.map((mod) => (
                                                <th
                                                    key={mod.key}
                                                    className="tw-px-2 tw-py-3 tw-text-center tw-font-medium tw-cursor-pointer
                                   hover:tw-text-gray-700 tw-whitespace-nowrap"
                                                    onClick={() => handleSort(mod.key)}
                                                >
                                                    <span style={{ color: mod.color }}>{mod.icon}</span> M{mod.num}
                                                    <SortIcon col={mod.key} />
                                                </th>
                                            ))}
                                            <th
                                                className="tw-px-4 tw-py-3 tw-text-center tw-font-medium tw-cursor-pointer hover:tw-text-gray-700"
                                                onClick={() => handleSort("system_health")}
                                            >
                                                Health <SortIcon col="system_health" />
                                            </th>
                                            <th
                                                className="tw-px-4 tw-py-3 tw-text-left tw-font-medium tw-cursor-pointer hover:tw-text-gray-700"
                                                onClick={() => handleSort("ok_count")}
                                            >
                                                Coverage <SortIcon col="ok_count" />
                                            </th>
                                            <th className="tw-px-4 tw-py-3 tw-text-left tw-font-medium">Updated</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, idx) => (
                                            <tr
                                                key={row.sn}
                                                className="tw-border-b tw-border-gray-50 hover:tw-bg-gray-50 tw-transition-colors"
                                            >
                                                {/* # */}
                                                <td className="tw-px-4 tw-py-3 tw-text-gray-400">{idx + 1}</td>

                                                {/* Station */}
                                                <td className="tw-px-4 tw-py-3">
                                                    <div className="tw-font-medium tw-text-gray-800">{row.name}</div>
                                                    <div className="tw-text-xs tw-text-gray-400">
                                                        {row.sn}{row.province ? ` · ${row.province}` : ""}
                                                    </div>
                                                </td>

                                                {/* M1–M7 pills */}
                                                {MODULES.map((mod) => {
                                                    const raw = row.modules?.[mod.key];
                                                    const val = typeof raw === "number" ? raw : (raw as any)?.health ?? null;
                                                    return (
                                                        <td key={mod.key} className="tw-px-2 tw-py-3 tw-text-center">
                                                            <HealthPill value={val} />   {/* ← import จาก ../components/ui */}
                                                        </td>
                                                    );
                                                })}

                                                {/* Health grade */}
                                                <td className="tw-px-4 tw-py-3 tw-text-center">
                                                    {(() => {
                                                        const h = typeof row.system_health === "number"
                                                            ? row.system_health
                                                            : (row.system_health as any)?.health ?? null;
                                                        return (
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                                                                <GradeBadge health={h} />
                                                                <span style={{ fontSize: ".75em", color: "var(--color-text-secondary,#718096)" }}>
                                                                    {h ?? "—"}%
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>

                                                {/* Coverage bar */}
                                                <td className="tw-px-4 tw-py-3">
                                                    <CoverageBar ok={row.ok_count} />
                                                </td>

                                                {/* Timestamp */}
                                                <td className="tw-px-4 tw-py-3 tw-text-xs tw-text-gray-400 tw-whitespace-nowrap">
                                                    {row.updated
                                                        ? new Date(row.updated).toLocaleString("th-TH", {
                                                            dateStyle: "short",
                                                            timeStyle: "short",
                                                        })
                                                        : "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}