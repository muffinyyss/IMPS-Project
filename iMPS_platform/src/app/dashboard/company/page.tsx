"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Button,
  Card,
  Input,
  Tooltip,
  Typography,
} from "@material-tailwind/react";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/solid";
import { apiFetch } from "@/utils/api";
import ConfirmDialog from "@/app/dashboard/stations/components/ConfirmDialog";
import useLanguage, { type Lang } from "@/utils/useLanguage";

type TabId = "Owner" | "Vendor" | "Outsource";
type TabSlug = "owner" | "vendor" | "outsource";

const TABS: { id: TabId; label: string; slug: TabSlug }[] = [
  { id: "Owner", label: "Owner", slug: "owner" },
  { id: "Vendor", label: "Vendor", slug: "vendor" },
  { id: "Outsource", label: "Outsource", slug: "outsource" },
];

const T = {
  addCompany: { th: "เพิ่มบริษัท", en: "Add Company" },
  editCompany: { th: "แก้ไขบริษัท", en: "Edit Company" },
  ownerInfo: { th: "ข้อมูล Owner", en: "Owner info" },
  name: { th: "ชื่อบริษัท", en: "Company name" },
  ownerName: { th: "ชื่อ Owner", en: "Owner name" },
  owner: { th: "Owner", en: "Owner" },
  selectOwner: { th: "— เลือก Owner —", en: "— Select owner —" },
  noOwners: { th: "ยังไม่มีรายชื่อ Owner กรุณาเพิ่มที่แท็บ Owner ก่อน", en: "No owners yet — add one in the Owner tab first" },
  outsourceInfo: { th: "ข้อมูล Outsource", en: "Outsource info" },
  outsourceName: { th: "ชื่อ Outsource", en: "Outsource name" },
  company: { th: "Company", en: "Company" },
  selectCompany: { th: "— เลือก Company —", en: "— Select company —" },
  companyRequired: { th: "กรุณาเลือก Company", en: "Please select a company" },
  outsourceNameRequired: { th: "กรุณากรอกชื่อ Outsource", en: "Outsource name is required" },
  duplicateOutsource: { th: "Company นี้มี Outsource ชื่อนี้อยู่แล้ว", en: "This company already has an outsource with that name" },
  noCompanies: {
    th: "ยังไม่มีรายชื่อ Owner หรือ Vendor กรุณาเพิ่มที่แท็บ Owner / Vendor ก่อน",
    en: "No owners or vendors yet — add them in the Owner / Vendor tabs first",
  },
  vendorName: { th: "ชื่อ Vendor", en: "Vendor name" },
  vendor: { th: "Vendor", en: "Vendor" },
  vendors: { th: "Vendor", en: "Vendors" },
  brand: { th: "ยี่ห้อ (Brand)", en: "Brand" },
  brandHint: { th: "พิมพ์ชื่อยี่ห้อ...", en: "Type a brand name..." },
  brandHelp: {
    th: "1 vendor ใส่ได้หลายยี่ห้อ — กด Enter หรือปุ่ม + เพื่อเพิ่มทีละยี่ห้อ (คั่นด้วย , ได้)",
    en: "A vendor can have several brands — press Enter or + to add each (comma-separated also works)",
  },
  addBrand: { th: "เพิ่มยี่ห้อ", en: "Add brand" },
  addVendor: { th: "เพิ่ม Vendor", en: "Add vendor" },
  removeVendor: { th: "ลบ Vendor นี้", en: "Remove this vendor" },
  addOutsource: { th: "เพิ่ม Outsource อีกช่อง", en: "Add another outsource" },
  removeOutsource: { th: "ลบ Outsource นี้", en: "Remove this outsource" },
  remove: { th: "ลบ", en: "Remove" },
  edit: { th: "แก้ไข", en: "Edit" },
  manageOutsource: { th: "แก้ไข / เพิ่ม / ลบ Outsource ของบริษัทนี้", en: "Edit / add / remove this company's outsources" },
  deleteOutsource: { th: "ลบ Outsource", en: "Delete outsource" },
  deleteConfirmTitle: { th: "ยืนยันการลบ Outsource", en: "Delete this outsource?" },
  deleteConfirmMsg: {
    th: "ชื่อนี้จะไม่ขึ้นเป็นตัวเลือกผู้รับผิดชอบงาน PM อีก (ใบงานเดิมไม่กระทบ)",
    en: "It will no longer appear as a PM assignee option (existing work orders are unaffected)",
  },
  deleteFailed: { th: "ลบไม่สำเร็จ กรุณาลองใหม่", en: "Delete failed, please try again" },
  pendingDelete: { th: "รายการที่จะถูกลบเมื่อกดบันทึก", en: "Will be deleted when you save" },
  undo: { th: "เอาคืน", en: "Undo" },
  companyUnit: { th: "บริษัท", en: "companies" },
  outsourceUnit: { th: "Outsource", en: "outsources" },
  tel: { th: "เบอร์โทร", en: "Tel" },
  email: { th: "อีเมล", en: "Email" },
  address: { th: "ที่อยู่", en: "Address" },
  save: { th: "บันทึก", en: "Save" },
  saving: { th: "กำลังบันทึก...", en: "Saving..." },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  add: { th: "เพิ่ม", en: "Add" },
  count: { th: "รายการ", en: "records" },
  loading: { th: "กำลังโหลด...", en: "Loading..." },
  empty: { th: "ยังไม่มีข้อมูลบริษัท", en: "No companies yet" },
  nameRequired: { th: "กรุณากรอกชื่อบริษัท", en: "Company name is required" },
  ownerNameRequired: { th: "กรุณากรอกชื่อ Owner", en: "Owner name is required" },
  ownerRequired: { th: "กรุณาเลือก Owner", en: "Please select an owner" },
  vendorRequired: { th: "กรุณากรอกชื่อ Vendor อย่างน้อย 1 ราย", en: "At least one vendor name is required" },
  duplicate: { th: "มีบริษัทชื่อนี้อยู่แล้ว", en: "This company already exists" },
  duplicateOwner: { th: "Owner นี้มีข้อมูลอยู่แล้ว กรุณาใช้ปุ่มแก้ไขที่รายการเดิม", en: "This owner already has a record — use Edit on the existing row" },
  saveFailed: { th: "บันทึกไม่สำเร็จ กรุณาลองใหม่", en: "Save failed, please try again" },
  loadFailed: { th: "โหลดข้อมูลไม่สำเร็จ", en: "Failed to load companies" },
  scopeHint: { th: "เฉพาะของ", en: "Only for" },
  noMyCompany: {
    th: "บัญชีของคุณยังไม่ได้ระบุบริษัท จึงเพิ่ม Vendor / Outsource ไม่ได้ — กรุณาติดต่อ admin",
    en: "Your account has no company set, so you can't add vendors / outsources — please contact an admin",
  },
} as const;

const t = (k: keyof typeof T, lang: Lang) => T[k][lang];

/** แท็บ Vendor กรอกแค่ 3 อย่าง: owner (ที่ระดับ record) + ชื่อ vendor + ยี่ห้อ */
type VendorEntry = {
  name: string;
  brands: string[];
};

type Company = {
  id: string;
  name: string;
  type: string;
  tel: string;
  email: string;
  address: string;
  /** type=outsource — owner หรือ vendor ที่ outsource รายนี้สังกัด */
  company: string;
  vendors: VendorEntry[];
  created_by: string;
  created_at: string | null;
};

/** แถวในฟอร์ม Outsource — id=null คือรายการใหม่, orig ไว้เทียบว่าชื่อถูกแก้หรือไม่ */
type OutsourceItem = { id: string | null; name: string; orig: string };
const emptyOutsource = (): OutsourceItem => ({ id: null, name: "", orig: "" });

/** แท็บ Outsource แสดงแบบรวมกลุ่มตาม company — 1 company มีได้หลาย outsource */
type OutsourceGroup = { company: string; items: Company[] };

function groupOutsources(list: Company[]): OutsourceGroup[] {
  const groups = new Map<string, OutsourceGroup>();
  for (const c of list) {
    const company = (c.company || "").trim();
    const key = company.toLowerCase();
    if (!groups.has(key)) groups.set(key, { company, items: [] });
    groups.get(key)!.items.push(c);
  }
  const byName = (a: string, b: string) => a.localeCompare(b, "th", { sensitivity: "base" });
  return Array.from(groups.values())
    .map(g => ({ ...g, items: [...g.items].sort((a, b) => byName(a.name, b.name)) }))
    .sort((a, b) => byName(a.company || "￿", b.company || "￿"));
}

function slugToTab(slug: string | null): TabId {
  switch (slug) {
    case "vendor": return "Vendor";
    case "outsource": return "Outsource";
    case "owner":
    default: return "Owner";
  }
}

function tabToSlug(tab: TabId): TabSlug {
  return TABS.find(tb => tb.id === tab)!.slug;
}

const EMPTY_FORM = { name: "", tel: "", email: "", address: "", company: "" };
const emptyVendor = (): VendorEntry => ({ name: "", brands: [] });

const TH_CLASS = "tw-px-4 tw-py-3 tw-whitespace-nowrap";

/** Section icon badge — ชุดเดียวกับ dialog หน้า EV Station */
const SectionIcon = ({ emoji }: { emoji: string }) => (
  <span className="tw-inline-flex tw-items-center tw-justify-center tw-h-7 tw-w-7 sm:tw-h-8 sm:tw-w-8 tw-rounded-xl tw-bg-gradient-to-br tw-shadow-lg tw-text-xs sm:tw-text-sm">
    {emoji}
  </span>
);

/** Spinner */
const Spinner = () => (
  <svg className="tw-animate-spin tw-h-4 tw-w-4" viewBox="0 0 24 24" fill="none">
    <circle className="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const ChevronDown = () => (
  <div className="tw-pointer-events-none tw-absolute tw-inset-y-0 tw-right-3 tw-flex tw-items-center">
    <svg xmlns="http://www.w3.org/2000/svg" className="tw-h-4 tw-w-4 tw-text-blue-gray-400" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  </div>
);

/** ช่องกรอกยี่ห้อแบบ chip — vendor 1 รายดูแลได้หลายยี่ห้อ */
function BrandChips({
  value,
  onChange,
  lang,
}: {
  value: string[];
  onChange: (brands: string[]) => void;
  lang: Lang;
}) {
  const [draft, setDraft] = useState("");

  /** รับได้ทั้งพิมพ์ทีละยี่ห้อ และวางมาทีเดียวคั่นด้วย , */
  const commit = () => {
    const parts = draft.split(",").map(s => s.trim()).filter(Boolean);
    setDraft("");
    if (!parts.length) return;
    const next = [...value];
    for (const brand of parts) {
      if (next.some(b => b.toLowerCase() === brand.toLowerCase())) continue;
      next.push(brand);
    }
    if (next.length !== value.length) onChange(next);
  };

  return (
    <div>
      <div className="tw-relative">
        <div className="tw-flex tw-min-h-[40px] tw-flex-wrap tw-items-center tw-gap-2 tw-rounded-[7px] tw-border tw-border-blue-gray-200 tw-bg-white tw-px-3 tw-py-2 focus-within:tw-border-2 focus-within:tw-border-gray-900">
          {value.map(brand => (
            <span
              key={brand}
              className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-md tw-bg-blue-gray-50 tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-blue-gray-600 tw-shadow-sm tw-ring-1 tw-ring-black/5"
            >
              {brand}
              <button
                type="button"
                aria-label={`${t("remove", lang)} ${brand}`}
                onClick={() => onChange(value.filter(b => b !== brand))}
                className="tw-text-blue-gray-300 tw-transition-colors hover:tw-text-red-500"
              >
                ✕
              </button>
            </span>
          ))}
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commit();
              } else if (e.key === "Backspace" && !draft && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
            onBlur={commit}
            placeholder={t("brandHint", lang)}
            className="tw-min-w-[110px] tw-flex-1 tw-border-0 tw-bg-transparent tw-py-0.5 tw-font-sans tw-text-sm tw-text-blue-gray-700 tw-outline-none placeholder:tw-text-blue-gray-300"
          />
          {/* ปุ่มนี้ไม่ได้ทำอะไรต่างจาก Enter — มีไว้ให้เห็นว่าเพิ่มได้หลายยี่ห้อ */}
          <button
            type="button"
            onClick={commit}
            disabled={!draft.trim()}
            className="tw-shrink-0 tw-rounded-lg tw-bg-gray-900 tw-px-2.5 tw-py-1 tw-text-[11px] tw-font-semibold tw-text-white tw-transition-all hover:tw-bg-black disabled:tw-opacity-30"
          >
            + {t("addBrand", lang)}
          </button>
        </div>
        <label className="tw-pointer-events-none tw-absolute tw-left-3 tw--top-1.5 tw-bg-white tw-px-1 tw-text-[11px] tw-font-normal tw-text-blue-gray-400">
          {t("brand", lang)}
        </label>
      </div>
      <p className="tw-mt-1.5 tw-text-[10px] tw-text-blue-gray-400 sm:tw-text-[11px]">{t("brandHelp", lang)}</p>
    </div>
  );
}

export default function CompanyPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { lang } = useLanguage();

  // planner เข้าหน้านี้ได้เฉพาะแท็บ Vendor / Outsource และเฉพาะของบริษัทตัวเอง (backend บังคับซ้ำ)
  // null = ยังโหลด /me ไม่เสร็จ — รอก่อนค่อยโหลดรายการ กันแท็บ Owner ยิงไปโดน 403
  const [me, setMe] = useState<{ role: string; company: string } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch("/me", { credentials: "include" });
        const data = res.ok ? await res.json() : {};
        if (alive) {
          setMe({
            role: String(data?.role ?? "").trim().toLowerCase(),
            company: String(data?.company ?? "").trim(),
          });
        }
      } catch {
        if (alive) setMe({ role: "", company: "" });
      }
    })();
    return () => { alive = false; };
  }, []);
  const isPlanner = me?.role === "planner";
  const myCompany = isPlanner ? me?.company || "" : "";
  const visibleTabs = useMemo(() => (isPlanner ? TABS.filter(tb => tb.id !== "Owner") : TABS), [isPlanner]);

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

  useEffect(() => {
    if (!isPlanner || active !== "Owner") return;
    setActive("Vendor");
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabToSlug("Vendor"));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [isPlanner, active, pathname, router, searchParams]);

  const go = (next: TabId) => {
    setActive(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabToSlug(next));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // ─── รายการบริษัทของแท็บปัจจุบัน ───
  const activeType = tabToSlug(active);
  const isVendorTab = activeType === "vendor";
  const isOutsourceTab = activeType === "outsource";
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0); // เพิ่มค่าเพื่อบังคับโหลดใหม่หลังบันทึก
  // planner ที่ไม่มี company ในโปรไฟล์ — ไม่รู้ว่าเป็นของใคร backend จะตอบ 403 จึงไม่โหลดเลย
  const plannerWithoutCompany = isPlanner && !myCompany;

  useEffect(() => {
    if (!me) return;
    if (isPlanner && (activeType === "owner" || !myCompany)) {
      setCompanies([]);
      setLoading(false);
      setLoadError(false);
      return;
    }
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
  }, [activeType, reloadKey, me, isPlanner, myCompany]);

  // ─── รายชื่อสำหรับ dropdown: แท็บ Vendor ใช้ Owner, แท็บ Outsource ใช้ทั้ง Owner และ Vendor ───
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const [vendorOptions, setVendorOptions] = useState<string[]>([]);

  useEffect(() => {
    // planner ไม่ได้เลือก owner / company เอง (ล็อกเป็นบริษัทตัวเอง) และอ่านแท็บ Owner ไม่ได้
    if (!me || isPlanner) return;
    if (!isVendorTab && !isOutsourceTab) return;
    let alive = true;
    (async () => {
      const fetchType = async (type: string): Promise<Company[]> => {
        const res = await apiFetch(`/companies/?type=${type}`, { credentials: "include" });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.companies) ? data.companies : [];
      };
      try {
        const [owners, vendorDocs] = await Promise.all([
          fetchType("owner"),
          isOutsourceTab ? fetchType("vendor") : Promise.resolve<Company[]>([]),
        ]);
        if (!alive) return;
        setOwnerOptions(owners.map(c => c.name).filter(Boolean));
        // ชื่อ vendor ซ่อนอยู่ในรายการย่อยของ record ที่ผูกกับ owner — แบนออกมาแล้วตัดซ้ำข้าม owner
        setVendorOptions(
          Array.from(
            new Map(
              vendorDocs
                .flatMap(c => c.vendors || [])
                .map(v => v.name)
                .filter(Boolean)
                .map(n => [n.toLowerCase(), n] as const)
            ).values()
          )
        );
      } catch {
        /* ปล่อยรายการว่าง — ฟอร์มจะขึ้นคำเตือนให้ไปเพิ่มก่อน */
      }
    })();
    return () => { alive = false; };
  }, [isVendorTab, isOutsourceTab, reloadKey, me, isPlanner]);

  // ─── Dialog เพิ่ม / แก้ไขบริษัท ───
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [vendors, setVendors] = useState<VendorEntry[]>([emptyVendor()]);
  const [outsourceItems, setOutsourceItems] = useState<OutsourceItem[]>([emptyOutsource()]);
  // outsource เดิมที่กด ✕ ในฟอร์ม — ยังไม่ลบจริงจนกว่าจะกดบันทึก
  const [removedOutsources, setRemovedOutsources] = useState<OutsourceItem[]>([]);
  // company ของกลุ่มที่กำลังแก้ (null = เพิ่มใหม่) — ใช้ดูว่าผู้ใช้ย้ายทั้งกลุ่มไป company อื่นหรือไม่
  const [editGroupCompany, setEditGroupCompany] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const isEditing = editId !== null || editGroupCompany !== null;

  const outsourceGroups = useMemo(
    () => (isOutsourceTab ? groupOutsources(companies) : []),
    [isOutsourceTab, companies]
  );

  // ─── ลบ outsource ทีละรายจากตาราง ───
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => { setActionError(""); }, [activeType]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/companies/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
      // 404 = มีคนลบไปก่อนแล้ว — ถือว่าสำเร็จ แค่โหลดใหม่
      if (res.ok || res.status === 404) {
        setActionError("");
        setReloadKey(k => k + 1);
      } else {
        setActionError(t("deleteFailed", lang));
      }
    } catch {
      setActionError(t("deleteFailed", lang));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // owner ที่ผูกไว้อาจถูกลบออกจากแท็บ Owner ไปแล้ว — คงไว้ใน dropdown ไม่ให้ค่าหาย
  const ownerChoices = useMemo(() => {
    // planner ไม่ได้เลือก owner เอง — ล็อกเป็นบริษัทตัวเอง
    const ownerList = isPlanner ? (myCompany ? [myCompany] : []) : ownerOptions;
    return form.name && !ownerList.includes(form.name) ? [form.name, ...ownerList] : ownerList;
  }, [form.name, isPlanner, myCompany, ownerOptions]);

  // แท็บ Outsource เลือก company ได้ทั้งฝั่ง Owner และ Vendor — เช่นเดียวกัน ค่าเดิมต้องไม่หาย
  const companyGroups = useMemo(() => {
    const groups = isPlanner
      ? [{ label: t("company", lang), options: myCompany ? [myCompany] : [] }]
      : [
          { label: t("owner", lang), options: ownerOptions },
          { label: t("vendor", lang), options: vendorOptions },
        ];
    const known = groups.flatMap(g => g.options);
    if (form.company && !known.includes(form.company)) {
      groups.unshift({ label: t("company", lang), options: [form.company] });
    }
    return groups.filter(g => g.options.length);
  }, [isPlanner, myCompany, ownerOptions, vendorOptions, form.company, lang]);

  const hasCompanyChoice = companyGroups.some(g => g.options.length);

  const openAdd = () => {
    if (isPlanner) {
      // owner 1 รายมีได้ record เดียว — planner มีบริษัทเดียว ถ้ามีแล้วก็เปิดของเดิมพร้อมช่อง vendor ใหม่
      if (isVendorTab && companies.length) {
        openEdit(companies[0]);
        setVendors(list => [...list.filter(v => v.name || v.brands.length), emptyVendor()]);
        return;
      }
      // outsource ของบริษัทตัวเองมีอยู่แล้ว — เปิดกลุ่มเดิมพร้อมช่องว่างให้เพิ่มต่อ จะได้เห็นชื่อที่มีครบ
      if (isOutsourceTab && outsourceGroups.length) {
        openEditGroup(outsourceGroups[0], true);
        return;
      }
      setEditId(null);
      setEditGroupCompany(null);
      setForm({ ...EMPTY_FORM, name: isVendorTab ? myCompany : "", company: isOutsourceTab ? myCompany : "" });
      setVendors([emptyVendor()]);
      setOutsourceItems([emptyOutsource()]);
      setRemovedOutsources([]);
      setFormError("");
      setAddOpen(true);
      return;
    }
    setEditId(null);
    setEditGroupCompany(null);
    setForm({ ...EMPTY_FORM });
    setVendors([emptyVendor()]);
    setOutsourceItems([emptyOutsource()]);
    setRemovedOutsources([]);
    setFormError("");
    setAddOpen(true);
  };

  /** แก้ทั้งกลุ่มของ company เดียว: เปลี่ยนชื่อ / ลบ / เพิ่ม outsource / ย้าย company ได้ในฟอร์มเดียว */
  const openEditGroup = (g: OutsourceGroup, withBlankRow = false) => {
    setEditId(null);
    setEditGroupCompany(g.company);
    setForm({ ...EMPTY_FORM, company: g.company });
    const items = g.items.map(c => ({ id: c.id, name: c.name, orig: c.name }));
    setOutsourceItems(withBlankRow ? [...items, emptyOutsource()] : items.length ? items : [emptyOutsource()]);
    setRemovedOutsources([]);
    setFormError("");
    setAddOpen(true);
  };

  const openEdit = (c: Company) => {
    setEditId(c.id);
    setEditGroupCompany(null);
    setForm({ name: c.name, tel: c.tel, email: c.email, address: c.address, company: c.company || "" });
    // หยิบมาเฉพาะ 2 ฟิลด์ที่ใช้ — record เก่าอาจมีฟิลด์ติดต่อที่เลิกใช้แล้วติดมาด้วย
    setVendors(
      c.vendors.length
        ? c.vendors.map(v => ({ name: v.name || "", brands: [...(v.brands || [])] }))
        : [emptyVendor()]
    );
    setOutsourceItems([emptyOutsource()]);
    setRemovedOutsources([]);
    setFormError("");
    setAddOpen(true);
  };

  const closeAdd = () => {
    if (saving) return;
    setAddOpen(false);
  };

  const patchVendor = (idx: number, patch: Partial<VendorEntry>) =>
    setVendors(list => list.map((v, i) => (i === idx ? { ...v, ...patch } : v)));

  const removeVendor = (idx: number) =>
    setVendors(list => (list.length > 1 ? list.filter((_, i) => i !== idx) : list));

  const removeOutsource = (idx: number) => {
    const item = outsourceItems[idx];
    if (!item) return;
    // รายการเดิมเก็บไว้ลบตอนกดบันทึก — กดเอาคืนได้ถ้ากดผิด
    if (item.id) setRemovedOutsources(list => [...list, item]);
    setOutsourceItems(list => {
      const next = list.filter((_, i) => i !== idx);
      return next.length ? next : [emptyOutsource()];
    });
  };

  const undoRemoveOutsource = (item: OutsourceItem) => {
    setRemovedOutsources(list => list.filter(r => r.id !== item.id));
    setOutsourceItems(list => {
      const kept = list.filter(i => i.id || i.name.trim()); // ตัดช่องว่างที่เติมไว้ตอนลบจนหมด
      return [...kept, { ...item, name: item.orig }];
    });
  };

  const saveCompany = (payload: object, id: string | null = null) => apiFetch(id ? `/companies/${id}` : "/companies/", {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  /** บันทึกแท็บ Outsource: ลบ → แก้ชื่อ/ย้าย company → เพิ่มใหม่ (ลบก่อน จะได้นำชื่อที่ลบมาใช้ซ้ำได้) */
  const submitOutsource = async () => {
    const company = form.company.trim();
    if (!company) {
      setFormError(t("companyRequired", lang));
      return;
    }
    // รายการเดิมที่ถูกล้างชื่อจนว่าง — ไม่รู้ว่าตั้งใจลบหรือพิมพ์ค้าง ให้กด ✕ แทน
    if (outsourceItems.some(i => i.id && !i.name.trim())) {
      setFormError(t("outsourceNameRequired", lang));
      return;
    }
    const filled = outsourceItems.filter(i => i.name.trim());
    if (!filled.length && !removedOutsources.length) {
      setFormError(t("outsourceNameRequired", lang));
      return;
    }
    const seen = new Set<string>();
    for (const i of filled) {
      const key = i.name.trim().toLowerCase();
      if (seen.has(key)) {
        setFormError(t("duplicateOutsource", lang));
        return;
      }
      seen.add(key);
    }

    const companyChanged = editGroupCompany !== null && company !== editGroupCompany;
    setSaving(true);
    setFormError("");
    let failed: Response | null = null;
    let changed = false;
    try {
      const stillRemoved: OutsourceItem[] = [];
      for (const item of removedOutsources) {
        const res = await apiFetch(`/companies/${item.id}`, { method: "DELETE", credentials: "include" });
        if (res.ok || res.status === 404) changed = true;
        else { failed ??= res; stillRemoved.push(item); }
      }

      const nextItems: OutsourceItem[] = [];
      for (const item of outsourceItems) {
        const name = item.name.trim();
        if (!item.id) {
          if (!name) continue; // ช่องว่างที่กดเพิ่มไว้แต่ไม่ได้กรอก
          const res = await saveCompany({ name, type: "outsource", company });
          if (res.ok) {
            const created = await res.json();
            changed = true;
            nextItems.push({ id: String(created.id), name, orig: name });
          } else {
            failed ??= res;
            nextItems.push(item);
          }
        } else if (name !== item.orig || companyChanged) {
          const res = await saveCompany({ name, company }, item.id);
          if (res.ok) {
            changed = true;
            nextItems.push({ ...item, name, orig: name });
          } else {
            failed ??= res;
            nextItems.push(item);
          }
        } else {
          nextItems.push(item);
        }
      }

      if (changed) setReloadKey(k => k + 1);
      if (!failed) {
        setAddOpen(false);
        return;
      }
      // บางรายการผ่านแล้ว — เก็บสถานะล่าสุดไว้ กดบันทึกซ้ำจะไม่สร้าง/ลบซ้ำ
      setRemovedOutsources(stillRemoved);
      setOutsourceItems(nextItems.length ? nextItems : [emptyOutsource()]);
      setFormError(t(failed.status === 409 ? "duplicateOutsource" : "saveFailed", lang));
    } catch {
      if (changed) setReloadKey(k => k + 1);
      setFormError(t("saveFailed", lang));
    } finally {
      setSaving(false);
    }
  };

  const submitAdd = async () => {
    if (isOutsourceTab) {
      await submitOutsource();
      return;
    }
    if (!form.name.trim()) {
      setFormError(t(isVendorTab ? "ownerRequired" : "ownerNameRequired", lang));
      return;
    }
    const cleanVendors = vendors
      .map(v => ({ name: v.name.trim(), brands: v.brands.filter(b => b.trim()) }))
      .filter(v => v.name || v.brands.length);
    if (isVendorTab && !cleanVendors.some(v => v.name)) {
      setFormError(t("vendorRequired", lang));
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const res = await saveCompany(
        isVendorTab
          ? { name: form.name.trim(), type: activeType, vendors: cleanVendors }
          : { ...form, name: form.name.trim(), type: activeType },
        editId
      );
      if (res.ok) {
        setAddOpen(false);
        setReloadKey(k => k + 1);
      } else if (res.status === 409) {
        setFormError(t(isVendorTab ? "duplicateOwner" : "duplicate", lang));
      } else {
        setFormError(t("saveFailed", lang));
      }
    } catch {
      setFormError(t("saveFailed", lang));
    } finally {
      setSaving(false);
    }
  };

  const editButton = (c: Company) => (
    <Tooltip content={t("edit", lang)}>
      <button
        onClick={() => openEdit(c)}
        aria-label={t("edit", lang)}
        className="tw-group/btn tw-rounded-lg tw-bg-blue-50 tw-p-2 tw-shadow-sm tw-ring-1 tw-ring-blue-200/60 tw-transition-all tw-duration-200 hover:tw-bg-blue-600 hover:tw-shadow-md hover:tw-ring-blue-600"
      >
        <PencilSquareIcon className="tw-h-4 tw-w-4 tw-text-blue-600 tw-transition-colors group-hover/btn:tw-text-white" />
      </button>
    </Tooltip>
  );

  const groupEditButton = (g: OutsourceGroup) => (
    <Tooltip content={t("manageOutsource", lang)}>
      <button
        onClick={() => openEditGroup(g)}
        aria-label={t("manageOutsource", lang)}
        className="tw-group/btn tw-rounded-lg tw-bg-blue-50 tw-p-2 tw-shadow-sm tw-ring-1 tw-ring-blue-200/60 tw-transition-all tw-duration-200 hover:tw-bg-blue-600 hover:tw-shadow-md hover:tw-ring-blue-600"
      >
        <PencilSquareIcon className="tw-h-4 tw-w-4 tw-text-blue-600 tw-transition-colors group-hover/btn:tw-text-white" />
      </button>
    </Tooltip>
  );

  const deleteButton = (c: Company) => (
    <Tooltip content={t("deleteOutsource", lang)}>
      <button
        onClick={() => setDeleteTarget(c)}
        aria-label={`${t("deleteOutsource", lang)} ${c.name}`}
        className="tw-group/del tw-rounded-lg tw-bg-red-50 tw-p-2 tw-shadow-sm tw-ring-1 tw-ring-red-200/60 tw-transition-all tw-duration-200 hover:tw-bg-red-600 hover:tw-shadow-md hover:tw-ring-red-600"
      >
        <TrashIcon className="tw-h-4 tw-w-4 tw-text-red-500 tw-transition-colors group-hover/del:tw-text-white" />
      </button>
    </Tooltip>
  );

  const brandBadges = (brands: string[]) =>
    brands.length ? (
      <div className="tw-flex tw-flex-wrap tw-gap-1.5">
        {brands.map(b => (
          <span
            key={b}
            className="tw-rounded-md tw-bg-blue-gray-50 tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-blue-gray-600 tw-shadow-sm tw-ring-1 tw-ring-black/5"
          >
            {b}
          </span>
        ))}
      </div>
    ) : (
      <span className="tw-text-gray-300">-</span>
    );

  const columnCount = isVendorTab || isOutsourceTab ? 5 : 3;

  const messageRow = (msg: string, isError = false) => (
    <tr>
      <td
        colSpan={columnCount}
        className={`tw-p-8 tw-text-center tw-text-sm ${isError ? "tw-text-red-500" : "tw-text-gray-400"}`}
      >
        {msg}
      </td>
    </tr>
  );

  /** แท็บ Vendor: 1 แถว = vendor 1 ราย โดยช่อง Owner ถูกรวมด้วย rowSpan */
  const vendorRows = () =>
    companies.map((c, i) => {
      const rows: (VendorEntry | null)[] = c.vendors.length ? c.vendors : [null];
      return rows.map((v, j) => (
        <tr
          key={`${c.id}-${j}`}
          className={`${j === 0 ? "tw-border-t tw-border-gray-100" : ""} hover:tw-bg-blue-50/30`}
        >
          {j === 0 && (
            <>
              <td rowSpan={rows.length} className="tw-px-4 tw-py-3 tw-align-top tw-text-gray-400">{i + 1}</td>
              <td rowSpan={rows.length} className="tw-px-4 tw-py-3 tw-align-top tw-font-medium tw-text-gray-800">{c.name}</td>
            </>
          )}
          <td className="tw-px-4 tw-py-3 tw-text-gray-600">{v?.name || "-"}</td>
          <td className="tw-px-4 tw-py-3">{brandBadges(v?.brands || [])}</td>
          {j === 0 && (
            <td rowSpan={rows.length} className="tw-px-4 tw-py-3 tw-align-top">{editButton(c)}</td>
          )}
        </tr>
      ));
    });

  /** แท็บ Outsource: รวมกลุ่มตาม company (rowSpan) — 1 แถว = outsource 1 ราย พร้อมปุ่มลบรายตัว */
  const outsourceRows = () =>
    outsourceGroups.map((g, i) =>
      g.items.map((c, j) => (
        <tr
          key={c.id}
          className={`${j === 0 ? "tw-border-t tw-border-gray-200" : "tw-border-t tw-border-gray-50"} hover:tw-bg-blue-50/30`}
        >
          {j === 0 && (
            <>
              <td rowSpan={g.items.length} className="tw-px-4 tw-py-3 tw-align-top tw-text-gray-400">{i + 1}</td>
              <td rowSpan={g.items.length} className="tw-px-4 tw-py-3 tw-align-top">
                <div className="tw-font-medium tw-text-gray-800">{g.company || "-"}</div>
                <div className="tw-mt-1 tw-text-[11px] tw-text-gray-400">
                  {g.items.length} {t("outsourceUnit", lang)}
                </div>
              </td>
            </>
          )}
          <td className="tw-px-4 tw-py-2.5 tw-text-gray-600">{c.name}</td>
          <td className="tw-px-2 tw-py-2.5 tw-text-right">{deleteButton(c)}</td>
          {j === 0 && (
            <td rowSpan={g.items.length} className="tw-border-l tw-border-gray-100 tw-px-4 tw-py-3 tw-align-top">
              {groupEditButton(g)}
            </td>
          )}
        </tr>
      ))
    );

  const plainRows = () =>
    companies.map((c, i) => (
      <tr key={c.id} className="tw-border-t tw-border-gray-100 hover:tw-bg-blue-50/30">
        <td className="tw-px-4 tw-py-3 tw-text-gray-400">{i + 1}</td>
        <td className="tw-px-4 tw-py-3 tw-font-medium tw-text-gray-800">{c.name}</td>
        <td className="tw-px-4 tw-py-3">{editButton(c)}</td>
      </tr>
    ));

  const renderBody = () => {
    if (!me || loading) return messageRow(t("loading", lang));
    if (plannerWithoutCompany) return messageRow(t("noMyCompany", lang), true);
    if (loadError) return messageRow(t("loadFailed", lang), true);
    if (!companies.length) return messageRow(t("empty", lang));
    return isVendorTab ? vendorRows() : isOutsourceTab ? outsourceRows() : plainRows();
  };

  return (
    <div className="tw-w-full tw-mt-8">
      {/* Custom Tabs — สไตล์เดียวกับหน้า CM report */}
      <div className="tw-w-full tw-flex tw-justify-start tw-overflow-x-auto tw-scrollbar-hide">
        <div className="tw-inline-flex tw-items-center tw-gap-1 tw-p-1 tw-bg-gray-100 tw-rounded-xl tw-border tw-border-gray-200">
          {visibleTabs.map((tab) => {
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
      <div className="tw-pt-4 tw-animate-[fadeIn_0.3s_ease-out]">
        <Card className="tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-shadow-sm">
          <div className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-border-b tw-border-gray-100 tw-px-4 tw-py-3.5">
            <div>
              <h2 className="tw-text-base tw-font-bold tw-text-gray-800">{active}</h2>
              {!loading && !loadError && !plannerWithoutCompany && (
                <p className="tw-mt-0.5 tw-text-xs tw-text-gray-500">
                  {isOutsourceTab
                    ? `${outsourceGroups.length} ${t("companyUnit", lang)} · ${companies.length} ${t("outsourceUnit", lang)}`
                    : `${companies.length} ${t("count", lang)}`}
                  {isPlanner && myCompany && ` · ${t("scopeHint", lang)} ${myCompany}`}
                </p>
              )}
            </div>
            <Button
              size="sm"
              onClick={openAdd}
              disabled={!me || plannerWithoutCompany}
              className="tw-shrink-0 tw-rounded-xl tw-bg-gray-900 tw-px-4 tw-py-2 tw-text-xs tw-font-semibold tw-normal-case tw-shadow-lg tw-shadow-gray-900/20 tw-transition-all hover:tw-bg-black hover:tw-shadow-xl"
            >
              + {t("add", lang)}
            </Button>
          </div>

          {actionError && (
            <div className="tw-mx-4 tw-mt-3 tw-flex tw-items-center tw-gap-3 tw-rounded-xl tw-bg-red-50 tw-px-4 tw-py-2.5 tw-text-sm tw-text-red-700 tw-ring-1 tw-ring-red-200/70">
              <span>⚠️</span>
              <span className="tw-flex-1">{actionError}</span>
              <button type="button" onClick={() => setActionError("")} aria-label={t("cancel", lang)} className="tw-text-red-400 hover:tw-text-red-600">✕</button>
            </div>
          )}

          <div className="tw-overflow-x-auto">
            <table className={`tw-w-full ${isVendorTab ? "tw-min-w-[760px]" : "tw-min-w-[640px]"} tw-table-auto tw-text-left tw-text-sm`}>
              <thead>
                <tr className="tw-bg-gray-50 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-gray-500">
                  <th className={`${TH_CLASS} tw-w-12`}>#</th>
                  {isVendorTab ? (
                    <>
                      <th className={TH_CLASS}>{t("owner", lang)}</th>
                      <th className={TH_CLASS}>{t("vendor", lang)}</th>
                      <th className={TH_CLASS}>{t("brand", lang)}</th>
                    </>
                  ) : isOutsourceTab ? (
                    <>
                      <th className={TH_CLASS}>{t("company", lang)}</th>
                      <th className={TH_CLASS}>{t("outsourceName", lang)}</th>
                      <th className={`${TH_CLASS} tw-w-16`} />
                    </>
                  ) : (
                    <th className={TH_CLASS}>{t("ownerName", lang)}</th>
                  )}
                  <th className={`${TH_CLASS} tw-w-20`} />
                </tr>
              </thead>
              <tbody>{renderBody()}</tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ══════ Dialog เพิ่ม / แก้ไขบริษัท — โครงเดียวกับ dialog หน้า EV Station ══════ */}
      <Dialog
        open={addOpen}
        handler={closeAdd}
        size={isVendorTab ? "md" : "sm"}
        dismiss={{ outsidePress: !saving, escapeKey: !saving }}
        className="tw-flex tw-flex-col tw-max-h-[95vh] sm:tw-max-h-[90vh] tw-overflow-hidden !tw-rounded-xl sm:!tw-rounded-2xl !tw-m-2 sm:!tw-m-4"
      >
        {/* ══════ HEADER ══════ */}
        <DialogHeader className="tw-sticky tw-top-0 tw-z-10 tw-shrink-0 tw-border-0 tw-bg-gradient-to-r tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-4 tw-py-3.5 tw-shadow-xl sm:tw-px-6 sm:tw-py-5">
          <div className="tw-flex tw-w-full tw-items-center tw-justify-between">
            <div className="tw-flex tw-items-center tw-gap-2.5 sm:tw-gap-3.5">
              <Typography variant="h5" className="!tw-text-base !tw-font-bold !tw-leading-tight !tw-tracking-tight !tw-text-white sm:!tw-text-lg">
                {t(isEditing ? "editCompany" : "addCompany", lang)} — {active}
              </Typography>
            </div>
            <button
              type="button"
              onClick={closeAdd}
              aria-label={t("cancel", lang)}
              className="tw-rounded-xl tw-bg-white/10 tw-p-1.5 tw-text-white/60 tw-transition-all tw-duration-200 hover:tw-bg-white/20 hover:tw-text-white sm:tw-p-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="tw-h-5 tw-w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </DialogHeader>

        <DialogBody className="tw-flex-1 tw-min-h-0 tw-space-y-3 tw-overflow-y-auto tw-bg-gray-50/60 tw-px-3 tw-py-3 sm:tw-space-y-5 sm:tw-px-6 sm:tw-py-5">
          {isVendorTab ? (
            <>
              {/* ══════ OWNER CARD ══════ */}
              <section className="tw-overflow-hidden tw-rounded-xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/[.06] sm:tw-rounded-2xl">
                <div className="tw-flex tw-items-center tw-gap-2.5 tw-border-b tw-border-gray-100 tw-px-3.5 tw-py-3 sm:tw-gap-3 sm:tw-px-5 sm:tw-py-4">
                  <SectionIcon emoji="🏢" />
                  <Typography variant="h6" className="!tw-text-sm !tw-font-bold !tw-tracking-tight !tw-text-gray-800 sm:!tw-text-base">
                    {t("ownerInfo", lang)}
                  </Typography>
                </div>
                <div className="tw-p-3.5 sm:tw-p-5">
                  <div className="tw-relative tw-h-10 tw-w-full">
                    <select
                      required
                      value={form.name}
                      onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                      disabled={isPlanner}
                      className="tw-peer tw-h-full tw-w-full tw-cursor-pointer tw-appearance-none tw-rounded-[7px] tw-border tw-border-blue-gray-200 tw-bg-transparent tw-px-3 tw-py-2.5 tw-font-sans tw-text-sm tw-font-normal tw-text-blue-gray-700 tw-outline-none focus:tw-border-2 focus:tw-border-gray-900 disabled:tw-cursor-not-allowed disabled:tw-bg-blue-gray-50"
                    >
                      <option value="" disabled>{t("selectOwner", lang)}</option>
                      {ownerChoices.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <ChevronDown />
                    <label className="tw-pointer-events-none tw-absolute tw-left-3 tw--top-1.5 tw-bg-white tw-px-1 tw-text-[11px] tw-font-normal tw-text-blue-gray-400">
                      {t("owner", lang)} *
                    </label>
                  </div>
                  {!ownerChoices.length && (
                    <div className="tw-mt-3 tw-rounded-xl tw-bg-amber-50/60 tw-px-4 tw-py-3 tw-text-sm tw-text-amber-700 tw-ring-1 tw-ring-amber-200/70">
                      {t("noOwners", lang)}
                    </div>
                  )}
                </div>
              </section>

              {/* ══════ VENDORS ══════ */}
              <section className="tw-space-y-3 sm:tw-space-y-4">
                <div className="tw-flex tw-items-center tw-justify-between">
                  <div className="tw-flex tw-items-center tw-gap-2 sm:tw-gap-3">
                    <SectionIcon emoji="🤝" />
                    <Typography variant="h6" className="!tw-text-sm !tw-font-bold !tw-tracking-tight !tw-text-gray-800 sm:!tw-text-base">
                      {t("vendors", lang)} <span className="tw-font-normal tw-text-blue-gray-400">({vendors.length})</span>
                    </Typography>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setVendors(list => [...list, emptyVendor()])}
                    className="tw-rounded-xl tw-bg-gray-900 tw-px-3 tw-py-2 tw-text-[11px] tw-font-semibold tw-normal-case hover:tw-bg-black sm:tw-px-4 sm:tw-text-xs"
                  >
                    + {t("addVendor", lang)}
                  </Button>
                </div>

                {vendors.map((v, idx) => (
                  <div
                    key={idx}
                    className="tw-overflow-hidden tw-rounded-xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/[.06] tw-transition-shadow tw-duration-300 hover:tw-shadow-md sm:tw-rounded-2xl"
                  >
                    {/* vendor header bar */}
                    <div className="tw-flex tw-items-center tw-justify-between tw-border-b tw-border-amber-100/70 tw-bg-gradient-to-r tw-from-amber-50 tw-to-orange-50/80 tw-px-3.5 tw-py-2.5 sm:tw-px-5 sm:tw-py-3">
                      <div className="tw-flex tw-min-w-0 tw-items-center tw-gap-2 sm:tw-gap-2.5">
                        <span className="tw-inline-flex tw-h-6 tw-w-6 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-lg tw-bg-gradient-to-br tw-from-amber-400 tw-to-orange-500 tw-text-[10px] tw-font-bold tw-text-white tw-shadow sm:tw-h-7 sm:tw-w-7 sm:tw-text-xs">
                          {idx + 1}
                        </span>
                        <span className="tw-truncate tw-text-xs tw-font-bold tw-text-gray-700 sm:tw-text-sm">
                          {v.name.trim() || `${t("vendor", lang)} ${idx + 1}`}
                        </span>
                        {v.brands.length > 0 && (
                          <span className="tw-hidden tw-max-w-[160px] tw-truncate tw-rounded-md tw-bg-white/90 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-semibold tw-text-blue-gray-500 tw-shadow-sm tw-ring-1 tw-ring-black/5 sm:tw-inline">
                            {v.brands.join(", ")}
                          </span>
                        )}
                      </div>
                      {vendors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVendor(idx)}
                          title={t("removeVendor", lang)}
                          className="tw-flex tw-h-7 tw-w-7 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-lg tw-text-red-400 tw-transition-colors hover:tw-bg-red-500 hover:tw-text-white"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="tw-space-y-3 tw-p-3.5 sm:tw-space-y-4 sm:tw-p-5">
                      <Input
                        label={t("vendorName", lang)}
                        required
                        value={v.name}
                        onChange={(e) => patchVendor(idx, { name: e.target.value })}
                        crossOrigin={undefined}
                      />
                      <BrandChips
                        value={v.brands}
                        onChange={(brands) => patchVendor(idx, { brands })}
                        lang={lang}
                      />
                    </div>
                  </div>
                ))}
              </section>
            </>
          ) : isOutsourceTab ? (
            /* ══════ OUTSOURCE CARD — company (owner+vendor) + ชื่อ outsource ══════ */
            <section className="tw-overflow-hidden tw-rounded-xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/[.06] sm:tw-rounded-2xl">
              <div className="tw-flex tw-items-center tw-gap-2.5 tw-border-b tw-border-gray-100 tw-px-3.5 tw-py-3 sm:tw-gap-3 sm:tw-px-5 sm:tw-py-4">
                <SectionIcon emoji="🛠️" />
                <Typography variant="h6" className="!tw-text-sm !tw-font-bold !tw-tracking-tight !tw-text-gray-800 sm:!tw-text-base">
                  {t("outsourceInfo", lang)}
                </Typography>
              </div>
              <div className="tw-space-y-5 tw-p-3.5 sm:tw-p-5">
                <div className="tw-relative tw-h-10 tw-w-full">
                  <select
                    required
                    value={form.company}
                    onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))}
                    disabled={isPlanner}
                    className="tw-peer tw-h-full tw-w-full tw-cursor-pointer tw-appearance-none tw-rounded-[7px] tw-border tw-border-blue-gray-200 tw-bg-transparent tw-px-3 tw-py-2.5 tw-font-sans tw-text-sm tw-font-normal tw-text-blue-gray-700 tw-outline-none focus:tw-border-2 focus:tw-border-gray-900 disabled:tw-cursor-not-allowed disabled:tw-bg-blue-gray-50"
                  >
                    <option value="" disabled>{t("selectCompany", lang)}</option>
                    {companyGroups.map(group => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map(name => (
                          <option key={`${group.label}-${name}`} value={name}>{name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown />
                  <label className="tw-pointer-events-none tw-absolute tw-left-3 tw--top-1.5 tw-bg-white tw-px-1 tw-text-[11px] tw-font-normal tw-text-blue-gray-400">
                    {t("company", lang)} *
                  </label>
                </div>
                {!hasCompanyChoice && (
                  <div className="tw-rounded-xl tw-bg-amber-50/60 tw-px-4 tw-py-3 tw-text-sm tw-text-amber-700 tw-ring-1 tw-ring-amber-200/70">
                    {t("noCompanies", lang)}
                  </div>
                )}
                <div className="tw-space-y-3">
                  {outsourceItems.map((item, idx) => (
                    <div key={item.id ?? `new-${idx}`} className="tw-flex tw-items-start tw-gap-2">
                      <div className="tw-min-w-0 tw-flex-1">
                        <Input
                          label={`${t("outsourceName", lang)} ${idx + 1}`}
                          required
                          value={item.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setOutsourceItems(list => list.map((v, i) => (i === idx ? { ...v, name } : v)));
                          }}
                          crossOrigin={undefined}
                        />
                      </div>
                      {(outsourceItems.length > 1 || item.id) && (
                        <button
                          type="button"
                          onClick={() => removeOutsource(idx)}
                          title={t("removeOutsource", lang)}
                          aria-label={t("removeOutsource", lang)}
                          className="tw-flex tw-h-10 tw-w-10 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-lg tw-text-red-400 tw-transition-colors hover:tw-bg-red-500 hover:tw-text-white"
                        >
                          {item.id ? <TrashIcon className="tw-h-4 tw-w-4" /> : "✕"}
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setOutsourceItems(list => [...list, emptyOutsource()])}
                    className="tw-text-sm tw-font-semibold tw-text-blue-600 hover:tw-text-blue-800"
                  >
                    + {t("addOutsource", lang)}
                  </button>
                </div>
                {removedOutsources.length > 0 && (
                  <div className="tw-rounded-xl tw-bg-red-50/60 tw-px-4 tw-py-3 tw-ring-1 tw-ring-red-200/70">
                    <p className="tw-mb-2 tw-text-xs tw-font-semibold tw-text-red-700">
                      🗑️ {t("pendingDelete", lang)} ({removedOutsources.length})
                    </p>
                    <div className="tw-flex tw-flex-wrap tw-gap-1.5">
                      {removedOutsources.map(item => (
                        <span
                          key={item.id}
                          className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-md tw-bg-white tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-red-600 tw-shadow-sm tw-ring-1 tw-ring-red-200"
                        >
                          <span className="tw-line-through">{item.orig}</span>
                          <button
                            type="button"
                            onClick={() => undoRemoveOutsource(item)}
                            className="tw-text-blue-600 hover:tw-text-blue-800"
                          >
                            {t("undo", lang)}
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          ) : (
            /* ══════ OWNER CARD ══════ */
            <section className="tw-overflow-hidden tw-rounded-xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/[.06] sm:tw-rounded-2xl">
              <div className="tw-flex tw-items-center tw-gap-2.5 tw-border-b tw-border-gray-100 tw-px-3.5 tw-py-3 sm:tw-gap-3 sm:tw-px-5 sm:tw-py-4">
                <SectionIcon emoji="🏢" />
                <Typography variant="h6" className="!tw-text-sm !tw-font-bold !tw-tracking-tight !tw-text-gray-800 sm:!tw-text-base">
                  {t("ownerInfo", lang)}
                </Typography>
              </div>
              <div className="tw-p-3.5 sm:tw-p-5">
                <Input
                  label={t("ownerName", lang)}
                  required
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  crossOrigin={undefined}
                />
              </div>
            </section>
          )}

          {formError && (
            <div className="tw-flex tw-items-center tw-gap-3 tw-rounded-xl tw-bg-red-50 tw-px-4 tw-py-3 tw-text-sm tw-text-red-700 tw-ring-1 tw-ring-red-200/70">
              <span className="tw-text-base">⚠️</span>
              <span>{formError}</span>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-shrink-0 tw-border-t tw-border-gray-200/80 tw-bg-white tw-px-3 tw-py-3 sm:tw-px-6 sm:tw-py-4">
          <div className="tw-flex tw-w-full tw-flex-col tw-items-center tw-justify-end tw-gap-2.5 sm:tw-flex-row sm:tw-gap-2.5">
            <div className="tw-flex tw-w-full tw-gap-2 sm:tw-w-auto sm:tw-gap-2.5">
              <Button
                variant="outlined"
                type="button"
                onClick={closeAdd}
                disabled={saving}
                className="tw-flex-1 tw-rounded-xl tw-border-gray-300 tw-px-4 tw-py-2.5 tw-text-xs tw-font-semibold tw-normal-case tw-text-gray-600 hover:tw-bg-gray-50 sm:tw-flex-none sm:tw-px-5 sm:tw-py-2 sm:tw-text-sm"
              >
                {t("cancel", lang)}
              </Button>
              <Button
                type="button"
                onClick={submitAdd}
                disabled={saving}
                className="tw-flex-1 tw-rounded-xl tw-bg-gray-900 tw-px-4 tw-py-2.5 tw-text-xs tw-font-semibold tw-normal-case tw-tracking-wide tw-shadow-lg tw-shadow-gray-900/20 tw-transition-all tw-duration-200 hover:tw-bg-black hover:tw-shadow-xl disabled:tw-opacity-50 sm:tw-flex-none sm:tw-px-6 sm:tw-py-2 sm:tw-text-sm"
              >
                {saving
                  ? <span className="tw-flex tw-items-center tw-justify-center tw-gap-2"><Spinner />{t("saving", lang)}</span>
                  : t("save", lang)}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        variant="danger"
        title={`${t("deleteConfirmTitle", lang)}${deleteTarget ? ` "${deleteTarget.name}"` : ""}`}
        message={`${deleteTarget?.company ? `${t("company", lang)}: ${deleteTarget.company} — ` : ""}${t("deleteConfirmMsg", lang)}`}
        confirmLabel={t("remove", lang)}
        cancelLabel={t("cancel", lang)}
      />
    </div>
  );
}
