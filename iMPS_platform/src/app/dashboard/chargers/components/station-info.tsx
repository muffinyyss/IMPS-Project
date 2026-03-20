"use client";
import { useEffect, useState, useRef, useCallback } from "react";

type Lang = "th" | "en";

export type CBMField = {
  key: string;
  label: string;
  unit?: string;
  sample_value?: any;
};

export type CBMDisplayItem = {
  key: string;
  label: string;
  unit: string;
  value?: number | string | null;
  status?: "normal" | "warning" | "critical";
};

export type StationInfoProps = {
  station_name?: string | null;
  model?: string | null;
  SN?: string | null;
  WO?: string | null;
  brand?: string | null;
  power?: string | null;
  status?: boolean | null;
  commissioningDate?: string | null;
  warrantyYears?: string | null;
  PLCFirmware?: string | null;
  PIFirmware?: string | null;
  RTFirmware?: string | null;
  chargerSN?: string | null;
  apiBaseUrl?: string;
  onAddSetting?: () => void;
};

// ===== Translations =====
const translations = {
  th: {
    stationInfo: "ข้อมูลสถานี",
    stationName: "ชื่อสถานี",
    brand: "ยี่ห้อ",
    serialNumber: "หมายเลขเครื่อง",
    workOrder: "ใบสั่งงาน",
    model: "รุ่น",
    power: "กำลังไฟ",
    status: "สถานะ",
    online: "ออนไลน์",
    offline: "ออฟไลน์",
    servicePeriod: "ระยะเวลาการใช้งาน",
    commissioningDate: "วันที่เริ่มใช้งาน",
    daysInService: "ระยะเวลาใช้งาน",
    warrantyInfo: "ข้อมูลการรับประกัน",
    warrantyPeriod: "ระยะเวลารับประกัน",
    expirationDate: "วันหมดประกัน",
    daysRemaining: "เหลืออีก",
    firmware: "เฟิร์มแวร์",
    expired: "หมดประกันแล้ว",
    years: "ปี",
    year: "ปี",
    months: "เดือน",
    month: "เดือน",
    days: "วัน",
    day: "วัน",
    settings: "ตั้งค่า",
    addSettingValue: "เพิ่มค่าตั้งค่า",
    addMonitoringValue: "เพิ่มค่าตรวจวัด",
    addSettingDesc: "กำหนดค่า Setting สำหรับสถานี",
    addMonitoringDesc: "เลือกค่า CBM ที่ต้องการแสดง",
    monitoringValues: "ค่าตรวจวัด (CBM)",
    selectMonitoring: "เลือกค่าตรวจวัด CBM",
    confirm: "ยืนยัน",
    cancel: "ยกเลิก",
    selectAll: "เลือกทั้งหมด",
    deselectAll: "ยกเลิกทั้งหมด",
    selected: "รายการที่เลือก",
    noData: "ไม่มีข้อมูล",
    noFields: "ไม่พบข้อมูลใน CBM Database",
    remove: "ลบ",
    lastUpdated: "อัปเดตล่าสุด",
    loading: "กำลังโหลด...",
    saving: "กำลังบันทึก...",
    loadingFields: "กำลังโหลดรายการ...",
    connecting: "กำลังเชื่อมต่อ...",
    sseConnected: "เชื่อมต่อแล้ว",
    sseDisconnected: "ขาดการเชื่อมต่อ",
  },
  en: {
    stationInfo: "Station Information",
    stationName: "Station Name",
    brand: "Brand",
    serialNumber: "Serial Number",
    workOrder: "Work Order",
    model: "Model",
    power: "Power",
    status: "Status",
    online: "Online",
    offline: "Offline",
    servicePeriod: "Service Period",
    commissioningDate: "Commissioning Date",
    daysInService: "Days in Service",
    warrantyInfo: "Warranty Information",
    warrantyPeriod: "Warranty Period",
    expirationDate: "Expiration Date",
    daysRemaining: "Days Remaining",
    firmware: "Firmware",
    expired: "Expired",
    years: "years",
    year: "year",
    months: "months",
    month: "month",
    days: "days",
    day: "day",
    settings: "Settings",
    addSettingValue: "Add Setting Value",
    addMonitoringValue: "Add Monitoring Value",
    addSettingDesc: "Configure setting values for station",
    addMonitoringDesc: "Select CBM values to display",
    monitoringValues: "Monitoring (CBM)",
    selectMonitoring: "Select CBM Monitoring Values",
    confirm: "Confirm",
    cancel: "Cancel",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    selected: "Selected",
    noData: "No data",
    noFields: "No fields found in CBM Database",
    remove: "Remove",
    lastUpdated: "Last Updated",
    loading: "Loading...",
    saving: "Saving...",
    loadingFields: "Loading fields...",
    connecting: "Connecting...",
    sseConnected: "Connected",
    sseDisconnected: "Disconnected",
  },
};

// ===== Keys to exclude (metadata, not sensor data) =====
const EXCLUDED_KEYS = new Set([
  "_id", "timestamp", "SN", "sn", "charger_sn", "chargerSN",
  "station_name", "station_id", "stationId",
  "created_at", "updated_at", "createdAt", "updatedAt",
  "__v", "$oid", "$date",
]);

// ===== Flatten nested object =====
// { voltage: { L1: 220 }, temp: 25 } → [["voltage.L1", 220], ["temp", 25]]
function flattenObject(
  obj: Record<string, any>,
  prefix = "",
  result: Array<[string, any]> = [],
): Array<[string, any]> {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (EXCLUDED_KEYS.has(key) || EXCLUDED_KEYS.has(fullKey)) continue;

    if (value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      flattenObject(value, fullKey, result);
    } else {
      result.push([fullKey, value]);
    }
  }
  return result;
}

function extractFieldsFromDoc(doc: Record<string, any>): CBMField[] {
  return flattenObject(doc)
    .filter(([key]) => {
      const k = key.toLowerCase();
      return k.includes("temp") && !k.includes("power_module") && !k.includes("charger_gun");
    })
    .map(([key, value]) => ({
      key,
      label: key.replace(/_/g, " ").replace(/\./g, " › "),
      unit: "",
      sample_value: value,
    }));
}

// ===== Get nested value by dotted key =====
function getNestedValue(obj: Record<string, any>, keyPath: string): any {
  let cur: any = obj;
  for (const part of keyPath.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

// ===== localStorage config =====
function cfgKey(sn: string) { return `cbm_monitor_config_${sn}`; }
function loadSavedConfig(sn: string): string[] {
  try {
    const raw = localStorage.getItem(cfgKey(sn));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveConfigToLocal(sn: string, keys: string[]) {
  localStorage.setItem(cfgKey(sn), JSON.stringify(keys));
}

// ===== Icons =====
const GearIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="tw-w-[18px] tw-h-[18px]">
    <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);
const SettingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="tw-w-5 tw-h-5">
    <path d="M10 3.75a2 2 0 10-4 0 2 2 0 004 0zM17.25 4.5a.75.75 0 000-1.5h-5.5a.75.75 0 000 1.5h5.5zM5 3.75a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5a.75.75 0 01.75.75zM4.25 17a.75.75 0 000-1.5h-1.5a.75.75 0 000 1.5h1.5zM17.25 17a.75.75 0 000-1.5h-5.5a.75.75 0 000 1.5h5.5zM9 10a.75.75 0 01-.75.75h-5.5a.75.75 0 010-1.5h5.5A.75.75 0 019 10zM17.25 10.75a.75.75 0 000-1.5h-1.5a.75.75 0 000 1.5h1.5zM14 10a2 2 0 10-4 0 2 2 0 004 0zM10 16.25a2 2 0 10-4 0 2 2 0 004 0z" />
  </svg>
);
const MonitoringIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="tw-w-5 tw-h-5">
    <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
  </svg>
);
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="tw-w-4 tw-h-4">
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
  </svg>
);
const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="tw-w-4 tw-h-4">
    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
  </svg>
);
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="tw-w-4 tw-h-4">
    <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-11.23-3.15a.75.75 0 00.713.988h.001a.75.75 0 00.735-.563A5.5 5.5 0 0114.889 6.11l.311.31h-2.432a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V3.536a.75.75 0 00-1.5 0v2.033l-.311-.311A7 7 0 003.628 8.463a.75.75 0 00.453.811z" clipRule="evenodd" />
  </svg>
);

// =============================================================================
// Component
// =============================================================================
export default function StationInfo({
  station_name, SN, WO, brand, model, power, status,
  commissioningDate, warrantyYears, PLCFirmware, PIFirmware, RTFirmware,
  chargerSN, apiBaseUrl = "", onAddSetting,
}: StationInfoProps) {
  const [lang, setLang] = useState<Lang>("th");
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showCBMModal, setShowCBMModal] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [displayedItems, setDisplayedItems] = useState<CBMDisplayItem[]>([]);
  const [monitorLastUpdated, setMonitorLastUpdated] = useState<string | null>(null);
  const [isLoadingMonitor, setIsLoadingMonitor] = useState(false);
  const [availableFields, setAvailableFields] = useState<CBMField[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [sseStatus, setSseStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const latestDocRef = useRef<Record<string, any> | null>(null);
  const sseAbortRef = useRef<AbortController | null>(null);
  const sseRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snForApi = chargerSN || SN || null;
  const t = translations[lang];

  // ===== Language =====
  useEffect(() => {
    const saved = localStorage.getItem("app_language") as Lang | null;
    if (saved === "th" || saved === "en") setLang(saved);
    const h = (e: CustomEvent<{ lang: Lang }>) => setLang(e.detail.lang);
    window.addEventListener("language:change", h as EventListener);
    return () => window.removeEventListener("language:change", h as EventListener);
  }, []);

  // ===== Close dropdown =====
  useEffect(() => {
    if (!showSettingsMenu) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node))
        setShowSettingsMenu(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showSettingsMenu]);

  // ===========================================================
  // ★ Update display items จาก CBM document + saved config
  // ===========================================================
  const updateDisplayFromDoc = useCallback(
    (doc: Record<string, any>, configKeys: string[]) => {
      if (configKeys.length === 0) { setDisplayedItems([]); return; }
      const items: CBMDisplayItem[] = configKeys.map((key) => ({
        key,
        label: key.replace(/_/g, " ").replace(/\./g, " › "),
        unit: "",
        value: getNestedValue(doc, key) ?? null,
      }));
      setDisplayedItems(items);
      setMonitorLastUpdated(
        doc.timestamp
          ? new Date(doc.timestamp).toLocaleString(lang === "th" ? "th-TH" : "en-US")
          : new Date().toLocaleString(lang === "th" ? "th-TH" : "en-US"),
      );
    },
    [lang],
  );

  // ===========================================================
  // ★ SSE — fetch-based (ส่ง Authorization header ได้)
  //   ต่อ /CBM?SN=xxx → รับ init + data events
  // ===========================================================
  useEffect(() => {
    if (!snForApi || !apiBaseUrl) return;

    const abort = new AbortController();
    sseAbortRef.current = abort;

    const handleDoc = (doc: Record<string, any>) => {
      latestDocRef.current = doc;
      setSseStatus("connected");
      setIsLoadingMonitor(false);
      setAvailableFields(extractFieldsFromDoc(doc));
      const keys = loadSavedConfig(snForApi);
      updateDisplayFromDoc(doc, keys);
    };

    const connect = async () => {
      const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
      const url = `${apiBaseUrl}/CBM?SN=${encodeURIComponent(snForApi)}`;

      setSseStatus("connecting");
      setIsLoadingMonitor(true);

      try {
        const res = await fetch(url, {
          signal: abort.signal,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: "text/event-stream",
          },
        });

        if (!res.ok) {
          console.error(`[CBM-SSE] HTTP ${res.status}`);
          setSseStatus("disconnected");
          setIsLoadingMonitor(false);
          if (!abort.signal.aborted) sseRetryRef.current = setTimeout(connect, 5000);
          return;
        }

        setSseStatus("connected");
        const reader = res.body?.getReader();
        if (!reader) { setSseStatus("disconnected"); setIsLoadingMonitor(false); return; }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (!part.trim()) continue;
            const dataLines: string[] = [];
            for (const line of part.split("\n")) {
              if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
            }
            if (dataLines.length === 0) continue;
            try {
              handleDoc(JSON.parse(dataLines.join("\n")));
            } catch (err) {
              console.error("[CBM-SSE] parse error:", err);
            }
          }
        }

        // Stream ended → reconnect
        setSseStatus("disconnected");
        if (!abort.signal.aborted) sseRetryRef.current = setTimeout(connect, 3000);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("[CBM-SSE] error:", err);
        setSseStatus("disconnected");
        setIsLoadingMonitor(false);
        if (!abort.signal.aborted) sseRetryRef.current = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      abort.abort();
      sseAbortRef.current = null;
      if (sseRetryRef.current) clearTimeout(sseRetryRef.current);
      setSseStatus("disconnected");
    };
  }, [snForApi, apiBaseUrl, updateDisplayFromDoc]);

  // ===========================================================
  // ★ One-shot fetch — ดึงทุก field สำหรับ Modal
  // ===========================================================
  const fetchAllFields = useCallback(async () => {
    if (latestDocRef.current) {
      setAvailableFields(extractFieldsFromDoc(latestDocRef.current));
      return;
    }
    if (!snForApi || !apiBaseUrl) return;

    setIsLoadingFields(true);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 10000);

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
      const res = await fetch(`${apiBaseUrl}/CBM?SN=${encodeURIComponent(snForApi)}`, {
        signal: ctrl.signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: "text/event-stream",
        },
      });
      if (!res.ok) { setAvailableFields([]); return; }

      const reader = res.body?.getReader();
      if (!reader) { setAvailableFields([]); return; }

      const decoder = new TextDecoder();
      let buffer = "";
      let found = false;

      while (!found) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;
          for (const line of part.split("\n")) {
            if (line.startsWith("data:")) {
              try {
                const doc = JSON.parse(line.slice(5).trim());
                latestDocRef.current = doc;
                setAvailableFields(extractFieldsFromDoc(doc));
                found = true;
              } catch { /* ignore */ }
              break;
            }
          }
          if (found) break;
        }
      }
      reader.cancel();
      if (!found) setAvailableFields([]);
    } catch (err: any) {
      if (err?.name !== "AbortError") console.error("[CBM] fetchAllFields error:", err);
      setAvailableFields([]);
    } finally {
      clearTimeout(timeout);
      setIsLoadingFields(false);
    }
  }, [snForApi, apiBaseUrl]);

  // ===========================================================
  // CBM Modal handlers
  // ===========================================================
  const openCBMModal = async () => {
    setShowSettingsMenu(false);
    await fetchAllFields();
    setSelectedKeys(new Set(displayedItems.map((i) => i.key)));
    setShowCBMModal(true);
  };

  const toggleField = (key: string) => {
    setSelectedKeys((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  const handleSelectAll = () => {
    setSelectedKeys(
      selectedKeys.size === availableFields.length
        ? new Set()
        : new Set(availableFields.map((f) => f.key)),
    );
  };

  const confirmSelection = () => {
    if (!snForApi) return;
    const selected = Array.from(selectedKeys);
    saveConfigToLocal(snForApi, selected);

    if (latestDocRef.current) {
      updateDisplayFromDoc(latestDocRef.current, selected);
    } else {
      setDisplayedItems(selected.map((key) => ({
        key, label: key.replace(/_/g, " ").replace(/\./g, " › "), unit: "", value: null,
      })));
    }
    setShowCBMModal(false);
  };

  const removeItem = (key: string) => {
    if (!snForApi) return;
    const remaining = displayedItems.filter((i) => i.key !== key);
    setDisplayedItems(remaining);
    saveConfigToLocal(snForApi, remaining.map((i) => i.key));
  };

  const handleRefresh = () => {
    if (!snForApi || !latestDocRef.current) return;
    updateDisplayFromDoc(latestDocRef.current, loadSavedConfig(snForApi));
  };

  // ===== Computed helpers =====
  const statusColor = status === true ? "tw-bg-green-100 tw-text-green-700" : "tw-bg-red-100 tw-text-red-700";
  const statusText = status === true ? t.online : t.offline;

  const formatDuration = (y: number, m: number, d: number): string => {
    if (y > 0) return `${y} ${y > 1 ? t.years : t.year} ${m} ${m !== 1 ? t.months : t.month}`;
    if (m > 0) return `${m} ${m !== 1 ? t.months : t.month} ${d} ${d !== 1 ? t.days : t.day}`;
    return `${d} ${d !== 1 ? t.days : t.day}`;
  };

  const calculateDaysInUse = (s: string | null | undefined): string => {
    if (!s) return "-";
    try {
      const diff = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
      if (diff < 0) return "-";
      return formatDuration(Math.floor(diff / 365), Math.floor((diff % 365) / 30), (diff % 365) % 30);
    } catch { return "-"; }
  };
  const daysInUse = calculateDaysInUse(commissioningDate);

  const calcWarranty = (s: string | null | undefined, wy: number | null | undefined): string => {
    if (!s || !wy) return "-";
    try {
      const cd = new Date(s);
      const end = new Date(cd.getFullYear() + wy, cd.getMonth(), cd.getDate());
      const diff = Math.floor((end.getTime() - Date.now()) / 86400000);
      if (diff <= 0) return t.expired;
      return formatDuration(Math.floor(diff / 365), Math.floor((diff % 365) / 30), (diff % 365) % 30);
    } catch { return "-"; }
  };
  const remainingWarrantyDays = calcWarranty(commissioningDate, warrantyYears ? parseInt(warrantyYears) : null);

  const formatDate = (s: string | null | undefined): string => {
    if (!s) return "-";
    try {
      const d = new Date(s);
      if (lang === "th") {
        const tm = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
        return `${d.getDate().toString().padStart(2, "0")} ${tm[d.getMonth()]} ${d.getFullYear() + 543}`;
      }
      const em = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return `${d.getDate().toString().padStart(2, "0")} ${em[d.getMonth()]} ${d.getFullYear()}`;
    } catch { return "-"; }
  };

  const calcWarrantyExpDate = (s: string | null | undefined, wy: number | null | undefined): string => {
    if (!s || !wy) return "-";
    try {
      const cd = new Date(s);
      return formatDate(new Date(cd.getFullYear() + wy, cd.getMonth(), cd.getDate()).toISOString());
    } catch { return "-"; }
  };
  const warrantyExpirationDate = calcWarrantyExpDate(commissioningDate, warrantyYears ? parseInt(warrantyYears) : null);

  const getWarrantyColor = (s: string): string => {
    if (s === t.expired || s === "Expired" || s === "หมดประกันแล้ว") return "tw-bg-red-50 tw-text-red-700";
    const p = s.split(" "); let td = 0;
    for (let i = 0; i < p.length; i++) {
      if (p[i + 1]?.includes("year") || p[i + 1]?.includes("ปี")) td += parseInt(p[i]) * 365;
      else if (p[i + 1]?.includes("day") || p[i + 1]?.includes("วัน")) td += parseInt(p[i]);
    }
    if (td > 365) return "tw-bg-green-50 tw-text-green-700";
    if (td > 90) return "tw-bg-blue-50 tw-text-blue-700";
    if (td > 30) return "tw-bg-amber-50 tw-text-amber-700";
    return "tw-bg-red-50 tw-text-red-700";
  };

  const getCBMStatusColor = (s?: string) => {
    if (s === "warning") return "tw-bg-amber-50 tw-text-amber-700";
    if (s === "critical") return "tw-bg-red-50 tw-text-red-700";
    return "tw-bg-green-50 tw-text-green-700";
  };

  const fmtSample = (v: any): string => {
    if (v == null) return "-";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
    return String(v);
  };

  const fmtValue = (v: any): string => {
    if (v == null) return "-";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
    return String(v);
  };

  const InfoRow = ({ label, value, badge, truncate = false }: {
    label: string; value?: React.ReactNode; badge?: { text: string; className: string }; truncate?: boolean;
  }) => (
    <div className="tw-flex tw-justify-between tw-items-center tw-gap-4 tw-mb-3">
      <dt className="tw-text-sm tw-text-blue-gray-500 tw-font-medium tw-shrink-0">{label}</dt>
      <dd className="tw-text-blue-gray-900 tw-font-medium tw-text-right tw-min-w-0 tw-flex-1">
        {badge ? (
          <span className={`tw-inline-flex tw-items-center tw-px-2.5 tw-py-1 tw-rounded tw-text-sm tw-font-medium ${badge.className}`}>{badge.text}</span>
        ) : (
          <span className={truncate ? "tw-truncate tw-block tw-max-w-[180px] tw-ml-auto" : ""}
            title={truncate && typeof value === "string" ? value : undefined}>{value ?? "-"}</span>
        )}
      </dd>
    </div>
  );

  // ===== Render =====
  return (
    <>
      <div className="tw-h-full tw-flex tw-flex-col">
        <div className="tw-flex-1 tw-overflow-auto tw-p-6">
          <dl className="tw-space-y-6">
            {/* Station Information */}
            <div className="tw-border-b tw-border-blue-gray-200 tw-pb-4">
              <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
                <h3 className="tw-text-sm tw-font-semibold tw-text-blue-gray-700">{t.stationInfo}</h3>
                <div className="tw-relative">
                  <button ref={buttonRef} onClick={() => setShowSettingsMenu((p) => !p)}
                    className={`tw-inline-flex tw-items-center tw-justify-center tw-w-8 tw-h-8 tw-rounded-lg tw-border tw-border-blue-gray-200 tw-text-blue-gray-500 tw-bg-white hover:tw-bg-blue-gray-50 hover:tw-text-blue-gray-700 tw-transition-colors ${showSettingsMenu ? "tw-bg-blue-gray-50 tw-text-blue-gray-700 tw-shadow-sm" : ""}`}
                    title={t.settings}><GearIcon /></button>

                  {showSettingsMenu && (
                    <div ref={menuRef} className="tw-absolute tw-right-0 tw-top-full tw-mt-1 tw-z-50 tw-w-72 tw-bg-white tw-rounded-xl tw-shadow-lg tw-border tw-border-blue-gray-100 tw-overflow-hidden">
                      <div className="tw-p-1.5">
                        <button onClick={openCBMModal}
                          className="tw-w-full tw-flex tw-items-start tw-gap-3 tw-px-3 tw-py-2.5 tw-rounded-lg tw-text-left hover:tw-bg-green-50 tw-transition-colors tw-group">
                          <span className="tw-mt-0.5 tw-text-green-500"><MonitoringIcon /></span>
                          <div><div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800">{t.addMonitoringValue}</div>
                            <div className="tw-text-xs tw-text-blue-gray-400 tw-mt-0.5">{t.addMonitoringDesc}</div></div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <InfoRow label={t.stationName} value={station_name} />
              <InfoRow label={t.brand} value={brand} />
              <InfoRow label={t.serialNumber} value={SN} />
              <InfoRow label={t.workOrder} value={WO} />
              <InfoRow label={t.model} value={model} />
              <InfoRow label={t.power} value={power} />
              <InfoRow label={t.status} badge={{ text: statusText, className: statusColor }} />
            </div>

            {/* Service Period */}
            <div className="tw-border-b tw-border-blue-gray-200 tw-pb-4">
              <h3 className="tw-text-sm tw-font-semibold tw-text-blue-gray-700 tw-mb-4">{t.servicePeriod}</h3>
              <InfoRow label={t.commissioningDate} value={formatDate(commissioningDate)} />
              <InfoRow label={t.daysInService} badge={{ text: daysInUse, className: "tw-bg-blue-50 tw-text-blue-700" }} />
            </div>

            {/* Warranty */}
            <div className="tw-border-b tw-border-blue-gray-200 tw-pb-4">
              <h3 className="tw-text-sm tw-font-semibold tw-text-blue-gray-700 tw-mb-4">{t.warrantyInfo}</h3>
              <InfoRow label={t.warrantyPeriod} value={warrantyYears ? `${warrantyYears} ${t.years}` : "-"} />
              <InfoRow label={t.expirationDate} value={warrantyExpirationDate} />
              <InfoRow label={t.daysRemaining} badge={{ text: remainingWarrantyDays, className: getWarrantyColor(remainingWarrantyDays) }} />
            </div>

            {/* Firmware */}
            <div className={displayedItems.length > 0 ? "tw-border-b tw-border-blue-gray-200 tw-pb-4" : "tw-pb-4"}>
              <h3 className="tw-text-sm tw-font-semibold tw-text-blue-gray-700 tw-mb-4">{t.firmware}</h3>
              <InfoRow label="PLC" value={PLCFirmware} truncate />
              <InfoRow label="PI" value={PIFirmware} truncate />
              <InfoRow label="Router" value={RTFirmware} truncate />
            </div>

            {/* CBM Monitoring */}
            {displayedItems.length > 0 && (
              <div className="tw-pb-4">
                <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                  <div className="tw-flex tw-items-center tw-gap-2">
                    <h3 className="tw-text-sm tw-font-semibold tw-text-blue-gray-700">{t.monitoringValues}</h3>
                    <span className={`tw-w-2 tw-h-2 tw-rounded-full ${sseStatus === "connected" ? "tw-bg-green-500" : sseStatus === "connecting" ? "tw-bg-amber-400 tw-animate-pulse" : "tw-bg-red-400"}`}
                      title={sseStatus === "connected" ? t.sseConnected : sseStatus === "connecting" ? t.connecting : t.sseDisconnected} />
                  </div>
                  <button onClick={handleRefresh} disabled={isLoadingMonitor}
                    className={`tw-inline-flex tw-items-center tw-justify-center tw-w-7 tw-h-7 tw-rounded-md tw-text-blue-gray-400 hover:tw-text-blue-600 hover:tw-bg-blue-50 tw-transition-all ${isLoadingMonitor ? "tw-animate-spin" : ""}`}
                    title="Refresh"><RefreshIcon /></button>
                </div>
                {monitorLastUpdated && (
                  <div className="tw-text-xs tw-text-blue-gray-400 tw-mb-3">{t.lastUpdated}: {monitorLastUpdated}</div>
                )}
                <div className="tw-space-y-2">
                  {displayedItems.map((item) => (
                    <div key={item.key} className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-group tw-py-1.5">
                      <dt className="tw-text-sm tw-text-blue-gray-500 tw-font-medium tw-truncate tw-min-w-0 tw-flex-1">{item.label}</dt>
                      <div className="tw-flex tw-items-center tw-gap-2 tw-shrink-0">
                        {item.value != null ? (
                          <span className={`tw-inline-flex tw-items-center tw-gap-1 tw-px-2.5 tw-py-1 tw-rounded tw-text-sm tw-font-semibold ${getCBMStatusColor(item.status)}`}>
                            {fmtValue(item.value)}{item.unit ? ` ${item.unit}` : ""}
                          </span>
                        ) : (
                          <span className="tw-text-sm tw-text-blue-gray-300 tw-font-medium">{isLoadingMonitor ? "..." : t.noData}</span>
                        )}
                        <button onClick={() => removeItem(item.key)}
                          className="tw-opacity-0 group-hover:tw-opacity-100 tw-w-6 tw-h-6 tw-rounded tw-flex tw-items-center tw-justify-center tw-text-blue-gray-300 hover:tw-text-red-500 hover:tw-bg-red-50 tw-transition-all"
                          title={t.remove}><CloseIcon /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* CBM Selection Modal */}
      {showCBMModal && (
        <div className="tw-fixed tw-inset-0 tw-z-[100] tw-flex tw-items-center tw-justify-center tw-p-4">
          <div className="tw-absolute tw-inset-0 tw-bg-black/40" onClick={() => setShowCBMModal(false)} />
          <div className="tw-relative tw-w-full tw-max-w-md tw-max-h-[80vh] tw-bg-white tw-rounded-2xl tw-shadow-2xl tw-flex tw-flex-col tw-overflow-hidden">
            <div className="tw-flex tw-items-center tw-justify-between tw-px-5 tw-py-4 tw-border-b tw-border-blue-gray-100">
              <div>
                <h4 className="tw-text-base tw-font-bold tw-text-blue-gray-800">{t.selectMonitoring}</h4>
                <p className="tw-text-xs tw-text-blue-gray-400 tw-mt-0.5">{t.selected}: {selectedKeys.size} / {availableFields.length}</p>
              </div>
              <button onClick={() => setShowCBMModal(false)}
                className="tw-w-8 tw-h-8 tw-rounded-lg tw-flex tw-items-center tw-justify-center tw-text-blue-gray-400 hover:tw-bg-blue-gray-50 tw-transition-colors">
                <CloseIcon />
              </button>
            </div>

            {availableFields.length > 0 && (
              <div className="tw-px-5 tw-py-2.5 tw-border-b tw-border-blue-gray-50">
                <button onClick={handleSelectAll}
                  className="tw-text-xs tw-font-semibold tw-text-blue-600 hover:tw-text-blue-700 tw-transition-colors">
                  {selectedKeys.size === availableFields.length ? t.deselectAll : t.selectAll}
                </button>
              </div>
            )}

            <div className="tw-flex-1 tw-overflow-auto tw-px-3 tw-py-2">
              {isLoadingFields ? (
                <div className="tw-flex tw-items-center tw-justify-center tw-py-12 tw-text-sm tw-text-blue-gray-400">{t.loadingFields}</div>
              ) : availableFields.length === 0 ? (
                <div className="tw-flex tw-items-center tw-justify-center tw-py-12 tw-text-sm tw-text-blue-gray-400">{t.noFields}</div>
              ) : (
                availableFields.map((field) => {
                  const sel = selectedKeys.has(field.key);
                  return (
                    <button key={field.key} onClick={() => toggleField(field.key)}
                      className={`tw-w-full tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2.5 tw-rounded-lg tw-text-left tw-mb-0.5 tw-transition-colors ${sel ? "tw-bg-green-50 hover:tw-bg-green-100" : "hover:tw-bg-blue-gray-50"}`}>
                      <span className={`tw-flex tw-items-center tw-justify-center tw-shrink-0 tw-w-5 tw-h-5 tw-rounded tw-border-2 tw-transition-colors ${sel ? "tw-bg-green-500 tw-border-green-500 tw-text-white" : "tw-border-blue-gray-300 tw-bg-white"}`}>
                        {sel && <CheckIcon />}
                      </span>
                      <div className="tw-flex-1 tw-min-w-0">
                        <div className={`tw-text-sm tw-font-medium ${sel ? "tw-text-green-800" : "tw-text-blue-gray-700"}`}>{field.label}</div>
                        <div className="tw-text-xs tw-text-blue-gray-400 tw-font-mono">{field.key}</div>
                      </div>
                      <span className="tw-text-xs tw-text-blue-gray-400 tw-bg-blue-gray-50 tw-px-2 tw-py-0.5 tw-rounded tw-font-mono tw-max-w-[100px] tw-truncate" title={String(field.sample_value ?? "")}>
                        {fmtSample(field.sample_value)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="tw-flex tw-items-center tw-justify-end tw-gap-2 tw-px-5 tw-py-3.5 tw-border-t tw-border-blue-gray-100 tw-bg-blue-gray-50/50">
              <button onClick={() => setShowCBMModal(false)}
                className="tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm tw-font-medium tw-text-blue-gray-600 hover:tw-bg-blue-gray-100 tw-transition-colors">{t.cancel}</button>
              <button onClick={confirmSelection} disabled={availableFields.length === 0}
                className="tw-px-5 tw-py-2 tw-rounded-lg tw-text-sm tw-font-semibold tw-text-white tw-shadow-sm tw-transition-colors tw-bg-green-600 hover:tw-bg-green-700">
                {`${t.confirm} (${selectedKeys.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}