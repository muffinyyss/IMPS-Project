"""
MQTT Client

Handles MQTT subscriptions and message routing to appropriate processors.
"""
import json
import logging
import threading
from typing import Dict, Callable, Optional, Any, List
from datetime import datetime

import paho.mqtt.client as mqtt

from config import settings, MQTTConfig, StationConfig
from utils import now_tz

logger = logging.getLogger(__name__)


class MQTTClient:
    """
    MQTT Client that subscribes to topics and routes messages to handlers.
    """
    
    def __init__(self, config: Optional[MQTTConfig] = None):
        self.config = config or settings.mqtt
        
        # Create client
        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2
        )
        
        # Set credentials
        if self.config.username and self.config.password:
            self.client.username_pw_set(self.config.username, self.config.password)
        
        # Setup callbacks
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        
        # Topic -> Handler mapping
        self._handlers: Dict[str, Callable] = {}
        
        # Topics to subscribe
        self._topics: List[str] = []
        
        # Connection state
        self._connected = False
        self._lock = threading.Lock()
    
    def register_handler(self, topic: str, handler: Callable):
        """Register a handler for a topic."""
        with self._lock:
            self._handlers[topic] = handler
            self._topics.append(topic)
            logger.debug(f"Registered handler for topic: {topic}")
    
    def register_station_topics(self, station_config: StationConfig, 
                                processor_callback: Callable):
        """Register all topics for a station."""
        topics = station_config.topics
        station_id = station_config.station_id
        
        # Map topic to topic_key for routing (ไม่รวม ambient และ mdb_raw)
        topic_mapping = {
            topics.plc: 'plc',
            topics.pi5_heartbeat: 'pi5_heartbeat',
            topics.eb_error: 'eb_error',
            topics.eb_temp: 'eb_temp',
            topics.eb_heartbeat: 'eb_heartbeat',
            topics.eb_count_device: 'eb_count_device',
            topics.router: 'router',
            # topics.ambient: 'ambient',  ← ตัดออก
            topics.bme280: 'bme280',
            topics.insulation1: 'insulation1',
            topics.insulation2: 'insulation2'
        }
        
        # Add optional topics if configured
        if topics.fan_rpm:
            topic_mapping[topics.fan_rpm] = 'fan_rpm'
        
        if topics.meter:
            topic_mapping[topics.meter] = 'meter'
        
        for topic, topic_key in topic_mapping.items():
            if topic:  # Only register non-empty topics
                def make_handler(sid, tk):
                    def handler(t, data, ts):
                        processor_callback(sid, tk, data, ts)
                    return handler
                
                self.register_handler(topic, make_handler(station_id, topic_key))
    
    def publish(self, topic: str, payload: Dict[str, Any], qos: int = 0):
        """
        Publish a message to a topic.
        
        Args:
            topic: MQTT topic
            payload: Dict to publish as JSON
            qos: Quality of Service (0, 1, or 2)
        """
        if not self._connected:
            logger.warning(f"Cannot publish to {topic}: not connected")
            return
        
        try:
            message = json.dumps(payload)
            self.client.publish(topic, message, qos=qos)
            logger.debug(f"Published to {topic}: {message[:100]}...")
        except Exception as e:
            logger.error(f"Failed to publish to {topic}: {e}")
    
    def connect(self) -> bool:
        """Connect to MQTT broker"""
        try:
            logger.info(f"Connecting to MQTT broker: {self.config.host}:{self.config.port}")
            self.client.connect(
                self.config.host, 
                self.config.port, 
                self.config.keepalive
            )
            return True
        except Exception as e:
            logger.error(f"Failed to connect to MQTT broker: {e}")
            return False
    
    def start(self):
        """Start MQTT client loop in background thread"""
        self.client.loop_start()
        logger.info("MQTT client loop started")
    
    def stop(self):
        """Stop MQTT client"""
        self.client.loop_stop()
        self.client.disconnect()
        logger.info("MQTT client stopped")
    
    def _on_connect(self, client, userdata, flags, reason_code, properties):
        """Callback when connected to broker"""
        if reason_code == 0:
            logger.info(f"Connected to MQTT broker successfully")
            self._connected = True
            
            # Subscribe to all registered topics
            with self._lock:
                for topic in self._topics:
                    client.subscribe(topic)
                    logger.debug(f"Subscribed to: {topic}")
                
                logger.info(f"Subscribed to {len(self._topics)} topics")
        else:
            logger.error(f"Failed to connect, reason code: {reason_code}")
    
    def _on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties):
        """Callback when disconnected from broker"""
        self._connected = False
        logger.warning(f"Disconnected from MQTT broker, reason: {reason_code}")
    
    def _on_message(self, client, userdata, msg):
        """Callback when message received"""
        topic = msg.topic
        
        try:
            # Parse JSON payload
            payload = msg.payload.decode('utf-8')
            data = json.loads(payload)
            timestamp = now_tz()
            
            # Find and call handler
            with self._lock:
                handler = self._handlers.get(topic)
            
            if handler:
                try:
                    handler(topic, data, timestamp)
                except Exception as e:
                    logger.error(f"Error in handler for {topic}: {e}")
            else:
                logger.debug(f"No handler for topic: {topic}")
        
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON from {topic}: {e}")
        except Exception as e:
            logger.error(f"Error processing message from {topic}: {e}")
    
    @property
    def is_connected(self) -> bool:
        return self._connected