"use client";

/**
 * ลิสต์ checkbox "ผู้รับผิดชอบ" ของฟอร์ม PM — ใช้ร่วมกันระหว่าง
 *   - PmPlanForm.tsx     (วางแผนใบงานที่มาจาก Maximo)
 *   - PmCreateWoForm.tsx (เปิดใบงานเอง)
 * ทั้งสองหน้าต้องเห็นชื่อชุดเดียวกันเสมอ จึงแยกออกมาเป็น component เดียว
 *
 * ชื่อที่เลือกได้มาจาก GET /companies/pm-options ซึ่งกรองด้วย company ของคนที่ login แล้ว
 * แบ่งเป็น Technician / Vendor / Outsource (กลุ่มที่ไม่มีคนจะไม่ถูกส่งมา)
 */

import React, { useMemo, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import {
  filterPmAssigneeGroups,
  pmAssigneeNames,
  togglePmAssigneeBatch,
  type PmAssigneeGroup,
} from "./planning";

const T = {
  all: { th: "ทั้งหมด", en: "All" },
  searchPlaceholder: { th: "ค้นหาชื่อ...", en: "Search by name..." },
  noMatch: { th: "ไม่พบชื่อที่ค้นหา", en: "No matching name" },
} as const;

const t = (key: keyof typeof T, lang: Lang) => T[key][lang === "en" ? "en" : "th"];

type Props = {
  /** กลุ่มที่มีคนอยู่จริงเท่านั้น — ได้จาก pmAssigneeGroups() */
  groups: PmAssigneeGroup[];
  assignees: string[];
  onChange: (next: string[]) => void;
  /** อ่านอย่างเดียว (ยังค้นหาได้ แต่ติ๊กไม่ได้) */
  disabled?: boolean;
};

export default function PmAssigneePicker({ groups, assignees, onChange, disabled = false }: Props) {
  const { lang } = useLanguage();
  const [query, setQuery] = useState("");

  const visibleGroups = useMemo(() => filterPmAssigneeGroups(groups, query), [groups, query]);

  const visibleNames = useMemo(() => pmAssigneeNames(visibleGroups), [visibleGroups]);
  const selectedVisible = useMemo(
    () => visibleNames.filter((name) => assignees.includes(name)).length,
    [visibleNames, assignees]
  );
  const allVisibleChecked = visibleNames.length > 0 && selectedVisible === visibleNames.length;

  const toggleAllVisible = () =>
    onChange(togglePmAssigneeBatch(assignees, visibleNames, allVisibleChecked));

  const toggleOne = (name: string) =>
    onChange(
      assignees.includes(name)
        ? assignees.filter((x) => x !== name)
        : [...assignees.filter(Boolean), name]
    );

  return (
    <div className="tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-overflow-hidden">
      {/* ช่องค้นหาอยู่นอกพื้นที่ scroll — ลิสต์ยาวแค่ไหนก็ยังเห็นช่องค้นหาตลอด */}
      <div className="tw-relative tw-border-b tw-border-blue-gray-100">
        <MagnifyingGlassIcon className="tw-pointer-events-none tw-absolute tw-left-3 tw-top-1/2 -tw-translate-y-1/2 tw-h-4 tw-w-4 tw-text-blue-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder", lang)}
          className="tw-w-full tw-bg-white tw-py-2.5 tw-pl-9 tw-pr-3 tw-text-sm tw-text-blue-gray-800 placeholder:tw-text-blue-gray-300 focus:tw-outline-none"
        />
      </div>

      <div className="tw-max-h-56 tw-overflow-y-auto tw-divide-y tw-divide-blue-gray-50">
        {visibleNames.length === 0 ? (
          <p className="tw-px-3 tw-py-3 tw-text-sm tw-text-blue-gray-400">{t("noMatch", lang)}</p>
        ) : (
          <>
            <label className="tw-flex tw-items-center tw-gap-2.5 tw-px-3 tw-py-2.5 tw-cursor-pointer hover:tw-bg-blue-gray-50/60 tw-transition-colors">
              <input
                type="checkbox"
                checked={allVisibleChecked}
                disabled={disabled}
                onChange={toggleAllVisible}
                className="tw-h-4 tw-w-4 tw-shrink-0 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500 tw-cursor-pointer"
              />
              <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-800">{t("all", lang)}</span>
              <span className="tw-ml-auto tw-text-xs tw-text-blue-gray-400">
                {selectedVisible}/{visibleNames.length}
              </span>
            </label>

            {visibleGroups.map((group) => (
              <React.Fragment key={group.key}>
                <div className="tw-bg-gray-50 tw-px-3 tw-py-1.5 tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-wide tw-text-blue-gray-500">
                  {group.label}
                </div>
                {group.names.map((name) => (
                  <label
                    key={`${group.key}-${name}`}
                    className="tw-flex tw-items-center tw-gap-2.5 tw-px-3 tw-py-2.5 tw-cursor-pointer hover:tw-bg-blue-gray-50/60 tw-transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={assignees.includes(name)}
                      disabled={disabled}
                      onChange={() => toggleOne(name)}
                      className="tw-h-4 tw-w-4 tw-shrink-0 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500 tw-cursor-pointer"
                    />
                    <span className="tw-min-w-0 tw-truncate tw-text-sm tw-text-blue-gray-800">{name}</span>
                  </label>
                ))}
              </React.Fragment>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
