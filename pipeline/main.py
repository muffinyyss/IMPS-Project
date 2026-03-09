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
from utils import now_tz

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
            
            # Create aggregators for this station
            agg_manager = AggregatorManager(station_config.stationId, timeout_seconds=120)
            self.aggregators[station_config.stationId] = agg_manager
            
            # Set aggregator callbacks
            self._setup_aggregator_callbacks(station_config.stationId, agg_manager)
            
            # Register MQTT topics
            self.mqtt.register_station_topics(station_config, self._process_message)
        
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
        
        try:
            while self.running:
                time.sleep(1)
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