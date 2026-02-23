#processors\aggregator_processor.py
"""
Aggregator Processor

Processes aggregated topics and writes to MongoDB collections.
Handles: MDB, Router, CBM aggregated data, Module1-6
"""
import logging
from typing import Optional, Dict, Any
from datetime import datetime

from core.state_manager import StationState
from core.mongodb_client import MongoDBClient
from models.schemas import (
    create_mdb_document,
    create_cbm_document,
    create_module1_document,
    create_module2_document,
    create_module3_document,
    create_module4_document,
    create_module6_document
)
from utils import now_tz, parse_float

logger = logging.getLogger(__name__)


class MDBProcessor:
    """
    Processes MDB (power meter) topic data.
    
    Writes to:
    - MDB
    - module1MdbDustPrediction
    
    Note: module4 is NOT written here - it's written from CBM aggregator
    """
    
    def __init__(self, mongodb: MongoDBClient):
        self.mongodb = mongodb
    
    def process(self, state: StationState, mdb_data: Dict[str, Any],
                timestamp: Optional[datetime] = None):
        """Process MDB data"""
        if timestamp is None:
            timestamp = now_tz()
        
        station_id = state.station_id
        ts_str = timestamp.isoformat()
        
        # Update latest data and heartbeat
        state.update_latest('mdb', mdb_data, timestamp)
        state.update_heartbeat('mdb', timestamp)
        
        # Get RSSI from router if available
        router_data = state.get_latest('router') or {}
        rssi = parse_float(router_data.get('RSSI', router_data.get('rssi', 0)))
        
        # --- Write to MDB collection ---
        mdb_doc = create_mdb_document(mdb_data, rssi, ts_str)
        if not state.check_duplicate('mdb', mdb_doc):
            self.mongodb.insert_one('mdb', station_id, mdb_doc)
            logger.debug(f"[{station_id}] Inserted MDB document")
        else:
            logger.debug(f"[{station_id}] Skipped duplicate MDB")
        
        # --- Write to module1 ---
        module1_doc = create_module1_document(state, mdb_data, ts_str)
        if not state.check_duplicate('module1', module1_doc):
            self.mongodb.insert_one('module1', station_id, module1_doc)
            logger.debug(f"[{station_id}] Inserted module1 document")
        else:
            logger.debug(f"[{station_id}] Skipped duplicate module1")


class RouterProcessor:
    """
    Processes Router topic data.
    Updates heartbeat and stores RSSI for other processors.
    """
    
    def __init__(self):
        pass
    
    def process(self, state: StationState, router_data: Dict[str, Any],
                timestamp: Optional[datetime] = None):
        """Process router data"""
        if timestamp is None:
            timestamp = now_tz()
        
        # Update latest data and heartbeat
        state.update_latest('router', router_data, timestamp)
        state.update_heartbeat('router', timestamp)
        
        logger.debug(f"[{state.station_id}] Router heartbeat updated")


class HeartbeatProcessor:
    """
    Processes heartbeat topics (Pi5, Edgebox).
    """
    
    def __init__(self):
        pass
    
    def process_pi5(self, state: StationState, data: Dict[str, Any],
                    timestamp: Optional[datetime] = None):
        """Process Pi5 heartbeat"""
        if timestamp is None:
            timestamp = now_tz()
        
        state.update_latest('pi5_heartbeat', data, timestamp)
        state.update_heartbeat('pi5', timestamp)
        logger.debug(f"[{state.station_id}] Pi5 heartbeat updated")
    
    def process_edgebox(self, state: StationState, data: Dict[str, Any],
                        timestamp: Optional[datetime] = None):
        """Process Edgebox heartbeat"""
        if timestamp is None:
            timestamp = now_tz()
        
        state.update_latest('eb_heartbeat', data, timestamp)
        state.update_heartbeat('edgebox', timestamp)
        logger.debug(f"[{state.station_id}] Edgebox heartbeat updated")


class CBMProcessor:
    """
    Processes CBM aggregated topic data.
    
    Writes to:
    - monitorCBM
    - module3ChargerOfflineAnalysis
    - module4AbnormalPowerPrediction  <-- Added here!
    - module6DcChargerRulPrediction
    """
    
    def __init__(self, mongodb: MongoDBClient):
        self.mongodb = mongodb
    
    def process(self, state: StationState, cbm_data: Dict[str, Any],
                timestamp: Optional[datetime] = None):
        """Process CBM aggregated data"""
        if timestamp is None:
            timestamp = now_tz()
        
        station_id = state.station_id
        serial_number = state.serial_number
        ts_str = timestamp.isoformat()
        
        # Update latest data
        state.update_latest('cbm', cbm_data, timestamp)
        
        # Get MDB data for module3
        mdb_data = state.get_latest('mdb') or {}
        
        # --- Write to monitorCBM ---
        cbm_doc = create_cbm_document(state, cbm_data, ts_str)
        if not state.check_duplicate('cbm', cbm_doc):
            self.mongodb.insert_one('cbm', serial_number, cbm_doc)
            logger.debug(f"[{station_id}] Inserted CBM document")
        else:
            logger.debug(f"[{station_id}] Skipped duplicate CBM")
        
        # --- Write to module3 ---
        module3_doc = create_module3_document(state, mdb_data, cbm_data, ts_str)
        if not state.check_duplicate('module3', module3_doc):
            self.mongodb.insert_one('module3', serial_number, module3_doc)
            logger.debug(f"[{station_id}] Inserted module3 document")
        else:
            logger.debug(f"[{station_id}] Skipped duplicate module3")
        
        # --- Write to module4 ---
        module4_doc = create_module4_document(state, cbm_data, ts_str)
        if not state.check_duplicate('module4', module4_doc):
            self.mongodb.insert_one('module4', serial_number, module4_doc)
            logger.debug(f"[{station_id}] Inserted module4 document")
        else:
            logger.debug(f"[{station_id}] Skipped duplicate module4")
        
        # --- Write to module6 ---
        module6_doc = create_module6_document(state, cbm_data, ts_str)
        if not state.check_duplicate('module6', module6_doc):
            self.mongodb.insert_one('module6', serial_number, module6_doc)
            logger.debug(f"[{station_id}] Inserted module6 document")
        else:
            logger.debug(f"[{station_id}] Skipped duplicate module6")


class Module2Processor:
    """
    Processes Module2 aggregated data.
    
    Writes to:
    - module2ChargerDustPrediction
    """
    
    def __init__(self, mongodb: MongoDBClient):
        self.mongodb = mongodb
    
    def process(self, state: StationState, module2_data: Dict[str, Any],
                timestamp: Optional[datetime] = None):
        """Process Module2 aggregated data"""
        if timestamp is None:
            timestamp = now_tz()
        
        station_id = state.station_id
        serial_number = state.serial_number
        ts_str = timestamp.isoformat()
        
        # --- Write to module2ChargerDustPrediction ---
        module2_doc = create_module2_document(state, module2_data, ts_str)
        if not state.check_duplicate('module2', module2_doc):
            self.mongodb.insert_one('module2', serial_number, module2_doc)
            logger.debug(f"[{station_id}] Inserted module2 document")
        else:
            logger.debug(f"[{station_id}] Skipped duplicate module2")


class ErrorProcessor:
    """
    Processes error topic for PILOT energy meter status.
    """
    
    def __init__(self):
        pass
    
    def process(self, state: StationState, error_data: Dict[str, Any],
                timestamp: Optional[datetime] = None):
        """Process error data for energy meter status"""
        if timestamp is None:
            timestamp = now_tz()
        
        state.update_latest('eb_error', error_data, timestamp)
        
        # Update energy meter status if PILOT type
        if state.config.hardware.energyMeterType.upper() == 'PILOT':
            state.update_energy_meter_from_error(error_data, timestamp)
            logger.debug(f"[{state.station_id}] Energy meter status updated from error")


class InsulationProcessor:
    """
    Processes insulation topic data.
    """
    
    def __init__(self):
        pass
    
    def process(self, state: StationState, insulation_data: Dict[str, Any],
                timestamp: Optional[datetime] = None):
        """Process insulation data"""
        if timestamp is None:
            timestamp = now_tz()
        
        state.update_latest('insulation_agg', insulation_data, timestamp)
        logger.debug(f"[{state.station_id}] Insulation data updated")


class FanRpmProcessor:
    """
    Processes Fan RPM topic data (for EBM fan type).
    """
    
    def __init__(self):
        pass
    
    def process(self, state: StationState, rpm_data: Dict[str, Any],
                timestamp: Optional[datetime] = None):
        """Process fan RPM data"""
        if timestamp is None:
            timestamp = now_tz()
        
        state.update_latest('fan_rpm', rpm_data, timestamp)
        logger.debug(f"[{state.station_id}] Fan RPM data updated")

class MeterProcessor:
    """
    Processes meter topic data.
    Updates meter1, meter2 values in state.
    """
    
    def __init__(self):
        pass
    
    def process(self, state: StationState, meter_data: Dict[str, Any],
                timestamp: Optional[datetime] = None):
        """Process meter data from MQTT"""
        if timestamp is None:
            timestamp = now_tz()
        
        meter1 = meter_data.get('meter1', 0)
        meter2 = meter_data.get('meter2', 0)
        
        state.set_meter_data(meter1, meter2)
        logger.info(f"[{state.station_id}] Meter updated: meter1={meter1}, meter2={meter2}")