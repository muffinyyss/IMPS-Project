# backend/pdf/templates/pdf_charger.py
from .pdf_base import PDFBase

def generate_pdf(data):
    pdf = PDFBase()
    pdf.alias_nb_pages()
    pdf.title = "PM Report - CCB"
    pdf.add_page()

    pdf.add_field("Document ID", data.get("_id"))
    pdf.add_field("Station", data.get("station_name"))
    pdf.add_field("Inspector", data.get("inspector"))
    pdf.add_field("Date", data.get("date"))
    pdf.add_checklist(data.get("checklist"))

    return pdf.output(dest="S").encode("latin-1")
