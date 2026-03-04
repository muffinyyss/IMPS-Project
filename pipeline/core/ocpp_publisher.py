#core\ocpp_publisher.py
"""
OCPP Config Publisher

Publishes chargeBoxID and ocppUrl to MQTT periodically and on value change.
"""
import json
import logging
import threading
import time
from typing import Dict, Optional, Any
from datetime import datetime

from config import settings, StationConfig
from utils import now_tz

logger = logging.getLogger(__name__)


class OCPPPublisher:
    """
    Publishes OCPP config (chargeBoxID, ocppUrl) to MQTT.
    
    Triggers:
    - Every 1 minute (periodic)
    - When values change (value_change)
    """
    
    PUBLISH_INTERVAL = 60  # seconds
    
    def __init__(self, mqtt_client: 'MQTTClient'):
        self.mqtt = mqtt_client
        self._running = False
        self._thread: Optional[threading.Thread] = None
        
        # Track previous values to detect changes
        # {station_id: {charge_box_id, ocpp_url}}
        self._prev_values: Dict[str, Dict[str, str]] = {}
    
    def start(self):
        """Start the publisher thread"""
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info("[OCPP-Publisher] Started")
    
    def stop(self):
        """Stop the publisher thread"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("[OCPP-Publisher] Stopped")
    
    def _run_loop(self):
        """Main loop - publish every PUBLISH_INTERVAL seconds"""
        while self._running:
            try:
                self._publish_all("periodic")
            except Exception as e:
                logger.error(f"[OCPP-Publisher] Error in publish loop: {e}")
            
            # Sleep in small intervals to allow quick shutdown
            for _ in range(self.PUBLISH_INTERVAL):
                if not self._running:
                    break
                time.sleep(1)
    
    def _publish_all(self, action: str):
        """Publish config for all stations"""
        for station_id, config in settings.stations.items():
            self._publish_station(config, action)
    
    def _publish_station(self, config: StationConfig, action: str):
        """Publish config for a single station"""
        topic = config.topics.ocppConfig
        
        # Skip if no topic configured
        if not topic:
            return
        
        timestamp = now_tz()
        
        payload = {
            "SN": config.serialNumber,
            "chargeBoxID": config.chargeBoxId,
            "ocppUrl": config.ocppUrl,
            "action": action,
            "timestamp": timestamp.isoformat()
        }
        
        try:
            self.mqtt.publish(topic, payload)
            logger.debug(f"[{config.stationId}] Published OCPP config: {action}")
        except Exception as e:
            logger.error(f"[{config.stationId}] Failed to publish OCPP config: {e}")
    
    def check_and_publish_changes(self):
        """
        Check for value changes and publish if changed.
        Called after reloading config from MongoDB.
        """
        for station_id, config in settings.stations.items():
            current = {
                'charge_box_id': config.chargeBoxId,
                'ocpp_url': config.ocppUrl
            }
            
            prev = self._prev_values.get(station_id)
            
            if prev is None:
                # First time - store values
                self._prev_values[station_id] = current
            elif prev != current:
                # Values changed
                logger.info(f"[{station_id}] OCPP config changed, publishing...")
                self._publish_station(config, "value_change")
                self._prev_values[station_id] = current