/**
 * Draft utilities for CM Report
 * ใช้ localStorage เก็บข้อมูลร่างระหว่างกรอกฟอร์ม
 */

const DRAFT_PREFIX = "cm-draft-";

/**
 * สร้าง draft key จาก station_id
 */
export function draftKey(stationId: string | null): string {
    return `${DRAFT_PREFIX}${stationId || "unknown"}`;
}

/**
 * สร้าง draft key สำหรับ edit mode
 */
export function draftKeyEdit(stationId: string | null, editId: string): string {
    return `${DRAFT_PREFIX}${stationId || "unknown"}:edit:${editId}`;
}

/**
 * บันทึก draft ลง localStorage
 */
export function saveDraftLocal<T extends object>(key: string, data: T): void {
    try {
        const payload = {
            ...data,
            _savedAt: Date.now(),
            _version: 2,  // bump version for new structure
        };
        localStorage.setItem(key, JSON.stringify(payload));
    } catch (error) {
        console.warn("[Draft] Failed to save draft:", error);
    }
}

/**
 * โหลด draft จาก localStorage
 */
export function loadDraftLocal<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        
        const parsed = JSON.parse(raw);
        
        // ตรวจสอบว่า draft หมดอายุหรือยัง (7 วัน)
        const savedAt = parsed._savedAt;
        if (savedAt && Date.now() - savedAt > 7 * 24 * 60 * 60 * 1000) {
            clearDraftLocal(key);
            return null;
        }
        
        return parsed as T;
    } catch (error) {
        console.warn("[Draft] Failed to load draft:", error);
        return null;
    }
}

/**
 * ลบ draft จาก localStorage
 */
export function clearDraftLocal(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.warn("[Draft] Failed to clear draft:", error);
    }
}

/**
 * ตรวจสอบว่ามี draft อยู่หรือไม่
 */
export function hasDraft(key: string): boolean {
    try {
        return localStorage.getItem(key) !== null;
    } catch {
        return false;
    }
}

/**
 * ดึงเวลาที่บันทึก draft ล่าสุด
 */
export function getDraftSavedAt(key: string): Date | null {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        
        const parsed = JSON.parse(raw);
        return parsed._savedAt ? new Date(parsed._savedAt) : null;
    } catch {
        return null;
    }
}

/**
 * ลบ draft ทั้งหมดของ CM report
 */
export function clearAllCMDrafts(): void {
    try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(DRAFT_PREFIX));
        keys.forEach(k => localStorage.removeItem(k));
    } catch (error) {
        console.warn("[Draft] Failed to clear all drafts:", error);
    }
}

/**
 * Type สำหรับ CM Draft Data (flat structure - no job object)
 */
export type CMDraftData = {
    // Form fields (flat)
    issueId: string;
    docName: string;
    foundDate: string;
    location: string;
    problemDetails: string;
    severity: "" | "Low" | "Medium" | "High" | "Critical";
    status: "" | "Open" | "In Progress";
    remarks_open: string;
    faultyEquipment: string;
    
    // Other fields
    reported_by: string;
    summary: string;
    
    // Metadata
    _savedAt?: number;
    _version?: number;
};