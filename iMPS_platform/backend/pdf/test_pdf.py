from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from io import BytesIO
from fpdf import FPDF

app = FastAPI()

@app.get("/download-pdf")
def download_pdf():
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=16)  # ใช้ Helvetica เพื่อตัดปัญหาฟอนต์
    pdf.cell(0, 10, "Hello from fpdf2!", ln=True, align="C")

    buf = BytesIO()
    pdf.output(buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={'Content-Disposition': 'attachment; filename="test.pdf"'}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("pdf_test_min:app", host="127.0.0.1", port=8000, reload=True)


