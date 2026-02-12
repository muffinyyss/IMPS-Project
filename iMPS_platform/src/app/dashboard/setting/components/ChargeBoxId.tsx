"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import Card from "./chargerSetting-card";
import { useSearchParams } from "next/navigation";

type ChargerInfoResponse = {
  station?: {
    SN?: string;
    station_id?: string;
    station_name?: string;
    chargeBoxID?: string;
    ocppUrl?: string;
    [key: string]: any;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function ChargeBoxId() {
  const [lang, setLang] = useState<"th" | "en">("en");
  useEffect(() => {
    const savedLang = localStorage.getItem("app_language") as "th" | "en" | null;
    if (savedLang === "th" || savedLang === "en") setLang(savedLang);
    const handleLangChange = (e: CustomEvent<{ lang: "th" | "en" }>) => { setLang(e.detail.lang); };
    window.addEventListener("language:change", handleLangChange as EventListener);
    return () => { window.removeEventListener("language:change", handleLangChange as EventListener); };
  }, []);

  const t = useMemo(() => {
    const translations = {
      th: {
        noStationSelected: "ยังไม่ได้เลือกสถานี",
        loading: "กำลังโหลด...",
        settings: "ตั้งค่า",
        chargerSettings: "ตั้งค่า OCPP",
        placeholderChargeBoxId: "เช่น CHARGER-001",
        placeholderOcppUrl: "เช่น ws://ocpp.example.com/CHARGER-001",
        savedSuccess: "บันทึกสำเร็จ",
        saveFailed: "บันทึกล้มเหลว",
        cancel: "ยกเลิก",
        saving: "กำลังบันทึก...",
        save: "บันทึก",
        edit: "แก้ไข",
      },
      en: {
        noStationSelected: "No station selected",
        loading: "Loading...",
        settings: "Settings",
        chargerSettings: "OCPP Settings",
        placeholderChargeBoxId: "e.g. CHARGER-001",
        placeholderOcppUrl: "e.g. ws://ocpp.example.com/CHARGER-001",
        savedSuccess: "Saved successfully",
        saveFailed: "Save failed",
        cancel: "Cancel",
        saving: "Saving...",
        save: "Save",
        edit: "Edit",
      },
    };
    return translations[lang];
  }, [lang]);

  const searchParams = useSearchParams();
  const [SN, setSN] = useState<string | null>(null);

  const [chargeBoxId, setChargeBoxId] = useState<string>("");
  const [ocppUrl, setOcppUrl] = useState<string>("");
  const [stationName, setStationName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editChargeBoxId, setEditChargeBoxId] = useState("");
  const [editOcppUrl, setEditOcppUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const snFromUrl = searchParams.get("SN");
    if (snFromUrl) {
      setSN(snFromUrl);
      if (typeof window !== "undefined") localStorage.setItem("selected_sn", snFromUrl);
      return;
    }
    const snLocal = typeof window !== "undefined" ? localStorage.getItem("selected_sn") : null;
    setSN(snLocal);
  }, [searchParams]);

  const fetchChargerInfo = async (signal?: AbortSignal) => {
    if (!SN) return;
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
      const res = await fetch(`${API_BASE}/charger/info?sn=${encodeURIComponent(SN)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: token ? "omit" : "include",
        signal,
      });
      if (res.status === 401) { if (typeof window !== "undefined") localStorage.removeItem("access_token"); throw new Error("Unauthorized"); }
      if (res.status === 403) throw new Error("Forbidden");
      if (res.status === 404) throw new Error("Charger not found");
      if (!res.ok) { let msg = `HTTP ${res.status}`; try { const j = await res.json(); msg = j.detail || j.message || msg; } catch {} throw new Error(msg); }
      const data: ChargerInfoResponse = await res.json();
      setChargeBoxId(data?.station?.chargeBoxID ?? "");
      setOcppUrl(data?.station?.ocppUrl ?? "");
      setStationName(data?.station?.station_name ?? "");
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message || "fetch failed");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!SN) return;
    const abort = new AbortController();
    fetchChargerInfo(abort.signal);
    return () => abort.abort();
  }, [SN]);

  useEffect(() => {
    if (!showModal) return;
    const handleClick = (e: MouseEvent) => { if (modalRef.current && !modalRef.current.contains(e.target as Node)) setShowModal(false); };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowModal(false); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [showModal]);

  const openModal = () => { setEditChargeBoxId(chargeBoxId); setEditOcppUrl(ocppUrl); setSaveMsg(null); setShowModal(true); };

  const handleSave = async () => {
    if (!SN) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
      const res = await fetch(`${API_BASE}/charger/setting`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: token ? "omit" : "include",
        body: JSON.stringify({ SN, chargeBoxID: editChargeBoxId.trim(), ocppUrl: editOcppUrl.trim() }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.detail || `HTTP ${res.status}`); }
      setSaveMsg({ type: "ok", text: t.savedSuccess });
      setChargeBoxId(editChargeBoxId.trim());
      setOcppUrl(editOcppUrl.trim());
      setTimeout(() => setShowModal(false), 800);
    } catch (e: any) {
      setSaveMsg({ type: "err", text: e?.message || t.saveFailed });
    } finally { setSaving(false); }
  };

  /* ── Icons ── */
  const SettingsIcon = () => (
    <svg className="tw-w-3.5 tw-h-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.062 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  );
  const PencilIcon = () => (
    <svg className="tw-w-3.5 tw-h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
      <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
    </svg>
  );
  const CloseIcon = () => (
    <svg className="tw-w-5 tw-h-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
  const PlugIcon = () => (
    <svg className="tw-w-4 tw-h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6m-3-3h6m-9 5h12a2 2 0 012 2v2a6 6 0 01-6 6h-4a6 6 0 01-6-6v-2a2 2 0 012-2z" />
    </svg>
  );
  const LinkIcon = () => (
    <svg className="tw-w-4 tw-h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
  const CheckIcon = () => (
    <svg className="tw-w-4 tw-h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
  const WarnIcon = () => (
    <svg className="tw-w-4 tw-h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );

  /* ── Render: Loading / Error / No SN ── */
  const renderLoading = () => (
    <div className="tw-flex tw-items-center tw-gap-2 tw-text-blue-gray-400 tw-text-sm">
      <span className="tw-w-4 tw-h-4 tw-border-2 tw-border-blue-gray-300 tw-border-t-transparent tw-rounded-full tw-animate-spin" />
      {t.loading}
    </div>
  );

  const renderError = () => (
    <div className="tw-text-red-500 tw-text-sm tw-font-medium">{error}</div>
  );

  const renderNoStation = () => (
    <div className="tw-text-blue-gray-400 tw-text-sm">{t.noStationSelected}</div>
  );

  return (
    <>
      {/* ─── Card: V4-style horizontal OCPP ─── */}
      <Card
        title={
          <div className="tw-flex tw-items-center tw-gap-2">
            <span className="tw-inline-flex tw-items-center tw-justify-center tw-w-7 tw-h-7 tw-rounded-lg tw-bg-purple-50 tw-text-purple-600">
              <SettingsIcon />
            </span>
            <span>OCPP Settings</span>
          </div>
        }
        right={
          SN && !loading && !error ? (
            <button
              onClick={openModal}
              title={t.chargerSettings}
              className="tw-inline-flex tw-items-center tw-gap-1.5
                         tw-px-3 tw-py-1.5 tw-rounded-md
                         tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide
                         tw-text-white tw-bg-gray-900
                         hover:tw-bg-gray-700 hover:tw-shadow-md hover:tw-shadow-black/20
                         tw-border tw-border-gray-700
                         tw-transition-all tw-duration-200 tw-whitespace-nowrap
                         active:tw-scale-[0.97]"
            >
              <SettingsIcon />
              {t.settings}
            </button>
          ) : null
        }
      >
        {!SN ? renderNoStation() : loading ? renderLoading() : error ? renderError() : (
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3">
            {/* Charge Box ID */}
            <div className="tw-flex-1 tw-min-w-[160px] tw-px-3.5 tw-py-2.5 tw-rounded-xl tw-bg-blue-gray-50/60 tw-border tw-border-blue-gray-100">
              <div className="tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-wider tw-text-blue-gray-400 tw-mb-1">
                Charge Box ID
              </div>
              <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-900 tw-break-all">
                {chargeBoxId || "—"}
              </div>
            </div>

            {/* OCPP URL */}
            <div className="tw-flex-1 tw-min-w-[160px] tw-px-3.5 tw-py-2.5 tw-rounded-xl tw-bg-blue-gray-50/60 tw-border tw-border-blue-gray-100">
              <div className="tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-wider tw-text-blue-gray-400 tw-mb-1">
                OCPP URL
              </div>
              <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-900 tw-break-all">
                {ocppUrl || "—"}
              </div>
            </div>

          </div>
        )}
      </Card>

      {/* ─── Modal ─── */}
      {showModal && (
        <div
          className="tw-fixed tw-inset-0 tw-z-[9999] tw-flex tw-items-center tw-justify-center tw-p-4"
          style={{ animation: "cbid-fade .2s ease-out" }}
        >
          <div className="tw-absolute tw-inset-0 tw-bg-black/40 tw-backdrop-blur-sm" />

          <div
            ref={modalRef}
            className="tw-relative tw-w-full tw-max-w-lg tw-overflow-hidden
                       tw-rounded-2xl tw-shadow-2xl
                       tw-bg-white tw-border tw-border-gray-200"
            style={{ animation: "cbid-slide .25s ease-out" }}
          >
            {/* Header */}
            <div className="tw-px-6 tw-pt-6 tw-pb-4">
              <div className="tw-flex tw-items-start tw-justify-between">
                <div>
                  <h3 className="tw-text-lg tw-font-bold tw-text-gray-900">
                    {t.chargerSettings}
                  </h3>
                  <p className="tw-mt-1 tw-text-sm tw-text-gray-500">
                    SN: <span className="tw-font-mono tw-text-gray-800">{SN}</span>
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="tw-p-1.5 tw-rounded-lg tw-text-gray-400
                             hover:tw-text-gray-600 hover:tw-bg-gray-100
                             tw-transition-all tw-duration-150"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="tw-mt-4 tw-h-px tw-bg-gradient-to-r tw-from-transparent tw-via-gray-200 tw-to-transparent" />
            </div>

            {/* Body */}
            <div className="tw-px-6 tw-pb-5 tw-space-y-5">
              {/* Charge Box ID */}
              <div>
                <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700 tw-mb-2">
                  <span className="tw-inline-flex tw-items-center tw-justify-center tw-w-7 tw-h-7 tw-rounded-lg tw-bg-blue-50 tw-text-blue-500">
                    <PlugIcon />
                  </span>
                  Charge Box ID
                </label>
                <input
                  type="text"
                  value={editChargeBoxId}
                  onChange={(e) => setEditChargeBoxId(e.target.value)}
                  className="tw-w-full tw-px-4 tw-py-2.5
                             tw-bg-gray-50 tw-border tw-border-gray-200
                             tw-rounded-xl tw-text-sm tw-text-gray-900 tw-font-mono
                             tw-placeholder-gray-400
                             focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500/30 focus:tw-border-blue-400
                             focus:tw-bg-white tw-transition-all tw-duration-200"
                  placeholder={t.placeholderChargeBoxId}
                />
              </div>

              {/* OCPP URL */}
              <div>
                <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700 tw-mb-2">
                  <span className="tw-inline-flex tw-items-center tw-justify-center tw-w-7 tw-h-7 tw-rounded-lg tw-bg-emerald-50 tw-text-emerald-500">
                    <LinkIcon />
                  </span>
                  OCPP URL
                </label>
                <input
                  type="text"
                  value={editOcppUrl}
                  onChange={(e) => setEditOcppUrl(e.target.value)}
                  className="tw-w-full tw-px-4 tw-py-2.5
                             tw-bg-gray-50 tw-border tw-border-gray-200
                             tw-rounded-xl tw-text-sm tw-text-gray-900 tw-font-mono
                             tw-placeholder-gray-400
                             focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500/30 focus:tw-border-blue-400
                             focus:tw-bg-white tw-transition-all tw-duration-200"
                  placeholder={t.placeholderOcppUrl}
                />
              </div>

              {/* Save Message */}
              {saveMsg && (
                <div
                  className={`tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2.5 tw-rounded-xl tw-text-sm tw-font-medium
                    ${saveMsg.type === "ok"
                      ? "tw-bg-emerald-50 tw-text-emerald-700 tw-border tw-border-emerald-200"
                      : "tw-bg-red-50 tw-text-red-700 tw-border tw-border-red-200"
                    }`}
                  style={{ animation: "cbid-fade .2s ease-out" }}
                >
                  {saveMsg.type === "ok" ? <CheckIcon /> : <WarnIcon />}
                  {saveMsg.text}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="tw-flex tw-items-center tw-justify-end tw-gap-3 tw-px-6 tw-py-4 tw-bg-gray-50 tw-border-t tw-border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="tw-px-4 tw-py-2 tw-text-sm tw-font-semibold tw-text-gray-600
                           tw-bg-white tw-border tw-border-gray-200 tw-rounded-xl
                           hover:tw-bg-gray-50 hover:tw-border-gray-300
                           tw-transition-all tw-duration-150
                           active:tw-scale-[0.97]"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="tw-px-5 tw-py-2 tw-text-sm tw-font-semibold tw-text-white
                           tw-bg-gray-900 tw-rounded-xl
                           hover:tw-bg-gray-700 hover:tw-shadow-lg hover:tw-shadow-gray-900/25
                           disabled:tw-opacity-50 disabled:tw-cursor-not-allowed
                           tw-transition-all tw-duration-200
                           active:tw-scale-[0.97]"
              >
                {saving ? (
                  <span className="tw-inline-flex tw-items-center tw-gap-2">
                    <span className="tw-w-3.5 tw-h-3.5 tw-border-2 tw-border-white tw-border-t-transparent tw-rounded-full tw-animate-spin" />
                    {t.saving}
                  </span>
                ) : (
                  t.save
                )}
              </button>
            </div>
          </div>

          <style>{`
            @keyframes cbid-fade { from { opacity: 0 } to { opacity: 1 } }
            @keyframes cbid-slide { from { opacity: 0; transform: translateY(12px) scale(.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
          `}</style>
        </div>
      )}
    </>
  );
}