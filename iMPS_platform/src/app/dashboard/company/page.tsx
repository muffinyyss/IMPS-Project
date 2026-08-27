"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Button,
  Input,
  Textarea,
} from "@material-tailwind/react";
import { apiFetch } from "@/utils/api";
import useLanguage, { type Lang } from "@/utils/useLanguage";

type TabId = "Owner" | "Vendor";
type TabSlug = "owner" | "vendor";

const TABS: { id: TabId; label: string; slug: TabSlug }[] = [
  { id: "Owner", label: "Owner", slug: "owner" },
  { id: "Vendor", label: "Vendor", slug: "vendor" },
];

const T = {
  addCompany: { th: "เพิ่มบริษัท", en: "Add Company" },
  name: { th: "ชื่อบริษัท", en: "Company name" },
  tel: { th: "เบอร์โทร", en: "Tel" },
  email: { th: "อีเมล", en: "Email" },
  address: { th: "ที่อยู่", en: "Address" },
  save: { th: "บันทึก", en: "Save" },
  saving: { th: "กำลังบันทึก...", en: "Saving..." },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  add: { th: "+ เพิ่ม", en: "+ Add" },
  loading: { th: "กำลังโหลด...", en: "Loading..." },
  empty: { th: "ยังไม่มีข้อมูลบริษัท", en: "No companies yet" },
  nameRequired: { th: "กรุณากรอกชื่อบริษัท", en: "Company name is required" },
  duplicate: { th: "มีบริษัทชื่อนี้อยู่แล้ว", en: "This company already exists" },
  saveFailed: { th: "บันทึกไม่สำเร็จ กรุณาลองใหม่", en: "Save failed, please try again" },
  loadFailed: { th: "โหลดข้อมูลไม่สำเร็จ", en: "Failed to load companies" },
} as const;

const t = (k: keyof typeof T, lang: Lang) => T[k][lang];

type Company = {
  id: string;
  name: string;
  type: string;
  tel: string;
  email: string;
  address: string;
  created_by: string;
  created_at: string | null;
};

function slugToTab(slug: string | null): TabId {
  switch (slug) {
    case "vendor": return "Vendor";
    case "owner":
    default: return "Owner";
  }
}

function tabToSlug(tab: TabId): TabSlug {
  return TABS.find(tb => tb.id === tab)!.slug;
}

const EMPTY_FORM = { name: "", tel: "", email: "", address: "" };

export default function CompanyPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { lang } = useLanguage();

  const [active, setActive] = useState<TabId>(() => slugToTab(searchParams.get("tab")));

  // 🔄 Sync active tab กับ URL params
  useEffect(() => {
    const newActive = slugToTab(searchParams.get("tab"));
    if (newActive !== active) {
      setActive(newActive);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!searchParams.get("tab")) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tabToSlug(active));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [pathname, router, searchParams, active]);

  const go = (next: TabId) => {
    setActive(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabToSlug(next));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // ─── รายการบริษัทของแท็บปัจจุบัน ───
  const activeType = tabToSlug(active);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0); // เพิ่มค่าเพื่อบังคับโหลดใหม่หลังบันทึก

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await apiFetch(`/companies/?type=${activeType}`, { credentials: "include" });
        if (!alive) return;
        if (res.ok) {
          const data = await res.json();
          setCompanies(Array.isArray(data.companies) ? data.companies : []);
        } else {
          setCompanies([]);
          setLoadError(true);
        }
      } catch {
        if (alive) { setCompanies([]); setLoadError(true); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [activeType, reloadKey]);

  // ─── Dialog เพิ่มบริษัท ───
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setAddOpen(true);
  };

  const closeAdd = () => {
    if (saving) return;
    setAddOpen(false);
  };

  const submitAdd = async () => {
    if (!form.name.trim()) {
      setFormError(t("nameRequired", lang));
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const res = await apiFetch("/companies/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, name: form.name.trim(), type: activeType }),
      });
      if (res.ok) {
        setAddOpen(false);
        setReloadKey(k => k + 1);
      } else if (res.status === 409) {
        setFormError(t("duplicate", lang));
      } else {
        setFormError(t("saveFailed", lang));
      }
    } catch {
      setFormError(t("saveFailed", lang));
    } finally {
      setSaving(false);
    }
  };

  const renderTable = () => {
    if (loading) {
      return <div className="tw-p-10 tw-text-center tw-text-gray-400">{t("loading", lang)}</div>;
    }
    if (loadError) {
      return <div className="tw-p-10 tw-text-center tw-text-red-400">{t("loadFailed", lang)}</div>;
    }
    if (!companies.length) {
      return <div className="tw-p-10 tw-text-center tw-text-gray-400">{t("empty", lang)}</div>;
    }
    return (
      <div className="tw-overflow-x-auto">
        <table className="tw-w-full tw-min-w-[640px] tw-text-left tw-text-sm">
          <thead>
            <tr className="tw-border-b tw-border-gray-200 tw-text-gray-500">
              <th className="tw-px-4 tw-py-3 tw-font-medium tw-w-12">#</th>
              <th className="tw-px-4 tw-py-3 tw-font-medium">{t("name", lang)}</th>
              <th className="tw-px-4 tw-py-3 tw-font-medium">{t("tel", lang)}</th>
              <th className="tw-px-4 tw-py-3 tw-font-medium">{t("email", lang)}</th>
              <th className="tw-px-4 tw-py-3 tw-font-medium">{t("address", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c, i) => (
              <tr key={c.id} className="tw-border-b tw-border-gray-100 last:tw-border-0 hover:tw-bg-gray-50">
                <td className="tw-px-4 tw-py-3 tw-text-gray-400">{i + 1}</td>
                <td className="tw-px-4 tw-py-3 tw-font-medium tw-text-gray-800">{c.name}</td>
                <td className="tw-px-4 tw-py-3 tw-text-gray-600">{c.tel || "-"}</td>
                <td className="tw-px-4 tw-py-3 tw-text-gray-600">{c.email || "-"}</td>
                <td className="tw-px-4 tw-py-3 tw-text-gray-600">{c.address || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="tw-w-full tw-mt-8">
      {/* Custom Tabs — สไตล์เดียวกับหน้า CM report */}
      <div className="tw-w-full tw-flex tw-justify-start tw-overflow-x-auto tw-scrollbar-hide">
        <div className="tw-inline-flex tw-items-center tw-gap-1 tw-p-1 tw-bg-gray-100 tw-rounded-xl tw-border tw-border-gray-200">
          {TABS.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => go(tab.id)}
                className={`
                  tw-relative tw-flex tw-items-center tw-justify-center tw-gap-2
                  tw-rounded-lg tw-px-5 tw-py-2.5
                  tw-text-sm md:tw-text-base tw-font-semibold
                  tw-whitespace-nowrap tw-leading-none
                  tw-min-w-[130px] md:tw-min-w-[150px]
                  tw-transition-all tw-duration-300 tw-ease-out
                  focus:tw-outline-none
                  ${isActive
                    ? "tw-bg-gray-900 tw-text-white tw-shadow-lg tw-shadow-gray-900/25 tw-scale-[1.02]"
                    : "tw-bg-transparent tw-text-gray-500 hover:tw-text-gray-800 hover:tw-bg-white/60"
                  }
                `}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="tw-pt-4">
        <div className="tw-animate-[fadeIn_0.3s_ease-out] tw-rounded-xl tw-border tw-border-gray-200 tw-bg-white">
          <div className="tw-flex tw-items-center tw-justify-between tw-px-4 tw-py-3 tw-border-b tw-border-gray-100">
            <div className="tw-font-semibold tw-text-gray-800">{active}</div>
            <Button size="sm" className="tw-bg-gray-900" onClick={openAdd}>
              {t("add", lang)}
            </Button>
          </div>
          {renderTable()}
        </div>
      </div>

      {/* Dialog เพิ่มบริษัท */}
      <Dialog open={addOpen} handler={closeAdd} size="sm">
        <DialogHeader>{t("addCompany", lang)} — {active}</DialogHeader>
        <DialogBody className="tw-space-y-4">
          <Input
            label={`${t("name", lang)} *`}
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            crossOrigin={undefined}
          />
          <Input
            label={t("tel", lang)}
            value={form.tel}
            onChange={(e) => setForm(f => ({ ...f, tel: e.target.value }))}
            crossOrigin={undefined}
          />
          <Input
            label={t("email", lang)}
            value={form.email}
            onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
            crossOrigin={undefined}
          />
          <Textarea
            label={t("address", lang)}
            value={form.address}
            onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
          />
          {formError && <div className="tw-text-sm tw-text-red-500">{formError}</div>}
        </DialogBody>
        <DialogFooter className="tw-gap-2">
          <Button variant="text" color="gray" onClick={closeAdd} disabled={saving}>
            {t("cancel", lang)}
          </Button>
          <Button className="tw-bg-gray-900" onClick={submitAdd} disabled={saving}>
            {saving ? t("saving", lang) : t("save", lang)}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
