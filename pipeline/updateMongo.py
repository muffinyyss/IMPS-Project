from pymongo import MongoClient, UpdateOne

# 1. ข้อมูลสถานี (รวบ hardware, topics ไว้ใน dict เดียวกันก่อน)
stations_data = [
    {
        "serialNumber": "F1500824011",
        "stationId": "PT_Pratunam_Phrain",
        
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
                "plc": "OCPP/PaIn1/PLC",
                "pi5Heartbeat": "OCPP/PaIn1/heartbeatPI5",
                "ebError": "OCPP/Elex_PT_PaIn1_1/error",
                "ebTemp": "OCPP/Elex_PT_PaIn1_1/edgeboxTemp",
                "ebHeartbeat": "OCPP/Elex_PT_PaIn1_1/heartbeat",
                "ebCountDevice": "OCPP/Elex_PT_PaIn1_1/totaltime",
                "router": "PratunamPhraIn1",
                "mdbRaw": "",
                "plcTemp1": "OCPP/PaIn1/plcTemp1",
                "plcTemp2": "OCPP/PaIn1/plcTemp2",
                "bme280": "OCPP/PaIn1/bme280",
                "insulation1": "OCPP/PaIn1/insu1",
                "insulation2": "OCPP/PaIn1/insu2",
                "fanRpm": "PaIn1/RPM"
            },
            "collections": {
                "meter": "PaIn1"
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