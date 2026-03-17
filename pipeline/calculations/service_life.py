#calculations\service_life.py
"""
Service Life Calculations

Service life tracking for various components.
Includes heartbeat-based status tracking.
"""
import re
from typing import Dict, Optional, Any
from datetime import datetime
from collections import deque


# Default timeout for heartbeat (5 minutes)
DEFAULT_HEARTBEAT_TIMEOUT = 300


class HeartbeatTracker:
    """
    Tracks device status based on heartbeat messages.
    Device is Active if message received within timeout period.
    
    Usage:
        tracker = HeartbeatTracker(timeout_seconds=300)
        tracker.update()  # Call when message received
        status = tracker.get_status()  # "Active" or "Inactive"
    """
    
    def __init__(self, timeout_seconds: int = DEFAULT_HEARTBEAT_TIMEOUT):
        self.timeout_seconds = timeout_seconds
        self.last_seen: Optional[datetime] = None
    
    def update(self, now: Optional[datetime] = None):
        """Update last_seen timestamp when message received"""
        from utils.time_utils import now_tz
        
        if now is None:
            now = now_tz()
        self.last_seen = now
    
    def get_status(self, now: Optional[datetime] = None) -> str:
        """Get current status based on last_seen"""
        from utils.time_utils import now_tz
        
        if self.last_seen is None:
            return "Inactive"
        
        if now is None:
            now = now_tz()
        
        elapsed = (now - self.last_seen).total_seconds()
        return "Active" if elapsed <= self.timeout_seconds else "Inactive"
    
    def is_active(self, now: Optional[datetime] = None) -> bool:
        """Check if device is active"""
        return self.get_status(now) == "Active"


class EnergyMeterStatus:
    """
    Energy Meter status tracker.
    
    For LEM type: Uses status from PLC topic (LEM1_status, LEM2_status)
    For PILOT type: Monitors error topic for "No communication" message
    """
    
    # Error pattern for PILOT meter
    NC_PATTERN = re.compile(r'no\s*communication', re.IGNORECASE)
    NC_THRESHOLD = 3  # Number of NC errors in window
    NC_WINDOW_SEC = 60  # Window size in seconds
    
    def __init__(self, meter_type: str = "PILOT"):
        """
        Args:
            meter_type: "LEM" or "PILOT"
        """
        self.meter_type = meter_type.upper()
        self._nc_times: deque = deque()
        self._last_status = "Active"
    
    def update_from_plc(self, status_value: str) -> str:
        """
        Update status from PLC topic (for LEM type).
        
        Args:
            status_value: Value of LEM1_status or LEM2_status
        
        Returns:
            "Active" or "Inactive"
        """
        self._last_status = status_value if status_value in ["Active", "Inactive"] else "Active"
        return self._last_status
    
    def update_from_error(self, error_data: Optional[Dict[str, Any]], 
                       now: Optional[datetime] = None) -> str:
        """
        Update status from error topic (for PILOT type).
        
        Args:
            error_data: Error message dict with "error" key
            now: Current timestamp
        
        Returns:
            "Active" or "Inactive"
        """
        import time
        
        if now is None:
            t = time.time()
        else:
            t = now.timestamp()
        
        # Check if error contains "No communication"
        error_msg = ""
        if error_data:
            raw_error = error_data.get("error", "")
            # Ensure error_msg is always a string
            if isinstance(raw_error, str):
                error_msg = raw_error
            elif isinstance(raw_error, dict):
                # If error is a dict, try to get message field
                error_msg = str(raw_error.get("message", raw_error.get("msg", "")))
            elif raw_error is not None:
                error_msg = str(raw_error)
        
        is_nc = bool(self.NC_PATTERN.search(error_msg))
        
        if is_nc:
            self._nc_times.append(t)
        
        # Remove old entries outside window
        while self._nc_times and (t - self._nc_times[0] > self.NC_WINDOW_SEC):
            self._nc_times.popleft()
        
        # Frequent NC errors = Inactive
        frequent = len(self._nc_times) >= self.NC_THRESHOLD
        self._last_status = "Inactive" if (is_nc or frequent) else "Active"
        
        return self._last_status
    
    def get_status(self) -> str:
        """Get current status"""
        return self._last_status


class ServiceLifeTracker:
    """
    Tracks service life for a device.
    
    initialSeconds = endDate - commitDate (calculated once)
    After that, adds elapsed time based on device status.
    """
    
    def __init__(self, initial_seconds: int = 0):
        self.total_seconds = float(initial_seconds)
        self.last_update: Optional[datetime] = None
        self.is_running = False
    
    def start(self, now: Optional[datetime] = None):
        """Start tracking (device is active)"""
        from utils.time_utils import now_tz
        
        if now is None:
            now = now_tz()
        
        if not self.is_running:
            self.last_update = now
            self.is_running = True
    
    def stop(self, now: Optional[datetime] = None):
        """Stop tracking (device is inactive)"""
        from utils.time_utils import now_tz
        
        if now is None:
            now = now_tz()
        
        if self.is_running and self.last_update:
            elapsed = (now - self.last_update).total_seconds()
            self.total_seconds += max(0, elapsed)
            self.is_running = False
            self.last_update = None
    
    def update(self, is_active: bool, now: Optional[datetime] = None):
        """Update based on active status"""
        if is_active:
            self.start(now)
        else:
            self.stop(now)
    
    def get_seconds(self, now: Optional[datetime] = None) -> int:
        """Get total seconds including current active period"""
        from utils.time_utils import now_tz
        
        if now is None:
            now = now_tz()
        
        total = self.total_seconds
        
        if self.is_running and self.last_update:
            elapsed = (now - self.last_update).total_seconds()
            total += max(0, elapsed)
        
        return int(total)
    
    def set_seconds(self, seconds: float):
        """Set total seconds (for recovery)"""
        self.total_seconds = float(seconds)


class BaseServiceLife:
    """
    Base service life - just adds time continuously.
    Used for devices that don't have individual status tracking.
    
    These devices use: initialSeconds + elapsed time since start
    """
    
    def __init__(self, initial_seconds: int = 0):
        self.initial_seconds = initial_seconds
        self.start_time: Optional[datetime] = None
    
    def start(self, now: Optional[datetime] = None):
        """Start tracking"""
        from utils.time_utils import now_tz
        
        if now is None:
            now = now_tz()
        
        if self.start_time is None:
            self.start_time = now
    
    def get_seconds(self, now: Optional[datetime] = None) -> int:
        """Get total seconds"""
        from utils.time_utils import now_tz
        
        if now is None:
            now = now_tz()
        
        total = self.initial_seconds
        
        if self.start_time:
            elapsed = (now - self.start_time).total_seconds()
            total += max(0, elapsed)
        
        return int(total)


class ServiceLifeManager:
    """
    Manages all service life tracking for a station.
    """
    
    # Devices with individual status tracking
    TRACKED_DEVICES = ['router', 'edgebox', 'pi5', 'plc1', 'plc2', 'hmi', 
                       'energy_meter1', 'energy_meter2']
    
    # Devices using base service life (continuous)
    BASE_DEVICES = ['fuse_control', 'circuit_breaker_fan', 'rcbo', 'rccb1', 'rccb2',
                    'ocpp_device', 'fan_controller', 'charging_controller1', 
                    'charging_controller2', 'power_supplies', 'insulation_monitoring1',
                    'insulation_monitoring2', 'dc_converter', 'surge_protection',
                    'disconnect_switch', 'noise_filter', 'switching_power_supply']
    
    def __init__(self, initial_seconds: int = 0, hardware_config: Optional[Any] = None):
        """
        Args:
            initial_seconds: Base seconds calculated from commitDate to endDate
            hardware_config: Hardware configuration for meter type etc.
        """
        self.initial_seconds = initial_seconds
        
        # Heartbeat trackers (5 minute timeout)
        self.heartbeats: Dict[str, HeartbeatTracker] = {
            'router': HeartbeatTracker(timeout_seconds=300),
            'edgebox': HeartbeatTracker(timeout_seconds=300),
            'pi5': HeartbeatTracker(timeout_seconds=300),
            'mdb': HeartbeatTracker(timeout_seconds=300)
        }
        
        # Service life trackers for tracked devices
        self.tracked: Dict[str, ServiceLifeTracker] = {}
        for device in self.TRACKED_DEVICES:
            self.tracked[device] = ServiceLifeTracker(initial_seconds)
        
        # Base service life for continuous devices
        self.base: Dict[str, BaseServiceLife] = {}
        for device in self.BASE_DEVICES:
            self.base[device] = BaseServiceLife(initial_seconds)
        
        # Energy meter status
        meter_type = "PILOT"
        if hardware_config:
            meter_type = getattr(hardware_config, 'energyMeterType', 'PILOT')
        
        self.energy_meter1 = EnergyMeterStatus(meter_type)
        self.energy_meter2 = EnergyMeterStatus(meter_type)
    
    def start_all(self, now: Optional[datetime] = None):
        """Start all base service life trackers"""
        for tracker in self.base.values():
            tracker.start(now)
    
    def update_heartbeat(self, device: str, now: Optional[datetime] = None):
        """Update heartbeat for a device"""
        if device in self.heartbeats:
            self.heartbeats[device].update(now)
            
            # Also update service life tracker
            if device in self.tracked:
                self.tracked[device].update(True, now)
    
    def get_heartbeat_status(self, device: str, now: Optional[datetime] = None) -> str:
        """Get status based on heartbeat"""
        if device in self.heartbeats:
            return self.heartbeats[device].get_status(now)
        return "Inactive"
    
    def update_plc_status(self, plc_num: int, status: str, now: Optional[datetime] = None):
        """Update PLC status from PLC topic"""
        device = f"plc{plc_num}"
        if device in self.tracked:
            is_active = (status == "Active")
            self.tracked[device].update(is_active, now)
    
    def update_hmi_status(self, status: str, now: Optional[datetime] = None):
        """Update HMI status from PLC topic"""
        if 'hmi' in self.tracked:
            is_active = (status == "Active")
            self.tracked['hmi'].update(is_active, now)
    
    def update_energy_meter_lem(self, meter_num: int, status: str):
        """Update energy meter status from LEM fields"""
        meter = self.energy_meter1 if meter_num == 1 else self.energy_meter2
        return meter.update_from_plc(status)
    
    def update_energy_meter_pilot(self, error_data: Optional[Dict], now: Optional[datetime] = None):
        """Update energy meter status from PILOT error"""
        # Both meters share same error source for PILOT type
        status = self.energy_meter1.update_from_error(error_data, now)
        self.energy_meter2.update_from_error(error_data, now)
        return status
    
    def get_energy_meter_status(self, meter_num: int) -> str:
        """Get energy meter status"""
        meter = self.energy_meter1 if meter_num == 1 else self.energy_meter2
        return meter.get_status()
    
    def get_service_life_seconds(self, device: str, now: Optional[datetime] = None) -> int:
        """Get service life seconds for a device"""
        if device in self.tracked:
            return self.tracked[device].get_seconds(now)
        if device in self.base:
            return self.base[device].get_seconds(now)
        return self.initial_seconds
    
    def get_all_service_life_seconds(self, now: Optional[datetime] = None) -> Dict[str, int]:
        """Get all service life seconds"""
        result = {}
        
        for device, tracker in self.tracked.items():
            result[device] = tracker.get_seconds(now)
        
        for device, tracker in self.base.items():
            result[device] = tracker.get_seconds(now)
        
        return result
    
    def get_rcbo_status(self) -> str:
        """
        Get RCBO status.
        Active if PLC1 AND PLC2 AND EnergyMeter all Active.
        """
        plc1_active = self.tracked.get('plc1', ServiceLifeTracker()).is_running
        plc2_active = self.tracked.get('plc2', ServiceLifeTracker()).is_running
        em_active = self.energy_meter1.get_status() == "Active"
        
        if plc1_active and plc2_active and em_active:
            return "Active"
        return "Inactive"

    def set_recovered_seconds(self, seconds: int):
        """
        Set recovered seconds from database.
        Replaces initial_seconds with actual accumulated value.
        Used during recovery to restore service life from DB.
        """
        if seconds <= 0:
            return
            
        self.initial_seconds = seconds
        
        # Update all tracked devices
        for device, tracker in self.tracked.items():
            tracker.total_seconds = float(seconds)
            tracker.last_update = None
            tracker.is_running = False
        
        # Update all base devices
        for device, tracker in self.base.items():
            tracker.initial_seconds = seconds
            tracker.start_time = None