"""
IESB MAXIMO API Test Script
============================
ทดสอบ API สำหรับ:
1. Location Query - ดึงข้อมูล Location ที่เกี่ยวข้องกับ EV
2. SR Create - สร้าง Service Request ใหม่

Usage:
    python test_maximo_api.py
"""

import requests
import json
import urllib3
from datetime import datetime, timedelta

# ปิด SSL warning (สำหรับ dev server)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# =============================================================================
# Configuration
# =============================================================================
BASE_URL = "https://mmsiesb-dev.egat.co.th/maximo/api/os"
API_KEY = "2n3h0kbvkksvgakpktkod72hlcdlqkmruakme4op"  # DEV key จาก doc

# =============================================================================
# 1. Location Query
# =============================================================================
def query_locations(location_filter="%-EV%", location_type="OPERATING"):
    """
    ดึงข้อมูล Location จาก Maximo
    
    Args:
        location_filter: pattern สำหรับกรอง location (default: *-EV*)
        location_type: ประเภท location (default: OPERATING)
    
    Returns:
        list of locations หรือ None ถ้า error
    """

    
    url = f"{BASE_URL}/ZAPILOCATION"
    params = {
        "Content-Type": "application/json",
        "lean": 1,
        "oslc.select": "location,description",
        # "oslc.where": f'location="{location_filter}" and type="{location_type}"',
        "oslc.where": f'location="{location_filter}"',
    }
    headers = {
        "apikey": API_KEY,
    }

    print("=" * 60)
    print("1. LOCATION QUERY")
    print("=" * 60)
    print(f"GET {url}")
    print(f"Params: {json.dumps(params, indent=2, ensure_ascii=False)}")
    print("-" * 60)

    try:
        resp = requests.get(url, params=params, headers=headers, verify=False, timeout=30)
        print(f"Status: {resp.status_code}")

        if resp.status_code == 200:
            data = resp.json()
            print(f"Raw Response:\n{json.dumps(data, indent=2, ensure_ascii=False)}")
            members = data.get("member", [])
            print(f"พบ {len(members)} locations\n")
            for i, loc in enumerate(members, 1):
                print(f"  {i}. {loc.get('location', 'N/A'):20s} | {loc.get('description', 'N/A')}")
            print()
            return members
        else:
            print(f"Error Response: {resp.text[:500]}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"Connection Error: {e}")
        return None


# =============================================================================
# 2. Create Service Request (SR)
# =============================================================================
def create_sr(
    description: str,
    location: str,
    reported_priority: int = 3,
    target_start: str = None,
    target_finish: str = None,
    cost_center: str = "N402040",
    craft: str = "EVMAINT",
    site_id: str = "IESB",
):
    """
    สร้าง Service Request ใน Maximo

    Args:
        description:        คำอธิบายปัญหา เช่น "EleX / สถานี XX / ปัญหาที่พบ"
        location:           รหัสพื้นที่ (จาก Location API) เช่น "EGT0327-EV"
        reported_priority:  ความเร่งด่วน (1=Urgent, 2=High, 3=Medium, 4=Low)
        target_start:       วันที่เป้าหมายเข้าตรวจสอบ (YYYY-MM-DD)
        target_finish:      วันที่เป้าหมายแก้ไขเสร็จ (YYYY-MM-DD)
        cost_center:        ศูนย์ต้นทุน (default: N402040)
        craft:              กลุ่มผู้รับผิดชอบ (default: EVMAINT)
        site_id:            Site ID (default: IESB)

    Returns:
        ticketid ที่สร้างได้ หรือ None ถ้า error
    """
    if target_start is None:
        target_start = datetime.now().strftime("%Y-%m-%d")
    if target_finish is None:
        target_finish = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    url = f"{BASE_URL}/ZAPISR"
    params = {"lean": 1}
    headers = {
        "apikey": API_KEY,
        "Content-Type": "application/json",
        "properties": "ticketid",
    }
    payload = {
        "description": description,
        "assetsiteid": site_id,
        "siteid": site_id,
        "zcostcenter": cost_center,
        "location": location,
        "zcraft": craft,
        "reportedpriority": reported_priority,
        "targetstart": target_start,
        "targetfinish": target_finish,
    }

    print("=" * 60)
    print("2. CREATE SERVICE REQUEST")
    print("=" * 60)
    print(f"POST {url}")
    print(f"Payload:\n{json.dumps(payload, indent=2, ensure_ascii=False)}")
    print("-" * 60)

    try:
        resp = requests.post(
            url, params=params, headers=headers, json=payload, verify=False, timeout=30
        )
        print(f"Status: {resp.status_code}")

        if resp.status_code in (200, 201):
            data = resp.json()
            ticket_id = data.get("ticketid", "N/A")
            print(f"สร้าง SR สำเร็จ! Ticket ID: {ticket_id}")
            print(f"Response:\n{json.dumps(data, indent=2, ensure_ascii=False)}")
            return ticket_id
        else:
            print(f"Error Response: {resp.text[:500]}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"Connection Error: {e}")
        return None


# =============================================================================
# Main - ทดสอบทั้ง 2 API
# =============================================================================
if __name__ == "__main__":
    print(f"\nIESB MAXIMO API Test - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # --- Test 1: Query Locations ---
    locations = query_locations()

    # --- Test 2: Create SR ---
    print()
    create_sr(
        description="TESTAPI - ทดสอบสร้าง SR จาก Python Script",
        location="EGT0327-EV",
        reported_priority=3,  # Medium
    )