#!/usr/bin/env python3
"""
One-time script to rebase service_life for all stations.
service_life = now - commissioningDate
"""
import sys
from datetime import datetime, timezone
from pymongo import MongoClient, DESCENDING

# Config
IMPS_URI = "mongodb://imps_platform:eds_imps@203.154.130.132:27017/?authSource=admin&directConnection=true"
IMPS_DB = "iMPS"
UTIL_DB = "utilizationFactor"

# Fields to update with service_life
SERVICE_LIFE_FIELDS = [
    "Router", "FUSEControl", "circuitBreakerFan", "RCBO", "RCCB1", "RCCB2",
    "energyMeter1", "energyMeter2", "OCPPDevice", "fanController",
    "chargingController1", "chargingController2", "powerSupplies",
    "insulationMonitoring1", "insulationMonitoring2", "DCConverter",
    "surtgeProtection", "disconnectSwitch", "noiseFilter"
]

def parse_date(date_str: str) -> datetime:
    """Parse date string to datetime"""
    if not date_str:
        return None
    
    # Try different formats
    formats = [
        "%Y-%m-%d",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%SZ",
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    
    return None

def main(dry_run: bool = True):
    print(f"{'=' * 60}")
    print(f"Rebase Service Life Script")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE UPDATE'}")
    print(f"{'=' * 60}")
    
    client = MongoClient(IMPS_URI)
    imps_db = client[IMPS_DB]
    util_db = client[UTIL_DB]
    
    now = datetime.now(timezone.utc)
    print(f"Current time: {now.isoformat()}")
    print()
    
    # Get all stations with pipeline_config
    stations = list(imps_db.charger.find(
        {"pipeline_config": {"$exists": True}},
        {"station_id": 1, "SN": 1, "commissioningDate": 1}
    ))
    
    print(f"Found {len(stations)} stations with pipeline_config")
    print()
    
    updated = 0
    skipped = 0
    errors = 0
    
    for station in stations:
        station_id = station.get("station_id", "Unknown")
        sn = station.get("SN")
        comm_date_str = station.get("commissioningDate")
        
        if not sn:
            print(f"[{station_id}] ❌ No SN, skipping")
            skipped += 1
            continue
        
        if not comm_date_str:
            print(f"[{station_id}] ❌ No commissioningDate, skipping")
            skipped += 1
            continue
        
        comm_date = parse_date(comm_date_str)
        if not comm_date:
            print(f"[{station_id}] ❌ Invalid commissioningDate: {comm_date_str}")
            errors += 1
            continue
        
        # Calculate service_life in seconds
        service_life_sec = int((now - comm_date).total_seconds())
        
        if service_life_sec < 0:
            print(f"[{station_id}] ❌ Negative service_life (future date?): {comm_date_str}")
            errors += 1
            continue
        
        days = service_life_sec / 86400
        
        # Find latest document in utilizationFactor
        util_collection = util_db[sn]
        latest_doc = util_collection.find_one(sort=[("timestamp_utc", DESCENDING)])
        
        if not latest_doc:
            print(f"[{station_id}] ⚠️  No utilization document found")
            skipped += 1
            continue
        
        current_router = latest_doc.get("Router", 0)
        
        # Build update
        update_fields = {}
        for field in SERVICE_LIFE_FIELDS:
            update_fields[field] = service_life_sec
        
        print(f"[{station_id}] SN={sn}")
        print(f"    commissioningDate: {comm_date_str}")
        print(f"    Current Router: {current_router:,} sec ({current_router/86400:.1f} days)")
        print(f"    New value: {service_life_sec:,} sec ({days:.1f} days)")
        
        if not dry_run:
            result = util_collection.update_one(
                {"_id": latest_doc["_id"]},
                {"$set": update_fields}
            )
            if result.modified_count > 0:
                print(f"    ✅ Updated!")
                updated += 1
            else:
                print(f"    ⚠️  No change")
                skipped += 1
        else:
            print(f"    [DRY RUN] Would update")
            updated += 1
        
        print()
    
    print(f"{'=' * 60}")
    print(f"Summary:")
    print(f"  Updated: {updated}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors: {errors}")
    print(f"{'=' * 60}")
    
    client.close()

if __name__ == "__main__":
    # Default: dry run
    # Pass --live to actually update
    dry_run = "--live" not in sys.argv
    main(dry_run)