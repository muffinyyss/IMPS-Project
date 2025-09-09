# from fpdf import FPDF
# import os

# pdf = FPDF()
# pdf.add_page()

# # path ไปยังไฟล์ฟอนต์
# font_path = os.path.join(os.path.dirname(__file__), "fonts", "THSarabunNew.ttf")

# # โหลดฟอนต์ (ไม่ต้องใส่ uni= แล้ว เพราะ fpdf เวอร์ชันใหม่ไม่ใช้แล้ว)
# pdf.add_font("THSarabun", "", font_path)
# pdf.set_font("THSarabun", size=16)

# pdf.cell(0, 10, "Hello PDF (รองรับไทยแล้ว)", new_x="LMARGIN", new_y="NEXT")
# pdf.cell(0, 10, "ทดสอบภาษาไทย: สวัสดีชาวโลก", new_x="LMARGIN", new_y="NEXT")

# pdf.output("test.pdf")
# print("สร้างไฟล์ test.pdf สำเร็จ")

import os
from pathlib import Path
from fpdf import FPDF

pdf = FPDF()
pdf.add_page()

downloads = str(Path.home() / "Downloads" / "test.pdf")

pdf.set_font("Arial", size=16)
pdf.cell(0, 10, "สวัสดี PDF")
pdf.output(downloads)

print("สร้างไฟล์ที่:", downloads)
