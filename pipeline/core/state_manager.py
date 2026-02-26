"""
State Manager

Manages state for each station including:
- Counters (DC, AC, Motor Starter)
- Timers (FUSE, DC Fan, Power Module)
- Service Life
- Latest data from topics
- Deduplication hashes
"""
import logging
import threading
from typing import Dict, Optional, Any
from datetime import datetime
from dataclasses import dataclass, field

from config import StationConfig
from calculations import CounterManager, TimerManager, ServiceLifeManager
from utils import calculate_initial_seconds, stable_hash, now_tz

logger = logging.getLogger(__name__)


@dataclass
class LatestData:
    """Stores latest data from a topic"""
    data: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None
    
    def update(self, data: Dict[str, Any], ts: Optional[datetime] = None):
        self.data = data
        self.timestamp = ts if ts else now_tz()


class StationState:
    """
    Manages all state for a single station.
    Thread-safe with lock.
    """
    
    def __init__(self, config: StationConfig):
        self.config = config
        self.station_id = config.station_id  # เปลี่ยนจาก stationId
        self.serial_number = config.serial_number  # เปลี่ยนจาก serialNumber
        self._meter_data: Dict[str, Any] = {'meter1': 0, 'meter2': 0}
        self._meter_initialized: bool = False
        
        self._lock = threading.RLock()
        
        # Calculate initial service life seconds
        initial_seconds = calculate_initial_seconds(
            config.service_life.commit_date,  # เปลี่ยนจาก serviceLife.commitDate
            config.service_life.end_date  # เปลี่ยนจาก serviceLife.endDate
        )
        logger.info(f"[{self.station_id}] Initial service life: {initial_seconds} seconds")
        
        # Initialize managers
        self.counters = CounterManager(config.hardware)
        self.timers = TimerManager(config.hardware)
        self.service_life = ServiceLifeManager(
            initial_seconds=initial_seconds,
            hardware_config=config.hardware
        )
        
        # Latest data from each topic
        self.latest: Dict[str, LatestData] = {
            'plc': LatestData(),
            'mdb': LatestData(),
            'router': LatestData(),
            'pi5_heartbeat': LatestData(),
            'eb_heartbeat': LatestData(),
            'eb_temp': LatestData(),
            'eb_error': LatestData(),
            'ambient': LatestData(),
            'bme280': LatestData(),
            'insulation1': LatestData(),
            'insulation2': LatestData(),
            'fan_rpm': LatestData(),
            'cbm': LatestData(),
            'module2_agg': LatestData(),
            'insulation_agg': LatestData()
        }
        
        # Deduplication hashes per collection
        self.hashes: Dict[str, Optional[str]] = {
            'plc': None,
            'setting': None,
            'utilization': None,
            'mdb': None,
            'cbm': None,
            'module1': None,
            'module2': None,
            'module3': None,
            'module4': None,
            'module5': None,
            'module6': None,
            'module7': None
        }
        
        # PMReport data (loaded from MongoDB)
        self.pm_date: Optional[str] = None
        self.dust_filter_enabled: bool = False
        
        # Start base service life tracking
        self.service_life.start_all()
    
    def update_latest(self, topic_key: str, data: Dict[str, Any], 
                      ts: Optional[datetime] = None):
        """Thread-safe update of latest data"""
        with self._lock:
            if topic_key in self.latest:
                self.latest[topic_key].update(data, ts)
    
    def get_latest(self, topic_key: str) -> Optional[Dict[str, Any]]:
        """Thread-safe get latest data"""
        with self._lock:
            if topic_key in self.latest:
                return self.latest[topic_key].data
            return None
    
    def get_latest_timestamp(self, topic_key: str) -> Optional[datetime]:
        """Thread-safe get latest timestamp"""
        with self._lock:
            if topic_key in self.latest:
                return self.latest[topic_key].timestamp
            return None
    
    def set_meter_data(self, meter1: int, meter2: int):
        """Set meter data from MQTT or recovery"""
        self._meter_data = {'meter1': meter1, 'meter2': meter2}
        self._meter_initialized = True

    def get_meter_data(self) -> Dict[str, int]:
        """Get current meter data"""
        return self._meter_data.copy()

    def is_meter_initialized(self) -> bool:
        """Check if meter data has been initialized"""
        return self._meter_initialized

    def check_duplicate(self, collection: str, data: Dict[str, Any]) -> bool:
        """
        Check if data is duplicate.
        
        Returns:
            True if duplicate (should skip), False if new data
        """
        with self._lock:
            new_hash = stable_hash(data)
            old_hash = self.hashes.get(collection)
            
            if new_hash == old_hash:
                return True  # Duplicate
            
            self.hashes[collection] = new_hash
            return False  # New data
    
    def update_counters_from_plc(self, plc_data: Dict[str, Any], 
                                  now: Optional[datetime] = None):
        """Update all counters from PLC data"""
        with self._lock:
            if now is None:
                now = now_tz()
            
            # DC Contractors
            for i in range(1, self.config.hardware.dc_contractor_count + 1):  # เปลี่ยน
                key = f"DCConType{i}"
                if key in plc_data:
                    self.counters.update_dc(i, plc_data[key])
            
            # AC Contractors
            if 'ACMagStatus1' in plc_data:
                self.counters.update_ac(1, plc_data['ACMagStatus1'])
            if 'ACMagStatus2' in plc_data:
                self.counters.update_ac(2, plc_data['ACMagStatus2'])
            
            # Motor Starters (with gate logic)
            icp1 = plc_data.get('icp1', 0)
            usl1 = plc_data.get('usl1', 0)
            icp2 = plc_data.get('icp2', 0)
            usl2 = plc_data.get('usl2', 0)
            
            ms1_val = plc_data.get('activeMld1', self.config.hardware.power_module_defaults.get('pm1', 2))  # เปลี่ยน
            ms2_val = plc_data.get('activeMld2', self.config.hardware.power_module_defaults.get('pm2', 3))  # เปลี่ยน
            
            self.counters.update_motor_starter(1, ms1_val, icp1, usl1, now)
            self.counters.update_motor_starter(2, ms2_val, icp2, usl2, now)
    
    def update_timers_from_plc(self, plc_data: Dict[str, Any], 
                                now: Optional[datetime] = None):
        """Update all timers from PLC data"""
        with self._lock:
            if now is None:
                now = now_tz()
            
            icp1 = plc_data.get('icp1', 0)
            usl1 = plc_data.get('usl1', 0)
            icp2 = plc_data.get('icp2', 0)
            usl2 = plc_data.get('usl2', 0)
            
            # FUSE timers
            self.timers.update_fuse(1, icp1, usl1, now)
            self.timers.update_fuse(2, icp2, usl2, now)
            
            # DC Fan timers
            self.timers.update_dc_fans(icp1, usl1, icp2, usl2, now)
            
            # Power Module tracker
            dc1 = plc_data.get('DCConType1', 0)
            dc2 = plc_data.get('DCConType2', 0)
            dc3 = plc_data.get('DCConType3', 0)
            dc4 = plc_data.get('DCConType4', 0)
            dc5 = plc_data.get('DCConType5', 0)
            dc6 = plc_data.get('DCConType6', 0)
            
            self.timers.update_power_modules(dc1, dc2, dc3, dc4, dc5, dc6, now)
    
    def update_service_life_from_plc(self, plc_data: Dict[str, Any], 
                                      now: Optional[datetime] = None):
        """Update service life status from PLC data"""
        with self._lock:
            if now is None:
                now = now_tz()
            
            # PLC status
            if 'PLC1_status' in plc_data:
                self.service_life.update_plc_status(1, plc_data['PLC1_status'], now)
            if 'PLC2_status' in plc_data:
                self.service_life.update_plc_status(2, plc_data['PLC2_status'], now)
            
            # HMI status
            if 'HMI_status' in plc_data:
                self.service_life.update_hmi_status(plc_data['HMI_status'], now)
            
            # Energy meter (LEM type)
            if self.config.hardware.energy_meter_type.upper() == 'LEM':  # เปลี่ยน
                if 'LEM1_status' in plc_data:
                    self.service_life.update_energy_meter_lem(1, plc_data['LEM1_status'])
                if 'LEM2_status' in plc_data:
                    self.service_life.update_energy_meter_lem(2, plc_data['LEM2_status'])
    
    def update_heartbeat(self, device: str, now: Optional[datetime] = None):
        """Update heartbeat for a device"""
        with self._lock:
            self.service_life.update_heartbeat(device, now)
    
    def update_energy_meter_from_error(self, error_data: Dict[str, Any], 
                                        now: Optional[datetime] = None):
        """Update energy meter status from error topic (PILOT type)"""
        with self._lock:
            if self.config.hardware.energy_meter_type.upper() == 'PILOT':  # เปลี่ยน
                self.service_life.update_energy_meter_pilot(error_data, now)
    
    def get_fan_rpm(self, fan_num: int) -> float:
        """Get fan RPM based on fan type"""
        with self._lock:
            if self.config.hardware.fan_type.upper() == 'EBM':  # เปลี่ยน
                # Get from fan_rpm topic
                rpm_data = self.latest['fan_rpm'].data
                if rpm_data:
                    key = f"FAN {fan_num}"
                    return float(rpm_data.get(key, 0))
                return 0.0
            else:
                # FIXED type - 3500 if fan is on, else 0
                plc_data = self.latest['plc'].data
                if plc_data:
                    fan_status = plc_data.get('fan_status1_8', '0')
                    return 3500.0 if str(fan_status) == '1' else 0.0
                return 0.0
    
    def get_all_fan_rpm(self) -> Dict[str, float]:
        """Get all fan RPMs"""
        result = {}
        for i in range(1, self.config.hardware.dc_fan_count + 1):  # เปลี่ยน
            result[f'fan{i}'] = self.get_fan_rpm(i)
        return result
    
    def get_power_module_status(self, pm_num: int) -> str:
        """Get power module status based on activeMld values"""
        with self._lock:
            plc_data = self.latest['plc'].data
            if not plc_data:
                return "Inactive"
            
            mld1 = str(plc_data.get('activeMld1', '0'))
            mld2 = str(plc_data.get('activeMld2', '0'))
            
            # PM1, PM2 based on activeMld1
            if pm_num in [1, 2]:
                if mld1 == '2':
                    return "Active"
                elif mld1 == '1' and pm_num == 1:
                    return "Active"
                return "Inactive"
            
            # PM3, PM4, PM5 based on activeMld2
            if pm_num in [3, 4, 5]:
                if mld2 == '3':
                    return "Active"
                elif mld2 == '2' and pm_num in [3, 4]:
                    return "Active"
                elif mld2 == '1' and pm_num == 3:
                    return "Active"
                return "Inactive"
            
            return "Inactive"
    
    def get_surge_status(self) -> str:
        """Get surge protection status"""
        with self._lock:
            plc_data = self.latest['plc'].data
            if not plc_data:
                return "Inactive"
            
            surge = plc_data.get('surge', '')
            return "Active" if str(surge) == '1' else "Inactive"
    
    def get_router_internet_status(self) -> str:
        """Get router internet connection status"""
        with self._lock:
            status = self.service_life.get_heartbeat_status('router')
            return "Connected" if status == "Active" else "Disconnected"


class StateManager:
    """
    Manages states for all stations.
    """
    
    def __init__(self):
        self.stations: Dict[str, StationState] = {}
        self._lock = threading.RLock()
    
    def add_station(self, config: StationConfig) -> StationState:
        """Add a new station"""
        with self._lock:
            state = StationState(config)
            self.stations[config.station_id] = state  # เปลี่ยน
            logger.info(f"Added station state: {config.station_id}")  # เปลี่ยน
            return state
    
    def get_station(self, station_id: str) -> Optional[StationState]:
        """Get station state by ID"""
        with self._lock:
            return self.stations.get(station_id)
    
    def get_all_stations(self) -> Dict[str, StationState]:
        """Get all station states"""
        with self._lock:
            return dict(self.stations)
    
    def find_station_by_topic(self, topic: str) -> Optional[StationState]:
        """Find station that subscribes to this topic"""
        with self._lock:
            for station_id, state in self.stations.items():
                topics = state.config.topics
                all_topics = topics.get_all_topics()
                if topic in all_topics:
                    return state
            return None