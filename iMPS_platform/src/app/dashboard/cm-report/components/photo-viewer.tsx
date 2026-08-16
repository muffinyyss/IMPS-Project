"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, DocumentIcon } from "@heroicons/react/24/outline";

/**
 * <img> ที่จิ้มแล้วขยายเต็มจอ — ใช้แทน <img> ของรูปแนบในฟอร์ม CM ได้ตรง ๆ
 *
 * ตัวมันเองถือ state และ portal overlay ไป body เอง จึงไม่ต้องมี provider/host
 * และไม่ต้องส่ง props เพิ่ม (รูปบางจุดอยู่ลึกในคอมโพเนนต์ย่อย ส่ง props ลงไปไม่คุ้ม)
 * ต้อง portal ไป body เพราะรูปอยู่ในกล่องที่มี overflow-hidden — เรนเดอร์ในที่เดิมจะโดนตัด
 */
export function ZoomableImg({
    className = "", onClick, alt = "", ...rest
}: React.ImgHTMLAttributes<HTMLImageElement>) {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    // ปิดด้วย Esc — capture ไว้ก่อน ไม่ให้ไปโดน Dialog ที่ครอบอยู่ปิดตามไปด้วย
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [open]);

    const src = rest.src ? String(rest.src) : "";

    return (
        <>
            <img
                {...rest}
                alt={alt}
                className={`${className} ${src ? "tw-cursor-zoom-in" : ""}`.trim()}
                onClick={(e) => {
                    // รูปมักอยู่ในการ์ด/แถวที่มี onClick ของตัวเอง — กันไม่ให้ลามขึ้นไป
                    if (src) { e.stopPropagation(); e.preventDefault(); setOpen(true); }
                    onClick?.(e);
                }}
            />

            {mounted && open && src && createPortal(
                <div
                    className="tw-fixed tw-inset-0 tw-z-[10000] tw-bg-black/90 tw-flex tw-items-center tw-justify-center tw-p-4 tw-cursor-zoom-out"
                    onClick={() => setOpen(false)}
                >
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                        className="tw-absolute tw-top-4 tw-right-4 tw-rounded-full tw-bg-white/10 tw-p-2 tw-text-white hover:tw-bg-white/25 tw-transition-colors"
                    >
                        <XMarkIcon className="tw-w-6 tw-h-6" />
                    </button>
                    <img
                        src={src}
                        alt={alt}
                        onClick={(e) => e.stopPropagation()}
                        className="tw-max-h-[90vh] tw-max-w-full tw-object-contain tw-rounded-lg tw-shadow-2xl tw-cursor-default"
                    />
                </div>,
                document.body
            )}
        </>
    );
}

/** นามสกุลที่หน้า Open และ backend รับ */
export const CM_ACCEPT_ATTACH = [
    ".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".txt", ".csv",
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".heic", ".bmp",
    ".mp4", ".mov", ".mkv", ".avi", ".webm", ".wmv",
].join(",");

const CM_ATTACH_EXTENSIONS = new Set(CM_ACCEPT_ATTACH.split(","));

export function isAllowedCmAttachment(name?: string | null): boolean {
    const value = String(name || "").toLowerCase();
    const dot = value.lastIndexOf(".");
    return dot >= 0 && CM_ATTACH_EXTENSIONS.has(value.slice(dot));
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|svg|heic|bmp)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|mov|mkv|avi|webm|wmv)(\?|#|$)/i;

/**
 * ไฟล์แนบนี้เป็นรูปหรือเปล่า — ตัดสินจาก mime ก่อน (ไฟล์ที่เพิ่งเลือกจากเครื่องมี type)
 * ถ้าไม่มีค่อยดูจากนามสกุลใน url (ไฟล์ที่โหลดกลับมาจาก server มีแต่ path)
 * blob: url ไม่มีนามสกุล จึงต้องพึ่ง mime เป็นหลัก — ไม่รู้จักถือว่าไม่ใช่รูป ปลอดภัยกว่าโชว์รูปแตก
 */
export function isImageAttachment(src?: string | null, mime?: string | null): boolean {
    const type = (mime || "").toLowerCase();
    if (type.startsWith("image/")) return true;
    if (type) return false;
    return IMAGE_EXT.test(String(src || ""));
}

export function isVideoAttachment(src?: string | null, mime?: string | null, name?: string | null): boolean {
    const type = (mime || "").toLowerCase();
    if (type.startsWith("video/")) return true;
    if (type) return false;
    return VIDEO_EXT.test(String(name || src || ""));
}

/** ชื่อไฟล์จาก url เมื่อไม่มีชื่อจริงติดมา (ไฟล์ที่โหลดกลับจาก server) */
export const attachmentName = (src?: string, name?: string) =>
    name || decodeURIComponent(String(src || "").split("/").pop()?.split("?")[0] || "") || "file";

/** สีไอคอนตามชนิดไฟล์ — แยก PDF กับ CSV ให้เห็นจากสีได้เลย */
const fileIconTone = (label: string) => {
    const ext = label.toLowerCase().split(".").pop() || "";
    if (ext === "csv") return "tw-text-green-600";
    if (ext === "pdf") return "tw-text-red-500";
    return "tw-text-blue-gray-400";
};

/**
 * ไฟล์แนบที่ไม่ใช่รูป — ชิปแคบ ๆ พอดีชื่อไฟล์ ไม่ยืดเต็มบรรทัดและไม่กินช่องใหญ่เท่ารูป
 * กดแล้วเปิดไฟล์ในแท็บใหม่ (ไม่มี lightbox — PDF/CSV ขยายในหน้าเว็บไม่ได้อยู่แล้ว)
 * วางในกล่อง flex-wrap ได้เลย หลายไฟล์จะเรียงต่อกันในบรรทัดเดียวจนกว่าจะเต็ม
 */
export function AttachmentFileRow({
    src, name, onRemove,
}: { src?: string; name?: string; onRemove?: () => void }) {
    const label = attachmentName(src, name);
    return (
        <div className="tw-inline-flex tw-items-center tw-gap-1.5 tw-max-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-pl-2 tw-pr-1.5 tw-py-1">
            <DocumentIcon className={`tw-w-3.5 tw-h-3.5 tw-shrink-0 ${fileIconTone(label)}`} />
            <a
                href={src || undefined}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={label}
                className="tw-min-w-0 tw-max-w-[11rem] tw-truncate tw-text-xs tw-text-blue-gray-700 hover:tw-text-blue-600 hover:tw-underline"
            >
                {label}
            </a>
            {onRemove && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="tw-shrink-0 tw-w-4 tw-h-4 tw-rounded-full tw-text-blue-gray-400 hover:tw-text-white hover:tw-bg-red-500 tw-flex tw-items-center tw-justify-center tw-transition-all"
                >
                    <XMarkIcon className="tw-w-3 tw-h-3" />
                </button>
            )}
        </div>
    );
}
