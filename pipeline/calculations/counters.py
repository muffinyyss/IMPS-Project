#calculations\counters.py
"""
Counter Calculations

Edge detection counters for DC Contractor, AC Contractor, and Motor Starter.
"""
from typing import Dict, Any, Optional
from datetime import datetime


class EdgeCounter:
    """
    Simple edge detection counter.
    Counts 0 → 1 transitions.
    """
    
    def __init__(self, initial_state: str = "0", initial_count: int = 0):
        self.prev = str(initial_state)
        self.count = int(initial_count)
    
    def update(self, new_state: Any) -> int:
        """
        Update counter with new state.
        
        Args:
            new_state: New state value (will be converted to string)
        
        Returns:
            Current count after update
        """
        s = str(new_state) if new_state is not None else "0"
        
        # Detect 0 → 1 transition
        if self.prev == "0" and s == "1":
            self.count += 1
        
        self.prev = s
        return self.count
    
    def get_count(self) -> int:
        return self.count
    
    def set_count(self, count: int):
        self.count = int(count)


class PersistEdgeCounter:
    """
    Persistent edge detection counter with threshold.
    Used for Motor Starters - counts when value stays non-default for threshold time.
    """
    
    def __init__(self, default_value: int = 2, threshold_sec: int = 120, initial_count: int = 0):
        self.default_value = default_value
        self.threshold_sec = threshold_sec
        self.state = "idle"
        self.t0: Optional[datetime] = None
        self.count = int(initial_count)
    
    def update(self, raw_value: Any, now: Optional[datetime] = None) -> int:
        """
        Update counter with new value.
        
        Args:
            raw_value: New value
            now: Current timestamp (optional, uses now if not provided)
        
        Returns:
            Current count after update
        """
        from utils.time_utils import now_tz, parse_int
        
        if now is None:
            now = now_tz()
        
        x = parse_int(raw_value)
        if x is None:
            return self.count
        
        # If value is default, reset state
        if x == self.default_value:
            self.state = "idle"
            self.t0 = None
            return self.count
        
        # Value is not default
        if self.state == "idle":
            self.state = "pending"
            self.t0 = now
        elif self.state == "pending":
            if self.t0 and (now - self.t0).total_seconds() >= self.threshold_sec:
                self.count += 1
                self.state = "latched"
        
        return self.count
    
    def get_count(self) -> int:
        return self.count
    
    def set_count(self, count: int):
        self.count = int(count)


class DualTransitionGate:
    """
    Gate that activates when both icp and usl transition to target values.
    Used to determine when motor starter counting should be active.
    """
    
    def __init__(self, icp_from: int = 1, icp_to: int = 7, 
                 usl_from: int = 0, usl_to: int = 13):
        self.icp_from = icp_from
        self.icp_to = icp_to
        self.usl_from = usl_from
        self.usl_to = usl_to
        
        self.prev_icp: Optional[int] = None
        self.prev_usl: Optional[int] = None
        self.seen_icp = False
        self.seen_usl = False
        self.active = False
    
    def update(self, icp_val: Any, usl_val: Any) -> bool:
        """
        Update gate with new icp and usl values.
        
        Returns:
            True if gate is active (both transitions seen)
        """
        from utils.time_utils import parse_int
        
        icp = parse_int(icp_val)
        usl = parse_int(usl_val)
        
        # Detect icp transition
        if self.prev_icp is not None and self.prev_icp == self.icp_from and icp == self.icp_to:
            self.seen_icp = True
        
        # Detect usl transition
        if self.prev_usl is not None and self.prev_usl == self.usl_from and usl == self.usl_to:
            self.seen_usl = True
        
        # Both seen -> gate on
        if self.seen_icp and self.seen_usl:
            self.active = True
        
        # Reset when back to base values
        if icp == self.icp_from and usl == self.usl_from:
            self.active = False
            self.seen_icp = False
            self.seen_usl = False
        
        self.prev_icp = icp
        self.prev_usl = usl
        return self.active


class CounterManager:
    """
    Manages all counters for a station.
    """
    
    def __init__(self, hardware_config: 'HardwareConfig'):
        self.dc_contractor_count = hardware_config.dcContractorCount
        self.ms_defaults = hardware_config.powerModuleDefaults
        
        # DC Contractor counters (1-6)
        self.dc_counters: Dict[str, EdgeCounter] = {}
        for i in range(1, self.dc_contractor_count + 1):
            self.dc_counters[f"dc{i}"] = EdgeCounter()
        
        # AC Contractor counters (1-2)
        self.ac_counters: Dict[str, EdgeCounter] = {
            "ac1": EdgeCounter(),
            "ac2": EdgeCounter()
        }
        
        # Motor Starter counters with gates
        self.ms_counters: Dict[str, PersistEdgeCounter] = {
            "ms1": PersistEdgeCounter(default_value=self.ms_defaults.get("ms1", 2)),
            "ms2": PersistEdgeCounter(default_value=self.ms_defaults.get("ms2", 3))
        }
        
        # Gates for motor starters
        self.gates: Dict[str, DualTransitionGate] = {
            "gate1": DualTransitionGate(),
            "gate2": DualTransitionGate()
        }
    
    def update_dc(self, dc_type: int, value: Any) -> int:
        """Update DC contractor counter"""
        key = f"dc{dc_type}"
        if key in self.dc_counters:
            return self.dc_counters[key].update(value)
        return 0
    
    def update_ac(self, ac_type: int, value: Any) -> int:
        """Update AC contractor counter"""
        key = f"ac{ac_type}"
        if key in self.ac_counters:
            return self.ac_counters[key].update(value)
        return 0
    
    def update_motor_starter(self, ms_type: int, value: Any, icp: Any, usl: Any, 
                             now: Optional[datetime] = None) -> int:
        """
        Update motor starter counter.
        Only counts when corresponding gate is active.
        """
        gate_key = f"gate{ms_type}"
        ms_key = f"ms{ms_type}"
        
        if gate_key not in self.gates or ms_key not in self.ms_counters:
            return 0
        
        gate_active = self.gates[gate_key].update(icp, usl)
        
        if gate_active:
            return self.ms_counters[ms_key].update(value, now)
        else:
            # Pass default value when gate is not active
            default = self.ms_defaults.get(ms_key, 2)
            return self.ms_counters[ms_key].update(default, now)
    
    def get_dc_counts(self) -> Dict[str, int]:
        """Get all DC contractor counts"""
        return {k: v.get_count() for k, v in self.dc_counters.items()}
    
    def get_ac_counts(self) -> Dict[str, int]:
        """Get all AC contractor counts"""
        return {k: v.get_count() for k, v in self.ac_counters.items()}
    
    def get_ms_counts(self) -> Dict[str, int]:
        """Get all motor starter counts"""
        return {k: v.get_count() for k, v in self.ms_counters.items()}
    
    def set_dc_count(self, dc_type: int, count: int):
        """Set DC contractor count (for recovery)"""
        key = f"dc{dc_type}"
        if key in self.dc_counters:
            self.dc_counters[key].set_count(count)
    
    def set_ac_count(self, ac_type: int, count: int):
        """Set AC contractor count (for recovery)"""
        key = f"ac{ac_type}"
        if key in self.ac_counters:
            self.ac_counters[key].set_count(count)
    
    def set_ms_count(self, ms_type: int, count: int):
        """Set motor starter count (for recovery)"""
        key = f"ms{ms_type}"
        if key in self.ms_counters:
            self.ms_counters[key].set_count(count)
