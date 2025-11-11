# test_pdf_photos.py
from fpdf import FPDF
from pymongo import MongoClient
import os
from io import BytesIO
import requests

# ---------------------------
# 1️⃣ ตั้งค่า MongoDB
# ---------------------------
MONGO_URI = "mongodb://localhost:8000"  # เปลี่ยนให้ตรงกับของคุณ
DB_NAME = "PMReport"            # ใส่ชื่อ database
COLLECTION_NAME = "Klongluang3"  # ใส่ชื่อ collection

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]

# ---------------------------
# 2️⃣ ดึงข้อมูลจาก MongoDB
# ---------------------------
doc = collection.find_one({"_id": {"$oid": "690820865d6713117d9dbdc8"}})
if not doc:
    print("❌ ไม่พบข้อมูลใน MongoDB")
    exit()

print("✅ ดึงข้อมูลสำเร็จ:", doc.get("station_id"))

# ---------------------------
# 3️⃣ สร้างคลาส PDF
# ---------------------------
class PDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 16)
        self.cell(0, 10, "Test Photo PDF", ln=True, align="C")
        self.ln(5)

# ---------------------------
# 4️⃣ สร้างเอกสาร PDF
# ---------------------------
pdf = PDF()
pdf.add_page()

photos = doc.get("photos", {})
if photos:
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Photos from MongoDB", ln=True, align="C")
    pdf.ln(10)

    x = 10
    y = pdf.get_y()
    w, h = 60, 45
    col = 0
    max_cols = 3

    for group, items in photos.items():
        for item in items:
            img_url = item.get("url")
            remark = item.get("remark", "")
            # ตัวอย่าง path รูปจริงในเครื่อง (ปรับให้ตรงกับระบบของคุณ)
            full_path = f"./backend{img_url}"

            if os.path.exists(full_path):
                pdf.image(full_path, x=x, y=y, w=w, h=h)
            else:
                # ถ้าไม่เจอรูปในเครื่อง ลองโหลดจาก URL
                try:
                    response = requests.get("http://localhost:8000" + img_url)
                    if response.status_code == 200:
                        pdf.image(BytesIO(response.content), x=x, y=y, w=w, h=h)
                    else:
                        pdf.set_xy(x, y + 20)
                        pdf.cell(w, 10, "รูปไม่พบ", border=1, align="C")
                except Exception as e:
                    pdf.set_xy(x, y + 20)
                    pdf.cell(w, 10, "Error", border=1, align="C")

            # แสดง remark ใต้รูป
            pdf.set_xy(x, y + h + 2)
            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(w, 8, remark or group, align="C")

            # ขยับตำแหน่ง
            x += w + 10
            col += 1
            if col == max_cols:
                col = 0
                x = 10
                y += h + 20

    pdf.ln(10)
else:
    pdf.cell(0, 10, "ไม่มีรูปภาพ", ln=True, align="C")

# ---------------------------
# 5️⃣ บันทึกเป็น PDF
# ---------------------------
output_path = "test_photos_output.pdf"
pdf.output(output_path)
print(f"✅ สร้างไฟล์ PDF เรียบร้อย: {output_path}")
