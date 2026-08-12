"""
Agentic AI — Module knowledge registry
=======================================

ความรู้เชิงโดเมนของโมดูล AI ทั้ง 7 ตัว ที่ "ground" ให้ LLM agent ใช้วิเคราะห์
โดยไม่ต้องเดา/แต่งเอง ทุกค่าดึงมาจาก logic จริงของ backend_worker_v11.py
(สูตร health, threshold, field ที่อ่าน) และมาตรฐานที่โมดูลอ้างอิง

ใช้ที่: services/agent_tools.py (tool get_module_metadata) และ routers/ai_agent.py
(seed system prompt). โครงสร้างนี้เป็นแหล่งความจริงเดียว — แก้ที่นี่ที่เดียว

หมายเหตุ collection key:
  - input DB ของ M2..M7 ตั้งชื่อ collection ตาม "SN"
  - input DB ของ M1 ตั้งชื่อ collection ตาม "station_name" (บางที fallback เป็น SN)
  - eds_ai_results ตั้งชื่อ collection ตาม "SN" เสมอ (1 doc ต่อโมดูล)
"""
from __future__ import annotations

# key = "m1".."m7"  (ตรงกับ field `module` ใน eds_ai_results และ MODULES ฝั่ง frontend)
MODULE_KNOWLEDGE: dict[str, dict] = {
    "m1": {
        "num": 1,
        "name_en": "MDB Dust Filter Clogging",
        "name_th": "การตันของแผ่นกรองฝุ่นตู้สวิตช์ประธาน (MDB)",
        "weight": 0.12,
        "input_db": "module1MdbDustPrediction",
        "collection_key": "station_name",   # fallback → SN
        "measures": "ระดับการอุดตันของแผ่นกรองฝุ่นในตู้ MDB จากอุณหภูมิ/ความชื้น/อายุแผ่นกรอง",
        "input_fields": [
            "MDB_ambient_temp", "pi5_temp", "MDB_humidity", "MDB_pressure",
            "MDB_status", "dust_filter_charging", "meter1", "meter2",
        ],
        "health_formula": "health = (1 - ensemble_risk) * 100 ; risk รวมถ่วงน้ำหนัก: อายุแผ่นกรอง 35%, อุณหภูมิ MDB 15%, temp_diff 15%, ความชื้น 12%, pi5 10%, ความดัน 8%, สถานะ 5%",
        "thresholds": {
            "dust_filter_charging_days": "0 วัน = ความเสี่ยง 0 ; >=120 วัน = ความเสี่ยง 1.0 (ควรเปลี่ยน)",
            "risk_bands": "<0.25 สะอาด, <0.50 ปานกลาง, <0.75 เสื่อม, >=0.75 ตัน",
        },
        "typical_root_causes": [
            "แผ่นกรองเลยรอบเปลี่ยน (dust_filter_charging สูง)",
            "อุณหภูมิแวดล้อม MDB สูงเร่งการสะสมฝุ่น",
            "ความชื้นสูงทำให้ฝุ่นเกาะแน่น",
        ],
        "recommended_actions": [
            "ตรวจ/เปลี่ยนแผ่นกรองฝุ่นตู้ MDB",
            "ตรวจระบบระบายอากาศ/แอร์ในตู้",
        ],
        "standards": [],
    },
    "m2": {
        "num": 2,
        "name_en": "Charger Air Filter Clogging",
        "name_th": "การตันของแผ่นกรองอากาศเครื่องอัดประจุ",
        "weight": 0.12,
        "input_db": "module2ChargerDustPrediction",
        "collection_key": "SN",
        "measures": "การตันของแผ่นกรองอากาศ อนุมานจากอุณหภูมิ power module (ระบายความร้อนแย่ลง)",
        "input_fields": [
            "power_module_temp1", "power_module_temp2", "power_module_temp3",
            "power_module_temp4", "power_module_temp5",
            "fan_RPM1", "fan_RPM2", "ambient_temp", "edgebox_temp", "pi5_temp",
        ],
        "health_formula": "health = 100 - (max(power_module_temp1..5) - 35) * 2.5  (35°C→100%, 55°C→50%, 75°C→0%)",
        "thresholds": {
            "power_module_temp": "35°C ปกติ, 55°C เตือน, >=75°C วิกฤต",
        },
        "typical_root_causes": [
            "แผ่นกรองอากาศตันทำให้ power module ระบายความร้อนไม่ทัน",
            "พัดลมระบายความร้อนเสีย/รอบตก (fan_RPM ต่ำ)",
        ],
        "recommended_actions": [
            "ทำความสะอาด/เปลี่ยนแผ่นกรองอากาศเครื่องชาร์จ",
            "ตรวจพัดลมระบายความร้อนทุกตัว",
        ],
        "standards": [],
    },
    "m3": {
        "num": 3,
        "name_en": "Charger Offline Detection",
        "name_th": "การออฟไลน์ของเครื่องอัดประจุ",
        "weight": 0.16,
        "input_db": "module3ChargerOfflineAnalysis",
        "collection_key": "SN",
        "measures": "อุปกรณ์ในตู้ออนไลน์กี่ตัว + จำแนกสาเหตุการออฟไลน์",
        "input_fields": [
            "edgebox_status", "router_status", "PLC1_status", "PLC2_status",
            "MDB_status", "energy_meter_status",
            "VL1N_MDB", "VL2N_MDB", "VL3N_MDB", "edgebox_temp", "RSSI",
        ],
        "health_formula": "health = online_count / 6 * 100  (นับจาก edgebox, router, PLC1, PLC2, MDB, energy_meter)",
        "thresholds": {
            "status": "ทุกตัวออนไลน์ = ok ; ขาด 1 = warn ; ขาด >=2 = crit",
        },
        "typical_root_causes": [
            "NETWORK_FAILURE — router/เครือข่ายล่ม",
            "POWER_OUTAGE — ไฟดับ",
            "PLC_FAULT — PLC ขัดข้อง",
            "EDGEBOX_CRASH — edgebox ค้าง",
            "SCHEDULED_MAINTENANCE — อยู่ระหว่างบำรุงรักษา",
        ],
        "recommended_actions": [
            "ตรวจ router/เครือข่ายและสัญญาณ (RSSI)",
            "ตรวจแหล่งจ่ายไฟ MDB (VL1N/VL2N/VL3N)",
            "รีสตาร์ต edgebox / PLC ที่ค้าง",
        ],
        "standards": [],
    },
    "m4": {
        "num": 4,
        "name_en": "Abnormal Power Delivery",
        "name_th": "การจ่ายไฟฟ้าผิดปกติของเครื่องอัดประจุ",
        "weight": 0.20,
        "input_db": "module4AbnormalPowerPrediction",
        "collection_key": "SN",
        "measures": "ตรวจ 22 เงื่อนไข (C01–C22) แยกเป็น 7 กลุ่ม: voltage/current/power/soc/thermal/communication/session",
        "input_fields": [
            "target_voltage1", "present_voltage1", "target_current1", "present_current1",
            "target_voltage2", "present_voltage2", "target_current2", "present_current2",
            "charger_temp", "power_module_temp1", "power_module_temp5",
            "charger_gun_temp_plus1", "SOC",
        ],
        "health_formula": "health = 100 - anomaly_flags * 15  (แต่ละ flag ที่ติดลด 15 คะแนน)",
        "thresholds": {
            "anomaly_groups": "anomaly_voltage 0.5, anomaly_current 0.4, anomaly_power 0.5, anomaly_soc 0.5, anomaly_thermal 0.3, anomaly_communication 0.3, anomaly_session 0.4",
        },
        "typical_root_causes": [
            "แรงดัน/กระแสจริงเบี่ยงจากค่าเป้าหมาย (over/under voltage, overcurrent)",
            "ความร้อนสูงจน derate กำลัง",
            "การสื่อสาร EV↔charger หลุด",
            "session ผิดขั้นตอน",
        ],
        "recommended_actions": [
            "เทียบ present vs target ของแรงดัน/กระแสทั้ง 2 หัว",
            "ตรวจอุณหภูมิ power module และหัวชาร์จ",
            "ตรวจสาย CP/สื่อสารและคุณภาพการจับคู่ session",
        ],
        "standards": ["ISO 15118-2", "IEC 61851-23", "IEC 62196-3", "IEC 61851-1", "DIN 70121"],
    },
    "m5": {
        "num": 5,
        "name_en": "Network Problem Prediction",
        "name_th": "ปัญหาเครือข่ายอินเทอร์เน็ต",
        "weight": 0.12,
        "input_db": "module5NetworkProblemPrediction",
        "collection_key": "SN",
        "measures": "สถานะเครือข่ายของอุปกรณ์ในตู้ (router, PLC, edgebox, pi5, energy meter) + ระดับความรุนแรง",
        "input_fields": [
            "router_status", "PLC_network_status1", "PLC_network_status2",
            "edgebox_network_status", "pi5_network_status",
            "energy_meter_network_status1", "severity", "anomaly_score",
        ],
        "health_formula": "health = (1 - severity) * 100",
        "thresholds": {
            "severity": "0 = ปกติ, ยิ่งเข้าใกล้ 1 ยิ่งวิกฤต",
        },
        "typical_root_causes": [
            "ROUTER_DOWN — เราเตอร์ล่ม",
            "INTERNET_DOWN — WAN หลุด",
            "PLC_OFFLINE — PLC หลุดจากเครือข่าย",
            "PARTIAL_OUTAGE — บางอุปกรณ์หลุด",
        ],
        "recommended_actions": [
            "ตรวจ WAN/LAN และเราเตอร์",
            "ตรวจสายและสวิตช์เครือข่ายในตู้",
        ],
        "standards": [],
    },
    "m6": {
        "num": 6,
        "name_en": "Remaining Useful Life (RUL)",
        "name_th": "อายุการใช้งานคงเหลือของอุปกรณ์ภายในเครื่อง",
        "weight": 0.18,
        "input_db": "module6DcChargerRulPrediction",
        "collection_key": "SN",
        "measures": "อายุคงเหลือรายชิ้นส่วน ด้วยแบบจำลอง Arrhenius (อุณหภูมิเร่งการเสื่อม)",
        "input_fields": [
            "power_module_temp1", "power_module_temp5", "charger_temp",
            "edgebox_temp", "fan_RPM1",
        ],
        "health_formula": "health = ค่าเฉลี่ย RUL% ของชิ้นส่วน ; ชิ้นที่อ่อนสุด = weakest_component",
        "thresholds": {
            "rated_life_years": "power_module 10, charger_body 15, cable_connector 5, cooling_fan 7, plc_board 12",
        },
        "typical_root_causes": [
            "ชิ้นส่วนใกล้หมดอายุ (RUL% ต่ำ)",
            "อุณหภูมิสูงต่อเนื่องเร่งการเสื่อมของ power module/พัดลม",
        ],
        "recommended_actions": [
            "วางแผนเปลี่ยนชิ้นส่วนที่อ่อนสุด (weakest_component) ล่วงหน้า",
            "ลดภาระความร้อน (ทำความสะอาดระบายอากาศ) เพื่อยืดอายุ",
        ],
        "standards": [],
    },
    "m7": {
        "num": 7,
        "name_en": "EV-PLCC Communication Fault",
        "name_th": "ความผิดปกติการสื่อสาร EV↔เครื่องอัดประจุ (PLCC)",
        "weight": 0.10,
        "input_db": "module7ChargerPowerIssue",
        "collection_key": "SN",
        "measures": "สถานะ state machine ของ Control Pilot (ICP 0–10) และ V2G session (USLink 0–16)",
        "input_fields": [
            "icp_state", "uslink_state", "AC_magnetic_contractor1",
            "DC_contractor1", "DC_contractor2", "DC_contractor3",
            "present_voltage1", "present_current1", "power_module_temp1", "SOC",
        ],
        "health_formula": "health = 100 - anomaly_count * 10",
        "thresholds": {
            "icp_state": "9 = E (Fault, CP=0V), 10 = Error — ถือเป็นความผิดปกติ",
            "uslink_state": "ค้างที่ขั้นตอนกลาง (เช่น CableCheck/PreCharge) นานผิดปกติ = session ติด",
        },
        "typical_root_causes": [
            "สัญญาณ Control Pilot ผิดปกติ (ICP อยู่สถานะ fault/error)",
            "session V2G ติดค้างไม่เดินหน้า",
            "คอนแทกเตอร์ AC/DC ไม่ทำงานตามสถานะ",
        ],
        "recommended_actions": [
            "ตรวจสาย CP และหัวชาร์จ/ปืนชาร์จ",
            "ตรวจคอนแทกเตอร์ AC/DC",
            "ตรวจลำดับ session ตาม ISO 15118-2",
        ],
        "standards": ["IEC 61851-1 (Control Pilot)", "ISO 15118-2 (V2G session)", "DIN SPEC 70121"],
    },
}

# น้ำหนักรวมของ system health (ตรงกับ backend_worker_v11.py: m1..m7 = 12/12/16/20/12/18/10)
MODULE_WEIGHTS = {k: v["weight"] for k, v in MODULE_KNOWLEDGE.items()}

VALID_MODULES = tuple(MODULE_KNOWLEDGE.keys())


def normalize_module_key(module: str) -> str:
    """รับได้ทั้ง 'm3', '3', 'module3' → คืน 'm3' ; ไม่ถูกต้อง → ValueError"""
    if not module:
        raise ValueError("module is required")
    s = str(module).strip().lower()
    if s in MODULE_KNOWLEDGE:
        return s
    s = s.replace("module", "").replace("m", "").strip()
    key = f"m{s}"
    if key in MODULE_KNOWLEDGE:
        return key
    raise ValueError(f"unknown module: {module!r}")


def get_knowledge(module: str) -> dict:
    return MODULE_KNOWLEDGE[normalize_module_key(module)]
