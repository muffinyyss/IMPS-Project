#!/usr/bin/env python3
"""
EV Charger Pipeline - Main Entry Point

Processes MQTT messages from EV charging stations and writes to MongoDB.
Supports multiple stations running in a single process.
"""
import sys
import signal
import logging
import argparse
import time
from typing import Dict, Optional, Any, List
from datetime import datetime

from config import settings, StationConfig
from core import MQTTClient, MongoDBClient, RecoveryLoader, StateManager, StationState
from core.aggregators import AggregatorManager
from processors import (
    PLCProcessor,
    MDBProcessor,
    RouterProcessor,
    HeartbeatProcessor,
    CBMProcessor,
    ErrorProcessor,
    InsulationProcessor,
    FanRpmProcessor
)
from utils import now_tz

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class Pipeline:
    """
    Main Pipeline class that orchestrates all components.
    """
    
    def __init__(self, station_names: Optional[List[str]] = None, debug: bool = False):
        """
        Initialize pipeline.
        
        Args:
            station_names: List of station names to load, or None for all
            debug: Enable debug logging
        """
        if debug:
            logging.getLogger().setLevel(logging.DEBUG)
        
        self.running = False
        
        # Load station configurations
        logger.info("Loading station configurations...")
        settings.load_stations(station_names)
        
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
        
        # Aggregators per station
        self.aggregators: Dict[str, AggregatorManager] = {}
    
    def setup(self) -> bool:
        """
        Setup all components.
        
        Returns:
            True if successful
        """
        # Connect to MongoDB
        if not self.mongodb.connect():
            logger.error("Failed to connect to MongoDB")
            return False
        
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
            
            # Create aggregators for this station
            agg_manager = AggregatorManager(station_config.stationId, timeout_seconds=60)
            self.aggregators[station_config.stationId] = agg_manager
            
            # Set aggregator callbacks
            self._setup_aggregator_callbacks(station_config.stationId, agg_manager)
            
            # Register MQTT topics
            self.mqtt.register_station_topics(station_config, self._process_message)
        
        # Connect to MQTT
        if not self.mqtt.connect():
            logger.error("Failed to connect to MQTT broker")
            return False
        
        return True
    
    def _setup_aggregator_callbacks(self, station_id: str, agg_manager: AggregatorManager):
        """Setup callbacks for aggregators"""
        
        # CBM Aggregator callback -> monitorCBM, module3, module6
        def cbm_callback(aggregated_data: Dict[str, Any]):
            state = self.state_manager.get_station(station_id)
            if state:
                self.cbm_processor.process(state, aggregated_data, now_tz())
                logger.debug(f"[{station_id}] CBM aggregator triggered")
        
        # Module2 Aggregator callback -> module2ChargerDustPrediction
        def module2_callback(aggregated_data: Dict[str, Any]):
            state = self.state_manager.get_station(station_id)
            if state:
                from processors.aggregator_processor import Module2Processor
                processor = Module2Processor(self.mongodb)
                processor.process(state, aggregated_data, now_tz())
                logger.debug(f"[{station_id}] Module2 aggregator triggered")
        
        # Insulation Aggregator callback -> update state
        def insulation_callback(aggregated_data: Dict[str, Any]):
            state = self.state_manager.get_station(station_id)
            if state:
                state.update_latest('insulation_agg', aggregated_data, now_tz())
                logger.debug(f"[{station_id}] Insulation aggregator triggered")
        
        agg_manager.set_cbm_callback(cbm_callback)
        agg_manager.set_module2_callback(module2_callback)
        agg_manager.set_insulation_callback(insulation_callback)
    
    def _process_message(self, station_id: str, topic_key: str, 
                         data: Dict[str, Any], timestamp: datetime):
        """
        Process incoming MQTT message.
        
        Args:
            station_id: Station identifier
            topic_key: Topic key (e.g., 'plc', 'mdb', 'router')
            data: Message data
            timestamp: Message timestamp
        """
        state = self.state_manager.get_station(station_id)
        if state is None:
            logger.warning(f"Unknown station: {station_id}")
            return
        
        agg = self.aggregators.get(station_id)
        
        try:
            # Route to appropriate processor
            if topic_key == 'plc':
                self.plc_processor.process(state, data, timestamp)
            
            elif topic_key == 'mdb':
                # Process MDB directly
                self.mdb_processor.process(state, data, timestamp)
                # Also feed to CBM aggregator
                if agg:
                    agg.cbm.update_mdb(data, timestamp)
            
            elif topic_key == 'router':
                self.router_processor.process(state, data, timestamp)
                # Feed to CBM and Module2 aggregators
                if agg:
                    agg.cbm.update_router(data, timestamp)
                    agg.module2.update_router(data, timestamp)
            
            elif topic_key == 'pi5_heartbeat':
                self.heartbeat_processor.process_pi5(state, data, timestamp)
            
            elif topic_key == 'eb_heartbeat':
                self.heartbeat_processor.process_edgebox(state, data, timestamp)
            
            elif topic_key == 'eb_error':
                self.error_processor.process(state, data, timestamp)
            
            elif topic_key == 'eb_temp':
                state.update_latest('eb_temp', data, timestamp)
                # Feed to CBM and Module2 aggregators
                if agg:
                    agg.cbm.update_eb_temp(data, timestamp)
                    agg.module2.update_eb_temp(data, timestamp)
            
            elif topic_key == 'ambient':
                state.update_latest('ambient', data, timestamp)
                # Feed to CBM and Module2 aggregators
                if agg:
                    agg.cbm.update_ambient(data, timestamp)
                    agg.module2.update_ambient(data, timestamp)
            
            elif topic_key == 'bme280':
                state.update_latest('bme280', data, timestamp)
                # Feed to Module2 aggregator
                if agg:
                    agg.module2.update_bme280(data, timestamp)
            
            elif topic_key == 'insulation1':
                state.update_latest('insulation1', data, timestamp)
                # Feed to Insulation aggregator
                if agg:
                    agg.insulation.update_insulation1(data, timestamp)
            
            elif topic_key == 'insulation2':
                state.update_latest('insulation2', data, timestamp)
                # Feed to Insulation aggregator
                if agg:
                    agg.insulation.update_insulation2(data, timestamp)
            
            elif topic_key == 'fan_rpm':
                self.fan_rpm_processor.process(state, data, timestamp)
            
            else:
                logger.debug(f"[{station_id}] Unhandled topic key: {topic_key}")
        
        except Exception as e:
            logger.error(f"[{station_id}] Error processing {topic_key}: {e}", exc_info=True)
    
    def run(self):
        """Run the pipeline"""
        self.running = True
        
        # Start MQTT client
        self.mqtt.start()
        
        logger.info("="*60)
        logger.info("Pipeline is running!")
        logger.info(f"Stations: {list(settings.stations.keys())}")
        logger.info("="*60)
        
        # Keep running until stopped
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
        
        self.stop()
    
    def stop(self):
        """Stop the pipeline"""
        logger.info("Stopping pipeline...")
        self.running = False
        self.mqtt.stop()
        self.mongodb.close()
        logger.info("Pipeline stopped")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='EV Charger Pipeline - Process charging station data'
    )
    parser.add_argument(
        '--stations', '-s',
        type=str,
        help='Comma-separated list of station names (default: all)'
    )
    parser.add_argument(
        '--debug', '-d',
        action='store_true',
        help='Enable debug logging'
    )
    
    args = parser.parse_args()
    
    # Parse station names
    station_names = None
    if args.stations:
        station_names = [s.strip() for s in args.stations.split(',')]
    
    # Create and run pipeline
    pipeline = Pipeline(station_names=station_names, debug=args.debug)
    
    # Setup signal handlers
    def handle_signal(signum, frame):
        logger.info(f"Received signal {signum}")
        pipeline.stop()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)
    
    # Setup and run
    if pipeline.setup():
        pipeline.run()
    else:
        logger.error("Failed to setup pipeline")
        sys.exit(1)


if __name__ == '__main__':
    main()
