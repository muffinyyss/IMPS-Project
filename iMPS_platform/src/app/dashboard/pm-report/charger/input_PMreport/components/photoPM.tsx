"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Button, Card, CardBody, CardHeader, CardFooter, Typography, Input } from "@material-tailwind/react";
import { apiFetch } from "@/utils/api";
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
  bitmap.close(); // ปล่อย GPU/memory resource
  return new Promise<File>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(file); return; }
      resolve(new File([blob], file.name.replace(/\.(\w+)$/, "_min.$1"), {
        type: blob.type || file.type || "image/jpeg",
        lastModified: Date.now(),
      }));
    }, "image/jpeg", quality);
  });
}
function bytesToMB(n: number) { return (n / (1024 * 1024)).toFixed(2); }

// ⚡ Retry helper: exponential backoff
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // 1s, 2s, 4s (max 8s)
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable"); // TypeScript guard
}

/** ---------- Reusable Photo Slot (Memoized) ----------
 *  รับ groupKey + index เป็น props แทน inline closure
 *  เพื่อให้ React.memo สามารถ skip re-render ได้เมื่อ props ไม่เปลี่ยน
 */
const PhotoSlot = React.memo(function PhotoSlot({
  item, groupKey, index, onPickReplace, onRemove, onRemarkChange, indexLabel,
}: {
  item: PhotoItem;
  groupKey: GroupKey;
  index: number;
  indexLabel: string;
  onPickReplace: (gk: GroupKey, idx: number, file: File) => void;
  onRemove: (gk: GroupKey, idx: number) => void;
  onRemarkChange: (gk: GroupKey, idx: number, remark: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handlePick = useCallback(
    (file: File) => onPickReplace(groupKey, index, file),
    [groupKey, index, onPickReplace],
  );
  const handleRemove = useCallback(
    () => onRemove(groupKey, index),
    [groupKey, index, onRemove],
  );
  const handleRemark = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onRemarkChange(groupKey, index, e.target.value),
    [groupKey, index, onRemarkChange],
  );

  return (
    <div className="tw-relative tw-rounded-xl tw-border tw-border-blue-gray-200 tw-bg-white tw-overflow-hidden tw-flex tw-flex-col">
      <label
        className="tw-flex-1 tw-min-h-[200px] sm:tw-min-h-[180px] md:tw-min-h-[144px] tw-flex tw-items-center tw-justify-center tw-text-center tw-p-3 hover:tw-bg-blue-gray-50 cursor-pointer"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handlePick(f); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="tw-hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePick(f); e.currentTarget.value = ""; }}
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
        <Input label="หมายเหตุ" value={item.remark || ""} crossOrigin="" onChange={handleRemark} containerProps={{ className: "tw-w-full sm:tw-flex-1 tw-min-w-0" }} />
        {item.preview && (
          <Button size="sm" variant="text" color="red" onClick={handleRemove} className="tw-w-full sm:tw-w-auto sm:tw-shrink-0">ลบ</Button>
        )}
      </div>

      {/* สถานะอัปโหลด */}
      {item.uploading && (
        <div className="tw-absolute tw-inset-x-0 tw-bottom-0 tw-bg-white/80 tw-text-center tw-text-xs tw-py-1">กำลังอัปโหลด...</div>
      )}
      {!!item.error && (
        <div className="tw-absolute tw-inset-x-0 tw-bottom-0 tw-bg-red-50 tw-text-red-700 tw-text-xs tw-py-1">{item.error}</div>
      )}
    </div>
  );
});

/** ---------- Add Photo Tile (Memoized) ---------- */
const AddPhotoTile = React.memo(function AddPhotoTile({
  groupKey, onAddFiles, label = "เพิ่มรูป", className = "",
}: {
  groupKey: GroupKey;
  onAddFiles: (gk: GroupKey, files: FileList | File[]) => void;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleAdd = useCallback(
    (files: FileList | File[]) => onAddFiles(groupKey, files),
    [groupKey, onAddFiles],
  );

  return (
    <div className={`tw-relative tw-rounded-xl tw-border tw-border-dashed tw-border-blue-gray-300 tw-bg-white tw-overflow-hidden tw-flex tw-flex-col ${className}`}>
      <label
        className="tw-flex-1 tw-min-h-[200px] sm:tw-min-h-[180px] md:tw-min-h-[144px] tw-flex tw-flex-col tw-items-center tw-justify-center tw-text-center tw-p-3 hover:tw-bg-blue-gray-50 cursor-pointer"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) handleAdd(e.dataTransfer.files); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="tw-hidden"
          onChange={(e) => { if (e.target.files?.length) handleAdd(e.target.files); e.currentTarget.value = ""; }}
        />
        <Typography className="tw-font-medium">+ {label}</Typography>
        <Typography variant="small" className="!tw-text-blue-gray-500">รองรับเลือกหลายไฟล์ & ลาก-วางหลายไฟล์</Typography>
        <div className="tw-mt-2"><Button size="sm" variant="outlined" onClick={() => inputRef.current?.click()}>เลือกหลายไฟล์</Button></div>
      </label>
    </div>
  );
});

/** ---------- Group Card (Memoized) ----------
 *  แยกแต่ละกลุ่มเป็น component — การเปลี่ยนแปลงใน g1 จะไม่ทำให้ g2–g10 re-render
 */
const GroupCard = React.memo(function GroupCard({
  group, items, remarkValue, uploadingAll,
  onAddFiles, onReplace, onRemove, onRemarkChange,
  onGroupRemarkChange, onUploadGroup,
}: {
  group: PhotoGroup;
  items: PhotoItem[];
  remarkValue: string;
  uploadingAll: boolean;
  onAddFiles: (gk: GroupKey, files: FileList | File[]) => void;
  onReplace: (gk: GroupKey, idx: number, file: File) => void;
  onRemove: (gk: GroupKey, idx: number) => void;
  onRemarkChange: (gk: GroupKey, idx: number, remark: string) => void;
  onGroupRemarkChange: (gk: GroupKey, value: string) => void;
  onUploadGroup: (gk: GroupKey) => void;
}) {
  const hasFilesToUpload = items.some((it) => it.file);
  const isGroupUploading = items.some((it) => it.uploading);

  const handleGroupRemark = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onGroupRemarkChange(group.key, e.target.value),
    [group.key, onGroupRemarkChange],
  );
  const handleUpload = useCallback(
    () => onUploadGroup(group.key),
    [group.key, onUploadGroup],
  );

  return (
    <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
      <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
        <Typography className="tw-font-semibold">{group.title}</Typography>
        {group.subtitle && <Typography variant="small" className="!tw-text-blue-gray-500">{group.subtitle}</Typography>}
      </CardHeader>

      <CardBody className="tw-space-y-4">
        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-3 lg:tw-grid-cols-4 tw-gap-3">
          {items.map((item, idx) => (
            <PhotoSlot
              key={item.id}
              item={item}
              groupKey={group.key}
              index={idx}
              indexLabel={`ภาพที่ ${idx + 1}`}
              onPickReplace={onReplace}
              onRemove={onRemove}
              onRemarkChange={onRemarkChange}
            />
          ))}
          <AddPhotoTile
            className="tw-col-span-full sm:tw-col-span-1"
            groupKey={group.key}
            onAddFiles={onAddFiles}
          />
        </div>

        {/* ปุ่มอัปโหลดเฉพาะกลุ่มนี้ */}
        {hasFilesToUpload && (
          <div className="tw-flex tw-justify-end">
            <Button color="blue" variant="filled" size="sm" onClick={handleUpload}
              disabled={uploadingAll || isGroupUploading}>
              อัปโหลดหัวข้อ {group.key.toUpperCase()}
            </Button>
          </div>
        )}

        <div className="tw-pt-1">
          <Input label="หมายเหตุรวมของหัวข้อนี้" value={remarkValue} crossOrigin=""
            onChange={handleGroupRemark} />
        </div>
      </CardBody>
    </Card>
  );
});

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
    let small: File;
    try {
      small = await compressImage(file);
    } catch {
      return { id: crypto.randomUUID(), error: "ไม่สามารถอ่านไฟล์รูปภาพได้" };
    }
    const dataURL = await new Promise<string>((res) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.readAsDataURL(small);
    });
    return { id: crypto.randomUUID(), file: small, preview: dataURL };
  }, []);

  /** ---------- Stable callbacks (รับ groupKey เป็น param แทน closure) ---------- */

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
      list[idx] = { ...list[idx], ...item, url: undefined, path: undefined, error: undefined };
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

  const removeFromGroup = useCallback((gk: GroupKey, idx: number) => {
    setGroups((prev) => {
      const next = { ...prev };
      const list = [...next[gk]];
      list.splice(idx, 1);
      next[gk] = list;
      return next;
    });
  }, []);

  const updateGroupRemark = useCallback((gk: GroupKey, value: string) => {
    setGroupRemark((prev) => ({ ...prev, [gk]: value }));
  }, []);

  const totalBytes = useMemo(() => {
    const files = Object.values(groups).flat().map((x) => x.file).filter(Boolean) as File[];
    return files.reduce((sum, f) => sum + f.size, 0);
  }, [groups]);

  /** ---------- Upload logic ---------- */
  // ใช้ ref เก็บค่าที่เปลี่ยนบ่อย เพื่อให้ stable callback อ่านค่าล่าสุดได้
  const groupRemarkRef = useRef(groupRemark);
  groupRemarkRef.current = groupRemark;
  const stationIdRef = useRef(stationId);
  stationIdRef.current = stationId;
  const reportIdRef = useRef(reportId);
  reportIdRef.current = reportId;

  const uploadGroup = useCallback(async (gk: GroupKey) => {
    // อ่าน list จาก state ล่าสุดผ่าน functional setState
    const list = await new Promise<PhotoItem[]>((resolve) => {
      setGroups((prev) => {
        resolve(prev[gk]);
        return prev;
      });
    });

    const files = list.filter((it) => it.file);
    if (files.length === 0) return;

    // mark uploading
    setGroups((prev) => ({
      ...prev,
      [gk]: prev[gk].map((it) => ({ ...it, uploading: !!it.file && !it.url, error: undefined })),
    }));

    const fd = new FormData();
    files.forEach((it) => { if (it.file) fd.append("files", it.file, it.file.name); });
    const remarks = files.map((it) => it.remark ?? "");
    fd.append("remarks", JSON.stringify(remarks));
    fd.append("groupRemark", groupRemarkRef.current[gk] ?? "");

    const url = `${API_BASE}/pmreport/upload?station_id=${encodeURIComponent(stationIdRef.current)}&report_id=${encodeURIComponent(reportIdRef.current)}&group=${encodeURIComponent(gk)}`;

    try {
      // ⚡ FIX: ใช้ withRetry ลองซ้ำ 3 ครั้ง + exponential backoff
      const json = await withRetry(async () => {
        const res = await apiFetch(url, { method: "POST", body: fd, credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
        return await res.json() as {
          files: Array<{ index: number; url: string; path: string; filename: string }>;
        };
      });

      setGroups((prev) => {
        const next = { ...prev };
        const arr = [...next[gk]];
        json.files.forEach((f, i) => {
          const idx = arr.findIndex((it) => it.uploading);
          const target = idx >= 0 ? idx : i;
          if (arr[target]) {
            arr[target] = { ...arr[target], url: f.url, path: f.path, uploading: false };
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
  }, []); // stable — อ่านค่าจาก ref เท่านั้น

  // ⚡ FIX: uploadAll ใช้ continue on fail — ไม่หยุดทั้งหมดเมื่อกลุ่มใดกลุ่มหนึ่ง fail
  async function uploadAll() {
    setUploadingAll(true);
    const failedGroups: string[] = [];
    try {
      for (const g of GROUPS) {
        // ข้ามกลุ่มที่ไม่มีไฟล์ต้อง upload
        const hasFiles = await new Promise<boolean>((resolve) => {
          setGroups((prev) => {
            resolve(prev[g.key].some((it) => it.file));
            return prev;
          });
        });
        if (!hasFiles) continue;

        try {
          await uploadGroup(g.key);
        } catch {
          // ⚡ จำกลุ่มที่ fail แต่ไม่หยุด loop → อัปโหลดกลุ่มถัดไปต่อ
          failedGroups.push(g.key.replace("g", ""));
        }
      }

      if (failedGroups.length > 0) {
        alert(`อัปโหลดรูปไม่สำเร็จในหัวข้อ: ${failedGroups.join(", ")} — กรุณาลองใหม่`);
      } else {
        alert("อัปโหลดรูปครบแล้ว ✅");
      }
    } finally {
      setUploadingAll(false);
    }
  }

  /** ---------- เดโม่ payload ---------- */
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

  return (
    <section className="tw-mx-0 tw-px-3 md:tw-px-6 xl:tw-px-0 tw-pb-24">
      <Card className="tw-mt-3 tw-shadow-none">
        <CardBody className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-flex-wrap">
          <Typography variant="h6">แนบรูปประกอบการตรวจ (สำหรับช่าง)</Typography>
          <Typography variant="small" className="!tw-text-blue-gray-500">ขนาดรวม: {bytesToMB(totalBytes)} MB</Typography>
        </CardBody>
      </Card>

      {GROUPS.map((g) => (
        <GroupCard
          key={g.key}
          group={g}
          items={groups[g.key]}
          remarkValue={groupRemark[g.key]}
          uploadingAll={uploadingAll}
          onAddFiles={addFilesToGroup}
          onReplace={replaceFileInGroup}
          onRemove={removeFromGroup}
          onRemarkChange={updateRemarkInGroup}
          onGroupRemarkChange={updateGroupRemark}
          onUploadGroup={uploadGroup}
        />
      ))}

      <Card className="tw-mt-8 tw-shadow-none">
        <CardFooter className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-between tw-gap-3">
          <div className="tw-text-sm tw-text-blue-gray-600">หน้าอัปโหลดรูปภาพ</div>
          <div className="tw-flex tw-gap-2">
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
      </Card>
    </section>
  );
}