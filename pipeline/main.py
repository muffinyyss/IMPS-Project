#main.py
#!/usr/bin/env python3
"""
EV Charger Pipeline - Main Entry Point
"""
import sys
import signal
import logging
import argparse
import asyncio
import threading
import time
from dataclasses import asdict
from typing import Dict, Optional, Any, List
from datetime import datetime

from config import settings, StationConfig
from core import MQTTClient, MongoDBClient, RecoveryLoader, StateManager, StationState
from core.aggregators import AggregatorManager
# from core.mdb_subscriber import MDBSubscriber
from core.status_tracker import StatusTracker
from core.ocpp_publisher import OCPPPublisher
from processors import (
    PLCProcessor,
    MDBProcessor,
    RouterProcessor,
    HeartbeatProcessor,
    CBMProcessor,
    ErrorProcessor,
    InsulationProcessor,
    FanRpmProcessor,
    MeterProcessor
)
from utils import now_tz, stable_hash

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class Pipeline:
    
    def __init__(self, station_ids: Optional[List[str]] = None, debug: bool = False):
        if debug:
            logging.getLogger().setLevel(logging.DEBUG)

        self.running = False

        # Remember the station filter so the hot-reload loop respects --stations
        self.station_ids = station_ids
        # Cache config hashes to detect changes during reload
        self._config_hashes: Dict[str, str] = {}

        logger.info("Loading station configurations from MongoDB...")
        settings.load_stations(station_ids)
        
        if not settings.stations:
            logger.error("No stations configured!")
            sys.exit(1)
        
        logger.info(f"Loaded {len(settings.stations)} station(s)")
        
        # Initialize components
        self.mongodb = MongoDBClient()
        self.mqtt = MQTTClient()
        self.state_manager = StateManager()
        self.recovery_loader = RecoveryLoader(self.mongodb)
        
        # Initialize processors
        self.plc_processor = PLCProcessor(self.mongodb)
        self.mdb_processor = MDBProcessor(self.mongodb)
        self.router_processor = RouterProcessor()
        self.heartbeat_processor = HeartbeatProcessor()
        self.cbm_processor = CBMProcessor(self.mongodb)
        self.error_processor = ErrorProcessor()
        self.insulation_processor = InsulationProcessor()
        self.fan_rpm_processor = FanRpmProcessor()
        self.meter_processor = MeterProcessor()
        
        # Aggregators per station
        self.aggregators: Dict[str, AggregatorManager] = {}
        
        # # MDB Subscriber
        # self.mdb_subscriber: Optional[MDBSubscriber] = None 
        # self._mdb_reload_thread: Optional[threading.Thread] = None
        
        # Status Tracker (ใหม่)
        self.status_tracker: Optional[StatusTracker] = None
        
        # OCPP Publisher (ใหม่)
        self.ocpp_publisher: Optional[OCPPPublisher] = None
    
    def setup(self) -> bool:
        # Connect to MongoDB
        if not self.mongodb.connect():
            logger.error("Failed to connect to MongoDB")
            return False
        
        # Initialize Status Tracker
        self.status_tracker = StatusTracker(self.mongodb)

        # Initialize state for each station
        for station_name, station_config in settings.stations.items():
            self._init_station(station_config)

        # # Setup MDB Subscriber
        # self.mdb_subscriber = MDBSubscriber(self.mongodb)
        # self.mdb_subscriber.set_data_callback(self._on_mdb_data)
        
        # # Load initial topic map
        # loop = asyncio.new_event_loop()
        # loop.run_until_complete(self.mdb_subscriber.load_topic_map())
        # loop.close()
        
        # # Connect MDB subscriber
        # if not self.mdb_subscriber.connect():
        #     logger.warning("MDB Subscriber failed to connect (continuing without MDB)")
        
        # Connect to MQTT
        if not self.mqtt.connect():
            logger.error("Failed to connect to MQTT broker")
            return False
        
        # Initialize OCPP Publisher
        self.ocpp_publisher = OCPPPublisher(self.mqtt)
        
        return True
    
    def _setup_aggregator_callbacks(self, station_id: str, agg_manager: AggregatorManager):
        """Setup callbacks for aggregators"""
        
        def cbm_callback(aggregated_data: Dict[str, Any]):
            state = self.state_manager.get_station(station_id)
            if state:
                self.cbm_processor.process(state, aggregated_data, now_tz())
                # Update status tracker
                if self.status_tracker:
                    self.status_tracker.update_all(state, now_tz())
                logger.debug(f"[{station_id}] CBM aggregator triggered")
        
        def module2_callback(aggregated_data: Dict[str, Any]):
            state = self.state_manager.get_station(station_id)
            if state:
                from processors.aggregator_processor import Module2Processor
                processor = Module2Processor(self.mongodb)
                processor.process(state, aggregated_data, now_tz())
                logger.debug(f"[{station_id}] Module2 aggregator triggered")
        
        def insulation_callback(aggregated_data: Dict[str, Any]):
            state = self.state_manager.get_station(station_id)
            if state:
                state.update_latest('insulationAgg', aggregated_data, now_tz())
                logger.debug(f"[{station_id}] Insulation aggregator triggered")
        
        agg_manager.set_cbm_callback(cbm_callback)
        agg_manager.set_module2_callback(module2_callback)
        agg_manager.set_insulation_callback(insulation_callback)

    # =========================================================================
    # Station lifecycle (used by setup() and the hot-reload loop)
    # =========================================================================
    def _init_station(self, station_config: StationConfig):
        """Build state, recover from MongoDB, and subscribe MQTT topics for one station."""
        state = self.state_manager.add_station(station_config)

        # Recover state from MongoDB
        recovery_data = self.recovery_loader.recover_state(station_config)
        self.recovery_loader.apply_recovery(state, recovery_data)

        # Load PM Report data
        pm_data = self.recovery_loader.load_pm_report(station_config)
        state.pm_date = pm_data['pm_date']
        state.dust_filter_enabled = pm_data['dust_filter_enabled']

        # Recovery meter data from meter database
        if station_config.collections.meter:
            meter_data = self.mongodb.get_latest_meter(station_config.collections.meter)
            state.set_meter_data(meter_data['meter1'], meter_data['meter2'])
            logger.info(f"[{station_config.stationId}] Recovered meter: {meter_data}")

        # Use state.aggregators (not create new instance)
        state.aggregators.set_timeout(120)

        # Store reference for quick access
        self.aggregators[station_config.stationId] = state.aggregators

        # Set aggregator callbacks
        self._setup_aggregator_callbacks(station_config.stationId, state.aggregators)

        # Register MQTT topics (subscribes immediately if MQTT is already connected)
        self.mqtt.register_station_topics(station_config, self._process_message)

        # Record config hash for change detection
        self._config_hashes[station_config.stationId] = self._config_hash(station_config)

    def _teardown_station(self, station_id: str):
        """Unsubscribe topics and drop in-memory state for one station."""
        old_config = settings.stations.get(station_id)
        if old_config:
            self.mqtt.unregister_station_topics(old_config)
        self.aggregators.pop(station_id, None)
        self.state_manager.remove_station(station_id)
        self._config_hashes.pop(station_id, None)

    @staticmethod
    def _config_hash(config: StationConfig) -> str:
        """Stable hash of a station config to detect any change."""
        return stable_hash(asdict(config))

    @staticmethod
    def _topics_only_change(old: StationConfig, new: StationConfig) -> bool:
        """True if only the topics changed (hardware/service_life/collections identical).

        In that case we can refresh subscriptions without rebuilding counters/timers,
        preserving accumulated in-memory state.
        """
        return (
            asdict(old.hardware) == asdict(new.hardware)
            and asdict(old.serviceLife) == asdict(new.serviceLife)
            and asdict(old.collections) == asdict(new.collections)
            and old.commissioningDate == new.commissioningDate
            and old.serialNumber == new.serialNumber
        )

    def _refresh_station_topics(self, station_id: str, old_config: StationConfig,
                                new_config: StationConfig):
        """Update MQTT subscriptions for a station whose topics changed (no state rebuild)."""
        # Drop all old subscriptions, then register the new mapping fresh
        self.mqtt.unregister_station_topics(old_config)
        state = self.state_manager.get_station(station_id)
        if state:
            state.config = new_config
        self.mqtt.register_station_topics(new_config, self._process_message)
        self._config_hashes[station_id] = self._config_hash(new_config)

    def _reload_configs(self):
        """Poll MongoDB and apply config changes without restarting the pipeline.

        - new station (document with pipeline_config)  -> init + subscribe
        - removed station                              -> unsubscribe + drop state
        - topics-only change                           -> refresh subscriptions (state preserved)
        - hardware/service_life/etc change             -> full rebuild (state recovered from Mongo)
        """
        new_configs = settings.fetch_station_configs(self.station_ids)
        if not new_configs:
            logger.warning("[Reload] No configs fetched from MongoDB; skipping this cycle")
            return

        old_ids = set(settings.stations.keys())
        new_ids = set(new_configs.keys())

        # Heartbeat: prove the reload loop is actually polling MongoDB each cycle
        changed_ids = [
            sid for sid in (old_ids & new_ids)
            if self._config_hashes.get(sid) != self._config_hash(new_configs[sid])
        ]
        logger.info(
            f"[Reload] Poll OK: fetched={len(new_configs)} "
            f"new={len(new_ids - old_ids)} removed={len(old_ids - new_ids)} "
            f"changed={len(changed_ids)}"
            + (f" -> {changed_ids}" if changed_ids else "")
        )

        # Removed stations
        for sid in old_ids - new_ids:
            logger.info(f"[Reload] Station removed from config: {sid}")
            self._teardown_station(sid)
            settings.stations.pop(sid, None)

        # New stations
        for sid in new_ids - old_ids:
            logger.info(f"[Reload] New station detected: {sid}")
            settings.stations[sid] = new_configs[sid]
            self._init_station(new_configs[sid])

        # Existing stations — apply changes only when the hash differs
        for sid in old_ids & new_ids:
            new_config = new_configs[sid]
            if self._config_hashes.get(sid) == self._config_hash(new_config):
                continue  # unchanged

            old_config = settings.stations[sid]
            old_topics = set(old_config.topics.get_all_topics())
            new_topics = set(new_config.topics.get_all_topics())
            logger.info(
                f"[Reload] Change detected for {sid}: "
                f"+{sorted(new_topics - old_topics)} -{sorted(old_topics - new_topics)}"
            )
            if self._topics_only_change(old_config, new_config):
                logger.info(f"[Reload] Topics changed for {sid}; refreshing subscriptions")
                settings.stations[sid] = new_config
                self._refresh_station_topics(sid, old_config, new_config)
            else:
                logger.info(f"[Reload] Hardware/config changed for {sid}; rebuilding station")
                self._teardown_station(sid)
                settings.stations[sid] = new_config
                self._init_station(new_config)

    def _on_mdb_data(self, station_id: str, data: Dict[str, Any]):
        """Callback when MDB data arrives"""
        state = self.state_manager.get_station(station_id)
        if state:
            timestamp = now_tz()
            state.update_latest('mdb', data, timestamp)
            
            # Trigger MDB processor
            self.mdb_processor.process(state, data, timestamp)
            
            # Update aggregators
            agg = self.aggregators.get(station_id)
            if agg:
                agg.cbm.update_mdb(data, timestamp)
    
    def _check_heartbeat_timeouts(self):
        """Check heartbeat timeouts for all stations"""
        now = now_tz()
        
        for station_id, state in self.state_manager.get_all_stations().items():
            if self.status_tracker:
                self.status_tracker.update_all(state, now)

    def _process_message(self, station_id: str, topic_key: str, 
                         data: Dict[str, Any], timestamp: datetime):
        state = self.state_manager.get_station(station_id)
        if state is None:
            logger.warning(f"Unknown station: {station_id}")
            return
        
        agg = self.aggregators.get(station_id)
        
        try:
            if topic_key == 'plc':
                self.plc_processor.process(state, data, timestamp)
                # Update status tracker after PLC processing
                if self.status_tracker:
                    self.status_tracker.update_all(state, timestamp)
            
            elif topic_key == 'router':
                self.router_processor.process(state, data, timestamp)
                if agg:
                    agg.cbm.update_router(data, timestamp)
                    agg.module2.update_router(data, timestamp)
            
            elif topic_key == 'pi5Heartbeat':
                self.heartbeat_processor.process_pi5(state, data, timestamp)
            
            elif topic_key == 'ebHeartbeat':
                self.heartbeat_processor.process_edgebox(state, data, timestamp)
            
            elif topic_key == 'ebError':
                self.error_processor.process(state, data, timestamp)
            
            elif topic_key == 'ebTemp':
                state.update_latest('ebTemp', data, timestamp)
                if agg:
                    agg.cbm.update_eb_temp(data, timestamp)
                    agg.module2.update_eb_temp(data, timestamp)
            
            elif topic_key == 'bme280':
                state.update_latest('bme280', data, timestamp)
                if agg:
                    # BME280 now provides both ambient and pressure data
                    agg.cbm.update_bme280(data, timestamp)
                    agg.module2.update_bme280(data, timestamp)
            
            elif topic_key == 'insulation1':
                state.update_latest('insulation1', data, timestamp)
                if agg:
                    agg.insulation.update_insulation1(data, timestamp)
            
            elif topic_key == 'insulation2':
                state.update_latest('insulation2', data, timestamp)
                if agg:
                    agg.insulation.update_insulation2(data, timestamp)
            
            elif topic_key == 'fanRpm':
                self.fan_rpm_processor.process(state, data, timestamp)
            
            elif topic_key == 'meter':
                self.meter_processor.process(state, data, timestamp)

            elif topic_key == 'mdb':
                self.mdb_processor.process(state, data, timestamp)
                # Update CBM aggregator with MDB data
                if agg:
                    agg.cbm.update_mdb(data, timestamp)

            elif topic_key == 'faultStatus':
                # Forward raw MQTT payload -> MongoDB "FaultStatus" db, collection = serial_number
                # Insert one document per message (history) with a received timestamp.
                if isinstance(data, dict):
                    doc = {**data, "received_at": timestamp.isoformat()}
                else:
                    doc = {"payload": data, "received_at": timestamp.isoformat()}
                self.mongodb.insert_one('faultStatus', state.serial_number, doc)

            else:
                logger.debug(f"[{station_id}] Unhandled topic key: {topic_key}")
        
        except Exception as e:
            logger.error(f"[{station_id}] Error processing {topic_key}: {e}", exc_info=True)
    
    def _run_mdb_reload_loop(self):
        """Run MDB reload loop in background"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(self.mdb_subscriber.run_reload_loop())
    
    def run(self):
        self.running = True
        self.mqtt.start()
        
        # # Start MDB subscriber
        #if self.mdb_subscriber:
        #    self.mdb_subscriber.start()
        #    self._mdb_reload_thread = threading.Thread(
        #        target=self._run_mdb_reload_loop,
        #        daemon=True
        #    )
        #    self._mdb_reload_thread.start()
        
        # Start OCPP Publisher
        if self.ocpp_publisher:
            self.ocpp_publisher.start()
        
        logger.info("="*60)
        logger.info("Pipeline is running!")
        logger.info(f"Stations: {list(settings.stations.keys())}")
        logger.info("="*60)
        
        last_heartbeat_check = time.time()
        last_config_reload = time.time()
        HEARTBEAT_CHECK_INTERVAL = 30  # Check every 30 seconds
        CONFIG_RELOAD_INTERVAL = 30    # Poll MongoDB for config changes every 30 seconds

        try:
            while self.running:
                time.sleep(1)

                # Periodic heartbeat timeout check
                if time.time() - last_heartbeat_check >= HEARTBEAT_CHECK_INTERVAL:
                    self._check_heartbeat_timeouts()
                    last_heartbeat_check = time.time()

                # Periodic config hot-reload (topics / stations / hardware)
                if time.time() - last_config_reload >= CONFIG_RELOAD_INTERVAL:
                    try:
                        self._reload_configs()
                    except Exception as e:
                        logger.error(f"Config reload error: {e}", exc_info=True)
                    last_config_reload = time.time()

        except KeyboardInterrupt:
            pass
        
        self.stop()
    
    def stop(self):
        logger.info("Stopping pipeline...")
        self.running = False
        self.mqtt.stop()
        
        #if self.mdb_subscriber:
        #    self.mdb_subscriber.stop()
        
        if self.ocpp_publisher:
            self.ocpp_publisher.stop()
        
        self.mongodb.close()
        logger.info("Pipeline stopped")



def main():
    parser = argparse.ArgumentParser(
        description='EV Charger Pipeline - Process charging station data'
    )
    parser.add_argument('--stations', '-s', type=str,
                        help='Comma-separated list of station IDs (default: all)')
    parser.add_argument('--debug', '-d', action='store_true',
                        help='Enable debug logging')
    
    args = parser.parse_args()
    
    station_ids = None
    if args.stations:
        station_ids = [s.strip() for s in args.stations.split(',')]
    
    pipeline = Pipeline(station_ids=station_ids, debug=args.debug)
    
    def handle_signal(signum, frame):
        logger.info(f"Received signal {signum}")
        pipeline.stop()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)
    
    if pipeline.setup():
        pipeline.run()
    else:
        logger.error("Failed to setup pipeline")
        sys.exit(1)


if __name__ == '__main__':
    main()