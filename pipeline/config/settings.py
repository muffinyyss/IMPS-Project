"""
Global Settings for Pipeline

Contains MQTT broker, MongoDB connection, and database configuration.
Station-specific configs are in config/stations/*.json
"""
import os
import json
import logging
from pathlib import Path
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
    uri: str = "mongodb://imps_platform:eds_imps@203.154.130.132:27017/"
    
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
        "plc": "serialNumber",
        "setting": "serialNumber",
        "utilization": "serialNumber",
        "mdb": "stationId",
        "cbm": "serialNumber",
        "pmreport": "serialNumber",
        "module1": "stationId",
        "module2": "serialNumber",
        "module3": "serialNumber",
        "module4": "serialNumber",
        "module5": "serialNumber",
        "module6": "serialNumber",
        "module7": "serialNumber",
        "errorCode": "serialNumber"
    })


# =============================================================================
# Station Configuration (loaded from JSON files)
# =============================================================================
@dataclass
class HardwareConfig:
    dcContractorCount: int = 6
    powerModuleCount: int = 5
    dcFanCount: int = 8
    fanType: str = "FIXED"
    energyMeterType: str = "PILOT"
    powerModuleDefaults: Dict[str, int] = field(default_factory=lambda: {"pm1": 2, "pm2": 3})


@dataclass
class TopicsConfig:
    plc: str = ""
    pi5Heartbeat: str = ""
    ebError: str = ""
    ebTemp: str = ""
    ebHeartbeat: str = ""
    ebCountDevice: str = ""
    router: str = ""
    mdbRaw: str = ""
    ambient: str = ""
    bme280: str = ""
    insulation1: str = ""
    insulation2: str = ""
    fanRpm: Optional[str] = None
    meter: Optional[str] = None  # เพิ่ม meter topic
    
    def get_all_topics(self) -> List[str]:
        """Get list of all non-empty topics"""
        topics = []
        for key in ['plc', 'pi5Heartbeat', 'ebError', 'ebTemp', 'ebHeartbeat',
                    'ebCountDevice', 'router', 'mdbRaw', 'ambient', 'bme280',
                    'insulation1', 'insulation2', 'fanRpm', 'meter']:
            val = getattr(self, key, None)
            if val:
                topics.append(val)
        return topics


@dataclass
class ServiceLifeConfig:
    commitDate: str = ""
    endDate: str = ""


@dataclass
class CollectionsConfig:
    """MongoDB collection names per station"""
    meter: str = ""


@dataclass
class StationConfig:
    stationId: str = ""
    serialNumber: str = ""
    hardware: HardwareConfig = field(default_factory=HardwareConfig)
    topics: TopicsConfig = field(default_factory=TopicsConfig)
    serviceLife: ServiceLifeConfig = field(default_factory=ServiceLifeConfig)
    collections: CollectionsConfig = field(default_factory=CollectionsConfig)
    
    def get_collection_name(self, db_key: str, mongodb_config: MongoDBConfig) -> str:
        """Get collection name for a database"""
        naming = mongodb_config.collection_naming.get(db_key, "serialNumber")
        if naming == "stationId":
            return self.stationId
        return self.serialNumber


# =============================================================================
# Configuration Loading
# =============================================================================
def load_station_config(station_name: str) -> StationConfig:
    """Load station configuration from JSON file"""
    config_dir = Path(__file__).parent / "stations"
    config_path = config_dir / f"{station_name}.json"
    
    if not config_path.exists():
        raise FileNotFoundError(f"Station config not found: {config_path}")
    
    with open(config_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Parse hardware config
    hw_data = data.get('hardware', {})
    hardware = HardwareConfig(
        dcContractorCount=hw_data.get('dcContractorCount', 6),
        powerModuleCount=hw_data.get('powerModuleCount', 5),
        dcFanCount=hw_data.get('dcFanCount', 8),
        fanType=hw_data.get('fanType', 'FIXED'),
        energyMeterType=hw_data.get('energyMeterType', 'PILOT'),
        powerModuleDefaults=hw_data.get('powerModuleDefaults', {"pm1": 2, "pm2": 3})
    )
    
    # Parse topics config
    topics_data = data.get('topics', {})
    topics = TopicsConfig(
        plc=topics_data.get('plc', ''),
        pi5Heartbeat=topics_data.get('pi5Heartbeat', ''),
        ebError=topics_data.get('ebError', ''),
        ebTemp=topics_data.get('ebTemp', ''),
        ebHeartbeat=topics_data.get('ebHeartbeat', ''),
        ebCountDevice=topics_data.get('ebCountDevice', ''),
        router=topics_data.get('router', ''),
        mdbRaw=topics_data.get('mdbRaw', ''),
        ambient=topics_data.get('ambient', ''),
        bme280=topics_data.get('bme280', ''),
        insulation1=topics_data.get('insulation1', ''),
        insulation2=topics_data.get('insulation2', ''),
        fanRpm=topics_data.get('fanRpm'),
        meter=topics_data.get('meter')
    )
    
    # Parse service life config
    sl_data = data.get('serviceLife', {})
    service_life = ServiceLifeConfig(
        commitDate=sl_data.get('commitDate', ''),
        endDate=sl_data.get('endDate', '')
    )
    
    # Parse collections config
    coll_data = data.get('collections', {})
    station_id = data.get('stationId', '')
    collections = CollectionsConfig(
        meter=coll_data.get('meter', station_id)
    )
    
    return StationConfig(
        stationId=station_id,
        serialNumber=data.get('serialNumber', ''),
        hardware=hardware,
        topics=topics,
        serviceLife=service_life,
        collections=collections
    )


def load_all_station_configs() -> Dict[str, StationConfig]:
    """Load all station configurations from config/stations/"""
    config_dir = Path(__file__).parent / "stations"
    configs = {}
    
    if not config_dir.exists():
        logger.warning(f"Stations config directory not found: {config_dir}")
        return configs
    
    for config_file in config_dir.glob("*.json"):
        station_name = config_file.stem
        try:
            configs[station_name] = load_station_config(station_name)
            logger.info(f"Loaded config for station: {station_name}")
        except Exception as e:
            logger.error(f"Failed to load config for {station_name}: {e}")
    
    return configs


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
            cls._instance.stations = {}
        return cls._instance
    
    def load_stations(self, station_names: Optional[List[str]] = None):
        """Load station configs. If names not provided, load all."""
        if station_names:
            for name in station_names:
                try:
                    self.stations[name] = load_station_config(name)
                except Exception as e:
                    logger.error(f"Failed to load station {name}: {e}")
        else:
            self.stations = load_all_station_configs()
        
        logger.info(f"Loaded {len(self.stations)} station(s)")


# Create global settings instance
settings = Settings()