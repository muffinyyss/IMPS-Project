"""
Global Settings for Pipeline

Contains MQTT broker, MongoDB connection, and database configuration.
Station configs are loaded from MongoDB (iMPS.charger collection)
"""
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


# =============================================================================
# MQTT Configuration
# =============================================================================
@dataclass
class MQTTConfig:
    host: str = "212.80.215.42"
    port: int = 1883
    username: str = "EDSFlexxfast"
    password: str = "password"
    keepalive: int = 60


# =============================================================================
# MongoDB Configuration  
# =============================================================================
@dataclass
class MongoDBConfig:
    uri: str = "mongodb://imps_platform:eds_imps@localhost:27017/"
    
    # Database for loading charger configs
    config_database: str = "iMPS"
    config_collection: str = "charger"
    
    # MDB databases
    mdb_realtime_db: str = "MDB_realtime"
    mdb_history_db: str = "MDB_history"
    
    # Status databases (ใหม่)
    edgebox_status_db: str = "edgeboxStatus"
    pi5_status_db: str = "pi5Status"
    router_status_db: str = "routerStatus"
    
    # Database names (14 databases)
    databases: Dict[str, str] = field(default_factory=lambda: {
        "plc": "PLC",
        "setting": "settingParameter",
        "utilization": "utilizationFactor",
        "mdb": "MDB",
        "cbm": "monitorCBM",
        "pmreport": "PMReport",
        "module1": "module1MdbDustPrediction",
        "module2": "module2ChargerDustPrediction",
        "module3": "module3ChargerOfflineAnalysis",
        "module4": "module4AbnormalPowerPrediction",
        "module5": "module5NetworkProblemPrediction",
        "module6": "module6DcChargerRulPrediction",
        "module7": "module7ChargerPowerIssue",
        "errorCode": "errorCode"
    })
    
    # Collection naming rules
    collection_naming: Dict[str, str] = field(default_factory=lambda: {
        "plc": "serial_number",
        "setting": "serial_number",
        "utilization": "serial_number",
        "mdb": "station_id",
        "cbm": "serial_number",
        "pmreport": "serial_number",
        "module1": "station_id",
        "module2": "serial_number",
        "module3": "serial_number",
        "module4": "serial_number",
        "module5": "serial_number",
        "module6": "serial_number",
        "module7": "serial_number",
        "errorCode": "serial_number"
    })


# =============================================================================
# Station Configuration (loaded from MongoDB)
# =============================================================================
@dataclass
class HardwareConfig:
    dc_contractor_count: int = 6
    power_module_count: int = 5
    dc_fan_count: int = 8
    fan_type: str = "FIXED"
    energy_meter_type: str = "PILOT"
    power_module_defaults: Dict[str, int] = field(default_factory=lambda: {"pm1": 2, "pm2": 3})


@dataclass
class TopicsConfig:
    plc: str = ""
    pi5_heartbeat: str = ""
    eb_error: str = ""
    eb_temp: str = ""
    eb_heartbeat: str = ""
    eb_count_device: str = ""
    router: str = ""
    # ambient: str = ""  ← ตัดออก ใช้ bme280 แทน
    bme280: str = ""
    insulation1: str = ""
    insulation2: str = ""
    fan_rpm: Optional[str] = None
    meter: Optional[str] = None
    ocpp_config: Optional[str] = None  # เพิ่มใหม่
    
    def get_all_topics(self) -> List[str]:
        """Get list of all non-empty subscribe topics"""
        topics = []
        for key in ['plc', 'pi5_heartbeat', 'eb_error', 'eb_temp', 'eb_heartbeat',
                    'eb_count_device', 'router', 'bme280',
                    'insulation1', 'insulation2', 'fan_rpm', 'meter']:
            val = getattr(self, key, None)
            if val:
                topics.append(val)
        return topics


@dataclass
class ServiceLifeConfig:
    # commit_date ตัดออก - ใช้ commissioningDate จาก parent document
    end_date: str = ""


@dataclass
class CollectionsConfig:
    """MongoDB collection names per station"""
    meter: str = ""


@dataclass
class StationConfig:
    station_id: str = ""
    serial_number: str = ""
    charge_box_id: str = ""  # เพิ่มใหม่
    ocpp_url: str = ""  # เพิ่มใหม่
    commissioning_date: str = ""  # เพิ่มใหม่ (แทน commit_date)
    hardware: HardwareConfig = field(default_factory=HardwareConfig)
    topics: TopicsConfig = field(default_factory=TopicsConfig)
    service_life: ServiceLifeConfig = field(default_factory=ServiceLifeConfig)
    collections: CollectionsConfig = field(default_factory=CollectionsConfig)
    
    def get_collection_name(self, db_key: str, mongodb_config: MongoDBConfig) -> str:
        """Get collection name for a database"""
        naming = mongodb_config.collection_naming.get(db_key, "serial_number")
        if naming == "station_id":
            return self.station_id
        return self.serial_number


# =============================================================================
# Configuration Loading from MongoDB
# =============================================================================
def parse_station_config(doc: Dict[str, Any]) -> Optional[StationConfig]:
    """
    Parse charger document from MongoDB to StationConfig.
    Returns None if pipeline_config is missing.
    """
    # Check if pipeline_config exists
    pipeline_config = doc.get('pipeline_config')
    if not pipeline_config:
        return None
    
    # Get values from parent document
    station_id = doc.get('station_id', '')
    serial_number = doc.get('SN', '')
    charge_box_id = doc.get('chargeBoxID', '')  # เพิ่มใหม่
    ocpp_url = doc.get('ocppUrl', '')  # เพิ่มใหม่
    commissioning_date = doc.get('commissioningDate', '')  # เพิ่มใหม่
    
    if not station_id or not serial_number:
        return None
    
    # Parse hardware config
    hw_data = pipeline_config.get('hardware', {})
    hardware = HardwareConfig(
        dc_contractor_count=hw_data.get('dc_contractor_count', 6),
        power_module_count=hw_data.get('power_module_count', 5),
        dc_fan_count=hw_data.get('dc_fan_count', 8),
        fan_type=hw_data.get('fan_type', 'FIXED'),
        energy_meter_type=hw_data.get('energy_meter_type', 'PILOT'),
        power_module_defaults=hw_data.get('power_module_defaults', {"pm1": 2, "pm2": 3})
    )
    
    # Parse topics config (ไม่รวม ambient และ mdb_raw)
    topics_data = pipeline_config.get('topics', {})
    topics = TopicsConfig(
        plc=topics_data.get('plc', ''),
        pi5_heartbeat=topics_data.get('pi5_heartbeat', ''),
        eb_error=topics_data.get('eb_error', ''),
        eb_temp=topics_data.get('eb_temp', ''),
        eb_heartbeat=topics_data.get('eb_heartbeat', ''),
        eb_count_device=topics_data.get('eb_count_device', ''),
        router=topics_data.get('router', ''),
        bme280=topics_data.get('bme280', ''),
        insulation1=topics_data.get('insulation1', ''),
        insulation2=topics_data.get('insulation2', ''),
        fan_rpm=topics_data.get('fan_rpm'),
        meter=topics_data.get('meter'),
        ocpp_config=topics_data.get('ocpp_config')  # เพิ่มใหม่
    )
    
    # Parse service life config (ใช้ commissioningDate แทน commit_date)
    sl_data = pipeline_config.get('service_life', {})
    service_life = ServiceLifeConfig(
        end_date=sl_data.get('end_date', '')
    )
    
    # Parse collections config
    coll_data = pipeline_config.get('collections', {})
    collections = CollectionsConfig(
        meter=coll_data.get('meter', '')
    )
    
    return StationConfig(
        station_id=station_id,
        serial_number=serial_number,
        charge_box_id=charge_box_id,
        ocpp_url=ocpp_url,
        commissioning_date=commissioning_date,
        hardware=hardware,
        topics=topics,
        service_life=service_life,
        collections=collections
    )


# =============================================================================
# Global Settings Instance
# =============================================================================
class Settings:
    """Global settings singleton"""
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.mqtt = MQTTConfig()
            cls._instance.mongodb = MongoDBConfig()
            cls._instance.stations: Dict[str, StationConfig] = {}
        return cls._instance
    
    def load_stations_from_mongodb(self, station_ids: Optional[List[str]] = None):
        """
        Load station configs from MongoDB charger collection.
        Only loads chargers that have pipeline_config.
        """
        from pymongo import MongoClient
        
        try:
            client = MongoClient(self.mongodb.uri)
            db = client[self.mongodb.config_database]
            collection = db[self.mongodb.config_collection]
            
            # Build query
            query = {}
            if station_ids:
                query['station_id'] = {'$in': station_ids}
            
            # Find chargers with pipeline_config
            cursor = collection.find(query)
            
            loaded_count = 0
            skipped_count = 0
            
            for doc in cursor:
                station_id = doc.get('station_id', 'unknown')
                
                config = parse_station_config(doc)
                if config:
                    self.stations[station_id] = config
                    loaded_count += 1
                    logger.info(f"Loaded config for station: {station_id}")
                else:
                    skipped_count += 1
                    logger.debug(f"Skipped station (no pipeline_config): {station_id}")
            
            client.close()
            
            logger.info(f"Loaded {loaded_count} station(s), skipped {skipped_count}")
            
        except Exception as e:
            logger.error(f"Failed to load stations from MongoDB: {e}")
    
    def reload_station_config(self, station_id: str) -> Optional[StationConfig]:
        """Reload a single station config from MongoDB"""
        from pymongo import MongoClient
        
        try:
            client = MongoClient(self.mongodb.uri)
            db = client[self.mongodb.config_database]
            collection = db[self.mongodb.config_collection]
            
            doc = collection.find_one({'station_id': station_id})
            client.close()
            
            if doc:
                config = parse_station_config(doc)
                if config:
                    self.stations[station_id] = config
                    return config
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to reload station {station_id}: {e}")
            return None
    
    def load_stations(self, station_ids: Optional[List[str]] = None):
        """Alias for load_stations_from_mongodb"""
        self.load_stations_from_mongodb(station_ids)


# Create global settings instance
settings = Settings()