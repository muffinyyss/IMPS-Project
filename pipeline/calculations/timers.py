"""
Timer Calculations

Timers for FUSE, DC Fan, and Power Module service life.
"""
from typing import Dict, Optional, Set
from datetime import datetime


class FuseTimer:
    """
    FUSE timer that accumulates time when active.
    Active when icp=7 AND usl=13.
    """
    
    def __init__(self, initial_total_seconds: float = 0.0):
        self.total_seconds = float(initial_total_seconds)
        self.start_time: Optional[datetime] = None
    
    def update(self, icp: any, usl: any, now: Optional[datetime] = None) -> int:
        """
        Update timer based on icp and usl values.
        
        Args:
            icp: icp value
            usl: usl value
            now: Current timestamp (optional)
        
        Returns:
            Current total seconds
        """
        from utils.time_utils import now_tz
        
        if now is None:
            now = now_tz()
        
        is_active = (str(icp) == "7" and str(usl) == "13")
        
        if is_active:
            # Start tracking if not already
            if self.start_time is None:
                self.start_time = now
        else:
            # Stop tracking and accumulate time
            if self.start_time is not None:
                elapsed = (now - self.start_time).total_seconds()
                self.total_seconds += max(0.0, elapsed)
                self.start_time = None
        
        return self.get_seconds(now)
    
    def get_seconds(self, now: Optional[datetime] = None) -> int:
        """Get total seconds including current active period"""
        from utils.time_utils import now_tz
        
        if now is None:
            now = now_tz()
        
        current_total = self.total_seconds
        if self.start_time is not None:
            current_total += (now - self.start_time).total_seconds()
        
        return int(current_total)
    
    def set_seconds(self, seconds: float):
        """Set total seconds (for recovery)"""
        self.total_seconds = float(seconds)


class DCFanTimer:
    """
    DC Fan timer with bonus time on stop.
    Active when either FUSE is active.
    Adds bonus time (default 20 min) when stopping.
    """
    
    def __init__(self, initial_total_seconds: float = 0.0, bonus_minutes: int = 20):
        self.total_seconds = float(initial_total_seconds)
        self.bonus_seconds = bonus_minutes * 60
        self.start_time: Optional[datetime] = None
    
    def update(self, is_active: bool, now: Optional[datetime] = None) -> int:
        """
        Update timer based on active state.
        
        Args:
            is_active: Whether fan should be running
            now: Current timestamp (optional)
        
        Returns:
            Current total seconds
        """
        from utils.time_utils import now_tz
        
        if now is None:
            now = now_tz()
        
        if is_active:
            if self.start_time is None:
                self.start_time = now
        else:
            if self.start_time is not None:
                elapsed = (now - self.start_time).total_seconds()
                self.total_seconds += max(0.0, elapsed) + self.bonus_seconds
                self.start_time = None
        
        return self.get_seconds(now)
    
    def get_seconds(self, now: Optional[datetime] = None) -> int:
        """Get total seconds including current active period"""
        from utils.time_utils import now_tz
        
        if now is None:
            now = now_tz()
        
        current_total = self.total_seconds
        if self.start_time is not None:
            current_total += (now - self.start_time).total_seconds()
        
        return int(current_total)
    
    def set_seconds(self, seconds: float):
        """Set total seconds (for recovery)"""
        self.total_seconds = float(seconds)


class PowerModuleTracker:
    """
    Power Module service life tracker.
    Tracks time for each power module based on DC contractor states.
    
    Mapping:
    - DC1 or DC2 active → PM1, PM2 active
    - DC5 or DC6 active → PM3, PM4, PM5 active
    - DC3 or DC4 active → All PM active
    """
    
    def __init__(self, module_count: int = 5, initial_seconds: Optional[Dict[str, float]] = None):
        self.module_count = module_count
        self.total_seconds: Dict[str, float] = {}
        
        for i in range(1, module_count + 1):
            key = f"pm{i}"
            if initial_seconds and key in initial_seconds:
                self.total_seconds[key] = float(initial_seconds[key])
            else:
                self.total_seconds[key] = 0.0
        
        self.last_ts: Optional[datetime] = None
    
    def update(self, dc1, dc2, dc3, dc4, dc5, dc6, now: Optional[datetime] = None) -> Dict[str, int]:
        """
        Update power module service life based on DC contractor states.
        
        Args:
            dc1-dc6: DC contractor states (0 or 1)
            now: Current timestamp
        
        Returns:
            Dict of power module seconds
        """
        from utils.time_utils import now_tz, parse_int
        
        if now is None:
            now = now_tz()
        
        dc = [
            parse_int(dc1),
            parse_int(dc2),
            parse_int(dc3),
            parse_int(dc4),
            parse_int(dc5),
            parse_int(dc6)
        ]
        
        if self.last_ts is None:
            self.last_ts = now
            return self.get_seconds()
        
        dt = (now - self.last_ts).total_seconds()
        
        # Guard against clock jumps
        if dt < 0 or dt > 6 * 3600:
            dt = 0
        
        self.last_ts = now
        
        # Determine active modules
        active_modules: Set[int] = set()
        
        if dc[0] == 1 or dc[1] == 1:  # DC1 or DC2
            active_modules.update([1, 2])
        
        if dc[4] == 1 or dc[5] == 1:  # DC5 or DC6
            active_modules.update([3, 4, 5])
        
        if dc[2] == 1 or dc[3] == 1:  # DC3 or DC4
            active_modules.update([1, 2, 3, 4, 5])
        
        # Add time to active modules
        for m in active_modules:
            if m <= self.module_count:
                key = f"pm{m}"
                self.total_seconds[key] = self.total_seconds.get(key, 0.0) + dt
        
        return self.get_seconds()
    
    def get_seconds(self) -> Dict[str, int]:
        """Get all power module seconds"""
        return {k: int(v) for k, v in self.total_seconds.items()}
    
    def set_seconds(self, key: str, seconds: float):
        """Set power module seconds (for recovery)"""
        if key in self.total_seconds:
            self.total_seconds[key] = float(seconds)


class TimerManager:
    """
    Manages all timers for a station.
    """
    
    def __init__(self, hardware_config: 'HardwareConfig'):
        self.dc_fan_count = hardware_config.dcFanCount
        self.pm_count = hardware_config.powerModuleCount
        
        # FUSE timers (2)
        self.fuse_timers: Dict[str, FuseTimer] = {
            "fuse1": FuseTimer(),
            "fuse2": FuseTimer()
        }
        
        # DC Fan timers
        self.dc_fan_timers: Dict[str, DCFanTimer] = {}
        for i in range(1, self.dc_fan_count + 1):
            self.dc_fan_timers[f"fan{i}"] = DCFanTimer()
        
        # Power Module tracker
        self.pm_tracker = PowerModuleTracker(module_count=self.pm_count)
        
        # Track combined FUSE state for DC fans
        self.fuse_combined_active = False
    
    def update_fuse(self, fuse_num: int, icp: any, usl: any, 
                    now: Optional[datetime] = None) -> int:
        """Update FUSE timer"""
        key = f"fuse{fuse_num}"
        if key in self.fuse_timers:
            return self.fuse_timers[key].update(icp, usl, now)
        return 0
    
    def update_dc_fans(self, icp1, usl1, icp2, usl2, now: Optional[datetime] = None):
        """
        Update all DC fan timers.
        Active when either FUSE is active.
        """
        fuse1_active = (str(icp1) == "7" and str(usl1) == "13")
        fuse2_active = (str(icp2) == "7" and str(usl2) == "13")
        is_active = fuse1_active or fuse2_active
        
        for timer in self.dc_fan_timers.values():
            timer.update(is_active, now)
        
        self.fuse_combined_active = is_active
    
    def update_power_modules(self, dc1, dc2, dc3, dc4, dc5, dc6, 
                             now: Optional[datetime] = None) -> Dict[str, int]:
        """Update power module tracker"""
        return self.pm_tracker.update(dc1, dc2, dc3, dc4, dc5, dc6, now)
    
    def get_fuse_seconds(self, fuse_num: int, now: Optional[datetime] = None) -> int:
        """Get FUSE timer seconds"""
        key = f"fuse{fuse_num}"
        if key in self.fuse_timers:
            return self.fuse_timers[key].get_seconds(now)
        return 0
    
    def get_dc_fan_seconds(self, fan_num: int, now: Optional[datetime] = None) -> int:
        """Get DC fan timer seconds"""
        key = f"fan{fan_num}"
        if key in self.dc_fan_timers:
            return self.dc_fan_timers[key].get_seconds(now)
        return 0
    
    def get_all_dc_fan_seconds(self, now: Optional[datetime] = None) -> Dict[str, int]:
        """Get all DC fan seconds"""
        return {k: v.get_seconds(now) for k, v in self.dc_fan_timers.items()}
    
    def get_pm_seconds(self) -> Dict[str, int]:
        """Get power module seconds"""
        return self.pm_tracker.get_seconds()
    
    def set_fuse_seconds(self, fuse_num: int, seconds: float):
        """Set FUSE seconds (for recovery)"""
        key = f"fuse{fuse_num}"
        if key in self.fuse_timers:
            self.fuse_timers[key].set_seconds(seconds)
    
    def set_dc_fan_seconds(self, fan_num: int, seconds: float):
        """Set DC fan seconds (for recovery)"""
        key = f"fan{fan_num}"
        if key in self.dc_fan_timers:
            self.dc_fan_timers[key].set_seconds(seconds)
    
    def set_pm_seconds(self, pm_num: int, seconds: float):
        """Set power module seconds (for recovery)"""
        key = f"pm{pm_num}"
        self.pm_tracker.set_seconds(key, seconds)
