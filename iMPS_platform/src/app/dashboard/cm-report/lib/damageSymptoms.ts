export const DAMAGE_SYMPTOM_OPTIONS = [
    { value: "charger_issue", th: "เครื่องชาร์จมีปัญหา", en: "Charger issue" },
    { value: "electrical_issue", th: "ระบบไฟฟ้ามีปัญหา", en: "Electrical system issue" },
    { value: "station_sign_lighting_out", th: "ไฟสถานี / ไฟป้ายดับ", en: "Station / sign lighting outage" },
    { value: "structure_floor_damage", th: "โครงสร้าง / สีพื้นชำรุด", en: "Structure / floor paint damage" },
    { value: "other", th: "อื่น ๆ (โปรดระบุ)", en: "Other (please specify)" },
] as const;

export const damageSymptomLabel = (value: string, lang: "th" | "en") =>
    DAMAGE_SYMPTOM_OPTIONS.find(option => option.value === value)?.[lang] ?? value;
