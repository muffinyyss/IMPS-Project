"""
ทดสอบ image_convert — ตัวแปลงรูปที่อัปโหลดให้เป็น JPEG เสมอ

เน้นเคสที่เคยทำให้รูปเปิดไม่ได้จริง ๆ บน production:
ไฟล์ HEIC จาก iPhone ที่ frontend เปลี่ยนนามสกุลเป็น .jpg ไปแล้ว (ensureJpgFilename /
safeUploadName) — ตัดสินจากนามสกุลไม่ได้ ต้องดู magic bytes เท่านั้น

ไม่ต้องใช้ MongoDB — รันได้ตรง ๆ

    python test_image_convert.py

ออก exit code 0 ถ้าผ่านหมด
"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PIL import Image  # noqa: E402

from image_convert import (  # noqa: E402
    HEIF_SUPPORTED,
    ImageConversionError,
    is_heic_bytes,
    looks_like_image,
    normalize_image_bytes,
    sniff_image_kind,
)

failures: list[str] = []


def check(name: str, cond: bool, detail: str = ""):
    if cond:
        print(f"  PASS  {name}")
    else:
        print(f"  FAIL  {name} {detail}")
        failures.append(name)


def make(fmt: str, size=(800, 600), mode="RGB", color=(200, 40, 40)) -> bytes:
    buf = io.BytesIO()
    Image.new(mode, size, color).save(buf, format=fmt)
    return buf.getvalue()


print("image_convert")

# ── magic bytes ────────────────────────────────────────────────
check("รู้จัก JPEG", sniff_image_kind(make("JPEG")) == "jpeg")
check("รู้จัก PNG", sniff_image_kind(make("PNG")) == "png")
check("รู้จัก WEBP", sniff_image_kind(make("WEBP")) == "webp")
check("PDF ไม่ใช่รูป", sniff_image_kind(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3") is None)
check("ไฟล์สั้นเกินไปไม่พัง", sniff_image_kind(b"\xff\xd8") is None)
check("looks_like_image ใช้นามสกุลช่วยได้", looks_like_image(b"", "a.heic"))

if not HEIF_SUPPORTED:
    print("\n!! ไม่มี pillow-heif — ข้ามเทสต์ HEIC (ติดตั้งด้วย pip install pillow-heif)")
else:
    heic = make("HEIF")
    check("รู้จัก HEIC จาก magic bytes", sniff_image_kind(heic) == "heic")
    check("is_heic_bytes", is_heic_bytes(heic))

    # เคสจริงที่ทำให้บั๊กนี้เกิด: ไบต์ HEIC แต่ชื่อเป็น .jpg
    out, ext = normalize_image_bytes(heic, "IMG_1234.jpg")
    check("HEIC ในชื่อ .jpg ถูกแปลงจริง", sniff_image_kind(out) == "jpeg", f"(ได้ {sniff_image_kind(out)})")
    check("คืนนามสกุล jpg", ext == "jpg", f"(ได้ {ext})")
    check("เปิดผลลัพธ์ได้และขนาดคงเดิม", Image.open(io.BytesIO(out)).size == (800, 600))

    # HEIC เล็กกว่า max_width ก็ต้องถูกแปลง — ของเดิม `if width <= max_width: return data`
    # ปล่อยผ่านไปดิบ ๆ ซึ่งคือต้นเหตุที่รูปเล็กก็ยังเปิดไม่ได้
    small = make("HEIF", size=(320, 240))
    out_s, _ = normalize_image_bytes(small, "small.heic", max_width=1920)
    check("HEIC ที่เล็กกว่า max_width ก็ยังถูกแปลง", sniff_image_kind(out_s) == "jpeg")

# ── ฟอร์แมตอื่น ────────────────────────────────────────────────
out, ext = normalize_image_bytes(make("PNG", mode="RGBA", color=(0, 255, 0, 128)), "x.png")
check("PNG โปร่งใส → JPEG พื้นขาว", sniff_image_kind(out) == "jpeg" and ext == "jpg")

big = make("JPEG", size=(4000, 3000))
out, _ = normalize_image_bytes(big, "big.jpg", max_width=1280)
check("ย่อรูปใหญ่ลงตาม max_width", Image.open(io.BytesIO(out)).size == (1280, 960))

# รูปแนวตั้งจากมือถือ: กว้างไม่เกิน max_width แต่สูงเกิน — ต้องถูกคุมด้วย max_height
tall = make("JPEG", size=(1000, 4000))
out, _ = normalize_image_bytes(tall, "tall.jpg", max_width=1280, max_height=1280)
check("คุมความสูงเมื่อส่ง max_height", Image.open(io.BytesIO(out)).size == (320, 1280),
      f"(ได้ {Image.open(io.BytesIO(out)).size})")

out, _ = normalize_image_bytes(tall, "tall.jpg", max_width=1280)
check("ไม่ส่ง max_height → ไม่คุมความสูง", Image.open(io.BytesIO(out)).size == (1000, 4000))

pdf = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3 rest"
out, ext = normalize_image_bytes(pdf, "doc.pdf")
check("ไฟล์ที่ไม่ใช่รูปส่งคืนตามเดิม", out == pdf and ext == "pdf")

# ── ไฟล์เสีย ───────────────────────────────────────────────────
broken_heic = b"\x00\x00\x00\x18ftypheic" + b"\x00" * 64
try:
    normalize_image_bytes(broken_heic, "broken.heic")
    check("HEIC เสียต้อง raise", False, "(ไม่ raise)")
except ImageConversionError:
    check("HEIC เสียต้อง raise ให้ผู้ใช้รู้", True)

broken_jpg = b"\xff\xd8\xff" + b"\x00" * 64
out, ext = normalize_image_bytes(broken_jpg, "broken.jpg")
check("JPEG เสียไม่ block งานช่าง (คืนของเดิม)", out == broken_jpg and ext == "jpg")

print()
if failures:
    print(f"ไม่ผ่าน {len(failures)} เคส: {', '.join(failures)}")
    raise SystemExit(1)
print("ผ่านทั้งหมด")
