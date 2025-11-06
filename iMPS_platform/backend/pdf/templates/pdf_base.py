# backend/pdf/templates/pdf_base.py
from fpdf import FPDF

class PDFBase(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 14)
        self.cell(0, 10, self.title, ln=True, align="C")
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 9)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def add_field(self, label, value, w_label=50):
        self.set_font("Helvetica", "", 12)
        self.cell(w_label, 8, f"{label}:", border=0)
        self.cell(0, 8, str(value or "-"), border=0, ln=True)

    def add_checklist(self, checklist):
        self.ln(5)
        self.set_font("Helvetica", "B", 12)
        self.cell(0, 8, "Checklist:", ln=True)
        self.set_font("Helvetica", "", 11)
        for item in checklist or []:
            status = "✓" if item.get("result") else "✗"
            self.cell(0, 8, f"{status} {item.get('title', '')}", ln=True)
