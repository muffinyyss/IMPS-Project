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
    - PLC (plc topic) → PLCAmbient: {ambient_temp, humidity, pressure} [PRIMARY]
    - BME280 (bme280 topic) → BME280Ambient: {ambient_temp, humidity, pressure} [FALLBACK]
    - EBTemp (ebTemp topic) → EBTemp: {eb_temp}
    - Router (router topic) → Router: {rt_temp, rssi}
    
    Triggers every 120 seconds using latest available data.
    """
    
    def __init__(self, station_id: str, timeout_seconds: int = DEFAULT_TIMEOUT):
        super().__init__(f"CBM_{station_id}", timeout_seconds)
        self.station_id = station_id
        self._has_plc_ambient = False  # Flag to track if PLC has ambient keys
    
    def update_mdb(self, mdb_data: Dict[str, Any], ts: Optional[datetime] = None):
        """Update from MDB topic"""
        extracted = {
            'ambient_temp': mdb_data.get('Ambient_Temp'),
            'ambient_rt': mdb_data.get('Ambient_RH')
        }
        self.update('MDB', extracted, ts)
    
    def update_plc_ambient(self, plc_data: Dict[str, Any], ts: Optional[datetime] = None):
        """
        Update ambient data from PLC topic (PRIMARY source).
        Only updates if PLC has ambient keys.
        """
        # Check if PLC has ambient keys (not checking value, just key existence)
        has_ambient = 'ambientTemp' in plc_data
        
        if has_ambient:
            self._has_plc_ambient = True
            self.update('Ambient', {
                'ambient_temp': plc_data.get('ambientTemp'),
                'humidity': plc_data.get('ambientHum')
            }, ts)
            self.update('BME280', {
                'pressure': plc_data.get('ambientPressure')
            }, ts)
            
            # Also store PLC temps
            self.update('PLCTemp', {
                'plcTemp1': plc_data.get('plcTemp1'),
                'plcTemp2': plc_data.get('plcTemp2'),
                'plcHum1': plc_data.get('plcHum1'),
                'plcHum2': plc_data.get('plcHum2')
            }, ts)
        else:
            self._has_plc_ambient = False
    
    def update_bme280(self, bme280_data: Dict[str, Any], ts: Optional[datetime] = None):
        """
        Update from bme280 topic (FALLBACK source).
        Only used if PLC doesn't have ambient keys.
        """
        ambient_temp = bme280_data.get('temp_c', bme280_data.get('temperature'))
        humidity = bme280_data.get('rh_pct', bme280_data.get('humidity'))
        pressure = bme280_data.get('pressure_hpa', bme280_data.get('pressure'))
        
        # Store as BME280 source (will be used in fallback)
        self.update('BME280Fallback', {
            'ambient_temp': ambient_temp,
            'humidity': humidity,
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
        status = router_data.get('Status', {})
        extracted = {
            'rt_temp': status.get('temp', 0),
            'rssi': status.get('rssi', 0)
        }
        self.update('Router', extracted, ts)
    
    def get_aggregated_data(self) -> Dict[str, Any]:
        """
        Get CBM aggregated data.
        Priority: PLC ambient > BME280 ambient
        """
        with self._lock:
            # Get primary data (from PLC)
            ambient = self._data.get('Ambient') or {}
            bme280 = self._data.get('BME280') or {}
            
            # Get fallback data (from BME280 topic)
            bme280_fallback = self._data.get('BME280Fallback') or {}
            
            # Fallback logic: if PLC doesn't have ambient, use BME280
            if not self._has_plc_ambient and bme280_fallback:
                ambient = {
                    'ambient_temp': bme280_fallback.get('ambient_temp'),
                    'humidity': bme280_fallback.get('humidity')
                }
                bme280 = {
                    'pressure': bme280_fallback.get('pressure')
                }
                logger.debug(f"[{self.name}] Using BME280 topic data (fallback)")
            
            return {
                'MDB': self._data.get('MDB') or {},
                'Ambient': ambient,
                'BME280': bme280,
                'EBTemp': self._data.get('EBTemp') or {},
                'Router': self._data.get('Router') or {},
                'PLCTemp': self._data.get('PLCTemp') or {}
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
    - PLC (plc topic) → Ambient + BME280 [PRIMARY]
    - BME280 (bme280 topic) → BME280Fallback [FALLBACK]
    - Router → {rt_temp}
    - EBTemp → {eb_temp}
    
    Triggers every 120 seconds using latest available data.
    """
    
    def __init__(self, station_id: str, timeout_seconds: int = DEFAULT_TIMEOUT):
        super().__init__(f"Module2_{station_id}", timeout_seconds)
        self.station_id = station_id
        self._has_plc_ambient = False
    
    def update_plc_ambient(self, plc_data: Dict[str, Any], ts: Optional[datetime] = None):
        """
        Update ambient data from PLC topic (PRIMARY source).
        """
        has_ambient = 'ambientTemp' in plc_data
        
        if has_ambient:
            self._has_plc_ambient = True
            self.update('Ambient', {
                'ambient_temp': plc_data.get('ambientTemp'),
                'humidity': plc_data.get('ambientHum')
            }, ts)
            self.update('BME280', {
                'pressure': plc_data.get('ambientPressure')
            }, ts)
        else:
            self._has_plc_ambient = False
    
    def update_bme280(self, bme280_data: Dict[str, Any], ts: Optional[datetime] = None):
        """
        Update from bme280 topic (FALLBACK source).
        """
        ambient_temp = bme280_data.get('temp_c', bme280_data.get('temperature'))
        humidity = bme280_data.get('rh_pct', bme280_data.get('humidity'))
        pressure = bme280_data.get('pressure_hpa', bme280_data.get('pressure'))
        
        self.update('BME280Fallback', {
            'ambient_temp': ambient_temp,
            'humidity': humidity,
            'pressure': pressure
        }, ts)
    
    def update_ambient(self, data: Dict[str, Any], ts: Optional[datetime] = None):
        """Legacy method - redirects to bme280 fallback"""
        self.update_bme280(data, ts)
    
    def update_router(self, data: Dict[str, Any], ts: Optional[datetime] = None):
        """Update from router topic"""
        status = data.get('Status', {})
        extracted = {
            'rt_temp': status.get('temp', 0)
        }
        self.update('Router', extracted, ts)
    
    def update_eb_temp(self, data: Dict[str, Any], ts: Optional[datetime] = None):
        """Update from edgebox temp topic"""
        extracted = {
            'eb_temp': data.get('edgeboxTemp', data.get('eb_temp', data.get('temperature')))
        }
        self.update('EBTemp', extracted, ts)
    
    def get_aggregated_data(self) -> Dict[str, Any]:
        """
        Get module2 aggregated data.
        Priority: PLC ambient > BME280 ambient
        """
        with self._lock:
            # Get primary data (from PLC)
            ambient = self._data.get('Ambient') or {}
            bme280 = self._data.get('BME280') or {}
            
            # Get fallback data (from BME280 topic)
            bme280_fallback = self._data.get('BME280Fallback') or {}
            
            # Fallback logic
            if not self._has_plc_ambient and bme280_fallback:
                ambient = {
                    'ambient_temp': bme280_fallback.get('ambient_temp'),
                    'humidity': bme280_fallback.get('humidity')
                }
                bme280 = {
                    'pressure': bme280_fallback.get('pressure')
                }
                logger.debug(f"[{self.name}] Using BME280 topic data (fallback)")
            
            return {
                'Ambient': ambient,
                'BME280': bme280,
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
        self.timeout_seconds = timeout_seconds
        
        self.cbm = CBMAggregator(station_id, timeout_seconds)
        self.insulation = InsulationAggregator(station_id, timeout_seconds)
        self.module2 = Module2Aggregator(station_id, timeout_seconds)
    
    def set_timeout(self, timeout_seconds: int):
        """Set timeout for all aggregators"""
        self.timeout_seconds = timeout_seconds
        self.cbm.timeout_seconds = timeout_seconds
        self.module2.timeout_seconds = timeout_seconds
        self.insulation.timeout_seconds = timeout_seconds
        
    def set_cbm_callback(self, callback: Callable):
        """Set CBM aggregator callback"""
        self.cbm.set_callback(callback)
    
    def set_insulation_callback(self, callback: Callable):
        """Set insulation aggregator callback"""
        self.insulation.set_callback(callback)
    
    def set_module2_callback(self, callback: Callable):
        """Set module2 aggregator callback"""
        self.module2.set_callback(callback)
