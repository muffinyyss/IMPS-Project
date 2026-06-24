# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**iMPS** (Intelligent Maintenance and Predictive System) is a monitoring and maintenance platform for a fleet of EV charging stations in Thailand. It is composed of three distinct systems:

1. **`iMPS_platform/`** — Full-stack web application
   - **Frontend**: Next.js 14 (App Router) + TypeScript + Material Tailwind + TailwindCSS, runs on port `3001`
   - **Backend**: FastAPI (Python) + Motor (async MongoDB), runs on port `8000`
2. **`pipeline/`** — Python data ingestion pipeline (MQTT → MongoDB)

---

## Commands

### Frontend (`iMPS_platform/`)

```bash
npm install --legacy-peer-deps   # react-calendar@4.8.0 conflicts with @types/react@19 — flag required
npm run dev          # Dev server on http://localhost:3001
npm run build        # Production build (TypeScript errors are ignored — see next.config.js)
npm run lint         # ESLint
npm run build:pdf-css   # Compile Tailwind CSS for PDF templates
npm run watch:pdf-css   # Watch mode for PDF CSS
```

### Backend (`iMPS_platform/backend/`)

```bash
pip install -r requirements.txt
cd iMPS_platform/backend
uvicorn main:app --reload --port 8000
```

API docs are auto-generated at `http://localhost:8000/docs`.

### Pipeline (`pipeline/`)

```bash
pip install -r requirements.txt
cd pipeline
python main.py                                  # Run all stations
python main.py --stations klongluang3,ratchaphruek  # Specific stations only
python main.py --debug                          # With debug logging
```

---

## Architecture

### Frontend Architecture

The app uses **Next.js App Router** with a shell layout in `src/app/layout.tsx` → `src/app/content.tsx`. The `InnerContent` component renders `Sidenav` + `DashboardNavbar` for all dashboard routes, and a plain layout for `/auth/*` and `/pages/*`.

**Key directories:**
- `src/app/dashboard/` — Feature pages (stations, cbm, pm-report, cm-report, mdb, ai, device, etc.)
- `src/app/auth/` — Login/signup/reset flows
- `src/components/` — Shared UI components
- `src/widgets/layout/` — Sidenav, Navbar, Configurator
- `src/context/` — `MaterialTailwindContext` — global UI state (sidenav open/color, navbar) via `useReducer`
- `src/routes.jsx` — Central route registry; each route carries `allow: [roles]` for sidebar visibility filtering
- `src/services/` — API client (`index.tsx`), charging API (`charging-api.ts`), socket (`socket-service.ts`)
- `src/data/` — Static/mock data fed to charts and tables

**Role-based access**: Routes in `src/routes.jsx` declare `allow: ["admin", "owner", "technician"]` or `allow: ["*"]`. The sidenav filters visible items per the JWT role returned from the backend.

**State management**: Zustand for feature-level state; `MaterialTailwindContext` for layout UI state; `react-hook-form` + `zod` for forms.

**Fonts**: Thai-first — Kanit (thai+latin), Plus Jakarta Sans, JetBrains Mono. CSS variables: `--font-kanit`, `--font-jakarta`, `--font-mono`.

**Build note**: `next.config.js` sets `typescript.ignoreBuildErrors: true` and applies CSS class name mangling in production builds.

### Backend Architecture

FastAPI app defined in `backend/main.py`. All configuration (DB connections, JWT config, MQTT client, helpers) lives in `backend/config.py`.

**Authentication**: JWT stored in an HTTP-only cookie (`access_token`). Auth logic is in `backend/deps.py` → `get_current_user()` → returns `UserClaims`. Roles: `admin`, `owner`, `technician`.

**Router structure** (`backend/routers/`):
| Router | Purpose |
|---|---|
| `users.py` | User CRUD and auth |
| `stations.py` | Station and charger CRUD |
| `device.py` | Per-charger device data |
| `cbm.py` | Condition-based monitoring |
| `mdb.py` | MDB (meter data bus) readings |
| `setting.py` | Station settings |
| `ai.py` | AI module outputs (modules 1–7) + EDS health |
| `cmreport.py` | Corrective maintenance reports |
| `pmreport_*.py` | Preventive maintenance reports per asset type |
| `testreport_dc/ac.py` | DC/AC test reports |
| `notifications.py` | Email alert rules and fault watchers |
| `pm_all_stations.py` | Aggregated PM across all stations |
| `ocpp/` | OCPP websocket bridge (charging protocol) |

**Background tasks** started on startup in `main.py`:
- `email_watcher` — polls `FaultStatus` DB every 30 s, sends threshold-based email alerts
- `auto_cm_watcher` — watches for events that auto-generate CM records

**MongoDB databases** (all on `203.154.130.132:27017`, auth `imps_platform:eds_imps`):
- `iMPS` — core: `stations`, `charger`, `users`
- `PLC`, `settingParameter`, `utilizationFactor`, `FaultStatus`, `monitorCBM`
- `MDB`, `MDB_realtime`, `MDB_history`
- `edgeboxStatus`, `pi5Status`, `routerStatus`
- `module1MdbDustPrediction` … `module7ChargerPowerIssue` (AI input DBs)
- `OutputModule1` … `OutputModule7` (AI output DBs)
- `PMReport`, `CMReport`, `DCTestReport`, `ACTestReport` (and URL variants)

**PDF generation**: WeasyPrint-based, CSS compiled via `npm run build:pdf-css`. Templates live in `backend/pdf/templates/`.

### Pipeline Architecture

Single-process Python app. Entry point: `pipeline/main.py`. Station configs are loaded at startup from `iMPS.charger` MongoDB collection (any document with a `pipeline_config` field is loaded as a `StationConfig`).

**Flow**: MQTT broker → per-station `StationHandler` → shared calculations (counters, timers, service life) → MongoDB writes.

**Two topic types handled:**
- `PLC` topics → `plc_processor.py` → writes to PLC, settingParameter, utilizationFactor, monitorCBM, module3–7
- `MDB` topics → `mdb_processor.py` → writes to MDB, module1, module2

**State management**: `core/state_manager.py` holds per-station in-memory state for edge detection, timers, and service life counters. State is not persisted across restarts.

**Calculations:**
- `calculations/counters.py` — DC/AC contractor and motor starter edge detection (0→1 transitions)
- `calculations/timers.py` — FUSE timers (active when `icp=7 && usl=13`), DC fan timers (with 20 min cooldown), power module timers
- `calculations/service_life.py` — tracks remaining service life as `initialSeconds - elapsed`

**Collection naming convention**: Most collections are keyed by serial number (`SN`); MDB and module1 collections are keyed by `station_id`.

---

## Environment

Frontend `.env` (in `iMPS_platform/`):
```
NEXT_PUBLIC_API_BASE=http://localhost:8000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Backend uses `os.getenv()` for `MQTT_BROKER`, `MQTT_PORT`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`. Defaults are hardcoded in `config.py` as fallbacks.

Pipeline MongoDB URI is set in `pipeline/config/settings.py` (`MongoDBConfig.uri`). Switch between local and remote by editing that field directly.
