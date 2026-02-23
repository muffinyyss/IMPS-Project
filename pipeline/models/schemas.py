#models\schemas.py
"""
MongoDB Document Schemas

Defines the structure of documents for each collection.
Matches the original Node-RED format.
"""
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from utils import parse_float, parse_int, now_utc

def create_plc_document(plc_data: Dict[str, Any], timestamp: str) -> Dict[str, Any]:
    """Create PLC collection document"""
    return {
        # Head 1
        "icp1": plc_data.get("icp1"),
        "usl1": plc_data.get("usl1"),
        "finishing1": plc_data.get("finishing1"),
        "chargeState1": plc_data.get("chargeState1"),
        "head1Error": plc_data.get("head1Error"),
        "errorMessage1": plc_data.get("errorMessage1"),
        "targetVoltage1": plc_data.get("targetVoltage1"),
        "targetCurrent1": plc_data.get("targetCurrent1"),
        "presentVoltage1": plc_data.get("presentVoltage1"),
        "presentCurrent1": plc_data.get("presentCurrent1"),
        "powerKw1": plc_data.get("powerKw1"),
        "SOC1": plc_data.get("SOC1"),
        "temp1Head1": plc_data.get("temp1Head1"),
        "temp2Head1": plc_data.get("temp2Head1"),
        "insulationFault1": plc_data.get("insulationFault1"),
        "peCut1": plc_data.get("peCut1"),
        "cpFault1": plc_data.get("cpFault1"),
        "activeMld1": plc_data.get("activeMld1"),
        "tempPowerModule1": plc_data.get("tempPowerModule1"),
        "dynamicMaxCurrent1": plc_data.get("dynamicMaxCurrent1"),
        "powerLimit1": plc_data.get("powerLimit1"),
        "maxPower1": plc_data.get("maxPower1"),
        "maxVoltage1": plc_data.get("maxVoltage1"),
        "maxCurrent1": plc_data.get("maxCurrent1"),
        "measuredVoltage1": plc_data.get("measuredVoltage1"),
        "measuredCurrent1": plc_data.get("measuredCurrent1"),
        "insuStatus1": plc_data.get("insuStatus1"),
        "ACMagStatus1": plc_data.get("ACMagStatus1"),
        "CPStatus1": plc_data.get("CPStatus1"),
        
        # Head 2
        "icp2": plc_data.get("icp2"),
        "usl2": plc_data.get("usl2"),
        "finishing2": plc_data.get("finishing2"),
        "chargeState2": plc_data.get("chargeState2"),
        "head2Error": plc_data.get("head2Error"),
        "errorMessage2": plc_data.get("errorMessage2"),
        "targetVoltage2": plc_data.get("targetVoltage2"),
        "targetCurrent2": plc_data.get("targetCurrent2"),
        "presentVoltage2": plc_data.get("presentVoltage2"),
        "presentCurrent2": plc_data.get("presentCurrent2"),
        "powerKw2": plc_data.get("powerKw2"),
        "SOC2": plc_data.get("SOC2"),
        "temp1Head2": plc_data.get("temp1Head2"),
        "temp2Head2": plc_data.get("temp2Head2"),
        "insulationFault2": plc_data.get("insulationFault2"),
        "peCut2": plc_data.get("peCut2"),
        "cpFault2": plc_data.get("cpFault2"),
        "activeMld2": plc_data.get("activeMld2"),
        "tempPowerModule2": plc_data.get("tempPowerModule2"),
        "dynamicMaxCurrent2": plc_data.get("dynamicMaxCurrent2"),
        "powerLimit2": plc_data.get("powerLimit2"),
        "maxPower2": plc_data.get("maxPower2"),
        "maxVoltage2": plc_data.get("maxVoltage2"),
        "maxCurrent2": plc_data.get("maxCurrent2"),
        "measuredVoltage2": plc_data.get("measuredVoltage2"),
        "measuredCurrent2": plc_data.get("measuredCurrent2"),
        "insuStatus2": plc_data.get("insuStatus2"),
        "ACMagStatus2": plc_data.get("ACMagStatus2"),
        "CPStatus2": plc_data.get("CPStatus2"),
        
        # DC Contractors
        "DCConType1": plc_data.get("DCConType1"),
        "DCConType2": plc_data.get("DCConType2"),
        "DCConType3": plc_data.get("DCConType3"),
        "DCConType4": plc_data.get("DCConType4"),
        "DCConType5": plc_data.get("DCConType5"),
        "DCConType6": plc_data.get("DCConType6"),
        
        # Others
        "fan_status1_8": plc_data.get("fan_status1_8"),
        "surge": plc_data.get("surge"),
        "pi5_temp": plc_data.get("pi5_temp"),
        "HMI_status": plc_data.get("HMI_status"),
        "PLC1_status": plc_data.get("PLC1_status"),
        "PLC2_status": plc_data.get("PLC2_status"),
        
        "timestamp_utc": now_utc(),
        "timestamp": timestamp
    }


def create_setting_document(plc_data: Dict[str, Any], 
                            insulation_data: Optional[Dict] = None,
                            timestamp: str = None) -> Dict[str, Any]:
    """
    Create settingParameter collection document.
    Matches Node-RED format exactly.
    """
    # Get insulation values
    insu_kohm1 = None
    insu_kohm2 = None
    insu_fault1 = False
    insu_fault2 = False
    
    if insulation_data:
        insu1 = insulation_data.get("insulation1", {}) or {}
        insu2 = insulation_data.get("insulation2", {}) or {}
        insu_kohm1 = insu1.get("RF_kohm")
        insu_kohm2 = insu2.get("RF_kohm")
        insu_fault1 = insu1.get("is_alarm", False)
        insu_fault2 = insu2.get("is_alarm", False)
    
    # If no insulation data from aggregator, use PLC insuStatus as kohm value
    if insu_kohm1 is None:
        insu_kohm1 = parse_int(plc_data.get("insuStatus1"))
    if insu_kohm2 is None:
        insu_kohm2 = parse_int(plc_data.get("insuStatus2"))
    
    return {
        "icp1": plc_data.get("icp1"),
        "usl1": plc_data.get("usl1"),
        "icp2": plc_data.get("icp2"),
        "usl2": plc_data.get("usl2"),
        "present_current1": parse_float(plc_data.get("presentCurrent1")),
        "present_current2": parse_float(plc_data.get("presentCurrent2")),
        "dynamic_max_current1": parse_float(plc_data.get("dynamicMaxCurrent1")),
        "dynamic_max_current2": parse_float(plc_data.get("dynamicMaxCurrent2")),
        "power_limit1": parse_float(plc_data.get("powerLimit1")),
        "power_limit2": parse_float(plc_data.get("powerLimit2")),
        "power_limit0": parse_float(plc_data.get("powerLimit1")) + parse_float(plc_data.get("powerLimit2")),
        "dynamic_max_power1": parse_float(plc_data.get("dynamicMaxPower1", 0)),
        "dynamic_max_power2": parse_float(plc_data.get("dynamicMaxPower2", 0)),
        "start_charging_cmd1": parse_int(plc_data.get("startChargingCmd1", 0)),
        "stop_charging_cmd1": parse_int(plc_data.get("stopChargingCmd1", 0)),
        "start_charging_cmd2": parse_int(plc_data.get("startChargingCmd2", 0)),
        "stop_charging_cmd2": parse_int(plc_data.get("stopChargingCmd2", 0)),
        "max_voltage1": parse_float(plc_data.get("maxVoltage1")),
        "max_voltage2": parse_float(plc_data.get("maxVoltage2")),
        "max_current1": parse_float(plc_data.get("maxCurrent1")),
        "max_current2": parse_float(plc_data.get("maxCurrent2")),
        "max_power1": parse_float(plc_data.get("maxPower1")),
        "max_power2": parse_float(plc_data.get("maxPower2")),
        "measured_voltage1": plc_data.get("measuredVoltage1"),
        "measured_voltage2": parse_float(plc_data.get("measuredVoltage2")),
        "measured_current1": parse_float(plc_data.get("measuredCurrent1")),
        "measured_current2": parse_float(plc_data.get("measuredCurrent2")),
        "energy_power_kWh1": parse_float(plc_data.get("powerKw1", 0)),
        "energy_power_kWh2": parse_float(plc_data.get("powerKw2", 0)),
        "CP_status1": plc_data.get("CPStatus1"),
        "CP_status2": plc_data.get("CPStatus2"),
        "target_voltage1": plc_data.get("targetVoltage1"),
        "target_voltage2": plc_data.get("targetVoltage2"),
        "target_current1": plc_data.get("targetCurrent1"),
        "target_current2": plc_data.get("targetCurrent2"),
        "SOC1": plc_data.get("SOC1"),
        "SOC2": plc_data.get("SOC2"),
        "insulation_monitoring1": insu_kohm1,
        "insulation_monitoring2": insu_kohm2,
        "insulation_kohm1": insu_kohm1,
        "insulation_kohm2": insu_kohm2,
        "insulation_fault1": insu_fault1,
        "insulation_fault2": insu_fault2,
        "timestamp_utc": now_utc(),
        "timestamp": timestamp or plc_data.get("timestamp")
    }

def create_utilization_document(state: 'StationState', timestamp: str) -> Dict[str, Any]:
    """
    Create utilizationFactor collection document.
    Matches Node-RED format: motor_starter1-5 (not motor_starter1_count)
    """
    # Get all counter values
    dc_counts = state.counters.get_dc_counts()
    ac_counts = state.counters.get_ac_counts()
    ms_counts = state.counters.get_ms_counts()
    
    # Get timer values in SECONDS
    fuse1_sec = state.timers.get_fuse_seconds(1)
    fuse2_sec = state.timers.get_fuse_seconds(2)
    
    # Get base service life in SECONDS
    # This should come from ebCountDevice total_minutes * 60
    base_sl_sec = state.service_life.get_service_life_seconds('router')
    
    return {
        "DC_power_contractor1": dc_counts.get("dc1", 0),
        "DC_power_contractor2": dc_counts.get("dc2", 0),
        "DC_power_contractor3": dc_counts.get("dc3", 0),
        "DC_power_contractor4": dc_counts.get("dc4", 0),
        "DC_power_contractor5": dc_counts.get("dc5", 0),
        "DC_power_contractor6": dc_counts.get("dc6", 0),
        "FUSE1": fuse1_sec,
        "FUSE2": fuse2_sec,
        "Router": base_sl_sec,
        "FUSEControl": base_sl_sec,
        "circuitBreakerFan": base_sl_sec,
        "RCBO": base_sl_sec,
        "RCCB1": base_sl_sec,
        "RCCB2": base_sl_sec,
        "AC_power_contractor1": ac_counts.get("ac1", 0),
        "AC_power_contractor2": ac_counts.get("ac2", 0),
        # motor_starter1-5 (not motor_starter1_count)
        "motor_starter1": ms_counts.get("ms1", 0),
        "motor_starter2": ms_counts.get("ms2", 0),
        "motor_starter3": ms_counts.get("ms3", 0),
        "motor_starter4": ms_counts.get("ms4", 0),
        "motor_starter5": ms_counts.get("ms5", 0),
        "energyMeter1": base_sl_sec,
        "energyMeter2": base_sl_sec,
        "OCPPDevice": base_sl_sec,
        "fanController": base_sl_sec,
        "chargingController1": base_sl_sec,
        "chargingController2": base_sl_sec,
        "powerSupplies": base_sl_sec,
        "insulationMonitoring1": base_sl_sec,
        "insulationMonitoring2": base_sl_sec,
        "DCConverter": base_sl_sec,
        "surtgeProtection": base_sl_sec,
        "disconnectSwitch": base_sl_sec,
        "noiseFilter": base_sl_sec,
        "timestamp_utc": now_utc(),
        "timestamp": timestamp
    }


def create_mdb_document(mdb_data: Dict[str, Any], rssi: float = 0,
                        timestamp: str = None) -> Dict[str, Any]:
    """Create MDB collection document"""
    return {
        "frequency": mdb_data.get("Freq"),
        "humidity": mdb_data.get("Ambient_RH"),
        "VL1N": mdb_data.get("V_L1N"),
        "VL2N": mdb_data.get("V_L2N"),
        "VL3N": mdb_data.get("V_L3N"),
        "VL1L2": mdb_data.get("V_L1L2"),
        "VL2L3": mdb_data.get("V_L2L3"),
        "VL1L3": mdb_data.get("V_L3L1"),
        "I1": mdb_data.get("I_L1"),
        "I2": mdb_data.get("I_L2"),
        "I3": mdb_data.get("I_L3"),
        "I_total": mdb_data.get("I_Total"),
        "PL1N": mdb_data.get("P_Active_L1"),
        "PL2N": mdb_data.get("P_Active_L2"),
        "PL3N": mdb_data.get("P_Active_L3"),
        "PL123N": (parse_float(mdb_data.get("P_Active_L1")) + 
                  parse_float(mdb_data.get("P_Active_L2")) + 
                  parse_float(mdb_data.get("P_Active_L3"))),
        "EL1": mdb_data.get("E_Active_L1"),
        "EL2": mdb_data.get("E_Active_L2"),
        "EL3": mdb_data.get("E_Active_L3"),
        "EL123": mdb_data.get("E_Active_Total"),
        "THDU_L1N": mdb_data.get("THD_U_L1N"),
        "THDU_L2N": mdb_data.get("THD_U_L2N"),
        "THDU_L3N": mdb_data.get("THD_U_L3N"),
        "THDI_L1": mdb_data.get("THD_I_L1"),
        "THDI_L2": mdb_data.get("THD_I_L2"),
        "THDI_L3": mdb_data.get("THD_I_L3"),
        "pfL1": mdb_data.get("PF_L1"),
        "pfL2": mdb_data.get("PF_L2"),
        "pfL3": mdb_data.get("PF_L3"),
        "tempc": mdb_data.get("Ambient_Temp"),
        "RSSI": rssi,
        "MCU_temp": mdb_data.get("MCU_Temp"),
        "MDB_pressure": mdb_data.get("BME_Pressure"),
        "breaker_main": mdb_data.get("Breaker_Main"),
        "breaker_charger": mdb_data.get("Breaker_Charger"),
        "timestamp_utc": now_utc(),
        "timestamp": timestamp
    }


def create_cbm_document(state: 'StationState', cbm_data: Dict[str, Any],
                        timestamp: str = None) -> Dict[str, Any]:
    """Create monitorCBM collection document"""
    plc_data = state.get_latest('plc') or {}
    dc_counts = state.counters.get_dc_counts()
    fan_rpms = state.get_all_fan_rpm()
    fan_status = str(plc_data.get('fan_status1_8', '0'))
    
    doc = {
        "power_module_temp1": parse_int(plc_data.get("tempPowerModule1")),
        "power_module_temp2": parse_int(plc_data.get("tempPowerModule1")),
        "power_module_temp3": parse_int(plc_data.get("tempPowerModule2")),
        "power_module_temp4": parse_int(plc_data.get("tempPowerModule2")),
        "power_module_temp5": parse_int(plc_data.get("tempPowerModule2")),
        "charger_gun_temp_plus1": parse_int(plc_data.get("temp1Head1")),
        "charger_gun_temp_plus2": parse_int(plc_data.get("temp1Head2")),
        "charger_gan_temp_minus1": parse_int(plc_data.get("temp2Head1")),
        "charger_gan_temp_minus2": parse_int(plc_data.get("temp2Head2")),
        "router_temp": parse_float(cbm_data.get("Luang3", {}).get("rt_temp", 0)) / 10 if cbm_data.get("Luang3", {}).get("rt_temp") else 0,
        "RSSI_router": cbm_data.get("Luang3", {}).get("rssi"),
        "MDB_temp": cbm_data.get("MDB", {}).get("ambient_temp"),
        "edgebox_temp": cbm_data.get("EBTemp", {}).get("eb_temp"),
        "pi5_temp": plc_data.get("pi5_temp"),
        "charger_relative_humidity": cbm_data.get("Ambient", {}).get("humidity"),
        "DC_charger_temp": cbm_data.get("Ambient", {}).get("ambient_temp"),
        "DC_power_contractor1": dc_counts.get("dc1", 0),
        "DC_power_contractor2": dc_counts.get("dc2", 0),
        "DC_power_contractor3": dc_counts.get("dc3", 0),
        "DC_power_contractor4": dc_counts.get("dc4", 0),
        "DC_power_contractor5": dc_counts.get("dc5", 0),
        "DC_power_contractor6": dc_counts.get("dc6", 0),
        "insulation_monitoring_status1": parse_int(plc_data.get("insuStatus1")),
        "insulation_monitoring_status2": parse_int(plc_data.get("insuStatus2")),
        "AC_magnetic_contactor_status1": parse_int(plc_data.get("ACMagStatus1")),
        "AC_magnetic_contactor_status2": parse_int(plc_data.get("ACMagStatus2")),
        "MDB_relative_humidity": cbm_data.get("MDB", {}).get("ambient_rt"),
        "timestamp_utc": now_utc(),
        "timestamp": timestamp
    }
    
    # Add fan RPMs and status
    for i in range(1, state.config.hardware.dcFanCount + 1):
        doc[f"fan_RPM{i}"] = fan_rpms.get(f"fan{i}", 0)
        doc[f"fan_status{i}"] = parse_int(fan_status)
    
    return doc


def create_module1_document(state: 'StationState', mdb_data: Dict[str, Any],
                            timestamp: str = None) -> Dict[str, Any]:
    """Create module1MdbDustPrediction collection document"""
    from datetime import datetime as dt
    now = dt.now()
    
    plc_data = state.get_latest('plc') or {}
    mdb_status = state.service_life.get_heartbeat_status('mdb')
    
    # Calculate dust filter time in SECONDS
    dust_filter_sec = 0
    if state.dust_filter_enabled and state.pm_date:
        try:
            from utils.time_utils import TZ
            pm_dt = dt.strptime(state.pm_date, "%Y-%m-%d")
            pm_dt = TZ.localize(pm_dt)
            now_tz = dt.now(TZ)
            diff = now_tz - pm_dt
            dust_filter_sec = int(diff.total_seconds())
        except:
            pass
    
    return {
        "time_of_day": now.strftime("%H:%M:%S"),
        "day_of_month": now.day,
        "mouth_of_year": now.month,
        "MDB_ambient_temp": mdb_data.get("Ambient_Temp"),
        "pi5_temp": plc_data.get("pi5_temp"),
        "MDB_pressure": mdb_data.get("BME_Pressure"),
        "MDB_humidity": mdb_data.get("Ambient_RH"),
        "MDB_status": mdb_status,
        "dust_filter_charging": dust_filter_sec,
        "meter1": state.get_meter_data().get('meter1', 0),
        "meter2": state.get_meter_data().get('meter2', 0),
        "timestamp_utc": now_utc(),
        "timestamp": timestamp
    }


def create_module2_document(state: 'StationState', module2_data: Dict[str, Any],
                            timestamp: str = None) -> Dict[str, Any]:
    """
    Create module2ChargerDustPrediction collection document.
    Matches Node-RED format exactly.
    
    module2_data structure:
    {
        'Ambient': {'ambient_temp': ..., 'humidity': ...},
        'BME280': {'pressure': ...},
        'Router': {'rt_temp': ...},
        'EBTemp': {'eb_temp': ...}
    }
    """
    from datetime import datetime as dt
    now = dt.now()
    
    plc_data = state.get_latest('plc') or {}
    mdb_data = state.get_latest('mdb') or {}
    
    ambient = module2_data.get('Ambient', {}) or {}
    bme280 = module2_data.get('BME280', {}) or {}
    router = module2_data.get('Router', {}) or {}
    eb_temp_data = module2_data.get('EBTemp', {}) or {}
    
    # Get fan data
    fan_rpms = state.get_all_fan_rpm()
    fan_status = str(plc_data.get('fan_status1_8', '0'))
    
    # Calculate time_since_last_DFC (DC Fan Cleaning) - use service life seconds
    time_since_last_dfc = state.service_life.get_service_life_seconds('router')
    
    # Calculate total energy
    total_e = mdb_data.get("E_Active_Total")
    
    # Get power values
    power_kw1 = parse_float(plc_data.get("powerKw1", 0))
    power_kw2 = parse_float(plc_data.get("powerKw2", 0))
    
    doc = {
        "time_of_day": now.strftime("%H:%M:%S"),
        "day_of_month": now.day,
        "mouth_of_year": now.month,
        "ambient_temp": ambient.get('ambient_temp'),
        "edgebox_temp": eb_temp_data.get('eb_temp'),
        "router_temp": router.get('rt_temp'),
        "power_module_temp1": parse_int(plc_data.get("tempPowerModule1", 0)),
        "power_module_temp2": parse_int(plc_data.get("tempPowerModule1", 0)),
        "power_module_temp3": parse_int(plc_data.get("tempPowerModule2", 0)),
        "power_module_temp4": parse_int(plc_data.get("tempPowerModule2", 0)),
        "power_module_temp5": parse_int(plc_data.get("tempPowerModule2", 0)),
        "pi5_temp": plc_data.get("pi5_temp"),
        "pressure": bme280.get('pressure'),
        "humidity": ambient.get('humidity'),
        "total_E_since": total_e,
        "P(t)1": power_kw1,
        "P(t)2": power_kw2,
        "present_voltage1": plc_data.get("presentVoltage1"),
        "present_current1": plc_data.get("presentCurrent1"),
        "present_voltage2": plc_data.get("presentVoltage2"),
        "present_current2": plc_data.get("presentCurrent2"),
        "time_since_last_DFC": time_since_last_dfc,
        "meter1": state.get_meter_data().get('meter1', 0),
        "meter2": state.get_meter_data().get('meter2', 0),
        "timestamp_utc": now_utc(),
        "timestamp": timestamp
    }
    
    # Add fan status and RPM (1-8)
    for i in range(1, 9):
        doc[f"fan_status{i}"] = parse_int(fan_status)
        doc[f"fan_RPM{i}"] = fan_rpms.get(f"fan{i}", 0)
    
    return doc


def create_module3_document(state: 'StationState', mdb_data: Dict[str, Any],
                            cbm_data: Dict[str, Any], timestamp: str = None) -> Dict[str, Any]:
    """Create module3ChargerOfflineAnalysis collection document"""
    from datetime import datetime as dt
    now = dt.now()
    
    plc_data = state.get_latest('plc') or {}
    eb_error = state.get_latest('eb_error') or {}
    
    return {
        "time": now.strftime("%H:%M:%S"),
        "day_of_month": now.day,
        "mouth_of_year": now.month,
        "I1_MDB": mdb_data.get("I_L1"),
        "I2_MDB": mdb_data.get("I_L2"),
        "I3_MDB": mdb_data.get("I_L3"),
        "VL1N_MDB": mdb_data.get("V_L1N"),
        "VL2N_MDB": mdb_data.get("V_L2N"),
        "VL3N_MDB": mdb_data.get("V_L3N"),
        "edgebox_temp": cbm_data.get("EBTemp", {}).get("eb_temp"),
        "pi5_temp": plc_data.get("pi5_temp"),
        "charger_temp": cbm_data.get("MDB", {}).get("ambient_temp"),
        "router_internet_status": state.get_router_internet_status(),
        "RSSI": cbm_data.get("Luang3", {}).get("rssi"),
        "edgebox_error_code": eb_error.get("error"),
        "edgebox_status": state.service_life.get_heartbeat_status('edgebox'),
        "MDB_status": state.service_life.get_heartbeat_status('mdb'),
        "PLC1_status": plc_data.get("PLC1_status"),
        "PLC2_status": plc_data.get("PLC2_status"),
        "router_status": state.service_life.get_heartbeat_status('router'),
        "energy_meter_status": state.service_life.get_energy_meter_status(1),
        "surge_arrestor_status": state.get_surge_status(),
        "RCBO_status": state.service_life.get_rcbo_status(),
        "meter1": state.get_meter_data().get('meter1', 0),
        "meter2": state.get_meter_data().get('meter2', 0),
        "timestamp_utc": now_utc(),
        "timestamp": timestamp
    }


def create_module4_document(state: 'StationState', cbm_data: Dict[str, Any],
                            timestamp: str = None) -> Dict[str, Any]:
    """
    Create module4AbnormalPowerPrediction collection document.
    Matches Node-RED format - uses PLC data, not MDB data!
    """
    from datetime import datetime as dt
    now = dt.now()
    
    plc_data = state.get_latest('plc') or {}
    mdb_data = state.get_latest('mdb') or {}
    
    return {
        "time": now.strftime("%H:%M:%S"),
        "day_of_month": now.day,
        "mouth_of_year": now.month,
        "target_voltage1": plc_data.get("targetVoltage1"),
        "target_voltage2": plc_data.get("targetVoltage2"),
        "target_current1": plc_data.get("targetCurrent1"),
        "target_current2": plc_data.get("targetCurrent2"),
        "present_voltage1": plc_data.get("presentVoltage1"),
        "present_voltage2": plc_data.get("presentVoltage2"),
        "present_current1": plc_data.get("presentCurrent1"),
        "present_current2": plc_data.get("presentCurrent2"),
        "power_module_status1": state.get_power_module_status(1),
        "power_module_status2": state.get_power_module_status(2),
        "power_module_status3": state.get_power_module_status(3),
        "power_module_status4": state.get_power_module_status(4),
        "power_module_status5": state.get_power_module_status(5),
        "SOC": plc_data.get("SOC1"),  # Use SOC1 as main SOC
        "power_module_temp1": parse_int(plc_data.get("tempPowerModule1", 0)),
        "power_module_temp2": parse_int(plc_data.get("tempPowerModule1", 0)),
        "power_module_temp3": parse_int(plc_data.get("tempPowerModule2", 0)),
        "power_module_temp4": parse_int(plc_data.get("tempPowerModule2", 0)),
        "power_module_temp5": parse_int(plc_data.get("tempPowerModule2", 0)),
        "charger_temp": cbm_data.get("Ambient", {}).get("ambient_temp") or mdb_data.get("Ambient_Temp"),
        "charger_gun_temp_plus1": parse_int(plc_data.get("temp1Head1")),
        "charger_gun_temp_plus2": parse_int(plc_data.get("temp1Head2")),
        "charger_gun_temp_minus1": parse_int(plc_data.get("temp2Head1")),
        "charger_gun_temp_minus2": parse_int(plc_data.get("temp2Head2")),
        "humidity": cbm_data.get("MDB", {}).get("ambient_rt") or mdb_data.get("Ambient_RH"),
        "PLC1_status": plc_data.get("PLC1_status"),
        "PLC2_status": plc_data.get("PLC2_status"),
        "edgebox_temp": cbm_data.get("EBTemp", {}).get("eb_temp"),
        "energy_meter_status": state.service_life.get_energy_meter_status(1),
        "meter1": state.get_meter_data().get('meter1', 0),
        "meter2": state.get_meter_data().get('meter2', 0),
        "timestamp_utc": now_utc(),
        "timestamp": timestamp
    }


def create_module5_document(state: 'StationState', timestamp: str = None) -> Dict[str, Any]:
    """Create module5NetworkProblemPrediction collection document"""
    from datetime import datetime as dt
    now = dt.now()
    
    plc_data = state.get_latest('plc') or {}
    
    return {
        "time": now.strftime("%H:%M:%S"),
        "PLC_network_status1": plc_data.get("PLC1_status"),
        "PLC_network_status2": plc_data.get("PLC2_status"),
        "edgebox_network_status": state.service_life.get_heartbeat_status('edgebox'),
        "pi5_network_status": state.service_life.get_heartbeat_status('pi5'),
        "router_status": state.service_life.get_heartbeat_status('router'),
        "energy_meter_network_status1": state.service_life.get_energy_meter_status(1),
        "energy_meter_network_status2": state.service_life.get_energy_meter_status(2),
        "HMI_status": plc_data.get("HMI_status"),
        "router_network_status": state.get_router_internet_status(),
        "meter1": state.get_meter_data().get('meter1', 0),
        "meter2": state.get_meter_data().get('meter2', 0),
        "timestamp_utc": now_utc(),
        "timestamp": timestamp
    }


def create_module6_document(state: 'StationState', cbm_data: Dict[str, Any],
                            timestamp: str = None) -> Dict[str, Any]:
    """Create module6DcChargerRulPrediction collection document - ALL SERVICE LIFE IN SECONDS"""
    dc_counts = state.counters.get_dc_counts()
    ac_counts = state.counters.get_ac_counts()
    pm_seconds = state.timers.get_pm_seconds()
    dc_fan_seconds = state.timers.get_dc_fan_seconds(1)
    
    plc_data = state.get_latest('plc') or {}
    base_sl_sec = state.service_life.get_service_life_seconds('router')  # SECONDS
    ambient_temp = cbm_data.get("Ambient", {}).get("ambient_temp", 0)
    
    doc = {
        "DC_power_contractor_RUL1": {"DC_power_contractor_frequency": dc_counts.get("dc1", 0)},
        "DC_power_contractor_RUL2": {"DC_power_contractor_frequency": dc_counts.get("dc2", 0)},
        "DC_power_contractor_RUL3": {"DC_power_contractor_frequency": dc_counts.get("dc3", 0)},
        "DC_power_contractor_RUL4": {"DC_power_contractor_frequency": dc_counts.get("dc4", 0)},
        "DC_power_contractor_RUL5": {"DC_power_contractor_frequency": dc_counts.get("dc5", 0)},
        "DC_power_contractor_RUL6": {"DC_power_contractor_frequency": dc_counts.get("dc6", 0)},
        "router_RUL": {
            "router_service_life": base_sl_sec,
            "router_temp": cbm_data.get("Luang3", {}).get("rt_temp", 0),
            "charger_temp": ambient_temp
        },
        "AC_ppower_contractor_RUL1": {"AC_power_contractor_frequency": ac_counts.get("ac1", 0)},
        "AC_ppower_contractor_RUL2": {"AC_power_contractor_frequency": ac_counts.get("ac2", 0)},
        "energy_meter_RUL1": {
            "energy_meter_service_life": base_sl_sec,
            "energy_meter_temp": ambient_temp,
            "charger_temp": ambient_temp
        },
        "energy_meter_RUL2": {
            "energy_meter_service_life": base_sl_sec,
            "energy_meter_temp": ambient_temp,
            "charger_temp": ambient_temp
        },
        "edgebox_RUL": {
            "edgebox_service_life": base_sl_sec,
            "edgebox_temp": cbm_data.get("EBTemp", {}).get("eb_temp", 0),
            "charger_temp": ambient_temp
        },
        "pi5_RUL": {
            "pi5_service_life": base_sl_sec,
            "pi5_temp": plc_data.get("pi5_temp", 0),
            "charger_temp": ambient_temp
        },
        "PLC_RUL1": {"PLC_service_life": base_sl_sec, "charger_temp": ambient_temp},
        "PLC_RUL2": {"PLC_service_life": base_sl_sec, "charger_temp": ambient_temp},
        "power_supplies_RUL": {"power_supplies_service_life": base_sl_sec, "charger_temp": ambient_temp},
        "insulation_monitoring_RUL1": {"insulation_monitoring_service_life1": base_sl_sec, "charger_temp": ambient_temp},
        "insulation_monitoring_RUL2": {"insulation_monitoring_service_life1": base_sl_sec, "charger_temp": ambient_temp},
        "switching_power_supply_RUL": {"switching_power_supply_service_life": base_sl_sec, "charger_temp": ambient_temp},
        "meter1": state.get_meter_data().get('meter1', 0),
        "meter2": state.get_meter_data().get('meter2', 0),
        "timestamp_utc": now_utc(),
        "timestamp": timestamp
    }
    
    # Add power module RULs - SECONDS
    for i in range(1, state.config.hardware.powerModuleCount + 1):
        pm_sl_sec = pm_seconds.get(f"pm{i}", 0)  # Already in seconds
        pm_temp = parse_int(plc_data.get(f"tempPowerModule{min(i, 2)}"))
        doc[f"power_module_RUL{i}"] = {
            "power_module_service_life": pm_sl_sec,
            "charger_temp": ambient_temp,
            "power_module_temp": pm_temp,
            "power_module_total_kWh": 0,
            "power_module_efficiency": 0
        }
    
    # Add DC fan RULs - SECONDS
    dc_fan_sl_sec = dc_fan_seconds  # Already in seconds
    for i in range(1, state.config.hardware.dcFanCount + 1):
        doc[f"DC_fan_RUL{i}"] = {
            "DC_fan_service_life": dc_fan_sl_sec,
            "charger_temp": ambient_temp
        }
    
    return doc


def create_module7_document(state: 'StationState', timestamp: str = None) -> Dict[str, Any]:
    """Create module7ChargerPowerIssue collection document"""
    plc_data = state.get_latest('plc') or {}
    
    return {
        "AC_magnetic_contractor1": plc_data.get("ACMagStatus1"),
        "AC_magnetic_contractor2": plc_data.get("ACMagStatus2"),
        "DC_contractor1": plc_data.get("DCConType1"),
        "DC_contractor2": plc_data.get("DCConType2"),
        "DC_contractor3": plc_data.get("DCConType3"),
        "DC_contractor4": plc_data.get("DCConType4"),
        "DC_contractor5": plc_data.get("DCConType5"),
        "DC_contractor6": plc_data.get("DCConType6"),
        "CP_status1": plc_data.get("CPStatus1"),
        "CP_status2": plc_data.get("CPStatus2"),
        "PE_status1": plc_data.get("peCut1"),
        "PE_status2": plc_data.get("peCut2"),
        "router_status": state.service_life.get_heartbeat_status('router'),
        "power_module_status1": state.get_power_module_status(1),
        "power_module_status2": state.get_power_module_status(2),
        "power_module_status3": state.get_power_module_status(3),
        "power_module_status4": state.get_power_module_status(4),
        "power_module_status5": state.get_power_module_status(5),
        "energy_meter_status1": state.service_life.get_energy_meter_status(1),
        "energy_meter_status2": state.service_life.get_energy_meter_status(2),
        "edgebox_status": state.service_life.get_heartbeat_status('edgebox'),
        "PLC1_status": plc_data.get("PLC1_status"),
        "PLC2_status": plc_data.get("PLC2_status"),
        "PLC1_error": plc_data.get("head1Error"),
        "PLC2_error": plc_data.get("head2Error"),
        "insulation_monitoring1": plc_data.get("insuStatus1"),
        "insulation_monitoring2": plc_data.get("insuStatus2"),
        "surge_protection_fault": state.get_surge_status(),
        "meter1": state.get_meter_data().get('meter1', 0),
        "meter2": state.get_meter_data().get('meter2', 0),
        "timestamp_utc": now_utc(),
        "timestamp": timestamp
    }
