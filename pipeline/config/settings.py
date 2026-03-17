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
    uri: str = "mongodb://imps_platform:eds_imps@203.154.130.132:27017/?authSource=admin&directConnection=true"
    #uri: str = "mongodb://imps_platform:eds_imps@localhost:27017/"
    
    config_database: str = "iMPS"
    config_collection: str = "charger"
    # mdb_realtime_db: str = "MDB_realtime"
    # mdb_history_db: str = "MDB_history"
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
    dcContractorCount: int = 6          # ไม่ใช่ dc_contractor_count
    powerModuleCount: int = 5
    dcFanCount: int = 8
    fanType: str = "FIXED"
    energyMeterType: str = "PILOT"
    powerModuleDefaults: Dict[str, int] = field(default_factory=lambda: {"pm1": 2, "pm2": 3})


@dataclass
class TopicsConfig:
    plc: str = ""
    pi5Heartbeat: str = ""       # camelCase
    ebError: str = ""
    ebTemp: str = ""
    ebHeartbeat: str = ""
    # ebCountDevice ตัดออก
    router: str = ""
    bme280: str = ""
    insulation1: str = ""
    insulation2: str = ""
    fanRpm: Optional[str] = None
    meter: Optional[str] = None
    ocppConfig: Optional[str] = None
    plcTemp1: Optional[str] = None
    plcTemp2: Optional[str] = None
    mdb: Optional[str] = None 
    
    def get_all_topics(self) -> List[str]:
        """Get list of all non-empty subscribe topics"""
        topics = []
        # === แก้ list ให้ตรงกับ camelCase ===
        for key in ['plc', 'pi5Heartbeat', 'ebError', 'ebTemp', 'ebHeartbeat',
                    'router', 'bme280',
                    'insulation1', 'insulation2', 'fanRpm', 'meter',
                    'plcTemp1', 'plcTemp2', 'mdb']:
            val = getattr(self, key, None)
            if val:
                topics.append(val)
        return topics

@dataclass
class ServiceLifeConfig:
    endDate: str = ""

@dataclass
class CollectionsConfig:
    """MongoDB collection names per station"""
    meter: str = ""


@dataclass
class StationConfig:
    stationId: str = ""
    serialNumber: str = ""
    chargeBoxId: str = ""        # เพิ่มใหม่
    ocppUrl: str = ""            # เพิ่มใหม่
    commissioningDate: str = ""  # เพิ่มใหม่
    hardware: HardwareConfig = field(default_factory=HardwareConfig)
    topics: TopicsConfig = field(default_factory=TopicsConfig)
    serviceLife: ServiceLifeConfig = field(default_factory=ServiceLifeConfig)
    collections: CollectionsConfig = field(default_factory=CollectionsConfig)
    
    def get_collection_name(self, db_key: str, mongodb_config: MongoDBConfig) -> str:
        """Get collection name for a database"""
        naming = mongodb_config.collection_naming.get(db_key, "serial_number")
        if naming == "station_id":
            return self.stationId
        return self.serialNumber      


# =============================================================================
# Configuration Loading from MongoDB
# =============================================================================
def parse_station_config(doc: Dict[str, Any]) -> Optional[StationConfig]:
    """ Parse charger document from MongoDB to StationConfig. Returns None if pipeline_config is missing. MongoDB format uses camelCase for topics and hardware. """
    pipeline_config = doc.get('pipeline_config')
    if not pipeline_config:
        return None
    
    # Get values from parent document
    station_id = doc.get('station_id', '')
    serial_number = doc.get('SN', '')
    charge_box_id = doc.get('chargeBoxID', '')
    ocpp_url = doc.get('ocppUrl', '')
    commissioning_date = doc.get('commissioningDate', '')
    
    if not station_id or not serial_number:
        return None
    
    # Parse hardware config (camelCase from MongoDB)
    hw_data = pipeline_config.get('hardware', {})
    hardware = HardwareConfig(
        dcContractorCount=hw_data.get('dcContractorCount', 6),
        powerModuleCount=hw_data.get('powerModuleCount', 5),
        dcFanCount=hw_data.get('dcFanCount', 8),
        fanType=hw_data.get('fanType', 'FIXED'),
        energyMeterType=hw_data.get('energyMeterType', 'PILOT'),
        powerModuleDefaults=hw_data.get('powerModuleDefaults', {"pm1": 2, "pm2": 3})
    )
    
    # Parse topics config (camelCase from MongoDB)
    topics_data = pipeline_config.get('topics', {})
    topics = TopicsConfig(
        plc=topics_data.get('plc', ''),
        pi5Heartbeat=topics_data.get('pi5Heartbeat', ''),
        ebError=topics_data.get('ebError', ''),
        ebTemp=topics_data.get('ebTemp', ''),
        ebHeartbeat=topics_data.get('ebHeartbeat', ''),
        # ebCountDevice ตัดออก
        router=topics_data.get('router', ''),
        bme280=topics_data.get('bme280', ''),
        insulation1=topics_data.get('insulation1', ''),
        insulation2=topics_data.get('insulation2', ''),
        fanRpm=topics_data.get('fanRpm'),
        meter=topics_data.get('meter'),
        ocppConfig=topics_data.get('ocppConfig'),
        plcTemp1=topics_data.get('plcTemp1'),
        plcTemp2=topics_data.get('plcTemp2'),
        mdb=topics_data.get('mdbRaw') or topics_data.get('mdb'), 
    )
    
    # Parse service life config
    sl_data = pipeline_config.get('service_life', {})
    service_life = ServiceLifeConfig(
        endDate=sl_data.get('endDate', '')
    )
    
    # Parse collections config
    coll_data = pipeline_config.get('collections', {})
    collections = CollectionsConfig(
        meter=coll_data.get('meter', '')
    )
    
    return StationConfig(
        stationId=station_id,
        serialNumber=serial_number,
        chargeBoxId=charge_box_id,
        ocppUrl=ocpp_url,
        commissioningDate=commissioning_date,
        hardware=hardware,
        topics=topics,
        serviceLife=service_life,
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
        """Load station configs from MongoDB charger collection."""
        from pymongo import MongoClient
        
        try:
            client = MongoClient(self.mongodb.uri)
            db = client[self.mongodb.config_database]
            collection = db[self.mongodb.config_collection]
            
            query = {}
            if station_ids:
                query['station_id'] = {'$in': station_ids}
            
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