"""
แปลงรูปให้เบราว์เซอร์อ่านได้ — ใช้จากฝั่ง frontend ตอน "แนบรูป"

ทำไมต้องมี endpoint นี้ ทั้งที่ตอนอัปโหลดก็แปลงให้อยู่แล้ว:

ฟอร์ม PM ต้องประทับ วันที่-เวลา + พิกัด ลงบนรูปก่อนส่ง (addTimestampToImage)
ซึ่งทำผ่าน <img> + canvas บนเบราว์เซอร์ พอไฟล์เป็น HEIC เบราว์เซอร์ decode ไม่ได้
onerror ยิงแล้วโค้ดก็ `resolve(file)` คืนไฟล์เดิม — ผลคือรูป HEIC ถูกส่งขึ้นไป
"โดยไม่มีตราประทับเวลา/พิกัด" ซึ่งเป็นหลักฐานที่ใบ PM ต้องมี แถม preview ในฟอร์ม
ก็ขึ้นเป็นกรอบว่าง ช่างไม่รู้ว่าแนบรูปผิดใบหรือเปล่า

การแปลงฝั่ง client ต้องลงไลบรารี (heic2any ~1.2MB) ทั้งที่ backend มี pillow-heif
อยู่แล้ว จึงให้ frontend ส่งไฟล์มาแปลงที่นี่แล้วรับ JPEG กลับไปเข้าท่อเดิมต่อ
(ประทับเวลา → บีบ → preview → เก็บ IndexedDB) โดยไม่ต้องแก้ pipeline
"""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from deps import UserClaims, get_current_user
from image_convert import ImageConversionError, normalize_image_bytes

router = APIRouter()

# ใหญ่กว่า MAX_FILE_MB ของฝั่งอัปโหลดได้ เพราะไฟล์ต้นทางจาก iPhone ยังไม่ถูกบีบ
#
# ตั้งต่ำกว่า client_max_body_size ของ nginx (30M ที่ /etc/nginx/conf.d/imps-upload.conf)
# ไว้หนึ่งขั้น เพื่อให้เคสไฟล์ใหญ่เกินถูกปฏิเสธที่นี่พร้อมข้อความที่ frontend อ่านได้
# ไม่ใช่โดน nginx ตัดทิ้งเป็นหน้า HTML 413 เปล่า ๆ ที่ ensureViewableImage แปลไม่ออก
# (multipart มี overhead ด้วย ไฟล์ 30MB เป๊ะ ๆ จะเกินเพดาน nginx อยู่ดี)
MAX_CONVERT_MB = 25


@router.post("/images/convert")
async def convert_image(
    file: UploadFile = File(...),
    current: UserClaims = Depends(get_current_user),
):
    """รับรูปฟอร์แมตอะไรก็ได้ที่ Pillow เปิดได้ คืน JPEG กลับไปเป็นไบต์"""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_CONVERT_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large (> {MAX_CONVERT_MB} MB)")

    try:
        # ไม่ย่อขนาดตรงนี้ — ฝั่ง frontend ยังต้องเอาไปประทับเวลาแล้วบีบเองอีกที
        # ย่อซ้ำสองรอบจะทำให้ตัวหนังสือบนรูปแตก
        out, ext = normalize_image_bytes(data, file.filename or "", max_width=4096, quality=90)
    except ImageConversionError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if ext != "jpg":
        # ไม่ใช่รูป (เช่นเผลอส่ง pdf มา) — ไม่แปลงให้ ปล่อยให้ฝั่งเรียกจัดการเอง
        raise HTTPException(status_code=400, detail="ไฟล์นี้ไม่ใช่รูปภาพ")

    return Response(content=out, media_type="image/jpeg")
