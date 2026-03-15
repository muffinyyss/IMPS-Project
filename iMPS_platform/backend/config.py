from zoneinfo import ZoneInfo
from fastapi import HTTPException
from pymongo import MongoClient
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta, timezone
from bson.objectid import ObjectId
from bson.decimal128 import Decimal128
from jose import jwt
import json, os, re
import paho.mqtt.client as mqtt

BROKER_HOST = os.getenv("MQTT_BROKER", "203.154.130.132")
BROKER_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "imps/setting")

mqtt_client = mqtt.Client()
try:
    mqtt_client.connect(BROKER_HOST, BROKER_PORT, 60)
    mqtt_client.loop_start()
except Exception:
    pass

# ─── JWT / Auth ──────────────────────────────────────────────
SECRET_KEY = "supersecret"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES_TECHNICIAN = 1440
ACCESS_TOKEN_EXPIRE_MINUTES_DEFAULT = 1440
SESSION_IDLE_MINUTES_TECHNICIAN = None
SESSION_IDLE_MINUTES_DEFAULT = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
th_tz = ZoneInfo("Asia/Bangkok")
ACCESS_COOKIE_NAME = "access_token"

# ─── SMTP ────────────────────────────────────────────────────
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "eds194655@gmail.com")
SMTP_PASS = os.getenv("SMTP_PASS", "depllvpufjwtpysc")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "eds194655@gmail.com")

# ─── MongoDB ─────────────────────────────────────────────────
client1 = MongoClient("mongodb://imps_platform:eds_imps@203.154.130.132:27017/")
client = AsyncIOMotorClient("mongodb://imps_platform:eds_imps@203.154.130.132:27017/")

deviceDB = client["utilizationFactor"]
settingDB = client["settingParameter"]
errorDB = client["FaultStatus"]

db = client1["iMPS"]
users_collection = db["users"]
station_collection = db["stations"]
charger_collection = db["charger"]

station_collection.create_index("station_id", unique=True)
charger_collection.create_index("station_id")
charger_collection.create_index("chargeBoxID")

charger_onoff = client["edgeboxStatus"]
charger_onoff_sync = client1["edgeboxStatus"]
MDB_DB = client["MDB"]
MDB_realtime_DB = client["MDB_realtime"]
MDB_history_DB = client["MDB_history"]
CBM_DB = client["monitorCBM"]

PMReportDB = client["PMReport"]
PMUrlDB = client["PMReportURL"]
MDBPMReportDB = client["MDBPMReport"]
MDBPMUrlDB = client["MDBPMReportURL"]
CCBPMReportDB = client["CCBPMReport"]
CCBPMUrlDB = client["CCBPMReportURL"]
CBBOXPMReportDB = client["CBBOXPMReport"]
CBBOXPMUrlDB = client["CBBOXPMReportURL"]
DCTestReportDB = client["DCTestReport"]
DCUrlDB = client["DCUrl"]
ACTestReportDB = client["ACTestReport"]
ACUrlDB = client["ACUrl"]
stationPMReportDB = client["stationPMReport"]
stationPMUrlDB = client["stationPMReportURL"]
CMReportDB = client["CMReport"]
CMUrlDB = client["CMReportURL"]

outputModule1 = client["OutputModule1"]
outputModule2 = client["OutputModule2"]
outputModule3 = client["OutputModule3"]
outputModule4 = client["OutputModule4"]
outputModule5 = client["OutputModule5"]
outputModule6 = client["OutputModule6"]
outputModule7 = client["OutputModule7"]

inputModule1 = client["module1MdbDustPrediction"]
inputModule2 = client["module2ChargerDustPrediction"]
inputModule3 = client["module3ChargerOfflineAnalysis"]
inputModule4 = client["module4AbnormalPowerPrediction"]
inputModule5 = client["module5NetworkProblemPrediction"]
inputModule6 = client["module6DcChargerRulPrediction"]
inputModule7 = client["module7ChargerPowerIssue"]

MODULES = ["module1", "module2", "module3", "module4", "module5", "module6", "module7"]

OUTPUT_DBS = {
    "module1": outputModule1, "module2": outputModule2, "module3": outputModule3,
    "module4": outputModule4, "module5": outputModule5, "module6": outputModule6,
    "module7": outputModule7,
}
INPUT_DBS = {
    "module1": inputModule1, "module2": inputModule2, "module3": inputModule3,
    "module4": inputModule4, "module5": inputModule5, "module6": inputModule6,
    "module7": inputModule7,
}

imps_db_async = client["iMPS"]
charger_coll_async = imps_db_async["charger"]
stations_coll_async = imps_db_async["stations"]
users_coll_async = imps_db_async["users"]
email_log_coll = imps_db_async["errorEmailLog"]

MDB_collection = MDB_DB["Klongluang3"]

# ─── Shared Helpers ──────────────────────────────────────────
def _validate_station_id(station_id: str):
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")

def get_mdb_collection_for(station_id: str):
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")
    return MDB_DB.get_collection(str(station_id))

class _MongoEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, Decimal128):
            return float(o.to_decimal())
        if isinstance(o, datetime):
            return o.isoformat()
        return super().default(o)

def to_json(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), cls=_MongoEncoder)

def _ensure_utc_iso(v):
    if isinstance(v, datetime):
        return v.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    if isinstance(v, str) and re.match(r'^\d{4}-\d{2}-\d{2}T', v) and not re.search(r'(Z|[+\-]\d{2}:\d{2})$', v):
        return v + 'Z'
    return v

def create_access_token(data: dict, expires_delta: int | timedelta = 15):
    to_encode = dict(data)
    expire = (datetime.now(timezone.utc) + (timedelta(minutes=expires_delta) if isinstance(expires_delta, int) else expires_delta))
    to_encode["exp"] = int(expire.timestamp())
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def parse_iso_dt(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail=f"Bad datetime: {s}")

def _to_utc_dt(iso_str: str) -> datetime:
    s = iso_str
    if s.endswith("Z"):
        s = s.replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt

def to_float(x, default=0.0):
    try:
        if x is None: return default
        if isinstance(x, (int, float)): return float(x)
        if isinstance(x, Decimal128): return float(x.to_decimal())
        s = str(x).strip().replace(",", ".")
        return float(s)
    except Exception:
        return default

def normalize_pm_date(s: str) -> str:
    """แปลง date string (ISO/UTC/วันเปล่า) → 'YYYY-MM-DD' ตามเวลาไทย"""
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
        return s
    if s.endswith("Z") or re.search(r"[+\-]\d{2}:\d{2}$", s):
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    else:
        dt = datetime.fromisoformat(s).replace(tzinfo=th_tz)
    return dt.astimezone(th_tz).date().isoformat()

def floor_bin(dt: datetime, step_sec: int) -> datetime:
    epoch_ms = int(dt.timestamp() * 1000)
    bin_ms = epoch_ms - (epoch_ms % (step_sec * 1000))
    return datetime.fromtimestamp(bin_ms / 1000, tz=timezone.utc)