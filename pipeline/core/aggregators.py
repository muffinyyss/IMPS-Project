#core\aggregators.py
"""
Aggregators

Combines data from multiple MQTT topics before processing.
Replaces the Node-RED aggregator flows.

Option A: Trigger every 120 seconds using latest available data.
If a source hasn't sent data, use the last known value.
"""
import logging
import threading
import time
from typing import Dict, Optional, Any, Callable
from datetime import datetime
from dataclasses import dataclass, field

from utils import now_tz

logger = logging.getLogger(__name__)


# Default timeout for aggregation (120 seconds)
DEFAULT_TIMEOUT = 120


@dataclass
class AggregatedData:
    """Container for aggregated data from multiple sources"""
    data: Dict[str, Any] = field(default_factory=dict)
    last_update: Optional[datetime] = None
    
    def update(self, key: str, value: Any, ts: Optional[datetime] = None):
        """Update a specific source"""
        if ts is None:
            ts = now_tz()
        self.data[key] = value
        self.last_update = ts
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get value from a source"""
        return self.data.get(key, default)
    
    def clear(self):
        """Clear all data"""
        self.data.clear()
        self.last_update = None


class BaseAggregator:
    """
    Base class for aggregators.
    Triggers callback every timeout_seconds using latest available data.
    """
    
    def __init__(self, name: str, timeout_seconds: int = DEFAULT_TIMEOUT):
        self.name = name
        self.timeout_seconds = timeout_seconds
        self._data = AggregatedData()
        self._lock = threading.RLock()
        self._callback: Optional[Callable] = None
        self._last_trigger: Optional[datetime] = None
    
    def set_callback(self, callback: Callable):
        """Set callback to be called when aggregation is ready"""
        self._callback = callback
    
    def update(self, source_key: str, data: Any, ts: Optional[datetime] = None):
        """Update data from a source - stores latest value"""
        with self._lock:
            if ts is None:
                ts = now_tz()
            self._data.update(source_key, data, ts)
            self._check_and_trigger(ts)
    
    def _check_and_trigger(self, now: datetime):
        """Check if should trigger based on timeout"""
        # First time - trigger immediately
        if self._last_trigger is None:
            self._trigger_callback(now)
            return
        
        # Check timeout
        elapsed = (now - self._last_trigger).total_seconds()
        if elapsed >= self.timeout_seconds:
            self._trigger_callback(now)
    
    def _trigger_callback(self, now: datetime):
        """Trigger the callback with aggregated data"""
        if self._callback:
            try:
                self._callback(self.get_aggregated_data())
                self._last_trigger = now
                logger.debug(f"[{self.name}] Triggered callback")
            except Exception as e:
                logger.error(f"[{self.name}] Callback error: {e}")
    
    def get_aggregated_data(self) -> Dict[str, Any]:
        """Get the aggregated data (latest values from all sources)"""
        with self._lock:
            return dict(self._data.data)


class CBMAggregator(BaseAggregator):
    """
    CBM Aggregator - combines:
    - MDB (mdbRaw topic) → MDB: {ambient_temp, ambient_rt}
    - Ambient (ambient topic) → Ambient: {ambient_temp, humidity}
    - EBTemp (ebTemp topic) → EBTemp: {eb_temp}
    - Router (router topic) → Luang3: {rt_temp, rssi}
    
    Triggers every 120 seconds using latest available data.
    Output: monitorCBM, module3, module6
    """
    
    def __init__(self, station_id: str, timeout_seconds: int = DEFAULT_TIMEOUT):
        super().__init__(f"CBM_{station_id}", timeout_seconds)
        self.station_id = station_id
    
    def update_mdb(self, mdb_data: Dict[str, Any], ts: Optional[datetime] = None):
        """Update from MDB topic"""
        extracted = {
            'ambient_temp': mdb_data.get('Ambient_Temp'),
            'ambient_rt': mdb_data.get('Ambient_RH')
        }
        self.update('MDB', extracted, ts)
    
    
    def update_bme280(self, bme280_data: Dict[str, Any], ts: Optional[datetime] = None):
        """
        Update from bme280 topic.
        BME280 now provides ambient_temp, humidity, AND pressure.
        Replaces the old ambient topic.
        """
        # Extract all data from bme280
        ambient_temp = bme280_data.get('temp_c', bme280_data.get('temperature'))
        humidity = bme280_data.get('rh_pct', bme280_data.get('humidity'))
        pressure = bme280_data.get('pressure_hpa', bme280_data.get('pressure'))
        
        # Update Ambient (for CBM documents)
        self.update('Ambient', {
            'ambient_temp': ambient_temp,
            'humidity': humidity
        }, ts)
        
        # Update BME280 (for pressure)
        self.update('BME280', {
            'pressure': pressure
        }, ts)
        
    def update_eb_temp(self, eb_data: Dict[str, Any], ts: Optional[datetime] = None):
        """Update from edgebox temp topic"""
        extracted = {
            'eb_temp': eb_data.get('edgeboxTemp', eb_data.get('eb_temp', eb_data.get('temperature')))
        }
        self.update('EBTemp', extracted, ts)
    
    def update_router(self, router_data: Dict[str, Any], ts: Optional[datetime] = None):
        """Update from router topic"""
        # ดึงจาก Status object
        status = router_data.get('Status', {})
        extracted = {
            'rt_temp': status.get('temp', 0),   # temp อยู่ใน Status
            'rssi': status.get('rssi', 0)       # rssi อยู่ใน Status
        }
        self.update('Router', extracted, ts)
    
    def get_aggregated_data(self) -> Dict[str, Any]:
        """Get CBM aggregated data - uses latest values or empty dict"""
        with self._lock:
            return {
                'MDB': self._data.get('MDB') or {},
                'Ambient': self._data.get('Ambient') or {},
                'EBTemp': self._data.get('EBTemp') or {},
                'Router': self._data.get('Router') or {}   # ✅
            }


class InsulationAggregator(BaseAggregator):
    """
    Insulation Aggregator - combines:
    - insulation1 (slave3) → {RF_kohm, is_alarm}
    - insulation2 (slave4) → {RF_kohm, is_alarm}
    
    Triggers every 120 seconds using latest available data.
    Used for: settingParameter insulation fields
    """
    
    def __init__(self, station_id: str, timeout_seconds: int = DEFAULT_TIMEOUT):
        super().__init__(f"Insulation_{station_id}", timeout_seconds)
        self.station_id = station_id
    
    def update_insulation1(self, data: Dict[str, Any], ts: Optional[datetime] = None):
        """Update from insulation1 topic"""
        values = data.get('data', {}).get('values', {})
        alarm = data.get('data', {}).get('alarm', {})
        
        extracted = {
            'RF_kohm': values.get('RF_kohm'),
            'is_alarm': alarm.get('is_alarm', False)
        }
        self.update('insulation1', extracted, ts)

    def update_insulation2(self, data: Dict[str, Any], ts: Optional[datetime] = None):
        """Update from insulation2 topic"""
        values = data.get('data', {}).get('values', {})
        alarm = data.get('data', {}).get('alarm', {})
        
        extracted = {
            'RF_kohm': values.get('RF_kohm'),
            'is_alarm': alarm.get('is_alarm', False)
        }
        self.update('insulation2', extracted, ts)
    
    def get_aggregated_data(self) -> Dict[str, Any]:
        """Get insulation aggregated data - uses latest values or empty dict"""
        with self._lock:
            return {
                'insulation1': self._data.get('insulation1') or {},
                'insulation2': self._data.get('insulation2') or {}
            }


class Module2Aggregator(BaseAggregator):
    """
    Module2 Aggregator - combines:
    - Ambient (slave5) → {ambient_temp, humidity}
    - BME280 → {pressure}
    - Router → {rt_temp}
    - EBTemp → {eb_temp}
    
    Triggers every 120 seconds using latest available data.
    Output: module2ChargerDustPrediction
    """
    
    def __init__(self, station_id: str, timeout_seconds: int = DEFAULT_TIMEOUT):
        super().__init__(f"Module2_{station_id}", timeout_seconds)
        self.station_id = station_id
    
    def update_ambient(self, data: Dict[str, Any], ts: Optional[datetime] = None):
        """Update from ambient topic"""
        extracted = {
            'ambient_temp': data.get('temperature', data.get('temp')),
            'humidity': data.get('humidity', data.get('rh'))
        }
        self.update('Ambient', extracted, ts)
    
    def update_bme280(self, data: Dict[str, Any], ts: Optional[datetime] = None):
        """
        Update from bme280 topic.
        BME280 provides ambient_temp, humidity, AND pressure.
        """
        ambient_temp = data.get('temp_c', data.get('temperature'))
        humidity = data.get('rh_pct', data.get('humidity'))
        pressure = data.get('pressure_hpa', data.get('pressure'))
        
        # Update Ambient
        self.update('Ambient', {
            'ambient_temp': ambient_temp,
            'humidity': humidity
        }, ts)
        
        # Update BME280
        self.update('BME280', {
            'pressure': pressure
        }, ts)
        
        # Update BME280
        self.update('BME280', {
            'pressure': pressure
        }, ts)
    
    def update_router(self, data: Dict[str, Any], ts: Optional[datetime] = None):
        """Update from router topic"""
        # ดึงจาก Status object
        status = data.get('Status', {})
        extracted = {
            'rt_temp': status.get('temp', 0)    # temp อยู่ใน Status
        }
        self.update('Router', extracted, ts)

    
    def update_eb_temp(self, data: Dict[str, Any], ts: Optional[datetime] = None):
        """Update from edgebox temp topic"""
        extracted = {
            'eb_temp': data.get('edgeboxTemp', data.get('eb_temp', data.get('temperature')))
        }
        self.update('EBTemp', extracted, ts)
    
    def get_aggregated_data(self) -> Dict[str, Any]:
        """Get module2 aggregated data - uses latest values or empty dict"""
        with self._lock:
            return {
                'Ambient': self._data.get('Ambient') or {},
                'BME280': self._data.get('BME280') or {},
                'Router': self._data.get('Router') or {},
                'EBTemp': self._data.get('EBTemp') or {}
            }


class AggregatorManager:
    """
    Manages all aggregators for a station.
    All aggregators use 120 second timeout by default.
    """
    
    def __init__(self, station_id: str, timeout_seconds: int = DEFAULT_TIMEOUT):
        self.station_id = station_id
        
        self.cbm = CBMAggregator(station_id, timeout_seconds)
        self.insulation = InsulationAggregator(station_id, timeout_seconds)
        self.module2 = Module2Aggregator(station_id, timeout_seconds)
    
    def set_cbm_callback(self, callback: Callable):
        """Set CBM aggregator callback"""
        self.cbm.set_callback(callback)
    
    def set_insulation_callback(self, callback: Callable):
        """Set insulation aggregator callback"""
        self.insulation.set_callback(callback)
    
    def set_module2_callback(self, callback: Callable):
        """Set module2 aggregator callback"""
        self.module2.set_callback(callback)
