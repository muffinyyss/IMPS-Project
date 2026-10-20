"""อายุ session: หมดอายุพร้อมกันทุกคนตอนตี 3 (เวลาไทย) แทนการนับ 24 ชม. จากเวลา login

เดิม access token อยู่ 24 ชม. นับจากตอน login — ช่างที่ login 9:00 จึงหลุดตอน 9:00 วันถัดไป
กลางเวลางาน (เสี่ยงกรอกฟอร์ม PM/CM ค้าง) ตัดตอนกลางคืนแทนจึงแทบไม่มีใครโดนตัดระหว่างทำงาน
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

SESSION_TZ = ZoneInfo("Asia/Bangkok")
SESSION_CUTOFF_HOUR = 3                     # 03:00 น.
SESSION_MIN_LIFETIME = timedelta(hours=1)   # login ใกล้ตี 3 (เช่น 02:30) → ไม่ตัดใน 30 นาที ข้ามไปตี 3 คืนถัดไป


def access_token_ttl(now: datetime | None = None) -> timedelta:
    """เวลาที่เหลือจนถึงตี 3 ครั้งถัดไป (อย่างน้อย SESSION_MIN_LIFETIME)"""
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    local = now.astimezone(SESSION_TZ)
    cutoff = local.replace(hour=SESSION_CUTOFF_HOUR, minute=0, second=0, microsecond=0)
    if cutoff <= local:
        cutoff += timedelta(days=1)
    if cutoff - local < SESSION_MIN_LIFETIME:
        cutoff += timedelta(days=1)
    return cutoff - local
