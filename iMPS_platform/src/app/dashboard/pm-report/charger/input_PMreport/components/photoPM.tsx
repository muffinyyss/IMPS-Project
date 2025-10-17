"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Button, Card, CardBody, CardHeader, CardFooter, Typography, Input } from "@material-tailwind/react";

/** ---------- Config API ---------- */
// NEW: ตั้งค่า base ของ backend
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** ---------- Types ---------- */
type PhotoItem = {
  id: string;
  file?: File;
  preview?: string;
  remark?: string;
  uploading?: boolean;
  error?: string;
  // NEW: เก็บผลลัพธ์จาก backend
  url?: string;       // public URL (เช่น /uploads/pm/..../xxx.jpg)
  path?: string;      // path ที่เซิร์ฟเวอร์เก็บ
};

type GroupKey = `g${number}`;
type PMReportPhotosProps = {
  onBack?: () => void;

  // NEW: ต้องรู้ว่าเป็นของสถานีไหน/รายงานไหน
  stationId: string;       // e.g. "Klongluang3"
  reportId: string;        // _id หรือ uuid ของรายงาน PM (สร้างจาก step ก่อนหน้า)
};

type PhotoGroup = { key: GroupKey; title: string; subtitle?: string };

/** ---------- Config: 10 ข้อ ---------- */
const TOTAL_SECTIONS = 10;
const TITLES_BY_SECTION: Record<number, { title: string; subtitle?: string }> = {
  1: { title: "1) Visual Check / ตรวจสอบด้วยสายตา" },
  2: { title: "2) Cleaning the air filter / ทำความสะอาดไส้กรองอากาศ" },
  3: { title: "3) Internal Cleaning / ทำความสะอาดภายใน" },
  4: { title: "4) Check torque and tightness / ตรวจสอบค่าแรงบิดและการขันแน่น" },
  5: { title: "5) Check the strength between each wire connection / ทดสอบความแข็งแรงของจุดต่อไฟฟ้า" },
  6: { title: "6) Charging cable insulation Test / ทดสอบความเป็นฉนวนของสายชาร์จ" },
  7: { title: "7) Incoming cable Insulation Test / ทดสอบความเป็นฉนวนของสาย Incoming" },
  8: { title: "8) Incoming voltage check / ตรวจสอบแรงดันขาเข้า" },
  9: { title: "9) Test trip / ทดสอบการทำงานของอุปกรณ์ป้องกันระบบไฟฟ้า" },
  10: { title: "10) Thermal scan / ภาพถ่ายความร้อน" },
};

const GROUPS: PhotoGroup[] = Array.from({ length: TOTAL_SECTIONS }, (_, i) => {
  const n = i + 1;
  const key = `g${n}` as GroupKey;
  const conf = TITLES_BY_SECTION[n];
  return { key, title: conf?.title ?? `${n}) แนบรูปหัวข้อที่ ${n}`, subtitle: conf?.subtitle };
});

/** ---------- Utils ---------- */
async function compressImage(file: File, maxW = 1600, maxH = 1600, quality = 0.82): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise<File>((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob as Blob], file.name.replace(/\.(\w+)$/, "_min.$1"), {
        type: (blob as Blob).type || file.type || "image/jpeg",
        lastModified: Date.now(),
      }));
    }, "image/jpeg", quality);
  });
}
function bytesToMB(n: number) { return (n / (1024 * 1024)).toFixed(2); }

/** ---------- Reusable Photo Slot ---------- */
function PhotoSlot({
  item, onPickReplace, onRemove, onRemarkChange, indexLabel,
}: {
  item: PhotoItem; indexLabel: string;
  onPickReplace: (file: File) => void;
  onRemove: () => void;
  onRemarkChange: (remark: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="tw-relative tw-rounded-xl tw-border tw-border-blue-gray-200 tw-bg-white tw-overflow-hidden tw-flex tw-flex-col">
      <label
        className="tw-flex-1 tw-min-h-[200px] sm:tw-min-h-[180px] md:tw-min-h-[144px] tw-flex tw-items-center tw-justify-center tw-text-center tw-p-3 hover:tw-bg-blue-gray-50 cursor-pointer"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onPickReplace(f); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="tw-hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickReplace(f); e.currentTarget.value = ""; }}
        />
        {!item.preview ? (
          <div className="tw-space-y-1">
            <Typography className="tw-font-medium">{indexLabel}</Typography>
            <Typography variant="small" className="!tw-text-blue-gray-500">แตะเพื่อถ่ายภาพ/อัปโหลด หรือ ลาก-วางไฟล์</Typography>
            <div className="tw-mt-2"><Button size="sm" variant="outlined" onClick={() => inputRef.current?.click()}>เปิดกล้อง / เลือกภาพ</Button></div>
          </div>
        ) : (
          <img src={item.preview} alt={indexLabel} className="tw-w-full tw-h-full tw-object-cover tw-rounded-none" onClick={() => inputRef.current?.click()} />
        )}
      </label>

      {/* remark + actions */}
      <div className="tw-p-2 tw-flex tw-gap-2 tw-border-t tw-border-blue-gray-100 tw-flex-col sm:tw-flex-row">
        <Input label="หมายเหตุ" value={item.remark || ""} crossOrigin="" onChange={(e) => onRemarkChange(e.target.value)} containerProps={{ className: "tw-w-full sm:tw-flex-1 tw-min-w-0" }} />
        {item.preview && (
          <Button size="sm" variant="text" color="red" onClick={onRemove} className="tw-w-full sm:tw-w-auto sm:tw-shrink-0">ลบ</Button>
        )}
      </div>

      {/* NEW: สถานะอัปโหลด */}
      {item.uploading && (
        <div className="tw-absolute tw-inset-x-0 tw-bottom-0 tw-bg-white/80 tw-text-center tw-text-xs tw-py-1">กำลังอัปโหลด...</div>
      )}
      {!!item.error && (
        <div className="tw-absolute tw-inset-x-0 tw-bottom-0 tw-bg-red-50 tw-text-red-700 tw-text-xs tw-py-1">{item.error}</div>
      )}
    </div>
  );
}

function AddPhotoTile({ onAddFiles, label = "เพิ่มรูป", className = "" }: { onAddFiles: (files: FileList | File[]) => void; label?: string; className?: string; }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className={`tw-relative tw-rounded-xl tw-border tw-border-dashed tw-border-blue-gray-300 tw-bg-white tw-overflow-hidden tw-flex tw-flex-col ${className}`}>
      <label
        className="tw-flex-1 tw-min-h-[200px] sm:tw-min-h-[180px] md:tw-min-h-[144px] tw-flex tw-flex-col tw-items-center tw-justify-center tw-text-center tw-p-3 hover:tw-bg-blue-gray-50 cursor-pointer"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) onAddFiles(e.dataTransfer.files); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="tw-hidden"
          onChange={(e) => { if (e.target.files?.length) onAddFiles(e.target.files); e.currentTarget.value = ""; }}
        />
        <Typography className="tw-font-medium">+ {label}</Typography>
        <Typography variant="small" className="!tw-text-blue-gray-500">รองรับเลือกหลายไฟล์ & ลาก-วางหลายไฟล์</Typography>
        <div className="tw-mt-2"><Button size="sm" variant="outlined" onClick={() => inputRef.current?.click()}>เลือกหลายไฟล์</Button></div>
      </label>
    </div>
  );
}

/** ---------- Main Page 2: Photos ---------- */
export default function PMReportPhotos({ onBack, stationId, reportId }: PMReportPhotosProps) {
  const [groups, setGroups] = useState<Record<GroupKey, PhotoItem[]>>(() => {
    const initial: Record<GroupKey, PhotoItem[]> = {} as any;
    for (const g of GROUPS) initial[g.key] = [];
    return initial;
  });
  const [groupRemark, setGroupRemark] = useState<Record<GroupKey, string>>(() => {
    const initial: Record<GroupKey, string> = {} as any;
    for (const g of GROUPS) initial[g.key] = "";
    return initial;
  });
  // NEW: สถานะอัปโหลดรวม
  const [uploadingAll, setUploadingAll] = useState(false);

  const fileToItem = useCallback(async (file: File): Promise<PhotoItem> => {
    const small = await compressImage(file);
    const dataURL = await new Promise<string>((res) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.readAsDataURL(small);
    });
    return { id: crypto.randomUUID(), file: small, preview: dataURL };
  }, []);

  const addFilesToGroup = useCallback(async (gk: GroupKey, files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    const items = await Promise.all(arr.map((f) => fileToItem(f)));
    setGroups((prev) => ({ ...prev, [gk]: [...prev[gk], ...items] }));
  }, [fileToItem]);

  const replaceFileInGroup = useCallback(async (gk: GroupKey, idx: number, file: File) => {
    const item = await fileToItem(file);
    setGroups((prev) => {
      const next = { ...prev };
      const list = [...next[gk]];
      list[idx] = { ...list[idx], ...item, error: undefined };
      next[gk] = list;
      return next;
    });
  }, [fileToItem]);

  const updateRemarkInGroup = useCallback((gk: GroupKey, idx: number, remark: string) => {
    setGroups((prev) => {
      const next = { ...prev };
      const list = [...next[gk]];
      list[idx] = { ...list[idx], remark };
      next[gk] = list;
      return next;
    });
  }, []);

  const removeFromGroup = (gk: GroupKey, idx: number) => {
    setGroups((prev) => {
      const next = { ...prev };
      const list = [...next[gk]];
      list.splice(idx, 1);
      next[gk] = list;
      return next;
    });
  };

  const totalBytes = useMemo(() => {
    const files = Object.values(groups).flat().map((x) => x.file).filter(Boolean) as File[];
    return files.reduce((sum, f) => sum + f.size, 0);
  }, [groups]);

  /** ---------- NEW: อัปโหลดไป backend ---------- */
  async function uploadGroup(gk: GroupKey) {
    const list = groups[gk];
    const files = list.filter((it) => it.file);
    if (files.length === 0) return;

    // mark uploading
    setGroups((prev) => ({
      ...prev,
      [gk]: prev[gk].map((it) => ({ ...it, uploading: !!it.file && !it.url, error: undefined })),
    }));

    const fd = new FormData();
    // แนบไฟล์หลายไฟล์ ชื่อ field = "files"
    files.forEach((it) => { if (it.file) fd.append("files", it.file, it.file.name); });
    // meta เสริม (remark ต่อรูป)
    const remarks = list.map((it) => it.remark ?? "");
    fd.append("remarks", JSON.stringify(remarks));

    const url = `${API_BASE}/pmreport/upload?station_id=${encodeURIComponent(stationId)}&report_id=${encodeURIComponent(reportId)}&group=${encodeURIComponent(gk)}`;

    try {
      const res = await fetch(url, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json() as {
        files: Array<{ index: number; url: string; path: string; filename: string }>;
      };

      // เขียนผลลัพธ์กลับเข้า state (แมปตาม index ต้นฉบับ)
      setGroups((prev) => {
        const next = { ...prev };
        const arr = [...next[gk]];
        json.files.forEach((f, i) => {
          // พยายามจับคู่ด้วยลำดับไฟล์ในคำขอนี้
          const idx = arr.findIndex((it) => it.uploading);
          const target = idx >= 0 ? idx : i;
          if (arr[target]) {
            arr[target] = { ...arr[target], url: f.url, path: f.path, uploading: false };
            // อัปโหลดแล้วจะลบ object File ทิ้งเพื่อไม่ให้ซ้ำซ้อนในหน่วยความจำ
            delete arr[target].file;
          }
        });
        next[gk] = arr.map((it) => ({ ...it, uploading: false }));
        return next;
      });
    } catch (err: any) {
      setGroups((prev) => ({
        ...prev,
        [gk]: prev[gk].map((it) => ({ ...it, uploading: false, error: err?.message ?? "upload failed" })),
      }));
      throw err;
    }
  }

  async function uploadAll() {
    setUploadingAll(true);
    try {
      // อัปโหลดทีละกลุ่ม (กันโหลดหนักเกินไป)
      for (const g of GROUPS) {
        await uploadGroup(g.key);
      }
      alert("อัปโหลดรูปครบแล้ว ✅");
    } catch {
      // error รายกลุ่มมีแสดงอยู่แล้ว
    } finally {
      setUploadingAll(false);
    }
  }

  /** ---------- เดโม่ payload (ยังใช้ได้) ---------- */
  const collectPayload = () => {
    const payload = {
      groups: Object.fromEntries(
        GROUPS.map((g) => [
          g.key,
          groups[g.key].map((p) => ({
            name: p.path ?? p.url ?? p.file?.name,
            size: p.file?.size,
            remark: p.remark || "",
            url: p.url,
            path: p.path,
          })),
        ])
      ),
      remark: groupRemark,
    };
    console.log("PHOTO PAYLOAD:", payload);
    alert("รวมข้อมูลรูปแล้ว — ดูใน console");
  };

  const remaining = useMemo(() => GROUPS.filter((g) => groups[g.key].length === 0).length, [groups]);

  return (
    <section className="tw-mx-0 tw-px-3 md:tw-px-6 xl:tw-px-0 tw-pb-24">
      <Card className="tw-mt-3 tw-shadow-none">
        <CardBody className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-flex-wrap">
          <Typography variant="h6">แนบรูปประกอบการตรวจ (สำหรับช่าง)</Typography>
          <Typography variant="small" className="!tw-text-blue-gray-500">ขนาดรวม: {bytesToMB(totalBytes)} MB</Typography>
        </CardBody>
      </Card>

      {GROUPS.map((g) => (
        <Card key={g.key} className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
          <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
            <Typography className="tw-font-semibold">{g.title}</Typography>
            {g.subtitle && <Typography variant="small" className="!tw-text-blue-gray-500">{g.subtitle}</Typography>}
          </CardHeader>

          <CardBody className="tw-space-y-4">
            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-3 lg:tw-grid-cols-4 tw-gap-3">
              {groups[g.key].map((item, idx) => (
                <PhotoSlot
                  key={item.id}
                  item={item}
                  indexLabel={`ภาพที่ ${idx + 1}`}
                  onPickReplace={(f) => replaceFileInGroup(g.key, idx, f)}
                  onRemove={() => removeFromGroup(g.key, idx)}
                  onRemarkChange={(val) => updateRemarkInGroup(g.key, idx, val)}
                />
              ))}
              <AddPhotoTile className="tw-col-span-full sm:tw-col-span-1" onAddFiles={(files) => addFilesToGroup(g.key, files)} />
            </div>

            {/* ปุ่มอัปโหลดเฉพาะกลุ่มนี้ */}
            {groups[g.key].some((it) => it.file) && (
              <div className="tw-flex tw-justify-end">
                <Button color="blue" variant="filled" size="sm" onClick={() => uploadGroup(g.key)} disabled={uploadingAll}>
                  อัปโหลดหัวข้อ {g.key.toUpperCase()}
                </Button>
              </div>
            )}

            <div className="tw-pt-1">
              <Input label="หมายเหตุรวมของหัวข้อนี้" value={groupRemark[g.key]} crossOrigin=""
                onChange={(e) => setGroupRemark((prev) => ({ ...prev, [g.key]: e.target.value }))} />
            </div>
          </CardBody>
        </Card>
      ))}

      <CardFooter className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-between tw-gap-3 tw-mt-8">
        <div className="tw-text-sm tw-text-blue-gray-600">หน้าอัปโหลดรูปภาพ</div>
        <div className="tw-flex tw-gap-2">
          {/* NEW: อัปโหลดทั้งหมด */}
          <Button color="blue" type="button" onClick={uploadAll} disabled={uploadingAll}>
            {uploadingAll ? "กำลังอัปโหลด..." : "อัปโหลดทั้งหมด"}
          </Button>
          <Button variant="outlined" color="blue-gray" type="button" onClick={collectPayload} disabled={uploadingAll}>
            บันทึกชั่วคราว (Log)
          </Button>
          <Button variant="filled" color="blue-gray" type="button" onClick={() => onBack?.()} disabled={uploadingAll}>
            กลับไป Checklist
          </Button>
        </div>
      </CardFooter>
    </section>
  );
}
