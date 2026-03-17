"""
Heartbeat Processor

Processes heartbeat messages and updates device status + service life.
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from core.state_manager import StationState
from utils import now_tz

logger = logging.getLogger(__name__)


class HeartbeatProcessor:
    """
    Processes heartbeat messages.
    Updates device status and accumulates service life time.
    
    Devices:
    - pi5: from pi5_heartbeat topic
    - edgebox: from eb_heartbeat topic
    """
    
    def process_pi5(self, state: StationState, data: Dict[str, Any], 
                    timestamp: Optional[datetime] = None):
        """
        Process Pi5 heartbeat.
        
        Args:
            state: Station state
            data: Heartbeat payload
            timestamp: Message timestamp
        """
        if timestamp is None:
            timestamp = now_tz()
        
        # Store latest data
        state.update_latest('pi5Heartbeat', data, timestamp)
        
        # Update heartbeat (this also accumulates service life)
        elapsed = state.service_life.update_heartbeat('pi5', timestamp)
        
        if elapsed > 0:
            logger.debug(f"[{state.station_id}] Pi5 heartbeat: +{elapsed}s, "
                        f"total: {state.service_life.get_service_life_seconds('pi5')}s")
    
    def process_edgebox(self, state: StationState, data: Dict[str, Any],
                        timestamp: Optional[datetime] = None):
        """
        Process Edgebox heartbeat.
        
        Args:
            state: Station state
            data: Heartbeat payload
            timestamp: Message timestamp
        """
        if timestamp is None:
            timestamp = now_tz()
        
        # Store latest data
        state.update_latest('ebHeartbeat', data, timestamp)
        
        # Update heartbeat (this also accumulates service life)
        elapsed = state.service_life.update_heartbeat('edgebox', timestamp)
        
        if elapsed > 0:
            logger.debug(f"[{state.station_id}] Edgebox heartbeat: +{elapsed}s, "
                        f"total: {state.service_life.get_service_life_seconds('edgebox')}s")