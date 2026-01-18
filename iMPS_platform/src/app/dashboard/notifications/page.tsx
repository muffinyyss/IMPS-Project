"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  BellIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
  TrashIcon,
  CheckIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";

type Lang = "th" | "en";
type NotificationType = "info" | "warning" | "success" | "error";

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
  read: boolean;
  type: NotificationType;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const typeConfig: Record<NotificationType, { icon: React.ElementType; bgColor: string; iconColor: string }> = {
  info: { icon: InformationCircleIcon, bgColor: "tw-bg-blue-100", iconColor: "tw-text-blue-600" },
  warning: { icon: ExclamationTriangleIcon, bgColor: "tw-bg-amber-100", iconColor: "tw-text-amber-600" },
  success: { icon: CheckCircleIcon, bgColor: "tw-bg-emerald-100", iconColor: "tw-text-emerald-600" },
  error: { icon: ExclamationTriangleIcon, bgColor: "tw-bg-red-100", iconColor: "tw-text-red-600" },
};

export default function NotificationsPage() {
  const [lang, setLang] = useState<Lang>("th");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selectedCharger, setSelectedCharger] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ===== Language =====
  useEffect(() => {
    const savedLang = localStorage.getItem("app_language") as Lang | null;
    if (savedLang === "th" || savedLang === "en") {
      setLang(savedLang);
    }

    const handleLangChange = (e: CustomEvent) => {
      setLang(e.detail.lang);
    };
    window.addEventListener("language:change", handleLangChange as EventListener);
    return () => window.removeEventListener("language:change", handleLangChange as EventListener);
  }, []);

  const t = {
    title: lang === "th" ? "การแจ้งเตือน" : "Notifications",
    all: lang === "th" ? "ทั้งหมด" : "All",
    unread: lang === "th" ? "ยังไม่อ่าน" : "Unread",
    markAllRead: lang === "th" ? "อ่านทั้งหมด" : "Mark all read",
    deleteAll: lang === "th" ? "ลบทั้งหมด" : "Delete all",
    noNotifications: lang === "th" ? "ไม่มีการแจ้งเตือน" : "No notifications",
    noUnread: lang === "th" ? "ไม่มีการแจ้งเตือนที่ยังไม่อ่าน" : "No unread notifications",
    loading: lang === "th" ? "กำลังโหลด..." : "Loading...",
    errorLoading: lang === "th" ? "ไม่สามารถโหลดข้อมูลได้" : "Failed to load data",
    retry: lang === "th" ? "ลองใหม่" : "Retry",
    station: lang === "th" ? "สถานี" : "Station",
    charger: lang === "th" ? "ตู้ชาร์จ" : "Charger",
  };

  // ===== Fetch Notifications from Backend =====
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("access_token");
      
      const res = await fetch(`${API_BASE}/notifications/all?limit=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log("[Notifications] Fetched:", data);
      
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error("[Notifications] Fetch error:", err);
      setError(t.errorLoading);
    } finally {
      setLoading(false);
    }
  }, [t.errorLoading]);

  // ===== Fetch on mount =====
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ===== Get unique charger list =====
  const chargerList = React.useMemo(() => {
    const chargers = notifications
      .map(n => n.chargebox_id)
      .filter((id): id is string => !!id);
    return Array.from(new Set(chargers)).sort();
  }, [notifications]);

  // ===== Computed Values =====
  const filteredNotifications = React.useMemo(() => {
    let result = notifications;
    
    // Filter by charger
    if (selectedCharger !== "all") {
      result = result.filter(n => n.chargebox_id === selectedCharger);
    }
    
    // Filter by read status
    if (filter === "unread") {
      result = result.filter(n => !n.read);
    }
    
    return result;
  }, [notifications, selectedCharger, filter]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // ===== Actions =====
  const markAsRead = async (notification: Notification) => {
    try {
      const token = localStorage.getItem("access_token");
      
      await fetch(
        `${API_BASE}/notifications/${notification.id}/read?station_id=${notification.station_id}`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
    } catch (err) {
      console.error("[Notifications] Mark as read error:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem("access_token");
      
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error("[Notifications] Mark all read error:", err);
    }
  };

  const deleteNotification = async (notification: Notification) => {
    try {
      const token = localStorage.getItem("access_token");
      
      await fetch(
        `${API_BASE}/notifications/${notification.id}?station_id=${notification.station_id}`,
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    } catch (err) {
      console.error("[Notifications] Delete error:", err);
    }
  };

  const deleteAll = () => {
    // TODO: Add batch delete API
    setNotifications([]);
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

    if (diffMins < 1) {
      return lang === "th" ? "เมื่อสักครู่" : "Just now";
    } else if (diffMins < 60) {
      return lang === "th" ? `${diffMins} นาทีที่แล้ว` : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return lang === "th" ? `${diffHours} ชั่วโมงที่แล้ว` : `${diffHours}h ago`;
    } else {
      return lang === "th" ? `${diffDays} วันที่แล้ว` : `${diffDays}d ago`;
    }
  };

  // ===== Loading State =====
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

  // ===== Error State =====
  if (error) {
    return (
      <div className="tw-w-full">
        <div className="tw-w-full tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-gray-200 tw-p-6">
          <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-16">
            <ExclamationTriangleIcon className="tw-h-12 tw-w-12 tw-text-red-400 tw-mb-4" />
            <p className="tw-text-gray-600 tw-mb-4">{error}</p>
            <button
              onClick={fetchNotifications}
              className="tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2 tw-bg-gray-900 tw-text-white tw-rounded-lg hover:tw-bg-gray-800 tw-transition-colors"
            >
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
      <div className="tw-w-full tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-gray-200 tw-p-6">
        {/* Header */}
        <div className="tw-flex tw-items-center tw-justify-between tw-mb-6">
          <div className="tw-flex tw-items-center tw-gap-3">
            <div className="tw-p-3 tw-bg-gray-900 tw-rounded-xl">
              <BellIcon className="tw-h-6 tw-w-6 tw-text-white" />
            </div>
            <div>
              <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900">{t.title}</h1>
              {unreadCount > 0 && (
                <p className="tw-text-sm tw-text-gray-500">
                  {unreadCount} {lang === "th" ? "รายการยังไม่อ่าน" : "unread"}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="tw-flex tw-items-center tw-gap-2">
            {/* Refresh Button */}
            <button
              onClick={fetchNotifications}
              className="
                tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-2
                tw-text-sm tw-font-medium tw-text-gray-600
                tw-bg-white tw-border tw-border-gray-200 tw-rounded-lg
                hover:tw-bg-gray-50 tw-transition-colors
              "
              title={t.retry}
            >
              <ArrowPathIcon className="tw-h-4 tw-w-4" />
            </button>
            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="
                tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-2
                tw-text-sm tw-font-medium tw-text-gray-600
                tw-bg-white tw-border tw-border-gray-200 tw-rounded-lg
                hover:tw-bg-gray-50 tw-transition-colors
                disabled:tw-opacity-50 disabled:tw-cursor-not-allowed
              "
            >
              <CheckIcon className="tw-h-4 tw-w-4" />
              <span className="tw-hidden sm:tw-inline">{t.markAllRead}</span>
            </button>
            <button
              onClick={deleteAll}
              disabled={notifications.length === 0}
              className="
                tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-2
                tw-text-sm tw-font-medium tw-text-red-600
                tw-bg-white tw-border tw-border-gray-200 tw-rounded-lg
                hover:tw-bg-red-50 tw-transition-colors
                disabled:tw-opacity-50 disabled:tw-cursor-not-allowed
              "
            >
              <TrashIcon className="tw-h-4 tw-w-4" />
              <span className="tw-hidden sm:tw-inline">{t.deleteAll}</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-4 tw-mb-4">
          {/* Read Status Filter */}
          <div className="tw-flex tw-gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`
                tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-rounded-lg tw-transition-colors
                ${filter === "all"
                  ? "tw-bg-gray-900 tw-text-white"
                  : "tw-bg-white tw-text-gray-600 tw-border tw-border-gray-200 hover:tw-bg-gray-50"
                }
              `}
            >
              {t.all} ({notifications.length})
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`
                tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-rounded-lg tw-transition-colors
                ${filter === "unread"
                  ? "tw-bg-gray-900 tw-text-white"
                  : "tw-bg-white tw-text-gray-600 tw-border tw-border-gray-200 hover:tw-bg-gray-50"
                }
              `}
            >
              {t.unread} ({unreadCount})
            </button>
          </div>

          {/* Charger Dropdown */}
          <div className="tw-flex tw-items-center tw-gap-2">
            <label className="tw-text-sm tw-text-gray-500">
              {lang === "th" ? "ตู้ชาร์จ:" : "Charger:"}
            </label>
            <select
              value={selectedCharger}
              onChange={(e) => setSelectedCharger(e.target.value)}
              className="
                tw-px-3 tw-py-2 tw-text-sm
                tw-bg-white tw-border tw-border-gray-200 tw-rounded-lg
                tw-text-gray-700
                focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-gray-300
                tw-min-w-[200px] tw-max-w-[300px]
              "
            >
              <option value="all">
                {lang === "th" ? "ทั้งหมด" : "All Chargers"} ({notifications.length})
              </option>
              {chargerList.map((chargerId) => {
                const count = notifications.filter(n => n.chargebox_id === chargerId).length;
                return (
                  <option key={chargerId} value={chargerId}>
                    {chargerId} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Notification List */}
        <div className="tw-space-y-3">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((notification) => {
              const config = typeConfig[notification.type] || typeConfig.error;
              const IconComponent = config.icon;

              return (
                <div
                  key={notification.id}
                  className={`
                    tw-relative tw-flex tw-items-start tw-gap-4 tw-p-4
                    tw-bg-white tw-rounded-xl tw-border tw-transition-all
                    ${notification.read
                      ? "tw-border-gray-100"
                      : "tw-border-gray-200 tw-shadow-sm"
                    }
                  `}
                >
                  {/* Unread indicator */}
                  {!notification.read && (
                    <div className="tw-absolute tw-top-4 tw-left-0 tw-w-1 tw-h-8 tw-bg-blue-500 tw-rounded-r-full" />
                  )}

                  {/* Icon */}
                  <div className={`tw-flex-shrink-0 tw-p-2.5 tw-rounded-xl ${config.bgColor}`}>
                    <IconComponent className={`tw-h-5 tw-w-5 ${config.iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="tw-flex-1 tw-min-w-0">
                    {/* Station Name, ChargerNo, ChargerBoxID - ด้านบน */}
                    <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-mb-2">
                      <span className={`tw-text-xs tw-font-medium tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-gray-800 tw-text-white`}>
                        {notification.station_name || notification.station_id}
                      </span>
                      {notification.charger_no && (
                        <span className={`tw-text-xs tw-font-medium tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-blue-600 tw-text-white`}>
                          Charger{notification.charger_no}
                        </span>
                      )}
                      {notification.chargebox_id && (
                        <span className={`tw-text-xs tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-gray-100 ${notification.read ? "tw-text-gray-400" : "tw-text-gray-600"}`}>
                          {notification.chargebox_id}
                        </span>
                      )}
                    </div>

                    {/* Error Message */}
                    <div className="tw-flex tw-items-start tw-justify-between tw-gap-2">
                      <p className={`tw-text-sm ${notification.read ? "tw-text-gray-500" : "tw-text-gray-700"}`}>
                        {notification.error}
                      </p>
                      <span className="tw-text-xs tw-text-gray-400 tw-whitespace-nowrap">
                        {formatTime(notification.timestamp)}
                      </span>
                    </div>
                    
                    {/* Timestamp */}
                    {notification.timestamp && (
                      <p className={`tw-text-xs tw-mt-2 ${notification.read ? "tw-text-gray-400" : "tw-text-gray-500"}`}>
                        🕐 {new Date(notification.timestamp).toLocaleString("th-TH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="tw-flex tw-items-center tw-gap-1">
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification)}
                        className="tw-p-1.5 tw-text-gray-400 hover:tw-text-blue-600 tw-transition-colors"
                        title={lang === "th" ? "อ่านแล้ว" : "Mark as read"}
                      >
                        <CheckCircleIcon className="tw-h-5 tw-w-5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification)}
                      className="tw-p-1.5 tw-text-gray-400 hover:tw-text-red-600 tw-transition-colors"
                      title={lang === "th" ? "ลบ" : "Delete"}
                    >
                      <XMarkIcon className="tw-h-5 tw-w-5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-16 tw-text-gray-400">
              <BellIcon className="tw-h-16 tw-w-16 tw-mb-4 tw-opacity-30" />
              <p className="tw-text-lg tw-font-medium">
                {filter === "all" ? t.noNotifications : t.noUnread}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}