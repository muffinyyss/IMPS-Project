"""
ทดสอบว่ารูปทุกนามสกุลที่ระบบรับ ฝังลง PDF ได้จริง

ทุก template ใน pdf/templates/ ส่งรูปผ่าน load_image_autorotate() ก่อน แล้ว re-encode
เป็น JPEG ให้ fpdf2 เสมอ — PDF จึงรองรับ "อะไรก็ตามที่ Pillow เปิดได้" ไม่ใช่แค่ jpg/png

จุดที่เคยพลาดและเป็นที่มาของเทสต์ชุดนี้ (ทั้งหมดพังเงียบ — ผู้ใช้เห็นแค่ "รูปหายจาก PDF"
เพราะ _load_image_with_cache จับ exception แล้ว return None โดยไม่ฟ้องที่ไหนเลย):

  * RGBA/palette — pdf_charger/ccb/cbbox/station ไม่ convert mode ก่อน save JPEG
    → OSError: cannot write mode RGBA as JPEG (pdf_mdb/pdf_cm ทำไว้อยู่แล้ว)
  * HEIC — ต้องมี pillow-heif register opener ไว้ก่อน ไม่งั้น Image.open ไม่รู้จัก
    (ดู import image_convert ต้นไฟล์แต่ละ template)
  * BytesIO — _load_image_source_from_urlpath คืน BytesIO เมื่อดึงรูปผ่าน PHOTOS_BASE_URL
    ของเดิมตกไปเข้า BytesIO(BytesIO) → TypeError

ไม่ต้องใช้ MongoDB — รันได้ตรง ๆ

    python test_pdf_images.py

ออก exit code 0 ถ้าผ่านหมด
"""
import importlib
import io
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from PIL import Image  # noqa: E402

from image_convert import HEIF_SUPPORTED  # noqa: E402

# ทุก template ที่วาดรูปลง PDF — ถ้ามีไฟล์ใหม่เพิ่มต้องมาต่อท้ายที่นี่
TEMPLATES = [
    "pdf_charger", "pdf_mdb", "pdf_ccb", "pdf_cbbox",
    "pdf_station", "pdf_cm", "pdf_dctest", "pdf_actest",
]


def _make(fmt: str, mode: str = "RGB", size=(900, 1200)) -> bytes:
    buf = io.BytesIO()
    if mode == "RGBA":
        img = Image.new("RGBA", size, (20, 90, 180, 120))
    elif mode == "P":
        img = Image.new("RGB", size, (20, 90, 180)).convert("P")
    else:
        img = Image.new("RGB", size, (20, 90, 180))
    img.save(buf, format=fmt)
    return buf.getvalue()


def _cases() -> list[tuple[str, str, bytes]]:
    """(ชื่อเคส, นามสกุลไฟล์, ไบต์)"""
    out = [
        ("JPEG", "jpg", _make("JPEG")),
        ("PNG", "png", _make("PNG")),
        ("PNG โปร่งใส", "png", _make("PNG", "RGBA")),
        ("GIF palette", "gif", _make("GIF", "P")),
        ("WEBP", "webp", _make("WEBP")),
        ("BMP", "bmp", _make("BMP")),
        ("TIFF", "tif", _make("TIFF")),
    ]
    if HEIF_SUPPORTED:
        heic = _make("HEIF")
        out.append(("HEIC", "heic", heic))
        # เคสจริงบน production: ไบต์ HEIC แต่ชื่อลงท้าย .jpg (router เปลี่ยนนามสกุลให้)
        out.append(("HEIC ในชื่อ .jpg", "jpg", heic))
    return out


def main() -> int:
    if not HEIF_SUPPORTED:
        print("!! ไม่มี pillow-heif — ข้ามเคส HEIC (pip install pillow-heif)")

    cases = _cases()
    failures: list[str] = []

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        files = []
        for i, (label, ext, data) in enumerate(cases):
            p = tmpdir / f"{i}.{ext}"
            p.write_bytes(data)
            files.append((label, p, data))

        for name in TEMPLATES:
            mod = importlib.import_module(f"pdf.templates.{name}")
            fn = getattr(mod, "load_image_autorotate", None)
            if fn is None:
                failures.append(f"{name}: ไม่มี load_image_autorotate")
                print(f"  FAIL  {name}: ไม่มี load_image_autorotate")
                continue

            for label, path, data in files:
                # รับได้ทั้ง path (ไฟล์บนดิสก์) และ BytesIO (ดึงผ่าน PHOTOS_BASE_URL)
                for src_kind, src in (("path", path.as_posix()), ("BytesIO", io.BytesIO(data))):
                    tag = f"{name} / {label} / {src_kind}"
                    try:
                        out = fn(src)
                    except Exception as e:
                        failures.append(tag)
                        print(f"  FAIL  {tag}: {type(e).__name__}: {e}")
                        continue
                    if out is None:
                        failures.append(tag)
                        print(f"  FAIL  {tag}: คืน None (รูปจะหายจาก PDF)")
                        continue
                    fmt = Image.open(io.BytesIO(out.getvalue())).format
                    if fmt != "JPEG":
                        failures.append(tag)
                        print(f"  FAIL  {tag}: ได้ {fmt} ไม่ใช่ JPEG")

            if not any(f.startswith(name) for f in failures):
                print(f"  PASS  {name}  ({len(files)} นามสกุล x path/BytesIO)")

    print()
    if failures:
        print(f"ไม่ผ่าน {len(failures)} เคส")
        return 1
    print(f"ผ่านทั้งหมด ({len(TEMPLATES)} template x {len(cases)} นามสกุล x 2 แบบ input)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
