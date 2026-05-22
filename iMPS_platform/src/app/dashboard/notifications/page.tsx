"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  BellIcon,
  CheckCircleIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  TrashIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
  PlusIcon,
  ChevronLeftIcon,
  UserCircleIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";

type Lang = "th" | "en";

interface Notification {
  id: string;
  station_id: string;
  station_name: string;
  chargebox_id?: string;
  charger_no?: number;
  sn?: string;
  error: string;
  error_code?: string;
  timestamp: string;
  head?: string;
  connector?: string | number;
}

interface ChargerInfo {
  id: string;
  chargeBoxID: string;
  chargerNo?: number;
  SN?: string;
  brand?: string;
  model?: string;
}

interface StationInfo {
  id: string;
  station_id: string;
  station_name: string;
  user_id: string;   // owner ของ station
  username: string;   // owner username
  chargers: ChargerInfo[];
}

interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: string;
  company?: string;
  tel?: string;
}

interface EmailRule {
  id: string;
  station_id: string;
  station_name: string;
  chargebox_id: string | "all";
  user_ids: string[];
  enabled: boolean;
}

interface NotificationSettings {
  enableSound: boolean;
  enableDesktopNotif: boolean;
  autoRefreshInterval: number;
  emailRules: EmailRule[];
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enableSound: true,
  enableDesktopNotif: false,
  autoRefreshInterval: 0,
  emailRules: [],
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";


type SettingsView = "main" | "email-rules" | "email-rule-edit";

// Role badge colors
const roleBadge: Record<string, { bg: string; text: string; label: Record<Lang, string> }> = {
  admin: { bg: "tw-bg-purple-100", text: "tw-text-purple-700", label: { th: "แอดมิน", en: "Admin" } },
  owner: { bg: "tw-bg-emerald-100", text: "tw-text-emerald-700", label: { th: "เจ้าของ", en: "Owner" } },
};

export default function NotificationsPage() {
  const [lang, setLang] = useState<Lang>("th");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>("all");
  const [selectedCharger, setSelectedCharger] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [settingsView, setSettingsView] = useState<SettingsView>("main");
  const settingsRef = useRef<HTMLDivElement>(null);
  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const [stationDropdownOpen, setStationDropdownOpen] = useState(false);
  const [chargerDropdownOpen, setChargerDropdownOpen] = useState(false);
  const [stationSearch, setStationSearch] = useState("");
  const [chargerSearch, setChargerSearch] = useState("");
  const stationDropdownRef = useRef<HTMLDivElement>(null);
  const chargerDropdownRef = useRef<HTMLDivElement>(null);

  // All stations from /all-stations/
  const [allStations, setAllStations] = useState<StationInfo[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);

  // All users from /all-users/
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Email rule editing
  const [editingRule, setEditingRule] = useState<EmailRule | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Toast alert
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  };

  // เพิ่มฟังก์ชัน fetchEmailRules
  const fetchEmailRules = useCallback(async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/notifications/email-rules`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rules: EmailRule[] = data.rules || [];
      setSettings((prev) => {
        const next = { ...prev, emailRules: rules };
        persistSettings(next);
        return next;
      });
    } catch (err) {
      console.error("[EmailRule] Fetch rules error:", err);
    }
  }, []);

  // เรียกตอน settings เปิด
  useEffect(() => {
    if (showSettings) {
      fetchEmailRules(); // ★ โหลด background ไว้ก่อน
    }
  }, [showSettings, fetchEmailRules]);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    type: "danger" | "primary";
    onConfirm: () => void;
  } | null>(null);

  const showConfirm = (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: "danger" | "primary";
    onConfirm: () => void;
  }) => {
    setConfirmDialog({
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel || (lang === "th" ? "ยืนยัน" : "Confirm"),
      cancelLabel: opts.cancelLabel || (lang === "th" ? "ยกเลิก" : "Cancel"),
      type: opts.type || "primary",
      onConfirm: opts.onConfirm,
    });
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (stationDropdownRef.current && !stationDropdownRef.current.contains(e.target as Node)) {
        setStationDropdownOpen(false);
      }
      if (chargerDropdownRef.current && !chargerDropdownRef.current.contains(e.target as Node)) {
        setChargerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ===== Language =====
  useEffect(() => {
    const savedLang = localStorage.getItem("app_language") as Lang | null;
    if (savedLang === "th" || savedLang === "en") setLang(savedLang);
    const handleLangChange = (e: CustomEvent) => setLang(e.detail.lang);
    window.addEventListener("language:change", handleLangChange as EventListener);
    return () => window.removeEventListener("language:change", handleLangChange as EventListener);
  }, []);

  // ===== Load Settings =====
  useEffect(() => {
    try {
      const saved = localStorage.getItem("notification_settings");
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
    } catch { /* ignore */ }
  }, []);

  const persistSettings = (next: NotificationSettings) => {
    localStorage.setItem("notification_settings", JSON.stringify(next));
  };

  const updateSettings = (patch: Partial<NotificationSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persistSettings(next);
      return next;
    });
  };


  // ===== Close settings on outside click =====
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
        setSettingsView("main");
      }
    };
    if (showSettings) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSettings]);

  // ===== Fetch ALL stations from /all-stations/ =====
  const fetchStations = useCallback(async () => {
    setLoadingStations(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/all-stations/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Response: { stations: [{ id, station_id, station_name, user_id, username, chargers: [...] }] }
      const raw: any[] = data.stations || [];
      const parsed: StationInfo[] = raw.map((s: any) => ({
        id: s.id || "",
        station_id: s.station_id || "",
        station_name: s.station_name || s.station_id || "",
        user_id: s.user_id || "",
        username: s.username || "",
        chargers: (s.chargers || []).map((c: any) => ({
          id: c.id || "",
          chargeBoxID: c.chargeBoxID || c.chargebox_id || "",
          chargerNo: c.chargerNo ?? c.charger_no,
          SN: c.SN || c.sn || "",
          brand: c.brand || "",
          model: c.model || "",
        })),
      }));

      console.log("[Notifications] Fetched stations:", parsed.length);
      setAllStations(parsed);
    } catch (err) {
      console.error("[Notifications] Fetch stations error:", err);
      setAllStations([]);
    } finally {
      setLoadingStations(false);
    }
  }, []);

  // ===== Fetch ALL users from /all-users/ =====
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/all-users/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Response: { users: [{ _id, username, email, role, company, tel, ... }] }
      const raw: any[] = data.users || [];
      const parsed: UserInfo[] = raw.map((u: any) => ({
        id: u._id || u.id || "",
        username: u.username || "",
        email: u.email || "",
        role: u.role || "",
        company: u.company || "",
        tel: u.tel || "",
      }));

      console.log("[Notifications] Fetched users:", parsed.length);
      setAllUsers(parsed);
    } catch (err) {
      console.error("[Notifications] Fetch users error:", err);
      setAllUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // ===== Translations =====
  const t = {
    title: lang === "th" ? "การแจ้งเตือน" : "Notifications",
    noNotifications: lang === "th" ? "ไม่มีการแจ้งเตือน" : "No notifications",
    loading: lang === "th" ? "กำลังโหลด..." : "Loading...",
    errorLoading: lang === "th" ? "ไม่สามารถโหลดข้อมูลได้" : "Failed to load data",
    retry: lang === "th" ? "ลองใหม่" : "Retry",
    settings: lang === "th" ? "ตั้งค่า" : "Settings",
    settingsSound: lang === "th" ? "เสียงแจ้งเตือน" : "Notification sound",
    settingsDesktop: lang === "th" ? "แจ้งเตือนเดสก์ท็อป" : "Desktop notifications",
    settingsAutoRefresh: lang === "th" ? "รีเฟรชอัตโนมัติ" : "Auto-refresh",
    settingsOff: lang === "th" ? "ปิด" : "Off",
    settingsReset: lang === "th" ? "รีเซ็ตค่าเริ่มต้น" : "Reset defaults",
    emailRules: lang === "th" ? "ตั้งค่าส่งอีเมล" : "Email Notifications",
    emailRulesDesc: lang === "th" ? "กำหนดสถานี/ตู้ชาร์จ ที่จะส่งอีเมลแจ้งเตือน" : "Configure email alerts per station/charger",
    addRule: lang === "th" ? "เพิ่มกฎ" : "Add Rule",
    editRule: lang === "th" ? "แก้ไขกฎ" : "Edit Rule",
    newRule: lang === "th" ? "กฎใหม่" : "New Rule",
    station: lang === "th" ? "สถานี" : "Station",
    charger: lang === "th" ? "ตู้ชาร์จ" : "Charger",
    allChargers: lang === "th" ? "ทุกตู้ชาร์จ" : "All Chargers",
    recipients: lang === "th" ? "ผู้รับอีเมล" : "Recipients",
    recipientsDesc: lang === "th" ? "แสดงเฉพาะ Admin และ Owner ของสถานีนี้" : "Showing Admin and Owner of this station",
    save: lang === "th" ? "บันทึก" : "Save",
    cancel: lang === "th" ? "ยกเลิก" : "Cancel",
    delete: lang === "th" ? "ลบ" : "Delete",
    noRules: lang === "th" ? "ยังไม่มีกฎส่งอีเมล" : "No email rules yet",
    noRulesDesc: lang === "th" ? "เพิ่มกฎเพื่อส่งอีเมลแจ้งเตือนอัตโนมัติ" : "Add rules to send automatic email alerts",
    searchUsers: lang === "th" ? "ค้นหาผู้ใช้..." : "Search users...",
    noUsersFound: lang === "th" ? "ไม่พบผู้ใช้" : "No users found",
    selectedUsers: lang === "th" ? "เลือกแล้ว" : "selected",
    enabled: lang === "th" ? "เปิดใช้งาน" : "Enabled",
    selectStation: lang === "th" ? "เลือกสถานี" : "Select station",
    selectStationFirst: lang === "th" ? "กรุณาเลือกสถานีก่อน" : "Please select a station first",
    loadingStations: lang === "th" ? "กำลังโหลดสถานี..." : "Loading stations...",
    dateFrom: lang === "th" ? "จาก" : "From",
    dateTo: lang === "th" ? "ถึง" : "To",
    clearDate: lang === "th" ? "ล้าง" : "Clear",
  };

  // ===== Auto-refresh =====
  useEffect(() => {
    if (settings.autoRefreshInterval <= 0) return;
    const interval = setInterval(() => fetchNotifications(), settings.autoRefreshInterval * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoRefreshInterval]);

  // ===== Fetch Notifications =====
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("access_token");
      const params = new URLSearchParams();
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await fetch(`${API_BASE}/notifications/all?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error("[Notifications] Fetch error:", err);
      setError(t.errorLoading);
    } finally {
      setLoading(false);
    }
  }, [t.errorLoading, dateFrom, dateTo]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  const stationList = React.useMemo(() => {
    return allStations
      .map((s) => ({ id: s.station_id, name: s.station_name || s.station_id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allStations]);

  // ===== Charger list for notification filter =====
  const chargerList = React.useMemo(() => {
    let stations = allStations;
    if (selectedStation !== "all") {
      stations = stations.filter((s) => s.station_id === selectedStation);
    }
    return stations
      .flatMap((s) =>
        s.chargers
          .filter((c) => !!c.SN)
          .map((c) => ({
            sn: c.SN!,
            chargeBoxID: c.chargeBoxID,
            chargerNo: c.chargerNo,
            stationName: s.station_name,
          }))
      )
      .sort((a, b) => a.sn.localeCompare(b.sn));
  }, [allStations, selectedStation]);

  // ===== Chargers for a station =====
  const chargersForStation = useCallback(
    (stationId: string): ChargerInfo[] => {
      const station = allStations.find((s) => s.station_id === stationId);
      return station?.chargers || [];
    },
    [allStations]
  );

  // ===== Users filtered for selected station: admin + owner =====
  const usersForStation = useCallback(
    (stationId: string): UserInfo[] => {
      if (!stationId) return [];

      const station = allStations.find((s) => s.station_id === stationId);
      const ownerUserId = station?.user_id || "";

      return allUsers.filter((u) => {
        // แสดง admin ทุกคน
        if (u.role === "admin") return true;
        // แสดง owner ของ station นี้
        if (u.role === "owner" && u.id === ownerUserId) return true;
        return false;
      });
    },
    [allStations, allUsers]
  );

  // ===== Filtered notifications =====
  const filteredNotifications = React.useMemo(() => {
    let result = notifications;
    // ★ เพิ่ม filter station
    if (selectedStation !== "all") result = result.filter((n) => (n.station_id || n.sn) === selectedStation);
    if (selectedCharger !== "all") result = result.filter((n) => n.sn === selectedCharger);
    return result;
  }, [notifications, selectedStation, selectedCharger]);



  // ===== Email Rule helpers =====
  const saveEmailRule = async (rule: EmailRule) => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/notifications/email-rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(rule),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      // ★ ใช้ rule ที่ backend return กลับมา (มี _id จริง)
      const savedRule: EmailRule = data.rule;

      setSettings((prev) => {
        const existing = prev.emailRules.findIndex((r) => r.id === rule.id);
        let newRules: EmailRule[];
        if (existing >= 0) {
          newRules = [...prev.emailRules];
          newRules[existing] = savedRule;  // ← ใช้ savedRule ไม่ใช่ rule เดิม
        } else {
          newRules = [...prev.emailRules, savedRule];
        }
        const next = { ...prev, emailRules: newRules };
        persistSettings(next);
        return next;
      });

      showToast(lang === "th" ? "บันทึกกฎเรียบร้อยแล้ว" : "Rule saved successfully", "success");
    } catch (err) {
      console.error("[EmailRule] Save error:", err);
      showToast(lang === "th" ? "บันทึกไม่สำเร็จ" : "Failed to save rule.", "error");
    }
  };

  const deleteEmailRule = async (ruleId: string) => {
    // ★ Optimistic — ลบออกจาก UI ทันที
    const prevRules = settings.emailRules;
    setSettings((prev) => {
      const next = { ...prev, emailRules: prev.emailRules.filter((r) => r.id !== ruleId) };
      persistSettings(next);
      return next;
    });

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/notifications/email-rules/${ruleId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(lang === "th" ? "ลบกฎเรียบร้อยแล้ว" : "Rule deleted successfully", "success");
    } catch (err) {
      // ★ Rollback ถ้า API fail
      setSettings((prev) => {
        const next = { ...prev, emailRules: prevRules };
        persistSettings(next);
        return next;
      });
      showToast(lang === "th" ? "ลบไม่สำเร็จ กรุณาลองใหม่" : "Failed to delete rule. Please try again.", "error");
      console.error("[EmailRule] Delete error:", err);
    }
  };

  const toggleEmailRule = async (ruleId: string) => {
    const rule = settings.emailRules.find((r) => r.id === ruleId);
    if (!rule) return;
    const toggled = { ...rule, enabled: !rule.enabled };

    // Optimistic update
    setSettings((prev) => {
      const next = { ...prev, emailRules: prev.emailRules.map((r) => (r.id === ruleId ? toggled : r)) };
      persistSettings(next);
      return next;
    });

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/notifications/email-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(toggled),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(toggled.enabled ? (lang === "th" ? "เปิดใช้งานกฎแล้ว" : "Rule enabled") : (lang === "th" ? "ปิดใช้งานกฎแล้ว" : "Rule disabled"), "success");
    } catch (err) {
      // ★ Rollback กลับสถานะเดิม
      setSettings((prev) => {
        const next = { ...prev, emailRules: prev.emailRules.map((r) => (r.id === ruleId ? rule : r)) };
        persistSettings(next);
        return next;
      });
      showToast(lang === "th" ? "เปลี่ยนสถานะไม่สำเร็จ" : "Failed to update rule status", "error");
      console.error("[EmailRule] Toggle error:", err);
    }
  };

  // ===== Format Time =====
  const formatTime = (timeStr: string) => {
    if (!timeStr) return "";
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return lang === "th" ? "เมื่อสักครู่" : "Just now";
    if (diffMins < 60) return lang === "th" ? `${diffMins} นาทีที่แล้ว` : `${diffMins}m ago`;
    if (diffHours < 24) return lang === "th" ? `${diffHours} ชั่วโมงที่แล้ว` : `${diffHours}h ago`;
    return lang === "th" ? `${diffDays} วันที่แล้ว` : `${diffDays}d ago`;
  };

  // ===== Render: Email Rule Editor =====
  const renderEmailRuleEdit = () => {
    if (!editingRule) return null;

    const stationChargers = editingRule.station_id ? chargersForStation(editingRule.station_id) : [];

    // ★ Filter users: admin ทุกคน + owner ของ station ที่เลือก
    const eligibleUsers = editingRule.station_id === "all"
      ? allUsers.filter((u) => u.role === "admin")
      : editingRule.station_id ? usersForStation(editingRule.station_id) : [];

    const filteredUsers = eligibleUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
    );

    const toggleUser = (userId: string) => {
      setEditingRule((prev) => {
        if (!prev) return prev;
        const has = prev.user_ids.includes(userId);
        return { ...prev, user_ids: has ? prev.user_ids.filter((id) => id !== userId) : [...prev.user_ids, userId] };
      });
    };


    // เมื่อเปลี่ยน station ให้ clear user_ids ที่ไม่ eligible แล้ว
    const handleStationChange = (sid: string) => {
      const found = allStations.find((s) => s.station_id === sid);
      const newEligible = sid === "all"
        ? allUsers.filter((u) => u.role === "admin")  // ← แก้
        : sid ? usersForStation(sid) : [];
      const eligibleIds = new Set(newEligible.map((u) => u.id));

      setEditingRule((prev) =>
        prev
          ? {
            ...prev,
            station_id: sid,
            station_name: sid === "all"
              ? (lang === "th" ? "ทุกสถานี" : "All Stations")
              : found?.station_name || sid,
            chargebox_id: "all",
            // ลบ user ที่ไม่ eligible ออก
            user_ids: prev.user_ids.filter((uid) => eligibleIds.has(uid)),
          }
          : prev
      );
    };

    return (
      <div className="tw-flex tw-flex-col tw-h-full">
        {/* Header */}
        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-4">
          <button
            onClick={() => { setSettingsView("email-rules"); setEditingRule(null); }}
            className="tw-p-1 tw-text-gray-400 hover:tw-text-gray-700 tw-transition-colors"
          >
            <ChevronLeftIcon className="tw-h-4 tw-w-4" />
          </button>
          <h3 className="tw-text-sm tw-font-semibold tw-text-gray-900">
            {editingRule.id.startsWith("new-") ? t.newRule : t.editRule}
          </h3>
        </div>

        <div className="tw-space-y-4 tw-overflow-y-auto tw-max-h-[420px] tw-pr-1">


          {/* Station Selection */}
          <div>
            <label className="tw-block tw-text-xs tw-font-medium tw-text-gray-500 tw-mb-1">{t.station}</label>
            {loadingStations ? (
              <div className="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-text-sm tw-text-gray-400">
                <ArrowPathIcon className="tw-h-4 tw-w-4 tw-animate-spin" />
                {t.loadingStations}
              </div>
            ) : (
              <select
                value={editingRule.station_id}
                onChange={(e) => handleStationChange(e.target.value)}
                className="tw-w-full tw-px-3 tw-py-2 tw-text-sm tw-border tw-border-gray-200 tw-rounded-lg tw-bg-white focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-gray-300"
              >
                <option value="">{t.selectStation}</option>
                <option value="all">{lang === "th" ? "ทุกสถานี" : "All Stations"}</option>
                {allStations.map((s) => (
                  <option key={s.station_id} value={s.station_id}>
                    {s.station_name} ({s.chargers.length} {lang === "th" ? "ตู้" : "chargers"})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Charger Selection */}
          {editingRule.station_id && stationChargers.length > 0 && (
            <div>
              <label className="tw-block tw-text-xs tw-font-medium tw-text-gray-500 tw-mb-1">{t.charger}</label>
              <select
                value={editingRule.chargebox_id}
                onChange={(e) => setEditingRule((prev) => (prev ? { ...prev, chargebox_id: e.target.value } : prev))}
                className="tw-w-full tw-px-3 tw-py-2 tw-text-sm tw-border tw-border-gray-200 tw-rounded-lg tw-bg-white focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-gray-300"
              >
                <option value="all">{t.allChargers}</option>
                {stationChargers.map((c) => (
                  <option key={c.id || c.chargeBoxID} value={c.chargeBoxID}>
                    {c.chargeBoxID}
                    {c.chargerNo ? ` (Charger ${c.chargerNo})` : ""}
                    {c.SN ? ` — SN: ${c.SN}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Recipients — admin + owner ของ station เท่านั้น */}
          <div>
            <label className="tw-block tw-text-xs tw-font-medium tw-text-gray-500 tw-mb-1">
              {t.recipients} ({editingRule.user_ids.length} {t.selectedUsers})
            </label>
            <p className="tw-text-[11px] tw-text-gray-400 tw-mb-2">
              {editingRule.station_id === "all"
                ? (lang === "th" ? "แสดงเฉพาะ Admin (ทุกสถานี)" : "Showing all Admins")
                : t.recipientsDesc}
            </p>

            {/* ยังไม่เลือก station */}
            {!editingRule.station_id ? (
              <div className="tw-text-center tw-py-6 tw-text-xs tw-text-gray-400 tw-border tw-border-gray-100 tw-rounded-lg">
                {t.selectStationFirst}
              </div>
            ) : (
              <>
                {/* Selected users pills */}
                {editingRule.user_ids.length > 0 && (
                  <div className="tw-flex tw-flex-wrap tw-gap-1.5 tw-mb-2">
                    {editingRule.user_ids.map((uid) => {
                      const user = allUsers.find((u) => u.id === uid);
                      const badge = user ? roleBadge[user.role] : null;
                      return (
                        <span
                          key={uid}
                          className="tw-flex tw-items-center tw-gap-1 tw-pl-2 tw-pr-1 tw-py-0.5 tw-bg-gray-100 tw-rounded-full tw-text-xs tw-text-gray-700"
                        >
                          {user?.username || user?.email || uid}
                          {badge && (
                            <span className={`tw-ml-0.5 tw-px-1.5 tw-py-px tw-rounded-full tw-text-[10px] tw-font-medium ${badge.bg} ${badge.text}`}>
                              {badge.label[lang]}
                            </span>
                          )}
                          <button
                            onClick={() => toggleUser(uid)}
                            className="tw-p-0.5 tw-text-gray-400 hover:tw-text-red-500 tw-transition-colors"
                          >
                            <XMarkIcon className="tw-h-3 tw-w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Search */}
                <div className="tw-relative tw-mb-2">
                  <MagnifyingGlassIcon className="tw-absolute tw-left-2.5 tw-top-1/2 tw--translate-y-1/2 tw-h-3.5 tw-w-3.5 tw-text-gray-400" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder={t.searchUsers}
                    className="tw-w-full tw-pl-8 tw-pr-3 tw-py-2 tw-text-sm tw-border tw-border-gray-200 tw-rounded-lg tw-bg-white focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-gray-300"
                  />
                </div>

                {/* User list */}
                <div className="tw-max-h-[160px] tw-overflow-y-auto tw-border tw-border-gray-100 tw-rounded-lg tw-divide-y tw-divide-gray-50">
                  {loadingUsers ? (
                    <div className="tw-flex tw-items-center tw-justify-center tw-py-6">
                      <ArrowPathIcon className="tw-h-4 tw-w-4 tw-text-gray-400 tw-animate-spin" />
                      <span className="tw-ml-2 tw-text-xs tw-text-gray-400">{t.loading}</span>
                    </div>
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => {
                      const isSelected = editingRule.user_ids.includes(user.id);
                      const badge = roleBadge[user.role];
                      return (
                        <button
                          key={user.id}
                          onClick={() => toggleUser(user.id)}
                          className={`
                            tw-flex tw-items-center tw-gap-3 tw-w-full tw-px-3 tw-py-2.5
                            tw-text-left tw-transition-colors
                            ${isSelected ? "tw-bg-blue-50" : "hover:tw-bg-gray-50"}
                          `}
                        >
                          <UserCircleIcon className={`tw-h-7 tw-w-7 tw-flex-shrink-0 ${isSelected ? "tw-text-blue-500" : "tw-text-gray-300"}`} />
                          <div className="tw-flex-1 tw-min-w-0">
                            <div className="tw-flex tw-items-center tw-gap-1.5">
                              <p className={`tw-text-sm tw-font-medium tw-truncate ${isSelected ? "tw-text-blue-700" : "tw-text-gray-700"}`}>
                                {user.username}
                              </p>
                              {badge && (
                                <span className={`tw-px-1.5 tw-py-px tw-rounded-full tw-text-[10px] tw-font-medium tw-flex-shrink-0 ${badge.bg} ${badge.text}`}>
                                  {badge.label[lang]}
                                </span>
                              )}
                            </div>
                            <p className="tw-text-xs tw-text-gray-400 tw-truncate">{user.email}</p>
                          </div>
                          {isSelected && <CheckIcon className="tw-h-4 tw-w-4 tw-text-blue-500 tw-flex-shrink-0" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="tw-text-center tw-py-6 tw-text-xs tw-text-gray-400">{t.noUsersFound}</div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Enabled toggle */}
          <div className="tw-flex tw-items-center tw-justify-between">
            <span className="tw-text-sm tw-text-gray-700">{t.enabled}</span>
            <button
              onClick={() => setEditingRule((prev) => (prev ? { ...prev, enabled: !prev.enabled } : prev))}
              className={`tw-relative tw-w-10 tw-h-6 tw-rounded-full tw-transition-colors tw-duration-200 ${editingRule.enabled ? "tw-bg-gray-900" : "tw-bg-gray-300"}`}
            >
              <span className={`tw-absolute tw-left-0 tw-top-1 tw-w-4 tw-h-4 tw-bg-white tw-rounded-full tw-shadow tw-transition-transform tw-duration-200 ${editingRule.enabled ? "tw-translate-x-5" : "tw-translate-x-1"}`} />
            </button>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="tw-flex tw-gap-2 tw-mt-4 tw-pt-3 tw-border-t tw-border-gray-100">
          {!editingRule.id.startsWith("new-") && (
            <button
              onClick={() => {
                showConfirm({
                  title: lang === "th" ? "ยืนยันลบกฎ" : "Confirm Delete",
                  message: lang === "th"
                    ? `ลบกฎส่งอีเมลสำหรับสถานี "${editingRule.station_name}" ใช่หรือไม่?`
                    : `Delete email rule for station "${editingRule.station_name}"?`,
                  confirmLabel: lang === "th" ? "ลบ" : "Delete",
                  type: "danger",
                  onConfirm: () => {
                    deleteEmailRule(editingRule.id);
                    setSettingsView("email-rules");
                    setEditingRule(null);
                  },
                });
              }}
              className="tw-px-3 tw-py-2 tw-text-sm tw-font-medium tw-text-red-600 tw-bg-red-50 tw-rounded-lg hover:tw-bg-red-100 tw-transition-colors"
            >
              {t.delete}
            </button>
          )}
          <div className="tw-flex-1" />
          <button
            onClick={() => { setSettingsView("email-rules"); setEditingRule(null); }}
            className="tw-px-3 tw-py-2 tw-text-sm tw-font-medium tw-text-gray-600 tw-bg-gray-100 tw-rounded-lg hover:tw-bg-gray-200 tw-transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={() => {
              if (editingRule.station_id && editingRule.user_ids.length > 0) {
                const ruleToSave = editingRule.id.startsWith("new-")
                  ? { ...editingRule, id: `rule-${Date.now()}` }
                  : editingRule;
                showConfirm({
                  title: lang === "th" ? "ยืนยันบันทึก" : "Confirm Save",
                  message: lang === "th"
                    ? `บันทึกกฎส่งอีเมลสำหรับสถานี "${ruleToSave.station_name}" ใช่หรือไม่?`
                    : `Save email rule for station "${ruleToSave.station_name}"?`,
                  confirmLabel: lang === "th" ? "บันทึก" : "Save",
                  type: "primary",
                  onConfirm: () => {
                    saveEmailRule(ruleToSave);
                    setSettingsView("email-rules");
                    setEditingRule(null);
                  },
                });
              }
            }}
            disabled={!editingRule.station_id || editingRule.user_ids.length === 0}
            className="tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-text-white tw-bg-gray-900 tw-rounded-lg hover:tw-bg-gray-800 tw-transition-colors disabled:tw-opacity-40 disabled:tw-cursor-not-allowed"
          >
            {t.save}
          </button>
        </div>
      </div>
    );
  };

  // ===== Render: Email Rules List =====
  const renderEmailRulesList = () => (
    <div className="tw-flex tw-flex-col tw-h-full">
      <div className="tw-flex tw-items-center tw-gap-2 tw-mb-4">
        <button onClick={() => setSettingsView("main")} className="tw-p-1 tw-text-gray-400 hover:tw-text-gray-700 tw-transition-colors">
          <ChevronLeftIcon className="tw-h-4 tw-w-4" />
        </button>
        <div className="tw-flex-1">
          <h3 className="tw-text-sm tw-font-semibold tw-text-gray-900">{t.emailRules}</h3>
          <p className="tw-text-xs tw-text-gray-400">{t.emailRulesDesc}</p>
        </div>
        <button
          onClick={() => {
            fetchStations();
            fetchUsers();
            setEditingRule({
              id: `new-${Date.now()}`,
              station_id: "", station_name: "",
              chargebox_id: "all", user_ids: [], enabled: true,
            });
            setUserSearchQuery("");
            setSettingsView("email-rule-edit");
          }}
          className="tw-flex tw-items-center tw-gap-1 tw-px-2.5 tw-py-1.5 tw-text-xs tw-font-medium tw-text-white tw-bg-gray-900 tw-rounded-lg hover:tw-bg-gray-800 tw-transition-colors"
        >
          <PlusIcon className="tw-h-3.5 tw-w-3.5" />
          {t.addRule}
        </button>
      </div>

      <div className="tw-overflow-y-auto tw-max-h-[360px]">
        {settings.emailRules.length > 0 ? (
          <div className="tw-space-y-2">
            {settings.emailRules.map((rule) => (
              <div
                key={rule.id}
                className={`tw-flex tw-items-center tw-gap-3 tw-p-3 tw-rounded-xl tw-border tw-transition-all tw-cursor-pointer hover:tw-shadow-sm ${rule.enabled ? "tw-border-gray-200 tw-bg-white" : "tw-border-gray-100 tw-bg-gray-50 tw-opacity-60"}`}
                onClick={() => {
                  fetchStations();
                  fetchUsers();
                  setEditingRule({ ...rule });
                  setUserSearchQuery("");
                  setSettingsView("email-rule-edit");
                }}
              >
                <div className={`tw-p-2 tw-rounded-lg ${rule.enabled ? "tw-bg-blue-100" : "tw-bg-gray-100"}`}>
                  <EnvelopeIcon className={`tw-h-4 tw-w-4 ${rule.enabled ? "tw-text-blue-600" : "tw-text-gray-400"}`} />
                </div>
                <div className="tw-flex-1 tw-min-w-0">
                  <p className="tw-text-sm tw-font-medium tw-text-gray-800 tw-truncate">{rule.station_name || rule.station_id}</p>
                  <p className="tw-text-xs tw-text-gray-400 tw-truncate">
                    {rule.chargebox_id === "all" ? t.allChargers : rule.chargebox_id}
                    {" · "}{rule.user_ids.length} {lang === "th" ? "คน" : "user(s)"}
                  </p>
                </div>
                <div className="tw-flex tw-items-center tw-gap-1.5 tw-flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      showConfirm({
                        title: lang === "th" ? "ยืนยันลบกฎ" : "Confirm Delete",
                        message: lang === "th"
                          ? `ลบกฎส่งอีเมลสำหรับสถานี "${rule.station_name || rule.station_id}" ใช่หรือไม่?`
                          : `Delete email rule for station "${rule.station_name || rule.station_id}"?`,
                        confirmLabel: lang === "th" ? "ลบ" : "Delete",
                        type: "danger",
                        onConfirm: () => deleteEmailRule(rule.id),
                      });
                    }}
                    className="tw-p-1.5 tw-text-gray-300 hover:tw-text-red-500 tw-transition-colors tw-rounded-lg hover:tw-bg-red-50"
                    title={lang === "th" ? "ลบกฎ" : "Delete rule"}
                  >
                    <TrashIcon className="tw-h-3.5 tw-w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleEmailRule(rule.id); }}
                    className={`tw-relative tw-w-10 tw-h-6 tw-rounded-full tw-transition-colors tw-duration-200 ${rule.enabled ? "tw-bg-gray-900" : "tw-bg-gray-300"}`}
                  >
                    <span className={`tw-absolute tw-left-0 tw-top-1 tw-w-4 tw-h-4 tw-bg-white tw-rounded-full tw-shadow tw-transition-transform tw-duration-200 ${rule.enabled ? "tw-translate-x-5" : "tw-translate-x-1"}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-10 tw-text-gray-400">
            <EnvelopeIcon className="tw-h-10 tw-w-10 tw-mb-3 tw-opacity-30" />
            <p className="tw-text-sm tw-font-medium">{t.noRules}</p>
            <p className="tw-text-xs tw-mt-1">{t.noRulesDesc}</p>
          </div>
        )}
      </div>
    </div>
  );

  // ===== Render: Settings Main =====
  const renderSettingsMain = () => (
    <>
      <h3 className="tw-text-sm tw-font-semibold tw-text-gray-900 tw-mb-4">{t.settings}</h3>

      <div className="tw-flex tw-items-center tw-justify-between tw-py-2.5">
        <span className="tw-text-sm tw-text-gray-700">{t.settingsSound}</span>
        <button onClick={() => updateSettings({ enableSound: !settings.enableSound })} className={`tw-relative tw-w-10 tw-h-6 tw-rounded-full tw-transition-colors tw-duration-200 ${settings.enableSound ? "tw-bg-gray-900" : "tw-bg-gray-300"}`}>
          <span className={`tw-absolute tw-left-0 tw-top-1 tw-w-4 tw-h-4 tw-bg-white tw-rounded-full tw-shadow tw-transition-transform tw-duration-200 ${settings.enableSound ? "tw-translate-x-5" : "tw-translate-x-1"}`} />
        </button>
      </div>

      <div className="tw-flex tw-items-center tw-justify-between tw-py-2.5">
        <span className="tw-text-sm tw-text-gray-700">{t.settingsDesktop}</span>
        <button
          onClick={() => {
            if (!settings.enableDesktopNotif && "Notification" in window) {
              Notification.requestPermission().then((perm) => { if (perm === "granted") updateSettings({ enableDesktopNotif: true }); });
            } else {
              updateSettings({ enableDesktopNotif: !settings.enableDesktopNotif });
            }
          }}
          className={`tw-relative tw-w-10 tw-h-6 tw-rounded-full tw-transition-colors tw-duration-200 ${settings.enableDesktopNotif ? "tw-bg-gray-900" : "tw-bg-gray-300"}`}
        >
          <span className={`tw-absolute tw-left-0 tw-top-1 tw-w-4 tw-h-4 tw-bg-white tw-rounded-full tw-shadow tw-transition-transform tw-duration-200 ${settings.enableDesktopNotif ? "tw-translate-x-5" : "tw-translate-x-1"}`} />
        </button>
      </div>

      <div className="tw-flex tw-items-center tw-justify-between tw-py-2.5">
        <span className="tw-text-sm tw-text-gray-700">{t.settingsAutoRefresh}</span>
        <select value={settings.autoRefreshInterval} onChange={(e) => updateSettings({ autoRefreshInterval: Number(e.target.value) })} className="tw-text-sm tw-px-2 tw-py-1 tw-border tw-border-gray-200 tw-rounded-lg tw-bg-white tw-text-gray-700 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-gray-300">
          <option value={0}>{t.settingsOff}</option>
          <option value={15}>15s</option>
          <option value={30}>30s</option>
          <option value={60}>1 min</option>
          <option value={300}>5 min</option>
        </select>
      </div>

      <hr className="tw-my-3 tw-border-gray-100" />

      <button onClick={() => setSettingsView("email-rules")} className="tw-flex tw-items-center tw-justify-between tw-w-full tw-px-3 tw-py-3 tw-rounded-xl tw-border tw-border-gray-200 tw-bg-white hover:tw-bg-gray-50 tw-transition-colors tw-group">
        <div className="tw-flex tw-items-center tw-gap-3">
          <div className="tw-p-2 tw-bg-blue-100 tw-rounded-lg"><EnvelopeIcon className="tw-h-4 tw-w-4 tw-text-blue-600" /></div>
          <div className="tw-text-left">
            <p className="tw-text-sm tw-font-medium tw-text-gray-800">{t.emailRules}</p>
            <p className="tw-text-xs tw-text-gray-400">
              {settings.emailRules.length > 0
                ? `${settings.emailRules.filter((r) => r.enabled).length} ${lang === "th" ? "กฎที่เปิดใช้งาน" : "active rule(s)"}`
                : t.emailRulesDesc}
            </p>
          </div>
        </div>
        <ChevronLeftIcon className="tw-h-4 tw-w-4 tw-text-gray-300 tw-rotate-180 group-hover:tw-text-gray-500 tw-transition-colors" />
      </button>

      <hr className="tw-my-3 tw-border-gray-100" />

      <button
        onClick={() => {
          setSettings((prev) => {
            const next = { ...DEFAULT_SETTINGS, emailRules: prev.emailRules };
            persistSettings(next);
            return next;
          });
        }}
        className="tw-w-full tw-text-center tw-text-sm tw-text-gray-500 hover:tw-text-gray-800 tw-py-1.5 tw-transition-colors"
      >
        {t.settingsReset}
      </button>
    </>
  );

  // ===== Loading =====
  if (loading) {
    return (
      <div className="tw-w-full">
        <div className="tw-w-full tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-gray-200 tw-p-6">
          <div className="tw-flex tw-items-center tw-justify-center tw-py-16">
            <ArrowPathIcon className="tw-h-8 tw-w-8 tw-text-gray-400 tw-animate-spin" />
            <span className="tw-ml-3 tw-text-gray-500">{t.loading}</span>
          </div>
        </div>
      </div>
    );
  }

  // ===== Error =====
  if (error) {
    return (
      <div className="tw-w-full">
        <div className="tw-w-full tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-gray-200 tw-p-6">
          <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-16">
            <ExclamationTriangleIcon className="tw-h-12 tw-w-12 tw-text-red-400 tw-mb-4" />
            <p className="tw-text-gray-600 tw-mb-4">{error}</p>
            <button onClick={fetchNotifications} className="tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2 tw-bg-gray-900 tw-text-white tw-rounded-lg hover:tw-bg-gray-800 tw-transition-colors">
              <ArrowPathIcon className="tw-h-4 tw-w-4" />
              {t.retry}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tw-w-full">
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="tw-w-full tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-gray-200 tw-p-6">
        {/* Header */}
        <div className="tw-flex tw-items-center tw-justify-between tw-mb-6">
          <div className="tw-flex tw-items-center tw-gap-3">
            <div className="tw-p-3 tw-bg-gray-900 tw-rounded-xl"><BellIcon className="tw-h-6 tw-w-6 tw-text-white" /></div>
            <div>
              <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900">{t.title}</h1>

            </div>
          </div>

          <div className="tw-flex tw-items-center tw-gap-2">
            <button onClick={fetchNotifications} className="tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-2 tw-text-sm tw-font-medium tw-text-gray-600 tw-bg-white tw-border tw-border-gray-200 tw-rounded-lg hover:tw-bg-gray-50 tw-transition-colors" title={t.retry}>
              <ArrowPathIcon className="tw-h-4 tw-w-4" />
            </button>

            {/* Settings */}
            <div className="tw-relative" ref={settingsRef}>
              <button
                onClick={() => { setShowSettings((prev) => !prev); if (!showSettings) setSettingsView("main"); }}
                className={`tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-2 tw-text-sm tw-font-medium tw-border tw-rounded-lg tw-transition-colors ${showSettings ? "tw-bg-gray-900 tw-text-white tw-border-gray-900" : "tw-text-gray-600 tw-bg-white tw-border-gray-200 hover:tw-bg-gray-50"}`}
                title={t.settings}
              >
                <Cog6ToothIcon className="tw-h-4 tw-w-4" />
                <span className="tw-hidden sm:tw-inline">{t.settings}</span>
              </button>
              {showSettings && (
                <div className="tw-absolute tw-right-0 tw-top-full tw-mt-2 tw-z-50 tw-w-96 tw-bg-white tw-rounded-xl tw-shadow-lg tw-border tw-border-gray-200 tw-p-5">
                  {settingsView === "main" && renderSettingsMain()}
                  {settingsView === "email-rules" && renderEmailRulesList()}
                  {settingsView === "email-rule-edit" && renderEmailRuleEdit()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-4 tw-mb-4">
          {/* ★ Date filter */}
          <div className="tw-flex tw-items-center tw-gap-2">
            <label className="tw-text-sm tw-text-gray-500">{t.dateFrom}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="tw-px-3 tw-py-2 tw-text-sm tw-bg-white tw-border tw-border-gray-200 tw-rounded-lg tw-text-gray-700 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-gray-300"
            />
            <label className="tw-text-sm tw-text-gray-500">{t.dateTo}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="tw-px-3 tw-py-2 tw-text-sm tw-bg-white tw-border tw-border-gray-200 tw-rounded-lg tw-text-gray-700 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-gray-300"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="tw-p-1.5 tw-text-gray-400 hover:tw-text-gray-600"
              >
                <XMarkIcon className="tw-h-4 tw-w-4" />
              </button>
            )}
          </div>
          {/* ★ Station filter (searchable) */}
          <div className="tw-flex tw-items-center tw-gap-2">
            <label className="tw-text-sm tw-text-gray-500">{lang === "th" ? "สถานี:" : "Station:"}</label>
            <div className="tw-relative tw-min-w-[200px] tw-max-w-[300px]" ref={stationDropdownRef}>
              <input
                type="text"
                value={stationDropdownOpen ? stationSearch : (selectedStation === "all" ? "" : (stationList.find(s => s.id === selectedStation)?.name || selectedStation))}
                placeholder={`${lang === "th" ? "ทั้งหมด" : "All Stations"} (${stationList.length})`}
                onFocus={() => { setStationDropdownOpen(true); setStationSearch(""); }}
                onChange={(e) => setStationSearch(e.target.value)}
                className="tw-w-full tw-px-3 tw-py-2 tw-text-sm tw-bg-white tw-border tw-border-gray-200 tw-rounded-lg tw-text-gray-700 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-gray-300"
              />
              {selectedStation !== "all" && !stationDropdownOpen && (
                <button
                  onClick={() => { setSelectedStation("all"); setSelectedCharger("all"); setStationSearch(""); }}
                  className="tw-absolute tw-right-2 tw-top-1/2 tw--translate-y-1/2 tw-p-0.5 tw-text-gray-400 hover:tw-text-gray-600"
                >
                  <XMarkIcon className="tw-h-4 tw-w-4" />
                </button>
              )}
              {stationDropdownOpen && (
                <div className="tw-absolute tw-left-0 tw-top-full tw-mt-1 tw-w-full tw-max-h-[240px] tw-overflow-y-auto tw-bg-white tw-border tw-border-gray-200 tw-rounded-lg tw-shadow-lg tw-z-50">
                  <button
                    onClick={() => { setSelectedStation("all"); setSelectedCharger("all"); setStationDropdownOpen(false); setStationSearch(""); }}
                    className={`tw-w-full tw-text-left tw-px-3 tw-py-2 tw-text-sm hover:tw-bg-gray-50 ${selectedStation === "all" ? "tw-bg-blue-50 tw-text-blue-700 tw-font-medium" : "tw-text-gray-700"}`}
                  >
                    {lang === "th" ? "ทั้งหมด" : "All Stations"} ({stationList.length})
                  </button>
                  {stationList
                    .filter(s => s.name.toLowerCase().includes(stationSearch.toLowerCase()) || s.id.toLowerCase().includes(stationSearch.toLowerCase()))
                    .map((s) => {
                      const count = notifications.filter((n) => n.station_id === s.id).length;
                      return (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedStation(s.id); setSelectedCharger("all"); setStationDropdownOpen(false); setStationSearch(""); }}
                          className={`tw-w-full tw-text-left tw-px-3 tw-py-2 tw-text-sm hover:tw-bg-gray-50 ${selectedStation === s.id ? "tw-bg-blue-50 tw-text-blue-700 tw-font-medium" : "tw-text-gray-700"}`}
                        >
                          {s.name} {count > 0 ? `(${count})` : ""}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* ★ SN (Charger) filter (searchable) */}
          <div className="tw-flex tw-items-center tw-gap-2">
            <label className="tw-text-sm tw-text-gray-500">{lang === "th" ? "ตู้ชาร์จ:" : "Charger:"}</label>
            <div className="tw-relative tw-min-w-[200px] tw-max-w-[300px]" ref={chargerDropdownRef}>
              <input
                type="text"
                value={chargerDropdownOpen ? chargerSearch : (selectedCharger === "all" ? "" : (() => { const c = chargerList.find(c => c.sn === selectedCharger); return c ? `${c.chargerNo ? `Charger ${c.chargerNo}` : c.chargeBoxID || c.sn} (${c.sn})` : selectedCharger; })())}
                placeholder={`${lang === "th" ? "ทั้งหมด" : "All Chargers"} (${chargerList.length})`}
                onFocus={() => { setChargerDropdownOpen(true); setChargerSearch(""); }}
                onChange={(e) => setChargerSearch(e.target.value)}
                className="tw-w-full tw-px-3 tw-py-2 tw-text-sm tw-bg-white tw-border tw-border-gray-200 tw-rounded-lg tw-text-gray-700 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-gray-300"
              />
              {selectedCharger !== "all" && !chargerDropdownOpen && (
                <button
                  onClick={() => { setSelectedCharger("all"); setChargerSearch(""); }}
                  className="tw-absolute tw-right-2 tw-top-1/2 tw--translate-y-1/2 tw-p-0.5 tw-text-gray-400 hover:tw-text-gray-600"
                >
                  <XMarkIcon className="tw-h-4 tw-w-4" />
                </button>
              )}
              {chargerDropdownOpen && (
                <div className="tw-absolute tw-left-0 tw-top-full tw-mt-1 tw-w-full tw-max-h-[240px] tw-overflow-y-auto tw-bg-white tw-border tw-border-gray-200 tw-rounded-lg tw-shadow-lg tw-z-50">
                  <button
                    onClick={() => { setSelectedCharger("all"); setChargerDropdownOpen(false); setChargerSearch(""); }}
                    className={`tw-w-full tw-text-left tw-px-3 tw-py-2 tw-text-sm hover:tw-bg-gray-50 ${selectedCharger === "all" ? "tw-bg-blue-50 tw-text-blue-700 tw-font-medium" : "tw-text-gray-700"}`}
                  >
                    {lang === "th" ? "ทั้งหมด" : "All Chargers"} ({chargerList.length})
                  </button>
                  {chargerList
                    .filter(c => c.sn.toLowerCase().includes(chargerSearch.toLowerCase()) || (c.chargeBoxID || "").toLowerCase().includes(chargerSearch.toLowerCase()))
                    .map((c) => {
                      const count = notifications.filter((n) => n.sn === c.sn).length;
                      return (
                        <button
                          key={c.sn}
                          onClick={() => { setSelectedCharger(c.sn); setChargerDropdownOpen(false); setChargerSearch(""); }}
                          className={`tw-w-full tw-text-left tw-px-3 tw-py-2 tw-text-sm hover:tw-bg-gray-50 ${selectedCharger === c.sn ? "tw-bg-blue-50 tw-text-blue-700 tw-font-medium" : "tw-text-gray-700"}`}
                        >
                          {c.chargerNo ? `Charger ${c.chargerNo}` : c.chargeBoxID || c.sn}
                          {` (${c.sn})`}
                          {count > 0 ? ` — ${count} ${lang === "th" ? "รายการ" : "alert(s)"}` : ""}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notification List */}
        {/* Notification List */}
        <div className="tw-overflow-x-auto tw-w-full tw-rounded-xl tw-border tw-border-blue-gray-100 tw-shadow-sm">
          <table className="tw-w-full tw-border-separate tw-border-spacing-0 tw-min-w-[900px]">
            <thead className="tw-bg-gradient-to-r tw-from-gray-900 tw-to-gray-800">
              <tr>
                {/* unread indicator column */}
                {/* <th className="tw-w-1 tw-p-0" /> */}
                {[
                  { label: lang === "th" ? "วันที่" : "Date" },
                  { label: lang === "th" ? "เวลา" : "Time" },
                  { label: lang === "th" ? "สถานี" : "Station" },
                  { label: "Event" },
                  { label: "Connector" },
                  { label: lang === "th" ? "ข้อความ" : "Message" },
                  { label: lang === "th" ? "เมื่อ" : "When" },
                  // { label: lang === "th" ? "จัดการ" : "Actions" },
                ].map((h) => (
                  <th key={h.label} className="tw-px-3 tw-py-3 tw-text-left tw-whitespace-nowrap">
                    <span className="tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-wider tw-text-white/80">
                      {h.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredNotifications.length > 0 ? (
                filteredNotifications.map((notification, i) => {
                  return (
                    <tr
                      key={notification.id}
                      className={`tw-transition-colors hover:tw-bg-blue-50/40 hover:tw-shadow-[inset_3px_0_0_0_#2196F3]
  ${i % 2 === 0 ? "tw-bg-white" : "tw-bg-blue-gray-50/30"}`}
                    >

                      {/* Date */}
                      <td className="tw-px-3 tw-py-3 tw-border-y tw-border-x-0 tw-border-blue-gray-50 tw-whitespace-nowrap">
                        <span className="tw-text-xs tw-tabular-nums tw-text-blue-gray-600">
                          {notification.timestamp
                            ? new Date(notification.timestamp).toLocaleDateString("th-TH", {
                              year: "numeric", month: "short", day: "numeric",
                            })
                            : "—"}
                        </span>
                      </td>

                      {/* Time */}
                      <td className="tw-px-3 tw-py-3 tw-border-y tw-border-x-0 tw-border-blue-gray-50 tw-whitespace-nowrap">
                        <span className="tw-text-xs tw-tabular-nums tw-font-mono tw-text-blue-gray-600">
                          {notification.timestamp
                            ? new Date(notification.timestamp).toLocaleTimeString("th-TH", {
                              hour: "2-digit", minute: "2-digit", second: "2-digit",
                            })
                            : "—"}
                        </span>
                      </td>

                      {/* Station */}
                      <td className="tw-px-3 tw-py-3 tw-border-y tw-border-x-0 tw-border-blue-gray-50 tw-whitespace-nowrap">
                        <span className="tw-text-xs tw-tabular-nums tw-text-blue-gray-600">
                          {notification.station_name || notification.station_id}
                        </span>
                      </td>

                      {/* Charger */}
                      <td className="tw-px-3 tw-py-3 tw-border-y tw-border-x-0 tw-border-blue-gray-50 tw-whitespace-nowrap">
                        {notification.charger_no ? (
                          <span className="tw-text-xs tw-font-medium tw-text-blue-gray-700">
                            Charger {notification.charger_no}
                          </span>
                        ) : (
                          <span className="tw-text-blue-gray-300 tw-text-xs">—</span>
                        )}
                      </td>

                      {/* Connector */}
                      <td className="tw-px-3 tw-py-3 tw-border-y tw-border-x-0 tw-border-blue-gray-50 tw-whitespace-nowrap">
                        {notification.head ? (
                          <span className="tw-text-xs tw-font-medium tw-text-blue-gray-700">
                            {String(notification.head).replace(/^head\s*/i, "")}
                          </span>
                        ) : (
                          <span className="tw-text-blue-gray-300 tw-text-xs">—</span>
                        )}
                      </td>

                      {/* Message */}
                      <td className="tw-px-3 tw-py-3 tw-border-y tw-border-x-0 tw-border-blue-gray-50 tw-max-w-xs">
                        <span className="tw-text-xs tw-text-blue-gray-700 tw-font-medium">
                          {notification.error}
                        </span>
                      </td>

                      {/* When */}
                      <td className="tw-px-3 tw-py-3 tw-border-y tw-border-x-0 tw-border-blue-gray-50 tw-whitespace-nowrap">
                        <span className="tw-text-xs tw-text-blue-gray-400">{formatTime(notification.timestamp)}</span>
                      </td>

                      {/* Actions */}
                      {/* <td className="tw-px-3 tw-py-3 tw-border-y tw-border-x-0 tw-border-blue-gray-50">
                        <span className="tw-inline-flex tw-items-center tw-gap-1">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification)}
                              className="tw-group/btn tw-rounded-lg tw-p-1.5 tw-bg-blue-50 tw-ring-1 tw-ring-blue-200/60 hover:tw-bg-blue-600 hover:tw-ring-blue-600 tw-transition-all tw-duration-200 tw-shadow-sm"
                              title={lang === "th" ? "อ่านแล้ว" : "Mark as read"}
                            >
                              <CheckCircleIcon className="tw-h-3.5 tw-w-3.5 tw-text-blue-600 group-hover/btn:tw-text-white tw-transition-colors" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification)}
                            className="tw-group/btn tw-rounded-lg tw-p-1.5 tw-bg-red-50 tw-ring-1 tw-ring-red-200/60 hover:tw-bg-red-600 hover:tw-ring-red-600 tw-transition-all tw-duration-200 tw-shadow-sm"
                            title={lang === "th" ? "ลบ" : "Delete"}
                          >
                            <XMarkIcon className="tw-h-3.5 tw-w-3.5 tw-text-red-500 group-hover/btn:tw-text-white tw-transition-colors" />
                          </button>
                        </span>
                      </td> */}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="tw-px-4 tw-py-16 tw-text-center">
                    <div className="tw-flex tw-flex-col tw-items-center tw-gap-3 tw-text-blue-gray-400">
                      <BellIcon className="tw-h-12 tw-w-12 tw-opacity-20" />
                      <p className="tw-text-sm tw-font-medium">{t.noNotifications}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="tw-fixed tw-inset-0 tw-z-[200] tw-flex tw-items-center tw-justify-center">
          <div className="tw-absolute tw-inset-0 tw-bg-black/40" onClick={() => setConfirmDialog(null)} />
          <div className="tw-relative tw-bg-white tw-rounded-2xl tw-shadow-2xl tw-border tw-border-gray-200 tw-p-6 tw-w-[380px] tw-max-w-[90vw] tw-animate-[slideUp_0.2s_ease-out]">
            <h3 className="tw-text-base tw-font-semibold tw-text-gray-900 tw-mb-2">{confirmDialog.title}</h3>
            <p className="tw-text-sm tw-text-gray-600 tw-mb-6">{confirmDialog.message}</p>
            <div className="tw-flex tw-justify-end tw-gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-text-gray-600 tw-bg-gray-100 tw-rounded-lg hover:tw-bg-gray-200 tw-transition-colors"
              >
                {confirmDialog.cancelLabel}
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className={`tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-text-white tw-rounded-lg tw-transition-colors ${confirmDialog.type === "danger"
                  ? "tw-bg-red-600 hover:tw-bg-red-700"
                  : "tw-bg-gray-900 hover:tw-bg-gray-800"
                  }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toast && (
        <div className="tw-fixed tw-bottom-6 tw-right-6 tw-z-[100] tw-animate-[slideUp_0.3s_ease-out]">
          <div
            className={`tw-flex tw-items-center tw-gap-3 tw-px-5 tw-py-3.5 tw-rounded-xl tw-shadow-lg tw-border tw-min-w-[280px] ${toast.type === "success"
              ? "tw-bg-emerald-50 tw-border-emerald-200 tw-text-emerald-800"
              : "tw-bg-red-50 tw-border-red-200 tw-text-red-800"
              }`}
          >
            {toast.type === "success" ? (
              <CheckCircleIcon className="tw-h-5 tw-w-5 tw-text-emerald-500 tw-flex-shrink-0" />
            ) : (
              <ExclamationTriangleIcon className="tw-h-5 tw-w-5 tw-text-red-500 tw-flex-shrink-0" />
            )}
            <span className="tw-text-sm tw-font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="tw-ml-auto tw-p-1 tw-opacity-60 hover:tw-opacity-100 tw-transition-opacity"
            >
              <XMarkIcon className="tw-h-4 tw-w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}