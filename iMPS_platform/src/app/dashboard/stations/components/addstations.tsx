// "use client";

// import { useEffect, useState } from "react";
// import {
//     Dialog,
//     DialogHeader,
//     DialogBody,
//     DialogFooter,
//     Button,
//     Input,
//     Typography,
//     Select,
//     Option,
// } from "@material-tailwind/react";

// export type NewStationForm = {
//     station_id: string;
//     station_name: string;
//     brand: string;
//     model: string;
//     SN: string;
//     WO: string;
//     PLCFirmware: string;
//     PIFirmware: string;
//     RTFirmware: string;
//     chargeBoxID: string;
//     owner: string;
//     is_active: boolean;
//     // is_active: boolean;
// };

// type Props = {
//     open: boolean;
//     onClose: () => void;
//     onSubmit: (payload: NewStationForm) => Promise<void> | void;
//     loading?: boolean;

//     // ใหม่
//     currentUser: string;       // ชื่อ username ของคนที่ล็อกอิน
//     isAdmin: boolean;          // true = admin
//     allOwners?: string[];      // รายชื่อ owner ทั้งหมด (ใช้เมื่อ isAdmin = true)
// };

// export default function AddUserModal({
//     open,
//     onClose,
//     onSubmit,
//     loading,
//     currentUser,
//     isAdmin,
//     allOwners = [],
// }: Props) {
//     const [form, setForm] = useState<NewStationForm>({
//         station_id: "",
//         station_name: "",
//         brand: "",
//         model: "",
//         SN: "",
//         WO: "",
//         PLCFirmware: "",
//         PIFirmware: "",
//         RTFirmware: "",
//         chargeBoxID: "",
//         owner: "",
//         is_active: true,
//     });

//     // ตั้ง owner อัตโนมัติเป็น currentUser เมื่อ modal เปิด หรือเมื่อ currentUser เปลี่ยน
//     useEffect(() => {
//         if (open) {
//             setForm((s) => ({ ...s, owner: currentUser || s.owner }));
//         }
//     }, [open, currentUser]);

//     const onChange = (k: keyof NewStationForm, v: any) =>
//         setForm((s) => ({ ...s, [k]: v }));
//     const [submitting, setSubmitting] = useState(false);
//     const handleSubmit = async (e: React.FormEvent) => {
//         e.preventDefault();
//         if (submitting) return;
//         setSubmitting(true);
//         const payload: NewStationForm = {
//             ...form,
//             station_id: form.station_id.trim(),
//             station_name: form.station_name.trim(),
//             brand: form.brand.trim(),
//             model: form.model.trim(),
//             SN: form.SN.trim(),
//             WO: form.WO.trim(),
//             PLCFirmware: form.PLCFirmware.trim(),
//             PIFirmware: form.PIFirmware.trim(),
//             RTFirmware: form.RTFirmware.trim(),
//             chargeBoxID: form.chargeBoxID.trim(),
//             owner: (form.owner || currentUser).trim(),
//             is_active: form.is_active
//             // status เป็น boolean อยู่แล้ว
//         };

//         try {
//             await onSubmit(payload);
//             resetAndClose();
//         } catch (err) {
//             console.error(err);
//         } finally {
//             setSubmitting(false);
//         }
//     };

//     const resetAndClose = () => {
//         setForm({
//             station_id: "",
//             station_name: "",
//             brand: "",
//             model: "",
//             SN: "",
//             WO: "",
//             PLCFirmware: "",
//             PIFirmware: "",
//             RTFirmware: "",
//             chargeBoxID: "",
//             owner: "",
//             is_active: false,
//         });
//         onClose();
//     };

//     return (
//         <Dialog
//             open={open}
//             handler={resetAndClose}
//             size="md"
//             dismiss={{ outsidePress: !loading, escapeKey: !loading }}
//             className="tw-flex tw-flex-col tw-max-h-[90vh] tw-overflow-hidden tw-px-0 tw-py-0"
//         >
//             <DialogHeader className="tw-sticky tw-top-0 tw-z-10 tw-bg-white tw-px-6 tw-py-4 tw-border-b">
//                 <div className="tw-flex tw-items-center tw-justify-between">
//                     <Typography variant="h5" color="blue-gray">Add New Station</Typography>
//                     <Button variant="text" onClick={resetAndClose}>✕</Button>
//                 </div>
//             </DialogHeader>

//             <form onSubmit={handleSubmit} className="tw-flex tw-flex-col tw-min-h-0">
//                 <DialogBody className="tw-flex-1 tw-min-h-0 tw-overflow-y-auto tw-space-y-6 tw-px-6 tw-py-4">
//                     <div className="tw-flex tw-flex-col tw-gap-4">
//                         <Input label="Station ID" required value={form.station_id}
//                             onChange={(e) => onChange("station_id", e.target.value)} crossOrigin={undefined} />
//                         <Input label="Station Name" required value={form.station_name}
//                             onChange={(e) => onChange("station_name", e.target.value)} crossOrigin={undefined} />
//                         <Input label="Brand" required value={form.brand}
//                             onChange={(e) => onChange("brand", e.target.value)} crossOrigin={undefined} />
//                         <Input label="Model" required value={form.model}
//                             onChange={(e) => onChange("model", e.target.value)} crossOrigin={undefined} />
//                         <Input label="Serial Number (S/N)" required value={form.SN}
//                             onChange={(e) => onChange("SN", e.target.value)} crossOrigin={undefined} />
//                         <Input label="Work Order (WO)" required value={form.WO}
//                             onChange={(e) => onChange("WO", e.target.value)} crossOrigin={undefined} />
//                         <Input label="PLC Firmware" required value={form.PLCFirmware}
//                             onChange={(e) => onChange("PLCFirmware", e.target.value)} crossOrigin={undefined} />
//                         <Input label="Raspberry pi Firmware" required value={form.PIFirmware}
//                             onChange={(e) => onChange("PIFirmware", e.target.value)} crossOrigin={undefined} />
//                         <Input label="Router Firmware" required value={form.RTFirmware}
//                             onChange={(e) => onChange("RTFirmware", e.target.value)} crossOrigin={undefined} />
//                         <Input label="Charger Box ID" required value={form.chargeBoxID}
//                             onChange={(e) => onChange("chargeBoxID", e.target.value)} crossOrigin={undefined} />

//                         {isAdmin ? (
//                             <Select
//                                 label="Owner"
//                                 value={form.owner || ""}
//                                 onChange={(v) => onChange("owner", v || "")}
//                             >
//                                 {(allOwners.length ? allOwners : [currentUser]).map((name) => (
//                                     <Option key={name} value={name}>{name}</Option>
//                                 ))}
//                             </Select>
//                         ) : (
//                             <Input label="Owner" value={form.owner || currentUser || ""} readOnly disabled crossOrigin={undefined} />
//                         )}

//                         <Select
//                             label="Is_active"
//                             value={String(form.is_active)}
//                             onChange={(v) => onChange("is_active", v === "true")}
//                         >
//                             <Option value="true">Active</Option>
//                             <Option value="false">Inactive</Option>
//                         </Select>
//                     </div>
//                 </DialogBody>

//                 <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-6 tw-py-3 tw-border-t">
//                     <div className="tw-flex tw-w-full tw-justify-end tw-gap-2">
//                         <Button variant="outlined" onClick={resetAndClose} type="button">Cancel</Button>
//                         <Button type="submit" className="tw-bg-blue-600" disabled={loading || submitting}>
//                             {loading || submitting ? "Saving..." : "Create Station"}
//                         </Button>
//                     </div>
//                 </DialogFooter>
//             </form>
//         </Dialog>

//     );
// }

"use client";

import { useEffect, useRef, useState } from "react";
import {
    Dialog,
    DialogHeader,
    DialogBody,
    DialogFooter,
    Button,
    Input,
    Typography,
    Select,
    Option,
} from "@material-tailwind/react";

export type NewStationForm = {
    station_id: string;
    station_name: string;
    brand: string;
    model: string;
    SN: string;
    WO: string;
    PLCFirmware: string;
    PIFirmware: string;
    RTFirmware: string;
    chargeBoxID: string;
    owner: string;
    is_active: boolean;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: NewStationForm) => Promise<void> | void;
    loading?: boolean;

    // ใหม่: ถ้าอยากอัปโหลดรูปด้วย ให้ส่ง prop นี้มา (ออปชัน)
    // สามารถรับ file = null เพื่อเคสไม่เลือกรูปได้
    // onSubmitImage?: (file: File | null, payload: NewStationForm) => Promise<void> | void;
    onSubmitImages?: (
        stationId: string,
        files: { station?: File | null; mdb?: File | null; charger?: File | null; device?: File | null }
    ) => Promise<void> | void;

    currentUser: string;
    isAdmin: boolean;
    allOwners?: string[];
};

type ImageKind = "station" | "mdb" | "charger" | "device";

export default function AddUserModal({
    open,
    onClose,
    onSubmit,
    loading,
    currentUser,
    isAdmin,
    allOwners = [],
    onSubmitImages, // <- เพิ่มเข้ามา
}: Props) {
    const [form, setForm] = useState<NewStationForm>({
        station_id: "",
        station_name: "",
        brand: "",
        model: "",
        SN: "",
        WO: "",
        PLCFirmware: "",
        PIFirmware: "",
        RTFirmware: "",
        chargeBoxID: "",
        owner: "",
        is_active: true,
    });

    // ====== ใหม่: รูปภาพ 4 ช่อง ======
    const [images, setImages] = useState<Record<ImageKind, File | null>>({
        station: null,
        mdb: null,
        charger: null,
        device: null,
    });
    const [previews, setPreviews] = useState<Record<ImageKind, string>>({
        station: "",
        mdb: "",
        charger: "",
        device: "",
    });

    // refs สำหรับเคลียร์ชื่อไฟล์ของแต่ละช่อง
    const fileInputRefs = useRef<Record<ImageKind, HTMLInputElement | null>>({
        station: null,
        mdb: null,
        charger: null,
        device: null,
    });
    // ==== ใหม่: รูปภาพ ====
    // const [imageFile, setImageFile] = useState<File | null>(null);
    // const [imagePreview, setImagePreview] = useState<string>(""); // objectURL



    // ลิมิตขนาดไฟล์ (ปรับได้)
    const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handlePick =
        (kind: ImageKind): React.ChangeEventHandler<HTMLInputElement> =>
            (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (!f.type.startsWith("image/")) {
                    alert("กรุณาเลือกรูปภาพเท่านั้น");
                    return;
                }
                if (f.size > MAX_IMAGE_BYTES) {
                    alert("ไฟล์รูปใหญ่เกินไป (จำกัด 3MB)");
                    return;
                }
                // เคลียร์ URL เก่า
                if (previews[kind]) URL.revokeObjectURL(previews[kind]);

                setImages((s) => ({ ...s, [kind]: f }));
                setPreviews((s) => ({ ...s, [kind]: URL.createObjectURL(f) }));
            };


    const clearImage = (kind: ImageKind) => {
        if (previews[kind]) URL.revokeObjectURL(previews[kind]);
        setImages((s) => ({ ...s, [kind]: null }));
        setPreviews((s) => ({ ...s, [kind]: "" }));
        const el = fileInputRefs.current[kind];
        if (el) el.value = ""; // ล้างชื่อไฟล์ใน input จริง ๆ
    };

    // ตั้ง owner อัตโนมัติเมื่อเปิด
    useEffect(() => {
        if (open) {
            setForm((s) => ({ ...s, owner: currentUser || s.owner }));
        }
    }, [open, currentUser]);

    const onChange = (k: keyof NewStationForm, v: any) =>
        setForm((s) => ({ ...s, [k]: v }));

    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);

        const payload: NewStationForm = {
            ...form,
            station_id: form.station_id.trim(),
            station_name: form.station_name.trim(),
            brand: form.brand.trim(),
            model: form.model.trim(),
            SN: form.SN.trim(),
            WO: form.WO.trim(),
            PLCFirmware: form.PLCFirmware.trim(),
            PIFirmware: form.PIFirmware.trim(),
            RTFirmware: form.RTFirmware.trim(),
            chargeBoxID: form.chargeBoxID.trim(),
            owner: (form.owner || currentUser).trim(),
            is_active: form.is_active,
        };

        try {
            await onSubmit(payload);
            if (onSubmitImages) {
                await onSubmitImages(payload.station_id, {
                    station: images.station,
                    mdb: images.mdb,
                    charger: images.charger,
                    device: images.device,
                });
            }
            resetAndClose();
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const resetAndClose = () => {
        setForm({
            station_id: "",
            station_name: "",
            brand: "",
            model: "",
            SN: "",
            WO: "",
            PLCFirmware: "",
            PIFirmware: "",
            RTFirmware: "",
            chargeBoxID: "",
            owner: "",
            is_active: false,
        });
        (["station", "mdb", "charger", "device"] as ImageKind[]).forEach((k) => clearImage(k));
        onClose();
    };

    return (
        <Dialog
            open={open}
            handler={resetAndClose}
            size="md"
            dismiss={{ outsidePress: !loading, escapeKey: !loading }}
            className="tw-flex tw-flex-col tw-max-h-[90vh] tw-overflow-hidden tw-px-0 tw-py-0"
        >
            <DialogHeader className="tw-sticky tw-top-0 tw-z-10 tw-bg-white tw-px-6 tw-py-4 tw-border-b">
                <div className="tw-flex tw-items-center tw-justify-between">
                    <Typography variant="h5" color="blue-gray">
                        Add New Station
                    </Typography>
                    <Button variant="text" onClick={resetAndClose}>✕</Button>
                </div>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="tw-flex tw-flex-col tw-min-h-0">
                <DialogBody className="tw-flex-1 tw-min-h-0 tw-overflow-y-auto tw-space-y-6 tw-px-6 tw-py-4">
                    <div className="tw-flex tw-flex-col tw-gap-4">
                        <Input label="Station ID" required value={form.station_id}
                            onChange={(e) => onChange("station_id", e.target.value)} crossOrigin={undefined} />
                        <Input label="Station Name" required value={form.station_name}
                            onChange={(e) => onChange("station_name", e.target.value)} crossOrigin={undefined} />
                        <Input label="Brand" required value={form.brand}
                            onChange={(e) => onChange("brand", e.target.value)} crossOrigin={undefined} />
                        <Input label="Model" required value={form.model}
                            onChange={(e) => onChange("model", e.target.value)} crossOrigin={undefined} />
                        <Input label="Serial Number (S/N)" required value={form.SN}
                            onChange={(e) => onChange("SN", e.target.value)} crossOrigin={undefined} />
                        <Input label="Work Order (WO)" required value={form.WO}
                            onChange={(e) => onChange("WO", e.target.value)} crossOrigin={undefined} />
                        <Input label="PLC Firmware" required value={form.PLCFirmware}
                            onChange={(e) => onChange("PLCFirmware", e.target.value)} crossOrigin={undefined} />
                        <Input label="Raspberry pi Firmware" required value={form.PIFirmware}
                            onChange={(e) => onChange("PIFirmware", e.target.value)} crossOrigin={undefined} />
                        <Input label="Router Firmware" required value={form.RTFirmware}
                            onChange={(e) => onChange("RTFirmware", e.target.value)} crossOrigin={undefined} />
                        <Input label="Charger Box ID" required value={form.chargeBoxID}
                            onChange={(e) => onChange("chargeBoxID", e.target.value)} crossOrigin={undefined} />

                        {isAdmin ? (
                            <Select
                                label="Owner"
                                value={form.owner || ""}
                                onChange={(v) => onChange("owner", v || "")}
                            >
                                {(allOwners.length ? allOwners : [currentUser]).map((name) => (
                                    <Option key={name} value={name}>{name}</Option>
                                ))}
                            </Select>
                        ) : (
                            <Input label="Owner" value={form.owner || currentUser || ""} readOnly disabled crossOrigin={undefined} />
                        )}

                        <Select
                            label="Is_active"
                            value={String(form.is_active)}
                            onChange={(v) => onChange("is_active", v === "true")}
                        >
                            <Option value="true">Active</Option>
                            <Option value="false">Inactive</Option>
                        </Select>

                        {/* === รูปภาพ 4 ช่อง === */}
                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-4">
                            {/* Station */}
                            <div className="tw-space-y-2">
                                <Typography variant="small" className="!tw-text-blue-gray-600">Station Image</Typography>
                                <div className="tw-flex tw-items-center tw-gap-3">
                                    <input
                                        ref={(el) => (fileInputRefs.current.station = el)}
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePick("station")}
                                        className="tw-block tw-w-full tw-text-sm file:tw-mr-3 file:tw-px-3 file:tw-py-2 file:tw-rounded-lg file:tw-border file:tw-border-blue-gray-100 file:tw-bg-white file:hover:tw-bg-gray-50"
                                    />
                                    {images.station && (
                                        <Button variant="text" onClick={() => clearImage("station")} className="tw-text-red-600">
                                            ล้างรูป
                                        </Button>
                                    )}
                                </div>
                                {previews.station && (
                                    <img src={previews.station} alt="station" className="tw-h-28 tw-w-28 tw-object-cover tw-rounded-lg tw-border tw-border-blue-gray-100" />
                                )}
                            </div>

                            {/* MDB */}
                            <div className="tw-space-y-2">
                                <Typography variant="small" className="!tw-text-blue-gray-600">MDB Image</Typography>
                                <div className="tw-flex tw-items-center tw-gap-3">
                                    <input
                                        ref={(el) => (fileInputRefs.current.mdb = el)}
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePick("mdb")}
                                        className="tw-block tw-w-full tw-text-sm file:tw-mr-3 file:tw-px-3 file:tw-py-2 file:tw-rounded-lg file:tw-border file:tw-border-blue-gray-100 file:tw-bg-white file:hover:tw-bg-gray-50"
                                    />
                                    {images.mdb && (
                                        <Button variant="text" onClick={() => clearImage("mdb")} className="tw-text-red-600">
                                            ล้างรูป
                                        </Button>
                                    )}
                                </div>
                                {previews.mdb && (
                                    <img src={previews.mdb} alt="mdb" className="tw-h-28 tw-w-28 tw-object-cover tw-rounded-lg tw-border tw-border-blue-gray-100" />
                                )}
                            </div>

                            {/* Charger */}
                            <div className="tw-space-y-2">
                                <Typography variant="small" className="!tw-text-blue-gray-600">Charger Image</Typography>
                                <div className="tw-flex tw-items-center tw-gap-3">
                                    <input
                                        ref={(el) => (fileInputRefs.current.charger = el)}
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePick("charger")}
                                        className="tw-block tw-w-full tw-text-sm file:tw-mr-3 file:tw-px-3 file:tw-py-2 file:tw-rounded-lg file:tw-border file:tw-border-blue-gray-100 file:tw-bg-white file:hover:tw-bg-gray-50"
                                    />
                                    {images.charger && (
                                        <Button variant="text" onClick={() => clearImage("charger")} className="tw-text-red-600">
                                            ล้างรูป
                                        </Button>
                                    )}
                                </div>
                                {previews.charger && (
                                    <img src={previews.charger} alt="charger" className="tw-h-28 tw-w-28 tw-object-cover tw-rounded-lg tw-border tw-border-blue-gray-100" />
                                )}
                            </div>

                            {/* Device */}
                            <div className="tw-space-y-2">
                                <Typography variant="small" className="!tw-text-blue-gray-600">Device Image</Typography>
                                <div className="tw-flex tw-items-center tw-gap-3">
                                    <input
                                        ref={(el) => (fileInputRefs.current.device = el)}
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePick("device")}
                                        className="tw-block tw-w-full tw-text-sm file:tw-mr-3 file:tw-px-3 file:tw-py-2 file:tw-rounded-lg file:tw-border file:tw-border-blue-gray-100 file:tw-bg-white file:hover:tw-bg-gray-50"
                                    />
                                    {images.device && (
                                        <Button variant="text" onClick={() => clearImage("device")} className="tw-text-red-600">
                                            ล้างรูป
                                        </Button>
                                    )}
                                </div>
                                {previews.device && (
                                    <img src={previews.device} alt="device" className="tw-h-28 tw-w-28 tw-object-cover tw-rounded-lg tw-border tw-border-blue-gray-100" />
                                )}
                            </div>
                        </div>
                        {/* === จบชุดรูปภาพ === */}
                    </div>
                </DialogBody>

                <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-6 tw-py-3 tw-border-t">
                    <div className="tw-flex tw-w-full tw-justify-end tw-gap-2">
                        <Button variant="outlined" onClick={resetAndClose} type="button">Cancel</Button>
                        <Button type="submit" className="tw-bg-blue-600" disabled={loading || submitting}>
                            {loading || submitting ? "Saving..." : "Create Station"}
                        </Button>
                    </div>
                </DialogFooter>
            </form>
        </Dialog>
    );
}
