#core\mongodb_client.py
"""
MongoDB Client

Handles MongoDB connections and writes to multiple databases.
"""
import logging
from typing import Dict, Optional, Any, List
from datetime import datetime

from pymongo import MongoClient, DESCENDING
from pymongo.collection import Collection
from pymongo.database import Database

from config import settings, MongoDBConfig, StationConfig
from utils import parse_h_m_to_seconds, parse_int

logger = logging.getLogger(__name__)

class MongoDBClient:
    """
    MongoDB client for multi-database operations.
    """
    
    METER_DB_URI = "mongodb://EDS:EV1@45.91.135.9:27017/"
    METER_DB_NAME = "meter"
    
    def __init__(self, config: Optional[MongoDBConfig] = None):
        self.config = config or settings.mongodb
        self._client: Optional[MongoClient] = None
        self._databases: Dict[str, Database] = {}
    
    def connect(self) -> bool:
        """Connect to MongoDB"""
        try:
            logger.info(f"Connecting to MongoDB...")
            self._client = MongoClient(self.config.uri)
            
            # Test connection
            self._client.admin.command('ping')
            logger.info("MongoDB connection successful")
            
            # Get database references
            for key, db_name in self.config.databases.items():
                self._databases[key] = self._client[db_name]
                logger.debug(f"Database '{key}' -> '{db_name}'")
            
            return True
        
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            return False
    
    def close(self):
        """Close MongoDB connection"""
        if self._client:
            self._client.close()
            logger.info("MongoDB connection closed")
    
    def get_collection(self, db_key: str, collection_name: str) -> Optional[Collection]:
        """
        Get collection reference.
        
        Args:
            db_key: Database key (e.g., 'plc', 'mdb', 'module1')
            collection_name: Collection name (usually station_id or serial_number)
        """
        db = self._databases.get(db_key)
        if db is None:
            logger.error(f"Database not found: {db_key}")
            return None
        return db[collection_name]
    
    def get_station_collection(self, db_key: str, 
                                station_config: StationConfig) -> Optional[Collection]:
        """
        Get collection for a station.
        Uses proper naming based on database rules.
        """
        naming = self.config.collection_naming.get(db_key, 'serialNumber')
        
        if naming == 'station_id':
            collection_name = station_config.stationId  
        else:
            collection_name = station_config.serialNumber  
        
        return self.get_collection(db_key, collection_name)
    
    def insert_one(self, db_key: str, collection_name: str, 
                   document: Dict[str, Any]) -> Optional[str]:
        """
        Insert a document.
        
        Returns:
            Inserted document ID or None on error
        """
        try:
            collection = self.get_collection(db_key, collection_name)
            if collection is None:
                return None
            
            result = collection.insert_one(document)
            return str(result.inserted_id)
        
        except Exception as e:
            logger.error(f"Error inserting to {db_key}/{collection_name}: {e}")
            return None
    
    def find_latest(self, db_key: str, collection_name: str,
                    filter_query: Optional[Dict] = None,
                    projection: Optional[Dict] = None) -> Optional[Dict]:
        """
        Find latest document by timestamp_utc.
        """
        try:
            collection = self.get_collection(db_key, collection_name)
            if collection is None:
                return None
            
            query = filter_query or {}
            
            return collection.find_one(
                query,
                projection=projection,
                sort=[("timestamp_utc", DESCENDING), ("_id", DESCENDING)]
            )
        
        except Exception as e:
            logger.error(f"Error finding latest in {db_key}/{collection_name}: {e}")
            return None

    def get_latest_meter(self, collection_name: str) -> Dict[str, int]:
        """
        Get latest meter values from meter database.
        
        Args:
            collection_name: Collection name (e.g., 'Klongluang3')
        
        Returns:
            Dict with meter1, meter2 values
        """
        try:
            meter_client = MongoClient(self.METER_DB_URI)  # ✅ เพิ่ม self.
            meter_db = meter_client[self.METER_DB_NAME]    # ✅ เพิ่ม self.
            meter_collection = meter_db[collection_name]
            
            # Get latest document
            latest = meter_collection.find_one(
                {},
                sort=[('_id', -1)]
            )
            
            meter_client.close()
            
            if latest and 'payload' in latest:
                payload = latest['payload']
                return {
                    'meter1': payload.get('meter1', 0),
                    'meter2': payload.get('meter2', 0)
                }
            
            logger.warning(f"No meter data found in {collection_name}")
            return {'meter1': 0, 'meter2': 0}
            
        except Exception as e:
            logger.error(f"Error getting meter data: {e}")
            return {'meter1': 0, 'meter2': 0}
        
    def get_mdb_realtime_db(self):
        """Get __MDB_realtime__ database"""
        if self._client:
            return self._client[self.config.mdb_realtime_db]
        return None
    
    def get_mdb_history_db(self):
        """Get __MDB_history__ database"""
        if self._client:
            return self._client[self.config.mdb_history_db]
        return None

class RecoveryLoader:
    """
    Loads state from MongoDB for recovery on startup.
    """
    
    def __init__(self, mongodb: MongoDBClient):
        self.mongodb = mongodb
    
    def recover_state(self, station_config: StationConfig) -> Dict[str, Any]:
        """
        Recover state from MongoDB for a station.
        
        Sources:
        - utilizationFactor: Counters, FUSE timers
        - module6DcChargerRulPrediction: Service lives, Power module, DC fan
        - monitorCBM: DC contractor counts (backup)
        """
        station_id = station_config.stationId  # เปลี่ยน
        serial_number = station_config.serialNumber  # เปลี่ยน
        
        result = {
            'dc_contractors': {},
            'ac_contractors': {},
            'motor_starters': {},
            'fuse_timers': {},
            'dc_fan_seconds': 0,
            'power_modules': {}
        }
        
        logger.info(f"[{station_id}] Recovering state from MongoDB...")
        
        # 1. Load from utilizationFactor
        util_doc = self.mongodb.find_latest('utilization', serial_number)
        if util_doc:
            logger.debug(f"[{station_id}] Found utilizationFactor document")
            
            # DC Contractors
            for i in range(1, 7):
                key = f"DC_power_contractor{i}"
                if key in util_doc:
                    result['dc_contractors'][i] = parse_int(util_doc[key], 0)
            
            # AC Contractors
            for i in range(1, 3):
                key = f"AC_power_contractor{i}"
                if key in util_doc:
                    result['ac_contractors'][i] = parse_int(util_doc[key], 0)
            
            # Motor Starters
            for i in range(1, 3):
                key = f"motor_starter{i}_count"
                alt_key = f"motor_starter{i}"
                if key in util_doc:
                    result['motor_starters'][i] = parse_int(util_doc[key], 0)
                elif alt_key in util_doc:
                    result['motor_starters'][i] = parse_int(util_doc[alt_key], 0)
            
            # FUSE timers
            for i in range(1, 3):
                key = f"FUSE{i}"
                if key in util_doc:
                    text = util_doc[key]
                    if isinstance(text, str):
                        result['fuse_timers'][i] = parse_h_m_to_seconds(text)
                    else:
                        result['fuse_timers'][i] = parse_int(text, 0)
        
        # 2. Load from module6DcChargerRulPrediction
        module6_doc = self.mongodb.find_latest('module6', serial_number)
        if module6_doc:
            logger.debug(f"[{station_id}] Found module6 document")
            
            # Power module service life
            for i in range(1, 6):
                key = f"power_module_RUL{i}"
                if key in module6_doc and isinstance(module6_doc[key], dict):
                    sl_val = module6_doc[key].get('power_module_service_life', 0)
                    if isinstance(sl_val, str):
                        result['power_modules'][i] = parse_h_m_to_seconds(sl_val)
                    else:
                        result['power_modules'][i] = parse_int(sl_val, 0)
            
            # DC Fan service life (all fans use same value)
            dc_fan_key = "DC_fan_RUL1"
            if dc_fan_key in module6_doc and isinstance(module6_doc[dc_fan_key], dict):
                sl_val = module6_doc[dc_fan_key].get('DC_fan_service_life', 0)
                if isinstance(sl_val, str):
                    result['dc_fan_seconds'] = parse_h_m_to_seconds(sl_val)
                else:
                    result['dc_fan_seconds'] = parse_int(sl_val, 0)
        
        # 3. Load from monitorCBM (backup for DC contractors)
        cbm_doc = self.mongodb.find_latest('cbm', serial_number)
        if cbm_doc:
            logger.debug(f"[{station_id}] Found CBM document")
            
            for i in range(1, 7):
                key = f"DC_power_contractor{i}"
                if key in cbm_doc and i not in result['dc_contractors']:
                    result['dc_contractors'][i] = parse_int(cbm_doc[key], 0)
        
        logger.info(f"[{station_id}] Recovery complete: "
                   f"DC={result['dc_contractors']}, "
                   f"AC={result['ac_contractors']}, "
                   f"MS={result['motor_starters']}")
        
        return result
    
    def load_pm_report(self, station_config: StationConfig) -> Dict[str, Any]:
        """
        Load PM Report data for dust filter tracking.
        """
        serial_number = station_config.serialNumber
        
        result = {
            'pm_date': None,
            'dust_filter_enabled': False
        }
        
        pm_doc = self.mongodb.find_latest('pmreport', serial_number)
        if pm_doc:
            result['pm_date'] = pm_doc.get('pm_date')
            result['dust_filter_enabled'] = pm_doc.get('dust_filter') == 'yes'
            logger.debug(f"[{station_config.stationId}] PM Report: "
                        f"date={result['pm_date']}, dust_filter={result['dust_filter_enabled']}")
        
        return result
    
    def apply_recovery(self, state: 'StationState', recovery_data: Dict[str, Any]):
        """
        Apply recovered data to station state.
        """
        from core.state_manager import StationState
        
        # DC Contractors
        for i, count in recovery_data.get('dc_contractors', {}).items():
            state.counters.set_dc_count(i, count)
        
        # AC Contractors
        for i, count in recovery_data.get('ac_contractors', {}).items():
            state.counters.set_ac_count(i, count)
        
        # Motor Starters
        for i, count in recovery_data.get('motor_starters', {}).items():
            state.counters.set_ms_count(i, count)
        
        # FUSE Timers
        for i, seconds in recovery_data.get('fuse_timers', {}).items():
            state.timers.set_fuse_seconds(i, seconds)
        
        # DC Fan Timers
        dc_fan_seconds = recovery_data.get('dc_fan_seconds', 0)
        for i in range(1, state.config.hardware.dcFanCount  + 1):
            state.timers.set_dc_fan_seconds(i, dc_fan_seconds)
        
        # Power Modules
        for i, seconds in recovery_data.get('power_modules', {}).items():
            state.timers.set_pm_seconds(i, seconds)
        
        logger.info(f"[{state.station_id}] State recovery applied")
