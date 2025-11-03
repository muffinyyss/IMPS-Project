from fpdf import FPDF

pdf = FPDF()
pdf.add_page()
pdf.set_font('Arial', size=16)
pdf.cell(0, 10, 'Hello PDF', ln=1)   # ln=1 = ขึ้นบรรทัดใหม่
pdf.output('hello.pdf')              # บันทึกเป็นไฟล์
