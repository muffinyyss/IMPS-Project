"""
แปลงรูปที่อัปโหลดให้เป็นรูปแบบที่เบราว์เซอร์เปิดได้เสมอ (JPEG)

ที่มา: iPhone ตั้งค่ากล้องเป็น "High Efficiency" จะได้ไฟล์ .HEIC ซึ่ง Chrome /
Edge / Firefox เปิดไม่ได้เลย (Safari เปิดได้เจ้าเดียว) พอช่างแนบรูป HEIC เข้ามา
ผลที่เกิดก่อนหน้านี้ต่างกันไปตามหน้า และ "พังคนละแบบ" ทั้งหมด:

  * ฟอร์ม PM  — routers ตั้งชื่อไฟล์เป็น .jpg เสมอ แต่ `resize_image_bytes` เดิม
                เปิด HEIC ไม่ได้ (Pillow เปล่า ๆ ไม่รองรับ) แล้ว `except: return data`
                ไฟล์ที่เขียนลงดิสก์จึงเป็น "ไบต์ HEIC ในชื่อ .jpg" → เปิดไม่ขึ้น
                ทั้งในหน้าเว็บและใน PDF โดยไม่มี error ให้เห็นเลยสักจุด
  * ฟอร์ม CM  — เก็บไฟล์ดิบพร้อมนามสกุล .heic → เบราว์เซอร์เรนเดอร์ไม่ได้
  * Test report / รูปสถานี — เด้ง 400/415 "File type not allowed" ช่างแนบไม่ได้เลย

ทางแก้: บีบให้ทุกรูปที่ขาเข้าถูก decode แล้ว encode ใหม่เป็น JPEG ตรงจุดเดียว
ก่อนเขียนลงดิสก์ ไฟล์ใน uploads/ จึงเป็น JPEG จริงทั้งหมด ไม่ต้องไปแก้หน้าแสดงผล
หรือ PDF ทีละที่ (ตัวแปลง HEIC มาจาก pillow-heif ซึ่ง register opener ให้ Pillow)

หลักการสำคัญ: **ตัดสินชนิดไฟล์จาก magic bytes ไม่ใช่นามสกุล** เพราะฝั่ง frontend
มี ensureJpgFilename/safeUploadName ที่เปลี่ยนนามสกุลเป็น .jpg ไปแล้วตั้งแต่ต้นทาง
นามสกุลจึงโกหกได้เสมอ
"""
from __future__ import annotations

import io
import logging

from PIL import Image, ImageOps

log = logging.getLogger(__name__)

# ลงทะเบียน HEIC/HEIF opener ให้ Pillow — ถ้าไม่มี lib ให้ระบบยังเดินต่อได้
# แต่จะตอบ error ที่อ่านรู้เรื่องแทนการเขียนไฟล์เสียลงดิสก์เงียบ ๆ
try:
    import pillow_heif

    pillow_heif.register_heif_opener()
    HEIF_SUPPORTED = True
except Exception as e:  # pragma: no cover - ขึ้นกับ environment
    HEIF_SUPPORTED = False
    log.warning("pillow-heif ไม่พร้อมใช้งาน: %s — อัปโหลดไฟล์ HEIC จะถูกปฏิเสธ", e)

# AVIF ก็มาจากมือถือรุ่นใหม่ได้เหมือนกัน และเบราว์เซอร์เก่ายังเปิดไม่ได้ทุกตัว
try:
    import pillow_avif  # noqa: F401  (register AVIF plugin as a side effect)

    AVIF_SUPPORTED = True
except Exception:
    AVIF_SUPPORTED = HEIF_SUPPORTED  # pillow-heif รองรับ AVIF ในตัวตั้งแต่ v0.13


class ImageConversionError(Exception):
    """decode รูปไม่สำเร็จ — ผู้เรียกควรแปลงเป็น HTTP 400 พร้อมข้อความให้ผู้ใช้"""


# นามสกุลที่ถือว่าเป็น "รูป" และต้องถูกแปลงเป็น JPEG
RASTER_EXTS = {
    "jpg", "jpeg", "jpe", "png", "webp", "gif", "bmp", "tif", "tiff",
    "heic", "heif", "hif", "avif",
}

# brand ใน ISO-BMFF ที่เป็นตระกูล HEIF (iPhone ใช้ heic/heix เป็นหลัก)
_HEIF_BRANDS = {
    b"heic", b"heix", b"heim", b"heis", b"hevc", b"hevx", b"hevm", b"hevs",
    b"mif1", b"msf1",
}
_AVIF_BRANDS = {b"avif", b"avis"}


def sniff_image_kind(data: bytes) -> str | None:
    """คืนชนิดรูปจาก magic bytes — None ถ้าไม่ใช่รูปที่รู้จัก (เช่น pdf/วิดีโอ)"""
    if len(data) < 12:
        return None
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data[:2] == b"BM":
        return "bmp"
    if data[:4] in (b"II*\x00", b"MM\x00*"):
        return "tiff"
    # ISO base media file format: [4 bytes size]"ftyp"[4 bytes brand]
    if data[4:8] == b"ftyp":
        brand = data[8:12]
        if brand in _HEIF_BRANDS:
            return "heic"
        if brand in _AVIF_BRANDS:
            return "avif"
    return None


def is_heic_bytes(data: bytes) -> bool:
    return sniff_image_kind(data) == "heic"


def looks_like_image(data: bytes, filename: str = "") -> bool:
    """เป็นรูปหรือไม่ — ดู magic ก่อน แล้วค่อย fallback ไปที่นามสกุล"""
    if sniff_image_kind(data) is not None:
        return True
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in RASTER_EXTS


def normalize_image_bytes(
    data: bytes,
    filename: str = "",
    max_width: int = 1920,
    quality: int = 85,
    max_height: int | None = None,
) -> tuple[bytes, str]:
    """
    แปลงไบต์รูปให้เป็น JPEG ที่เบราว์เซอร์เปิดได้เสมอ

    คืน (ไบต์ผลลัพธ์, นามสกุลที่ควรใช้) — ไฟล์ที่ไม่ใช่รูป (pdf, วิดีโอ, เอกสาร)
    ส่งกลับตามเดิมพร้อมนามสกุลเดิม ไม่ยุ่ง

    ต่างจาก resize_image_bytes เดิมสองข้อ:
      1. รูปที่เล็กกว่า max_width ก็ยัง re-encode ถ้าเป็นฟอร์แมตที่เบราว์เซอร์เปิด
         ไม่ได้ (HEIC/AVIF/TIFF/BMP) — ของเดิม `if img.width <= max_width: return data`
         ปล่อย HEIC ขนาดเล็กผ่านไปดิบ ๆ
      2. decode ไม่สำเร็จแล้ว raise ไม่ใช่ `return data` เงียบ ๆ ผู้ใช้จะได้รู้ตอน
         อัปโหลด ไม่ใช่ไปเจอรูปเปิดไม่ได้ทีหลังตอนออกรายงาน
    """
    src_ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if not looks_like_image(data, filename):
        return data, src_ext

    kind = sniff_image_kind(data)

    if kind == "heic" and not HEIF_SUPPORTED:
        raise ImageConversionError(
            "เซิร์ฟเวอร์ยังเปิดไฟล์ HEIC ไม่ได้ (ไม่ได้ติดตั้ง pillow-heif) "
            "กรุณาตั้งค่ากล้อง iPhone เป็น 'Most Compatible' แล้วแนบรูปใหม่"
        )

    try:
        with io.BytesIO(data) as src:
            img = Image.open(src)
            img.load()  # บังคับอ่านให้จบก่อน buffer ถูกปิด

            # HEIC จาก iPhone เก็บภาพไว้ในแนวเซ็นเซอร์แล้วใช้ EXIF Orientation บอกทิศ
            # ถ้าไม่หมุนตาม รูปที่ได้จะตะแคง — ต้องทำก่อนทิ้ง EXIF ตอน save JPEG
            img = ImageOps.exif_transpose(img)

            # รูปแนวตั้งจากมือถือสูงมากแต่ไม่กว้าง — ถ้าคุมแค่ความกว้างจะได้ไฟล์ใหญ่อยู่ดี
            # max_height เป็น optional เพราะฟอร์ม PM/CM คุมแค่ความกว้างมาแต่เดิม
            ratio = 1.0
            if img.width > max_width:
                ratio = max_width / img.width
            if max_height and img.height * ratio > max_height:
                ratio = max_height / img.height
            if ratio < 1.0:
                img = img.resize(
                    (max(1, int(img.width * ratio)), max(1, int(img.height * ratio))),
                    Image.LANCZOS,
                )

            # JPEG ไม่รองรับ alpha — วางบนพื้นขาวแทนการทิ้ง channel (ไม่งั้นได้ขอบดำ)
            if img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info):
                img = img.convert("RGBA")
                bg = Image.new("RGB", img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[-1])
                img = bg
            elif img.mode != "RGB":
                img = img.convert("RGB")

            with io.BytesIO() as buf:
                img.save(buf, format="JPEG", quality=quality, optimize=True)
                return buf.getvalue(), "jpg"
    except ImageConversionError:
        raise
    except Exception as e:
        log.warning("แปลงรูปไม่สำเร็จ (%s, kind=%s): %s", filename, kind, e)
        if kind in ("heic", "avif") or src_ext in ("heic", "heif", "hif", "avif"):
            # ปล่อยผ่านไม่ได้ — ไฟล์พวกนี้เบราว์เซอร์เปิดไม่ได้อยู่แล้ว
            raise ImageConversionError(
                f"เปิดไฟล์รูป {filename or ''} ไม่ได้ (ไฟล์อาจเสียหาย) กรุณาแนบรูปใหม่"
            ) from e
        # ฟอร์แมตที่เบราว์เซอร์เปิดได้อยู่แล้ว (jpg/png/gif/webp) → เก็บของเดิมไว้
        # ดีกว่าปฏิเสธงานช่างเพราะ re-encode พลาด
        return data, src_ext
