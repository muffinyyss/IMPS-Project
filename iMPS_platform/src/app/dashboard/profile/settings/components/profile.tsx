

"use client";

import React, { useEffect, useState } from "react";
import {
  Card, CardBody, CardHeader, CardFooter,
  Input, Typography, Button,
} from "@/components/MaterialTailwind";

import { apiFetch } from "@/utils/api";


const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Profile = {
  id: string;
  username: string;
  email: string;
  tel: string;
  role: string;
  company?: string;
};

export default function BasicInfo() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [p, setP] = useState<Profile | null>(null);

  // โหลดโปรไฟล์จาก /me (apiFetch จะแนบคุกกี้+จัดการ 401 ให้)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch("/me");
        if (!res.ok) throw new Error(await res.text());
        const data: Profile = await res.json();
        if (alive) setP(data);
      } catch (e) {
        console.error(e);
        // ไม่ต้อง redirect เอง ถ้า 401 apiFetch จะพาไปหน้า login ให้
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const handleEdit = () => setEditing(true);

  const handleSave = async () => {
    if (!p) return;
    try {
      setSaving(true);
      const body = {
        username: p.username,
        email: p.email,
        tel: p.tel,
        company: p.company ?? "",
      };

      const res = await apiFetch(`/user_update/${encodeURIComponent(p.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated: Profile = await res.json();
      setP(updated);
      setEditing(false);
      alert("บันทึกสำเร็จ");
    } catch (e: any) {
      console.error(e);
      alert(`บันทึกไม่สำเร็จ: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="tw-mb-6 tw-border tw-border-blue-gray-100 tw-shadow-sm tw-rounded-xl">
        <CardHeader shadow={false} floated={false}>
          <Typography variant="h5" color="blue-gray">Profile</Typography>
          <Typography variant="small" className="!tw-text-blue-gray-500">กำลังโหลด…</Typography>
        </CardHeader>
      </Card>
    );
  }

  const roClasses =
    "read-only:tw-bg-blue-gray-50";

  // ⬇️ ตัวอย่างกำหนดสิทธิ์แก้ไขตาม role
  const canEditUsernameEmail = p?.role === "admin";  // ถ้า backend อนุญาต owner แก้ได้ ให้ปรับตามจริง
  const canEditCompanyTel = editing;               // แก้ได้เมื่อกด Edit

  // return (
  //   <Card className="tw-mb-6 tw-scroll-mt-4 tw-border tw-border-blue-gray-100 tw-shadow-sm tw-rounded-xl tw-overflow-hidden" id="Profile">
  //     <CardHeader shadow={false} floated={false}>
  //       <Typography variant="h5" color="blue-gray">Profile</Typography>
  //       <Typography variant="small" className="!tw-text-blue-gray-500">ข้อมูลโปรไฟล์ของคุณ</Typography>
  //     </CardHeader>

  //     <CardBody className="tw-flex tw-flex-col">
  //       <div className="tw-grid tw-grid-cols-1 tw-gap-6">
  //         <Input
  //           label="Role"
  //           value={p?.role ?? ""}
  //           containerProps={{ className: "tw-w-full" }}
  //           // disabled
  //           readOnly
  //           className={roClasses}
  //         />
  //         <Input
  //           label="Username"
  //           value={p?.username ?? ""}
  //           onChange={(e) => setP((prev) => prev ? { ...prev, username: e.target.value } : prev)}
  //           containerProps={{ className: "tw-w-full" }}
  //           // disabled={!editing}
  //           readOnly={!editing}
  //           // className="!tw-bg-blue-gray-50"
  //           className={roClasses}
  //         />
  //         <Input
  //           label="Email"
  //           value={p?.email ?? ""}
  //           onChange={(e) => setP((prev) => prev ? { ...prev, email: e.target.value } : prev)}
  //           containerProps={{ className: "tw-w-full" }}
  //           // disabled={!editing}
  //           readOnly={!editing}
  //           // className="!tw-bg-blue-gray-50"
  //           className={roClasses}
  //         />
  //         <Input
  //           label="Phone number"
  //           value={p?.tel ?? ""}
  //           onChange={(e) => setP((prev) => prev ? { ...prev, tel: e.target.value } : prev)}
  //           containerProps={{ className: "tw-w-full" }}
  //           // disabled={!editing}
  //           readOnly={!editing}
  //           // className="!tw-bg-blue-gray-50"
  //           className={roClasses}
  //         />

  //         <Input
  //           label="Company"
  //           value={p?.company ?? ""}
  //           containerProps={{ className: "tw-w-full" }}
  //           // disabled
  //           readOnly={!editing}
  //           className={roClasses}
  //         />
  //       </div>
  //     </CardBody>

  //     <CardFooter className="tw-flex tw-items-center tw-justify-end tw-gap-3 tw-border-t tw-bg-white/60 tw-backdrop-blur-sm tw-mt-4">
  //       {!editing ? (
  //         <Button onClick={handleEdit} variant="outlined" color="gray" className="tw-px-6">
  //           Edit
  //         </Button>
  //       ) : (
  //         <>
  //           <Button onClick={() => { setEditing(false); }} variant="outlined" color="gray" className="tw-px-6">
  //             Cancel
  //           </Button>
  //           <Button onClick={handleSave} variant="gradient" className="tw-px-6" disabled={saving}>
  //             {saving ? "Saving..." : "Save"}
  //           </Button>
  //         </>
  //       )}
  //     </CardFooter>
  //   </Card>
  // );
  return (
    <Card className="tw-mb-6 tw-scroll-mt-4 tw-border tw-border-blue-gray-100 tw-shadow-sm tw-rounded-xl tw-overflow-hidden" id="Profile">
      <CardHeader shadow={false} floated={false}>
        <Typography variant="h5" color="blue-gray">Profile</Typography>
        <Typography variant="small" className="!tw-text-blue-gray-500">ข้อมูลโปรไฟล์ของคุณ</Typography>
      </CardHeader>

      <CardBody className="tw-flex tw-flex-col">
        <div className="tw-grid tw-grid-cols-1 tw-gap-6">
          <Input
            label="Role"
            value={p?.role ?? ""}
            readOnly
            containerProps={{ className: "tw-w-full" }}
            className={roClasses}
          />

          <Input
            label="Username"
            value={p?.username ?? ""}
            onChange={(e) => setP(prev => prev ? { ...prev, username: e.target.value } : prev)}
            readOnly={!editing || !canEditCompanyTel}
            containerProps={{ className: "tw-w-full" }}
            className={roClasses}
          />

          <Input
            label="Email"
            value={p?.email ?? ""}
            onChange={(e) => setP(prev => prev ? { ...prev, email: e.target.value } : prev)}
            readOnly={!editing || !canEditCompanyTel}
            containerProps={{ className: "tw-w-full" }}
            className={roClasses}
          />

          <Input
            label="Phone number"
            value={p?.tel ?? ""}
            onChange={(e) => setP(prev => prev ? { ...prev, tel: e.target.value } : prev)}
            readOnly={!canEditCompanyTel}
            containerProps={{ className: "tw-w-full" }}
            className={roClasses}
          />

          <Input
            label="Company"
            value={p?.company ?? ""}
            onChange={(e) => setP(prev => prev ? { ...prev, company: e.target.value } : prev)}  
            readOnly={!editing || !canEditUsernameEmail }
            containerProps={{ className: "tw-w-full" }}
            className={roClasses}
          />
        </div>
      </CardBody>

      <CardFooter className="tw-flex tw-items-center tw-justify-end tw-gap-3 tw-border-t tw-bg-white/60 tw-backdrop-blur-sm tw-mt-4">
        {!editing ? (
          <Button onClick={() => setEditing(true)} variant="outlined" color="gray" className="tw-px-6">
            Edit
          </Button>
        ) : (
          <>
            <Button onClick={() => setEditing(false)} variant="outlined" color="gray" className="tw-px-6">
              Cancel
            </Button>
            <Button onClick={handleSave} variant="gradient" className="tw-px-6" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}