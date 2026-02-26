"""
MDB MQTT Subscriber

Subscribes to MDB topics and writes to __MDB_realtime__ and __MDB_history__.
Topic mapping is loaded from __MDB_realtime__.{station_id}.config
"""
import asyncio
import json
import logging
import time
from typing import Dict, Optional, Callable, Any

import paho.mqtt.client as mqtt

from config import settings
from utils import now_tz

logger = logging.getLogger(__name__)

# Fields to save in history
HISTORY_FIELDS = [
    "VL1N", "VL2N", "VL3N",
    "I1", "I2", "I3",
    "PL1N", "PL2N", "PL3N", "PL123N",
    "timestamp",
]


class MDBSubscriber:
    """
    MDB MQTT Subscriber with dynamic topic loading.
    
    - Loads topic mapping from __MDB_realtime__ collection
    - Subscribes to all MDB topics
    - Reloads mapping every 30 seconds
    - Writes to __MDB_realtime__ (upsert latest) and __MDB_history__ (insert)
    """
    
    RELOAD_INTERVAL = 30  # seconds
    
    def __init__(self, mongodb_client: 'MongoDBClient'):
        self.mongodb = mongodb_client
        self.topic_map: Dict[str, str] = {}  # topic -> station_id
        self._subscribed_topics: set = set()
        self._last_reload: float = 0
        self._lock = asyncio.Lock()
        
        # MQTT Client
        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id="mdb_subscriber"
        )
        
        # Set credentials
        mqtt_config = settings.mqtt
        if mqtt_config.username and mqtt_config.password:
            self.client.username_pw_set(mqtt_config.username, mqtt_config.password)
        
        # Setup callbacks
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        
        # Callback for pipeline integration (optional)
        self._data_callback: Optional[Callable] = None
    
    def set_data_callback(self, callback: Callable[[str, Dict[str, Any]], None]):
        """Set callback to notify pipeline when MDB data arrives"""
        self._data_callback = callback
    
    async def load_topic_map(self) -> Dict[str, str]:
        """
        Load topic mapping from __MDB_realtime__ database.
        
        Returns:
            Dict mapping topic -> station_id
        """
        new_map = {}
        
        try:
            realtime_db = self.mongodb.get_mdb_realtime_db()
            if realtime_db is None:
                logger.error("MDB realtime database not available")
                return new_map
            
            # List all collections
            collection_names = realtime_db.list_collection_names()
            
            for coll_name in collection_names:
                # Get config document
                config_doc = realtime_db[coll_name].find_one({"_id": "config"})
                if config_doc and config_doc.get("topic"):
                    topic = config_doc["topic"]
                    new_map[topic] = coll_name
            
            logger.info(f"[MDB-Subscriber] Loaded {len(new_map)} topic mappings")
            logger.debug(f"[MDB-Subscriber] Mappings: {new_map}")
            
        except Exception as e:
            logger.error(f"[MDB-Subscriber] Failed to load topic map: {e}")
        
        return new_map
    
    async def reload_and_subscribe(self):
        """Reload topic map and subscribe to new topics"""
        async with self._lock:
            new_map = await self.load_topic_map()
            
            # Find new topics
            new_topics = set(new_map.keys()) - self._subscribed_topics
            
            # Subscribe to new topics
            for topic in new_topics:
                self.client.subscribe(topic)
                logger.info(f"[MDB-Subscriber] Subscribed to new topic: {topic}")
            
            self._subscribed_topics.update(new_topics)
            self.topic_map = new_map
            self._last_reload = time.time()
    
    def _on_connect(self, client, userdata, flags, reason_code, properties):
        """Callback when connected to broker"""
        if reason_code == 0:
            logger.info("[MDB-Subscriber] Connected to MQTT broker")
            
            # Subscribe to all known topics
            for topic in self.topic_map:
                client.subscribe(topic)
                self._subscribed_topics.add(topic)
            
            logger.info(f"[MDB-Subscriber] Subscribed to {len(self.topic_map)} topics")
        else:
            logger.error(f"[MDB-Subscriber] Failed to connect: {reason_code}")
    
    def _on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties):
        """Callback when disconnected"""
        logger.warning(f"[MDB-Subscriber] Disconnected: {reason_code}")
        self._subscribed_topics.clear()
    
    def _on_message(self, client, userdata, msg):
        """Callback when message received"""
        topic = msg.topic
        station_id = self.topic_map.get(topic)
        
        if not station_id:
            logger.debug(f"[MDB-Subscriber] Unknown topic: {topic}")
            return
        
        try:
            data = json.loads(msg.payload.decode('utf-8'))
            
            # Write to databases (sync for now, can be made async)
            self._write_to_databases(station_id, data)
            
            # Notify pipeline if callback set
            if self._data_callback:
                self._data_callback(station_id, data)
            
            logger.debug(f"[MDB-Subscriber] [{station_id}] Data saved")
            
        except json.JSONDecodeError as e:
            logger.warning(f"[MDB-Subscriber] Invalid JSON from {topic}: {e}")
        except Exception as e:
            logger.error(f"[MDB-Subscriber] Error processing {topic}: {e}")
    
    def _write_to_databases(self, station_id: str, data: Dict[str, Any]):
        """Write data to MDB_realtime and MDB_history"""
        try:
            # Write to realtime (upsert latest)
            realtime_db = self.mongodb.get_mdb_realtime_db()
            if realtime_db is not None:  # ✅ แก้จาก `if realtime_db:`
                realtime_db[station_id].update_one(
                    {"_id": "latest"},
                    {"$set": data},
                    upsert=True
                )
            
            # Write to history (insert selected fields)
            history_db = self.mongodb.get_mdb_history_db()
            if history_db is not None:  # ✅ แก้จาก `if history_db:`
                history_doc = {k: data[k] for k in HISTORY_FIELDS if k in data}
                if history_doc.get("timestamp"):
                    history_db[station_id].insert_one(history_doc)
            
        except Exception as e:
            logger.error(f"[MDB-Subscriber] DB write error for {station_id}: {e}")
    
    def connect(self) -> bool:
        """Connect to MQTT broker"""
        try:
            mqtt_config = settings.mqtt
            self.client.connect(mqtt_config.host, mqtt_config.port, mqtt_config.keepalive)
            return True
        except Exception as e:
            logger.error(f"[MDB-Subscriber] Failed to connect: {e}")
            return False
    
    def start(self):
        """Start MQTT client loop"""
        self.client.loop_start()
        logger.info("[MDB-Subscriber] Started")
    
    def stop(self):
        """Stop MQTT client"""
        self.client.loop_stop()
        self.client.disconnect()
        logger.info("[MDB-Subscriber] Stopped")
    
    async def run_reload_loop(self):
        """Background task to reload topic map periodically"""
        while True:
            await asyncio.sleep(self.RELOAD_INTERVAL)
            try:
                await self.reload_and_subscribe()
            except Exception as e:
                logger.error(f"[MDB-Subscriber] Reload error: {e}")