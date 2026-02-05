/**
 * Draft Management Utilities for CM Report In Progress Form
 * ไฟล์นี้จัดการการบันทึก/โหลด draft ข้อมูลอัตโนมัติ
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// ==================== TYPES ====================
export interface DraftImage {
    id: string;
    name: string;
    base64: string;  // data:image/...;base64,...
}

export interface DraftCorrectiveAction {
    text: string;
    images: DraftImage[];
}

export interface DraftData {
    corrective_actions: DraftCorrectiveAction[];
    repaired_equipment: string[];
    repair_result: string;
    preventive_action: string[];
    inprogress_remarks: string;
    savedAt?: string;
    savedBy?: string;
}

export interface DraftResponse {
    ok: boolean;
    draft: DraftData | null;
    hasDraft: boolean;
}

export interface SaveDraftResponse {
    ok: boolean;
    savedAt: string;
}

// ==================== API FUNCTIONS ====================

/**
 * บันทึก draft ไปยัง server
 */
export async function saveDraft(
    reportId: string,
    stationId: string,
    draftData: DraftData
): Promise<SaveDraftResponse> {
    const res = await fetch(
        `${API_BASE}/cmreport/${encodeURIComponent(reportId)}/draft`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                station_id: stationId,
                draft_data: draftData,
            }),
        }
    );

    if (!res.ok) {
        throw new Error(`Failed to save draft: ${res.status}`);
    }

    return res.json();
}

/**
 * โหลด draft จาก server
 */
export async function loadDraft(
    reportId: string,
    stationId: string
): Promise<DraftResponse> {
    const res = await fetch(
        `${API_BASE}/cmreport/${encodeURIComponent(reportId)}/draft?station_id=${encodeURIComponent(stationId)}`,
        { credentials: "include" }
    );

    if (!res.ok) {
        throw new Error(`Failed to load draft: ${res.status}`);
    }

    return res.json();
}

/**
 * ลบ draft จาก server
 */
export async function deleteDraft(
    reportId: string,
    stationId: string
): Promise<{ ok: boolean }> {
    const res = await fetch(
        `${API_BASE}/cmreport/${encodeURIComponent(reportId)}/draft?station_id=${encodeURIComponent(stationId)}`,
        { method: "DELETE", credentials: "include" }
    );

    if (!res.ok) {
        throw new Error(`Failed to delete draft: ${res.status}`);
    }

    return res.json();
}

// ==================== LOCAL STORAGE FALLBACK ====================

const DRAFT_STORAGE_PREFIX = "cm_draft_";

/**
 * บันทึก draft ลง localStorage (fallback เมื่อ offline)
 */
export function saveDraftLocal(reportId: string, draftData: DraftData): void {
    try {
        const key = `${DRAFT_STORAGE_PREFIX}${reportId}`;
        const dataWithTimestamp = {
            ...draftData,
            savedAt: new Date().toISOString(),
        };
        localStorage.setItem(key, JSON.stringify(dataWithTimestamp));
    } catch (e) {
        console.error("Failed to save draft to localStorage:", e);
    }
}

/**
 * โหลด draft จาก localStorage
 */
export function loadDraftLocal(reportId: string): DraftData | null {
    try {
        const key = `${DRAFT_STORAGE_PREFIX}${reportId}`;
        const data = localStorage.getItem(key);
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.error("Failed to load draft from localStorage:", e);
    }
    return null;
}

/**
 * ลบ draft จาก localStorage
 */
export function deleteDraftLocal(reportId: string): void {
    try {
        const key = `${DRAFT_STORAGE_PREFIX}${reportId}`;
        localStorage.removeItem(key);
    } catch (e) {
        console.error("Failed to delete draft from localStorage:", e);
    }
}

/**
 * ลบ draft ทั้งหมดที่เก่ากว่า X วัน
 */
export function cleanupOldDrafts(maxAgeDays: number = 7): void {
    try {
        const now = Date.now();
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(DRAFT_STORAGE_PREFIX)) {
                const data = localStorage.getItem(key);
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.savedAt) {
                            const savedTime = new Date(parsed.savedAt).getTime();
                            if (now - savedTime > maxAgeMs) {
                                localStorage.removeItem(key);
                            }
                        }
                    } catch {
                        // ลบถ้า parse ไม่ได้
                        localStorage.removeItem(key);
                    }
                }
            }
        }
    } catch (e) {
        console.error("Failed to cleanup old drafts:", e);
    }
}

// ==================== DRAFT MANAGER CLASS ====================

export class DraftManager {
    private reportId: string;
    private stationId: string;
    private debounceTimeout: NodeJS.Timeout | null = null;
    private debounceDelay: number;
    private onStatusChange?: (status: DraftStatus) => void;

    constructor(
        reportId: string,
        stationId: string,
        options?: {
            debounceDelay?: number;
            onStatusChange?: (status: DraftStatus) => void;
        }
    ) {
        this.reportId = reportId;
        this.stationId = stationId;
        this.debounceDelay = options?.debounceDelay ?? 2000;
        this.onStatusChange = options?.onStatusChange;
    }

    /**
     * บันทึก draft พร้อม debounce
     */
    saveWithDebounce(draftData: DraftData): void {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.debounceTimeout = setTimeout(async () => {
            await this.save(draftData);
        }, this.debounceDelay);
    }

    /**
     * บันทึก draft ทันที
     */
    async save(draftData: DraftData): Promise<boolean> {
        this.onStatusChange?.("saving");

        try {
            // พยายามบันทึกไป server ก่อน
            await saveDraft(this.reportId, this.stationId, draftData);
            // ลบ local draft ถ้า server save สำเร็จ
            deleteDraftLocal(this.reportId);
            this.onStatusChange?.("saved");
            return true;
        } catch (e) {
            console.error("Server draft save failed, saving locally:", e);
            // Fallback ไป localStorage
            saveDraftLocal(this.reportId, draftData);
            this.onStatusChange?.("saved-local");
            return false;
        }
    }

    /**
     * โหลด draft (ลอง server ก่อน แล้ว fallback ไป local)
     */
    async load(): Promise<DraftData | null> {
        try {
            // ลอง server ก่อน
            const response = await loadDraft(this.reportId, this.stationId);
            if (response.hasDraft && response.draft) {
                return response.draft;
            }
        } catch (e) {
            console.error("Server draft load failed:", e);
        }

        // Fallback ไป localStorage
        return loadDraftLocal(this.reportId);
    }

    /**
     * ลบ draft ทั้ง server และ local
     */
    async delete(): Promise<void> {
        // ลบ local ก่อน
        deleteDraftLocal(this.reportId);

        // แล้วลบ server
        try {
            await deleteDraft(this.reportId, this.stationId);
        } catch (e) {
            console.error("Server draft delete failed:", e);
        }
    }

    /**
     * Cancel pending debounce
     */
    cancel(): void {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = null;
        }
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.cancel();
    }
}

// ==================== TYPES ====================

export type DraftStatus = "" | "saving" | "saved" | "saved-local" | "error";

// ==================== REACT HOOK ====================

import { useState, useEffect, useRef, useCallback } from "react";

export interface UseDraftOptions {
    debounceDelay?: number;
    autoLoad?: boolean;
    onLoadDraft?: (draft: DraftData) => void;
}

export interface UseDraftReturn {
    status: DraftStatus;
    hasDraft: boolean;
    save: (data: DraftData) => void;
    saveNow: (data: DraftData) => Promise<boolean>;
    load: () => Promise<DraftData | null>;
    deleteDraft: () => Promise<void>;
}

/**
 * React Hook สำหรับจัดการ Draft
 * 
 * Usage:
 * ```tsx
 * const { status, save, deleteDraft } = useDraft(reportId, stationId, {
 *     debounceDelay: 2000,
 *     onLoadDraft: (draft) => setJob(prev => ({ ...prev, ...draft })),
 * });
 * 
 * // Auto-save เมื่อข้อมูลเปลี่ยน
 * useEffect(() => {
 *     save({ corrective_actions, repaired_equipment, ... });
 * }, [corrective_actions, repaired_equipment, ...]);
 * ```
 */
export function useDraft(
    reportId: string | null,
    stationId: string | null,
    options?: UseDraftOptions
): UseDraftReturn {
    const [status, setStatus] = useState<DraftStatus>("");
    const [hasDraft, setHasDraft] = useState(false);
    const managerRef = useRef<DraftManager | null>(null);

    // สร้าง/อัปเดต manager เมื่อ reportId หรือ stationId เปลี่ยน
    useEffect(() => {
        if (reportId && stationId) {
            managerRef.current = new DraftManager(reportId, stationId, {
                debounceDelay: options?.debounceDelay ?? 2000,
                onStatusChange: (s) => {
                    setStatus(s);
                    // ซ่อนสถานะหลัง 2 วินาที
                    if (s === "saved" || s === "saved-local") {
                        setTimeout(() => setStatus(""), 2000);
                    }
                },
            });

            // Auto load draft
            if (options?.autoLoad !== false) {
                managerRef.current.load().then((draft) => {
                    if (draft) {
                        setHasDraft(true);
                    }
                });
            }
        }

        return () => {
            managerRef.current?.destroy();
        };
    }, [reportId, stationId, options?.debounceDelay, options?.autoLoad]);

    const save = useCallback((data: DraftData) => {
        managerRef.current?.saveWithDebounce(data);
    }, []);

    const saveNow = useCallback(async (data: DraftData): Promise<boolean> => {
        return managerRef.current?.save(data) ?? false;
    }, []);

    const load = useCallback(async (): Promise<DraftData | null> => {
        const draft = await managerRef.current?.load();
        if (draft) {
            setHasDraft(true);
        }
        return draft ?? null;
    }, []);

    const deleteDraftFn = useCallback(async (): Promise<void> => {
        await managerRef.current?.delete();
        setHasDraft(false);
    }, []);

    return {
        status,
        hasDraft,
        save,
        saveNow,
        load,
        deleteDraft: deleteDraftFn,
    };
}