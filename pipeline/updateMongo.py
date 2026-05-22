from pymongo import MongoClient, UpdateOne

# 1. ข้อมูลสถานี (รวบ hardware, topics ไว้ใน dict เดียวกันก่อน)
stations_data = [
    {
        "serialNumber": "2222222",
        "stationId": "test",
        
        # ก้อนนี้คือสิ่งที่จะไปอยู่ใน pipeline_config
        "config_details": {
            "hardware": {
                "dcContractorCount": 6,
                "powerModuleCount": 5,
                "dcFanCount": 8,
                "fanType": "FIXED",
                "energyMeterType": "PILOT",
                "powerModuleDefaults": {"pm1": 2, "pm2": 3}
            },
            "topics": {
                "plc": "OCPP/Teststation/PLC",
                "pi5Heartbeat": "OCPP/Teststation/heartbeatPI5",
                "ebError": "OCPP/Teststation/error",
                "ebTemp": "OCPP/Teststation/edgeboxTemp",
                "ebHeartbeat": "OCPP/Teststation/heartbeat",
                "ebCountDevice": "OCPP/Teststation/totaltime",
                "router": "Teststation",
                "mdbRaw": "",
                "plcTemp1": "OCPP/Teststation/plcTemp1",
                "plcTemp2": "OCPP/Teststation/plcTemp2",
                "bme280": "OCPP/Teststation/bme280",
                "insulation1": "OCPP/Teststation/insu1",
                "insulation2": "OCPP/PaTeststationIn1/insu2",
                "fanRpm": "PaTeststationIn1/RPM"
            },
            "collections": {
                "meter": "Teststation"
            },
            "service_life": {
                "endDate": "2026-03-23T19:00:00"
            }
        }
    },
    
]

def update_by_serial(data_list):
    # เชื่อมต่อ MongoDB
    client = MongoClient("mongodb://imps_platform:eds_imps@203.154.130.132:27017/?authSource=admin&directConnection=true")
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