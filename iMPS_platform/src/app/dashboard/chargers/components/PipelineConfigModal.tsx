"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Dialog, DialogHeader, DialogBody, DialogFooter,
  Button, Input, Typography, Select, Option, Alert, Tooltip,
} from "@material-tailwind/react";
import {
  Cog6ToothIcon, CpuChipIcon, SignalIcon, CircleStackIcon, ClockIcon,
  PlusIcon, TrashIcon,
} from "@heroicons/react/24/solid";
import { apiFetch } from "@/utils/api";

type Lang = "th" | "en";

type PowerModuleDefaults = Record<string, number>;
type PipelineHardware = {
  dcContractorCount: number; powerModuleCount: number; dcFanCount: number;
  fanType: string; energyMeterType: string; powerModuleDefaults: PowerModuleDefaults;
};
type PipelineTopics = {
  plc: string | null; router: string | null; meter: string | null;
  ocpp_config: string | null; ebCountDevice: string | null; ebError: string | null;
  ebHeartbeat: string | null; ebTemp: string | null; fanRpm: string | null;
  pi5Heartbeat: string | null; mdbRaw: string | null;faultStatus: string | null;
};
type PipelineConfig = {
  hardware: PipelineHardware;
  topics: PipelineTopics;
  collections: { meter: string | null };
  service_life: { endDate: string | null };
};

type Props = {
  open: boolean;
  onClose: () => void;
  sn?: string | null;
  chargeBoxID?: string | null;
  stationId?: string | null;
  onSaved?: (ok: boolean, msg: string) => void;
};

const emptyConfig = (): PipelineConfig => ({
  hardware: { dcContractorCount: 0, powerModuleCount: 0, dcFanCount: 0, fanType: "FIXED", energyMeterType: "PILOT", powerModuleDefaults: {} },
  topics: {
    plc: "", router: "", meter: null,
    ocpp_config: "", ebCountDevice: "", ebError: "", ebHeartbeat: "", ebTemp: "",
    fanRpm: "", pi5Heartbeat: "", mdbRaw: "",faultStatus: "",   
  },
  collections: { meter: "" },
  service_life: { endDate: null },
});

const toLocalInput = (v: string | null | undefined): string => (v ? v.slice(0, 16) : "");
const fromLocalInput = (v: string): string | null => (v ? (v.length === 16 ? `${v}:00` : v) : null);
const emptyToNull = (v: string): string | null => { const s = v.trim(); return s ? s : null; };

const TOPIC_FIELDS: { key: keyof PipelineTopics; label: string }[] = [
  { key: "plc", label: "PLC" },
  { key: "router", label: "Router" },
  { key: "meter", label: "Meter" },
  { key: "ocpp_config", label: "OCPP Config" },
  { key: "ebCountDevice", label: "Edgebox Count Device" },
  { key: "ebError", label: "Edgebox Error" },
  { key: "ebHeartbeat", label: "Edgebox Heartbeat" },
  { key: "ebTemp", label: "Edgebox Temp" },
  { key: "fanRpm", label: "Fan RPM" },
  { key: "pi5Heartbeat", label: "Pi5 Heartbeat" },
  { key: "mdbRaw", label: "MDB Raw" },
  { key: "faultStatus", label: "Fault Status" },
];

const Spinner = () => (
  <svg className="tw-animate-spin tw-h-4 tw-w-4" viewBox="0 0 24 24" fill="none">
    <circle className="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const SectionCard = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <section className="tw-rounded-xl sm:tw-rounded-2xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/[.06] tw-overflow-hidden">
    <div className="tw-px-3.5 sm:tw-px-5 tw-py-3 sm:tw-py-4 tw-border-b tw-border-gray-100 tw-flex tw-items-center tw-gap-2.5 sm:tw-gap-3">
      <span className="tw-inline-flex tw-items-center tw-justify-center tw-h-7 tw-w-7 sm:tw-h-8 sm:tw-w-8 tw-rounded-xl tw-bg-gradient-to-br tw-from-indigo-500 tw-to-blue-600 tw-text-white tw-shadow-lg">{icon}</span>
      <Typography variant="h6" className="!tw-text-gray-800 !tw-font-bold !tw-tracking-tight !tw-text-sm sm:!tw-text-base">{title}</Typography>
    </div>
    <div className="tw-p-3.5 sm:tw-p-5">{children}</div>
  </section>
);

export default function PipelineConfigModal({ open, onClose, sn, chargeBoxID, stationId, onSaved }: Props) {
  const [lang, setLang] = useState<Lang>("th");
  useEffect(() => {
    const saved = localStorage.getItem("app_language") as Lang | null;
    if (saved === "th" || saved === "en") setLang(saved);
    const handler = (e: CustomEvent<{ lang: Lang }>) => setLang(e.detail.lang);
    window.addEventListener("language:change", handler as EventListener);
    return () => window.removeEventListener("language:change", handler as EventListener);
  }, []);

  const t = useMemo(() => {
    const tr = {
      th: {
        title: "ตั้งค่า Pipeline", charger: "ตู้ชาร์จ", station: "สถานี",
        hardware: "ฮาร์ดแวร์", topics: "MQTT Topics", collections: "Collections", serviceLife: "อายุการใช้งาน",
        dcContractorCount: "จำนวน DC Contactor", powerModuleCount: "จำนวน Power Module", dcFanCount: "จำนวน DC Fan",
        fanType: "ชนิดพัดลม", energyMeterType: "ชนิดมิเตอร์", powerModuleDefaults: "ค่าเริ่มต้น Power Module",
        meterCollection: "Meter Collection", endDate: "วันหมดอายุการใช้งาน",
        addPm: "เพิ่ม", pmKey: "คีย์ (เช่น pm1)", pmValue: "ค่า", remove: "ลบ",
        save: "บันทึก", saving: "กำลังบันทึก...", saved: "บันทึกสำเร็จ", loading: "กำลังโหลด...",
        cancel: "ยกเลิก", notFound: "ไม่พบตู้ชาร์จนี้", emptyTopicHint: "เว้นว่าง = null", noSn: "ไม่พบ SN ของตู้ชาร์จ",
      },
      en: {
        title: "Pipeline Config", charger: "Charger", station: "Station",
        hardware: "Hardware", topics: "MQTT Topics", collections: "Collections", serviceLife: "Service Life",
        dcContractorCount: "DC Contactor Count", powerModuleCount: "Power Module Count", dcFanCount: "DC Fan Count",
        fanType: "Fan Type", energyMeterType: "Energy Meter Type", powerModuleDefaults: "Power Module Defaults",
        meterCollection: "Meter Collection", endDate: "Service End Date",
        addPm: "Add", pmKey: "Key (e.g. pm1)", pmValue: "Value", remove: "Remove",
        save: "Save", saving: "Saving...", saved: "Saved successfully", loading: "Loading...",
        cancel: "Cancel", notFound: "Charger not found", emptyTopicHint: "Empty = null", noSn: "No charger SN provided",
      },
    };
    return tr[lang];
  }, [lang]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [chargerId, setChargerId] = useState<string>("");
  const [cfg, setCfg] = useState<PipelineConfig>(emptyConfig());
  const [pmRows, setPmRows] = useState<{ key: string; value: string }[]>([]);

  const hydrate = useCallback((charger: any) => {
    const base = emptyConfig();
    const pc = charger?.pipeline_config ?? {};
    const next: PipelineConfig = {
      hardware: { ...base.hardware, ...(pc.hardware ?? {}), powerModuleDefaults: { ...(pc.hardware?.powerModuleDefaults ?? {}) } },
      topics: { ...base.topics, ...(pc.topics ?? {}) },
      collections: { ...base.collections, ...(pc.collections ?? {}) },
      service_life: { ...base.service_life, ...(pc.service_life ?? {}) },
    };
    setCfg(next);
    setPmRows(Object.entries(next.hardware.powerModuleDefaults).map(([key, value]) => ({ key, value: String(value) })));
  }, []);

  // โหลดข้อมูลตู้เมื่อเปิด modal
  useEffect(() => {
    if (!open) return;
    setNotice(null);
    (async () => {
      try {
        setLoading(true);
        if (!sn) { setNotice({ type: "error", msg: t.noSn }); return; }
        const res = await apiFetch(`/all-stations/`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const json = await res.json();
        const stations: any[] = Array.isArray(json?.stations) ? json.stations : [];
        let found: any = null;
        for (const s of stations) {
          const c = (s.chargers || []).find((c: any) => c.SN === sn);
          if (c) { found = c; break; }
        }
        if (!found) { setNotice({ type: "error", msg: t.notFound }); return; }
        setChargerId(found.id || found.charger_id || "");
        hydrate(found);
      } catch (e: any) {
        console.error(e);
        setNotice({ type: "error", msg: e?.message || "Load error" });
      } finally { setLoading(false); }
    })();
  }, [open, sn, hydrate, t.noSn, t.notFound]);

  const setHw = <K extends keyof PipelineHardware>(key: K, value: PipelineHardware[K]) =>
    setCfg(c => ({ ...c, hardware: { ...c.hardware, [key]: value } }));
  const setTopic = (key: keyof PipelineTopics, value: string) =>
    setCfg(c => ({ ...c, topics: { ...c.topics, [key]: value } }));

  const fanTypeOptions = useMemo(() => Array.from(new Set(["FIXED", "VARIABLE", cfg.hardware.fanType].filter(Boolean))), [cfg.hardware.fanType]);
  const meterTypeOptions = useMemo(() => Array.from(new Set(["PILOT", "MODBUS", "NONE", cfg.hardware.energyMeterType].filter(Boolean))), [cfg.hardware.energyMeterType]);

  const addPmRow = () => setPmRows(rows => [...rows, { key: "", value: "0" }]);
  const removePmRow = (i: number) => setPmRows(rows => rows.filter((_, idx) => idx !== i));
  const setPmRow = (i: number, field: "key" | "value", val: string) =>
    setPmRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const handleSave = async () => {
    if (!chargerId) return;
    try {
      setSaving(true);

      // เช็ค PM key ซ้ำก่อนทุกอย่าง
      const seen = new Set<string>();
      for (const r of pmRows) {
        const k = r.key.trim();
        if (!k) continue;
        if (seen.has(k)) {
          const msg = lang === "th" ? `คีย์ซ้ำ: ${k}` : `Duplicate key: ${k}`;
          setNotice({ type: "error", msg });
          setSaving(false);
          return;
        }
        seen.add(k);
      }

      const powerModuleDefaults: PowerModuleDefaults = {};
      pmRows.forEach(r => {
        const k = r.key.trim();
        if (!k) return;
        const n = Number(r.value);
        powerModuleDefaults[k] = Number.isFinite(n) ? n : 0;
      });
      const topics: any = {};
      TOPIC_FIELDS.forEach(({ key }) => { topics[key] = emptyToNull(String(cfg.topics[key] ?? "")); });

      const payload = {
        pipeline_config: {
          hardware: {
            dcContractorCount: Number(cfg.hardware.dcContractorCount) || 0,
            powerModuleCount: Number(cfg.hardware.powerModuleCount) || 0,
            dcFanCount: Number(cfg.hardware.dcFanCount) || 0,
            fanType: cfg.hardware.fanType,
            energyMeterType: cfg.hardware.energyMeterType,
            powerModuleDefaults,
          },
          topics,
          collections: { meter: emptyToNull(String(cfg.collections.meter ?? "")) },
          service_life: { endDate: cfg.service_life.endDate },
        },
      };

      const res = await apiFetch(`/update_charger/${chargerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.detail || `Update failed: ${res.status}`);
      }
      setNotice({ type: "success", msg: t.saved });
      onSaved?.(true, t.saved);                       // ← เพิ่ม
      setTimeout(() => { setNotice(null); onClose(); }, 1200);
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || "Update failed";
      setNotice({ type: "error", msg });
      onSaved?.(false, msg);                           // ← เพิ่ม
      setTimeout(() => setNotice(null), 3500);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} handler={onClose} size="lg"
      dismiss={{ outsidePress: !saving, escapeKey: !saving }}
      className="tw-flex tw-flex-col tw-max-h-[95vh] sm:tw-max-h-[90vh] tw-overflow-hidden !tw-rounded-xl sm:!tw-rounded-2xl !tw-m-2 sm:!tw-m-4">
      <DialogHeader className="tw-sticky tw-top-0 tw-z-10 tw-bg-gradient-to-r tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-4 sm:tw-px-6 tw-py-3.5 sm:tw-py-5 tw-border-0 tw-shadow-xl tw-shrink-0">
        <div className="tw-flex tw-items-center tw-justify-between tw-w-full">
          <div className="tw-flex tw-items-center tw-gap-2.5 sm:tw-gap-3 tw-min-w-0">
            <span className="tw-inline-flex tw-items-center tw-justify-center tw-h-8 tw-w-8 sm:tw-h-9 sm:tw-w-9 tw-rounded-xl tw-bg-indigo-500/20 tw-ring-1 tw-ring-indigo-400/30 tw-shrink-0">
              <Cog6ToothIcon className="tw-h-4 tw-w-4 sm:tw-h-5 sm:tw-w-5 tw-text-indigo-300" />
            </span>
            <div className="tw-min-w-0">
              <Typography variant="h5" className="!tw-text-white !tw-font-bold !tw-tracking-tight !tw-leading-tight !tw-text-base sm:!tw-text-lg">{t.title}</Typography>
              <Typography variant="small" className="!tw-text-white/50 !tw-text-xs tw-truncate">
                {chargeBoxID || sn || "-"}{stationId ? ` • ${t.station}: ${stationId}` : ""}
              </Typography>
            </div>
          </div>
          <button type="button" onClick={onClose} className="tw-p-1.5 sm:tw-p-2 tw-rounded-xl tw-bg-white/10 hover:tw-bg-white/20 tw-text-white/60 hover:tw-text-white tw-transition-all tw-duration-200 tw-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="tw-h-5 tw-w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>
      </DialogHeader>

      <DialogBody className="tw-flex-1 tw-min-h-0 tw-overflow-y-auto tw-space-y-3 sm:tw-space-y-4 tw-px-3 sm:tw-px-6 tw-py-3 sm:tw-py-5 tw-bg-gray-50/60">
        {notice && (<Alert color={notice.type === "success" ? "green" : "red"} onClose={() => setNotice(null)}>{notice.msg}</Alert>)}

        {loading ? (
          <div className="tw-flex tw-items-center tw-justify-center tw-py-20 tw-text-blue-gray-400 tw-gap-2"><Spinner />{t.loading}</div>
        ) : (
          <>
            {/* Hardware */}
            <SectionCard icon={<CpuChipIcon className="tw-h-4 tw-w-4" />} title={t.hardware}>
              <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-3">
                <Input label={t.dcContractorCount} type="number" min={0} value={cfg.hardware.dcContractorCount}
                  onChange={(e) => setHw("dcContractorCount", parseInt(e.target.value) || 0)} crossOrigin={undefined} />
                <Input label={t.powerModuleCount} type="number" min={0} value={cfg.hardware.powerModuleCount}
                  onChange={(e) => setHw("powerModuleCount", parseInt(e.target.value) || 0)} crossOrigin={undefined} />
                <Input label={t.dcFanCount} type="number" min={0} value={cfg.hardware.dcFanCount}
                  onChange={(e) => setHw("dcFanCount", parseInt(e.target.value) || 0)} crossOrigin={undefined} />
                <Select label={t.fanType} value={cfg.hardware.fanType} onChange={(v) => setHw("fanType", v ?? "FIXED")}>
                  {fanTypeOptions.map(o => <Option key={o} value={o}>{o}</Option>)}
                </Select>
                <Select label={t.energyMeterType} value={cfg.hardware.energyMeterType} onChange={(v) => setHw("energyMeterType", v ?? "PILOT")}>
                  {meterTypeOptions.map(o => <Option key={o} value={o}>{o}</Option>)}
                </Select>
              </div>
              <div className="tw-mt-4 tw-pt-4 tw-border-t tw-border-gray-100">
                <div className="tw-flex tw-items-center tw-justify-between tw-mb-2.5">
                  <p className="tw-text-[10px] sm:tw-text-[11px] tw-font-bold tw-text-blue-gray-500 tw-uppercase tw-tracking-widest">{t.powerModuleDefaults}</p>
                  <button type="button" onClick={addPmRow} className="tw-inline-flex tw-items-center tw-gap-1 tw-px-2.5 tw-py-1 tw-rounded-lg tw-bg-gray-900 hover:tw-bg-black tw-text-white tw-text-[11px] tw-font-semibold tw-transition-colors">
                    <PlusIcon className="tw-h-3 tw-w-3" />{t.addPm}
                  </button>
                </div>
                {pmRows.length === 0 ? (
                  <p className="tw-text-[11px] tw-text-blue-gray-300 tw-italic">—</p>
                ) : (
                  <div className="tw-space-y-2">
                    {pmRows.map((row, i) => (
                      <div key={i} className="tw-grid tw-grid-cols-[minmax(0,1fr)_6rem_2.25rem] tw-items-center tw-gap-2">
                        <div className="tw-min-w-0">
                          <Input label={t.pmKey} value={row.key}
                            onChange={(e) => setPmRow(i, "key", e.target.value)}
                            crossOrigin={undefined}
                            containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                        <div className="tw-min-w-0">
                          <Input label={t.pmValue} type="number" value={row.value}
                            onChange={(e) => setPmRow(i, "value", e.target.value)}
                            crossOrigin={undefined}
                            containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                        <Tooltip content={t.remove}>
                          <button type="button" onClick={() => removePmRow(i)} className="tw-flex tw-items-center tw-justify-center tw-w-9 tw-h-9 tw-rounded-lg tw-text-red-400 hover:tw-text-red-600 hover:tw-bg-red-50 tw-transition-colors">
                            <TrashIcon className="tw-h-4 tw-w-4" />
                          </button>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Topics */}
            <SectionCard icon={<SignalIcon className="tw-h-4 tw-w-4" />} title={t.topics}>
              <p className="tw-text-[11px] tw-text-blue-gray-400 tw-mb-3">{t.emptyTopicHint}</p>
              <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-3">
                {TOPIC_FIELDS.map(({ key, label }) => (
                  <Input key={key} label={label} value={cfg.topics[key] ?? ""} onChange={(e) => setTopic(key, e.target.value)} crossOrigin={undefined} />
                ))}
              </div>
            </SectionCard>

            {/* Collections */}
            <SectionCard icon={<CircleStackIcon className="tw-h-4 tw-w-4" />} title={t.collections}>
              <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-3">
                <Input label={t.meterCollection} value={cfg.collections.meter ?? ""}
                  onChange={(e) => setCfg(c => ({ ...c, collections: { meter: e.target.value } }))} crossOrigin={undefined} />
              </div>
            </SectionCard>

            {/* Service life */}
            <SectionCard icon={<ClockIcon className="tw-h-4 tw-w-4" />} title={t.serviceLife}>
              <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-3">
                <Input label={t.endDate} type="datetime-local" value={toLocalInput(cfg.service_life.endDate)}
                  onChange={(e) => setCfg(c => ({ ...c, service_life: { endDate: fromLocalInput(e.target.value) } }))} crossOrigin={undefined} />
              </div>
            </SectionCard>
          </>
        )}
      </DialogBody>

      <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-3 sm:tw-px-6 tw-py-3 sm:tw-py-4 tw-border-t tw-border-gray-200/80 tw-shrink-0">
        <div className="tw-flex tw-w-full tw-justify-end tw-gap-2 sm:tw-gap-2.5">
          <Button variant="outlined" type="button" onClick={onClose}
            className="tw-flex-1 sm:tw-flex-none tw-rounded-xl tw-border-gray-300 tw-text-gray-600 hover:tw-bg-gray-50 tw-normal-case tw-font-semibold tw-text-xs sm:tw-text-sm tw-px-4 sm:tw-px-5 tw-py-2.5 sm:tw-py-2">{t.cancel}</Button>
          <Button type="button" onClick={handleSave} disabled={saving || loading || !chargerId}
            className="tw-flex-1 sm:tw-flex-none tw-rounded-xl tw-bg-gray-900 hover:tw-bg-black tw-shadow-lg tw-shadow-gray-900/20 tw-normal-case tw-font-semibold tw-text-xs sm:tw-text-sm tw-px-4 sm:tw-px-6 tw-py-2.5 sm:tw-py-2 disabled:tw-opacity-50">
            {saving ? <span className="tw-flex tw-items-center tw-justify-center tw-gap-2"><Spinner />{t.saving}</span> : t.save}
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  );
}