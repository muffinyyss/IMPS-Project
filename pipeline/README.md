# 🔌 EV Charger Pipeline

ระบบ Pipeline สำหรับรับข้อมูลจากตู้ชาร์จ EV ผ่าน MQTT, คำนวณค่าต่างๆ และบันทึกลง MongoDB

## 📋 Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EV CHARGER PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [ตู้ชาร์จ 1]    [ตู้ชาร์จ 2]    ...    [ตู้ชาร์จ 200]                     │
│        │              │                      │                              │
│        └──────────────┴──────────────────────┘                              │
│                        │                                                    │
│                        ▼                                                    │
│                   MQTT Broker                                               │
│                        │                                                    │
│                        ▼                                                    │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                    Python Pipeline (1 Process)                   │      │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │      │
│   │  │ Station  │  │ Station  │  │ Station  │  │ Station  │  ...   │      │
│   │  │ Handler  │  │ Handler  │  │ Handler  │  │ Handler  │        │      │
│   │  │    1     │  │    2     │  │    3     │  │   200    │        │      │
│   │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │      │
│   │                        │                                        │      │
│   │                        ▼                                        │      │
│   │              Shared Calculations                                │      │
│   │         (Counters, Timers, ServiceLife)                        │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                        │                                                    │
│                        ▼                                                    │
│                    MongoDB                                                  │
│              (14 Databases)                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🏗️ Project Structure

```
pipeline/
├── config/
│   ├── settings.py              # Global settings (MQTT, MongoDB)
│   └── stations/                # Per-station configs (JSON)
│       ├── klongluang3.json
│       ├── ratchaphruek.json
│       └── ...
│
├── core/                        # Core components (shared)
│   ├── mqtt_client.py          # MQTT subscriber
│   ├── mongodb_client.py       # MongoDB connections
│   └── state_manager.py        # State management per station
│
├── calculations/                # Shared calculation logic
│   ├── counters.py             # Edge detection (DC, AC, Motor)
│   ├── timers.py               # FUSE, DC Fan, Power Module
│   └── service_life.py         # Service life tracking
│
├── processors/                  # Data processors
│   ├── plc_processor.py        # Process PLC topic → multiple DBs
│   └── mdb_processor.py        # Process MDB topic → MDB, Module1, Module2
│
├── models/
│   └── schemas.py              # MongoDB document schemas
│
├── utils/
│   ├── time_utils.py           # Time parsing/formatting
│   └── hash_utils.py           # Deduplication hashing
│
├── main.py                     # Entry point
├── requirements.txt
└── README.md
```

## ⚙️ Station Config (JSON)

แต่ละสถานีมี config แยก:

```json
{
    "stationId": "Klongluang3",
    "serialNumber": "F1500624011",
    
    "hardware": {
        "dcContractorCount": 6,
        "powerModuleCount": 5,
        "dcFanCount": 8,
        "fanType": "FIXED",
        "energyMeterType": "PILOT"
    },
    
    "topics": {
        "plc": "OCPP/Klongluang3/PLC",
        "pi5Heartbeat": "OCPP/Klongluang3/heartbeatPI5",
        "ebError": "OCPP/PT100_Klongluang3/error",
        "ebTemp": "OCPP/PT100_Klongluang3/edgeboxTemp",
        "ebHeartbeat": "OCPP/PT100_Klongluang3/heartbeat",
        "ebCountDevice": "OCPP/Klongluang3/totaltime",
        "router": "Luang3",
        "mdbRaw": "MDB_khlongluang3",
        "fanRpm": null,
        "cbm": "CBM_Klongluang3",
        "module2Agg": "module2_Klongluang3",
        "insulation": "insulation_Klongluang3"
    },
    
    "serviceLife": {
        "commitDate": "2023-12-28",
        "endDate": "2025-10-02T16:00:00"
    }
}
```

## 🚀 Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Add station configs
cp config/stations/klongluang3.json config/stations/mystation.json
# Edit mystation.json

# 3. Run pipeline
python main.py

# Run with specific stations only
python main.py --stations klongluang3,ratchaphruek

# Run with debug logging
python main.py --debug
```

## 📊 Data Flow

```
MQTT Topics              Processors              MongoDB Collections
────────────────────────────────────────────────────────────────────

OCPP/{name}/PLC ──────► PLCProcessor ─────────► PLC
                              │                 settingParameter
                              │                 utilizationFactor
                              │                 monitorCBM
                              │                 module3-7
                              │
MDB_{name} ───────────► MDBProcessor ─────────► MDB
                              │                 module1MdbDustPrediction
                              │                 module2ChargerDustPrediction
                              │
{router} ─────────────► RouterProcessor ──────► (state only)
                              │
ebError ──────────────► StatusProcessor ──────► (energy meter status)
```

## 🔢 Calculations

### Counters (Edge Detection 0→1)
- DC Power Contractor 1-6
- AC Power Contractor 1-2  
- Motor Starter 1-2

### Timers
- FUSE 1-2 (active when icp=7 && usl=13)
- DC Fan 1-8 (active when charging, +20min bonus on stop)
- Power Module 1-5 (active based on DC contractor state)

### Service Life
- initialSeconds = endDate - commitDate
- อุปกรณ์ส่วนใหญ่: base + elapsed time
- อุปกรณ์เฉพาะ: base + active time only

## 📝 Version History

- **v1.0** - Initial Python pipeline (migrated from Node-RED v13)
