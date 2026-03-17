"""
Router Processor

Processes router topic data and updates service life.
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from core.state_manager import StationState
from utils import now_tz

logger = logging.getLogger(__name__)


class RouterProcessor:
    """
    Processes router topic data.
    
    Updates:
    - Router heartbeat / service life
    - Router data (RSSI, temperature)
    - Internet status
    """
    
    def process(self, state: StationState, data: Dict[str, Any],
                timestamp: Optional[datetime] = None):
        """
        Process router data.
        
        Args:
            state: Station state
            data: Router payload (from Teltonika RUT956)
            timestamp: Message timestamp
        """
        if timestamp is None:
            timestamp = now_tz()
        
        # Store latest data
        state.update_latest('router', data, timestamp)
        
        # Update router heartbeat (accumulates service life)
        elapsed = state.service_life.update_heartbeat('router', timestamp)
        
        if elapsed > 0:
            logger.debug(f"[{state.station_id}] Router: +{elapsed}s, "
                        f"total: {state.service_life.get_service_life_seconds('router')}s")
        
        # Extract and store router data
        rssi = data.get('RSSI', data.get('rssi'))
        rt_temp = data.get('rt_temp', data.get('temperature'))
        
        # Store internet status if available
        internet_status = data.get('internet_status', data.get('wan_state'))
        if internet_status is not None:
            state.set_router_internet_status(internet_status)
        
        logger.debug(f"[{state.station_id}] Router data: RSSI={rssi}, temp={rt_temp}")