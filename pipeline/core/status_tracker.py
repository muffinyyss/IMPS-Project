#core\status_tracker.py
"""
Status Tracker

Tracks device status changes and writes to MongoDB.
Databases: edgeboxStatus, pi5Status, routerStatus
"""
import logging
from typing import Dict, Optional, Any
from datetime import datetime

from config import settings
from utils import now_tz

logger = logging.getLogger(__name__)


class StatusTracker:
    """
    Tracks status changes for edgebox, pi5, router.
    Writes to MongoDB only when status changes (0 ↔ 1).
    """
    
    def __init__(self, mongodb_client: 'MongoDBClient'):
        self.mongodb = mongodb_client
        
        # Track previous status per station per device
        # {station_id: {device: status}}
        self._prev_status: Dict[str, Dict[str, int]] = {}
    
    def _get_status_db(self, device: str):
        """Get the status database for a device"""
        client = self.mongodb._client
        if client is None:
            return None
        
        db_name_map = {
            'edgebox': settings.mongodb.edgebox_status_db,
            'pi5': settings.mongodb.pi5_status_db,
            'router': settings.mongodb.router_status_db
        }
        
        db_name = db_name_map.get(device)
        if db_name:
            return client[db_name]
        return None
    
    def check_and_write(self, station_id: str, serial_number: str, 
                        device: str, current_status: str,
                        timestamp: Optional[datetime] = None):
        """
        Check if status changed and write to MongoDB if so.
        Skip first time (just store value, don't write to DB)
        """
        if timestamp is None:
            timestamp = now_tz()
        
        # Convert to int (1 = Active, 0 = Inactive)
        status_int = 1 if current_status == "Active" else 0
        
        # Initialize station tracking if needed
        if station_id not in self._prev_status:
            self._prev_status[station_id] = {}
        
        # Get previous status
        prev_status = self._prev_status[station_id].get(device)
        
        # First time - just store, don't write to DB
        if prev_status is None:
            self._prev_status[station_id][device] = status_int
            logger.debug(f"[{station_id}] {device} initial status: {status_int} (not writing to DB)")
            return  # ← ไม่เขียน DB ครั้งแรก
        
        # Check if actually changed
        if prev_status != status_int:
            # Status changed - write to MongoDB
            self._write_status(serial_number, station_id, device, status_int, timestamp)
            
            # Update tracking
            self._prev_status[station_id][device] = status_int
            
            logger.info(f"[{station_id}] {device} status changed: {prev_status} → {status_int}")
    
    def _write_status(self, serial_number: str, station_id: str,
                      device: str, status: int, timestamp: datetime):
        """Write status document to MongoDB"""
        try:
            db = self._get_status_db(device)
            if db is None:
                logger.error(f"Status database not available for {device}")
                return
            
            collection = db[serial_number]
            
            doc = {
                "station_id": station_id,
                "status": status,
                "timestamp": timestamp.isoformat()
            }
            
            collection.insert_one(doc)
            logger.debug(f"[{station_id}] Wrote {device} status: {status}")
            
        except Exception as e:
            logger.error(f"[{station_id}] Failed to write {device} status: {e}")
    
    def update_all(self, state: 'StationState', timestamp: Optional[datetime] = None):
        """Update status for all devices for a station"""
        if timestamp is None:
            timestamp = now_tz()
        
        station_id = state.station_id
        serial_number = state.serial_number
        
        # Get current status from service_life
        edgebox_status = state.service_life.get_heartbeat_status('edgebox')
        pi5_status = state.service_life.get_heartbeat_status('pi5')
        router_status = state.service_life.get_heartbeat_status('router')
        
        # Check and write each
        self.check_and_write(station_id, serial_number, 'edgebox', edgebox_status, timestamp)
        self.check_and_write(station_id, serial_number, 'pi5', pi5_status, timestamp)
        self.check_and_write(station_id, serial_number, 'router', router_status, timestamp)