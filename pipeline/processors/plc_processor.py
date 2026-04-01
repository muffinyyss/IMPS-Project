"""
PLC Processor

Processes MQTT messages from PLC topic and writes to multiple MongoDB collections.
"""
import logging
from typing import Optional, Dict, Any
from datetime import datetime

from core.state_manager import StationState
from core.mongodb_client import MongoDBClient
from models.schemas import (
    create_plc_document,
    create_setting_document, 
    create_utilization_document,
    create_module5_document,
    create_module7_document
)
from utils import now_tz

logger = logging.getLogger(__name__)


class PLCProcessor:
    """
    Processes PLC topic data.
    
    Writes to:
    - PLC
    - settingParameter
    - utilizationFactor
    - module5NetworkProblemPrediction
    - module7ChargerPowerIssue
    
    Also updates state:
    - Counters (DC, AC, Motor Starter)
    - Timers (FUSE, DC Fan, Power Module)
    - Service Life (PLC status, HMI status, Energy Meter LEM)
    """
    
    def __init__(self, mongodb: MongoDBClient):
        self.mongodb = mongodb
    
    def process(self, state: StationState, plc_data: Dict[str, Any], 
                timestamp: Optional[datetime] = None):
        """Process PLC data"""
        if timestamp is None:
            timestamp = now_tz()
        
        station_id = state.station_id
        serial_number = state.serial_number
        ts_str = plc_data.get("timestamp", timestamp.isoformat())
        
        # Update latest data
        state.update_latest('plc', plc_data, timestamp)
        
        # Update all state calculations
        state.update_counters_from_plc(plc_data, timestamp)
        state.update_timers_from_plc(plc_data, timestamp)
        state.update_service_life_from_plc(plc_data, timestamp)
        
        # === เพิ่ม: Update PLC ambient data to aggregators (PRIMARY source) ===
        state.aggregators.cbm.update_plc_ambient(plc_data, timestamp)
        state.aggregators.module2.update_plc_ambient(plc_data, timestamp)

        # Update insulation data from PLC (PRIMARY source)
        state.aggregators.insulation.update_plc_insulation(plc_data, timestamp)
        
        # --- Write to PLC collection ---
        plc_doc = create_plc_document(plc_data, ts_str)
        if not state.check_duplicate('plc', plc_doc):
            self.mongodb.insert_one('plc', serial_number, plc_doc)
            logger.debug(f"[{station_id}] Inserted PLC document")
        else:
            logger.debug(f"[{station_id}] Skipped duplicate PLC")
        
        # --- Write to settingParameter ---
        # Get insulation data if available
        insulation_data = state.get_latest('insulationAgg')
        setting_doc = create_setting_document(plc_data, insulation_data, ts_str)
        if not state.check_duplicate('setting', setting_doc):
            self.mongodb.insert_one('setting', serial_number, setting_doc)
            logger.debug(f"[{station_id}] Inserted settingParameter document")
        else:
            logger.debug(f"[{station_id}] Skipped duplicate settingParameter")
        
        # --- Write to utilizationFactor ---
        util_doc = create_utilization_document(state, ts_str)
        if not state.check_duplicate('utilization', util_doc):
            self.mongodb.insert_one('utilization', serial_number, util_doc)
            logger.debug(f"[{station_id}] Inserted utilizationFactor document")
        else:
            logger.debug(f"[{station_id}] Skipped duplicate utilizationFactor")
        
        # --- Write to module5 ---
        module5_doc = create_module5_document(state, ts_str)
        if not state.check_duplicate('module5', module5_doc):
            self.mongodb.insert_one('module5', serial_number, module5_doc)
            logger.debug(f"[{station_id}] Inserted module5 document")
        else:
            logger.debug(f"[{station_id}] Skipped duplicate module5")
        
        # --- Write to module7 ---
        module7_doc = create_module7_document(state, ts_str)
        if not state.check_duplicate('module7', module7_doc):
            self.mongodb.insert_one('module7', serial_number, module7_doc)
            logger.debug(f"[{station_id}] Inserted module7 document")
        else:
            logger.debug(f"[{station_id}] Skipped duplicate module7")
