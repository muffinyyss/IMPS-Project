from pymongo import MongoClient, UpdateOne

# 1. ข้อมูลสถานี (รวบ hardware, topics ไว้ใน dict เดียวกันก่อน)
stations_data = [
    {
        "serialNumber": "F1500824020",
        "stationId": "PT_PhromBuri2",
        
        # ก้อนนี้คือสิ่งที่จะไปอยู่ใน pipeline_config
        "config_details": {
            "hardware": {
                "dcContractorCount": 6,
                "powerModuleCount": 5,
                "dcFanCount": 7,
                "fanType": "EBM",
                "energyMeterType": "PILOT",
                "powerModuleDefaults": {"pm1": 2, "pm2": 3}
            },
            "topics": {
                "plc": "OCPP/PhromBuri2/PLC",
                "pi5Heartbeat": "OCPP/PhromBuri2/heartbeatPI5",
                "ebError": "OCPP/PhromBuri2/error",
                "ebTemp": "OCPP/PhromBuri2/edgeboxTemp",
                "ebHeartbeat": "OCPP/Elex_DC_PT_PhromBuri2_1/heartbeat",
                "ebCountDevice": "OCPP/PhromBuri2/totaltime",
                "router": "PhromBuri2",
                "mdbRaw": "",
                "plcTemp1": "OCPP/PhromBuri2/plcTemp1",
                "plcTemp2": "OCPP/PhromBuri2/plcTemp2",
                "bme280": "OCPP/PhromBuri2/bme280",
                "insulation1": "OCPP/PhromBuri2/insu1",
                "insulation2": "OCPP/PhromBuri2/insu2",
                "fanRpm": "PhromBuri2/RPM"
            },
            "collections": {
                "meter": "PhromBuri2"
            },
            "service_life": {
                "endDate": "2026-03-01T20:00:00"
            }
        }
    },
    
]

def update_by_serial(data_list):
    # เชื่อมต่อ MongoDB
    db = client["iMPS"]
    collection = db["charger"]

    operations = []
    
    for item in data_list:
        # ใช้ .get() เพื่อป้องกัน KeyError ถ้าพิมพ์ชื่อ Key ผิดโปรแกรมจะไม่พัง
        sn = item.get("serialNumber")
        s_id = item.get("stationId")
        config = item.get("config_details")

        if not sn:
            print("Warning: Found item without serialNumber, skipping...")
            continue
        
        # สร้าง Query ค้นหาด้วย Field "SN" ใน Database
        query = {"SN": sn}
        
        # จัดโครงสร้างให้ตรงกับในรูป (ยัด config เข้าไปใน pipeline_config)
        update_payload = {
            "$set": {
                "station_id": s_id,
                "pipeline_config": config
            }
        }
        
        operations.append(UpdateOne(query, update_payload, upsert=True))

    if operations:
        try:
            result = collection.bulk_write(operations)
            print(f"--- Bulk Update Completed ---")
            print(f"Matched: {result.matched_count}")
            print(f"Modified: {result.modified_count}")
            print(f"Upserted (New): {result.upserted_count}")
        except Exception as e:
            print(f"Error during bulk write: {e}")

# รันฟังก์ชัน
if __name__ == "__main__":
    update_by_serial(stations_data)