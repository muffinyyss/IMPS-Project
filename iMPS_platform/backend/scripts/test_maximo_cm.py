"""ตรวจ interface IN01–IN09 ของ Maximo (EGAT_IESB_Payload_Structure_v1)

โหมด dry-run (ค่าเริ่มต้น) — ปลอดภัย ไม่มีอะไรถูกเขียนเข้า Maximo
    ยิงเฉพาะ GET (IN04 / IN07 / IN08) ที่อ่านอย่างเดียว
    ส่วน POST (IN01/IN02/IN03/IN05/IN09) จะพิมพ์ payload ที่จะถูกส่งออกมาให้ดูแทน

    python backend/scripts/test_maximo_cm.py
    python backend/scripts/test_maximo_cm.py --location EGT0327-EV

โหมด live — ยิงจริง เกิดเรคคอร์ดจริงใน Maximo
    ต้องระบุ --location ของสถานีทดสอบ และยืนยันด้วย --live
    ลำดับที่ยิง: IN01 เปิด WO → IN02 เปลี่ยนสถานะ → IN03 แนบลิงก์
                 → IN05 รายงาน failure → IN09 ลงเวลาช่าง

    python backend/scripts/test_maximo_cm.py --live --location EGT0327-EV --labor 595503

รันจากโฟลเดอร์ backend (ต้องเห็นโมดูล services/ และไฟล์ .env)
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# console ของ Windows เป็น cp874/cp1252 — บังคับ UTF-8 ไม่งั้นภาษาไทยและ ✅ พังตั้งแต่บรรทัดแรก
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from services import maximo  # noqa: E402
from services.maximo import MaximoError  # noqa: E402

OK, BAD, SKIP = "✅", "❌", "⏭️ "


def show(title: str, obj) -> None:
    print(f"\n{'─' * 68}\n{title}\n{'─' * 68}")
    print(json.dumps(obj, ensure_ascii=False, indent=2, default=str)[:2500])


# ══════════════════════════════════════════════════════════════════
# dry-run — แทน _post ด้วยตัวพิมพ์ payload
# ══════════════════════════════════════════════════════════════════
_sent: list[dict] = []


_rejected: list[str] = []


def _drop_attr(payload, attr: str, objpath: str = "") -> bool:
    """
    ตัด attribute ที่ Maximo ปฏิเสธออกจาก payload

    Maximo บอกชั้นที่ผิดมาใน errorobjpath เช่น "workorder/failurereport" = อยู่ใน
    child collection ชื่อ failurereport — ต้องตัดเฉพาะชั้นนั้น ตัดทุกชั้นจะไปลบ
    ฟิลด์ที่อีกชั้นบังคับให้มี แล้วรอบถัดไปเด้ง "A value is required" แทน
    """
    if isinstance(payload, list):
        return any([_drop_attr(item, attr, objpath) for item in payload])
    if not isinstance(payload, dict):
        return False

    # ชั้นสุดท้ายของ errorobjpath คือชื่อ child collection (ชั้นแรก = ตัว parent)
    parts = [p for p in (objpath or "").split("/") if p]
    child = parts[-1] if len(parts) > 1 else ""
    if child and isinstance(payload.get(child), (dict, list)):
        return _drop_attr(payload[child], attr)

    return payload.pop(attr, _MISSING) is not _MISSING


_MISSING = object()


def _post_with_autodrop(real_post):
    """
    live mode: โดน BMXAA4191E (ค่าไม่ถูกต้อง) ให้ตัดฟิลด์นั้นทิ้งแล้วลองใหม่

    เอกสารที่ได้มาไม่มีสเปก payload — วิธีนี้ทำให้รันครั้งเดียวรู้ครบว่า Maximo
    ไม่รับฟิลด์ไหนบ้าง แทนที่จะเจอทีละตัวรอบละฟิลด์
    """
    async def wrapper(os_name, payload, **kw):
        for _ in range(8):
            try:
                return await real_post(os_name, payload, **kw)
            except MaximoError as e:
                if not e.attr or not _drop_attr(payload, e.attr, e.objpath):
                    raise
                note = f"{os_name}.{e.objpath or os_name}:{e.attr}"
                if note not in _rejected:
                    _rejected.append(note)
                print(f"   ↪ Maximo ไม่รับ {note} ({e.reason_code}) — ตัดออกแล้วลองใหม่")
        return await real_post(os_name, payload, **kw)
    return wrapper


async def _fake_post(os_name, payload, *, method_override=None, patchtype=None,
                     properties=None, timeout=30):
    entry = {
        "endpoint": f"{maximo.MAXIMO_BASE_URL}/{os_name}?lean=1",
        "headers": {k: v for k, v in {
            "x-method-override": method_override, "patchtype": patchtype,
            "properties": properties,
        }.items() if v},
        "payload": payload,
    }
    _sent.append(entry)
    show(f"[DRY-RUN] POST {os_name}", entry)
    # ให้ผู้เรียกเดินต่อได้เหมือนสำเร็จ
    return {"wonum": "DRYRUN-0001", "status": "WAPPR"}


# ══════════════════════════════════════════════════════════════════
# GET — ปลอดภัยเสมอ
# ══════════════════════════════════════════════════════════════════
async def check_reads(location_filter: str) -> dict:
    result = {}

    print(f"\n{'=' * 68}\nREAD (GET) — IN04 / IN07 / IN08\n{'=' * 68}")

    try:
        nodes = await maximo.query_failure_list()
        from services.cm_maximo import build_failure_tree
        tree = build_failure_tree(nodes)
        classes = [f"{c['code']} ({len(c['problems'])} problems)" for c in tree["classes"]]
        print(f"{OK} IN04 ZAPIFAILURELIST — {len(nodes)} nodes / {len(tree['matrix'])} rows")
        print(f"     failure classes: {', '.join(classes[:8])}"
              + (" …" if len(classes) > 8 else ""))
        result["IN04"] = {"nodes": len(nodes), "rows": len(tree["matrix"])}
    except MaximoError as e:
        print(f"{BAD} IN04 ZAPIFAILURELIST — {e}")
        result["IN04"] = {"error": str(e)}

    try:
        locs = await maximo.query_locations(location_filter)
        print(f"{OK} IN07 ZAPILOCATION — {len(locs or [])} locations (filter {location_filter})")
        for l in (locs or [])[:5]:
            print(f"     {l.get('location')} — {l.get('description')}")
        result["IN07"] = {"count": len(locs or [])}
    except MaximoError as e:
        print(f"{BAD} IN07 ZAPILOCATION — {e}")
        result["IN07"] = {"error": str(e)}

    try:
        people = await maximo.query_labor()
        named = [p for p in people if p.get("displayname")]
        print(f"{OK} IN08 ZAPIPERSON — {len(people)} persons ({len(named)} มีชื่อ)")
        for p in named[:5]:
            print(f"     {p.get('personid')} — {p.get('displayname')}")
        result["IN08"] = {"count": len(people)}
    except MaximoError as e:
        print(f"{BAD} IN08 ZAPIPERSON — {e}")
        result["IN08"] = {"error": str(e)}

    return result


# ══════════════════════════════════════════════════════════════════
# POST — dry-run หรือ live
# ══════════════════════════════════════════════════════════════════
async def check_writes(location: str, labor: str, failure_code: str, live: bool) -> dict:
    mode = "LIVE" if live else "DRY-RUN"
    print(f"\n{'=' * 68}\nWRITE (POST) — IN01 / IN02 / IN03 / IN05 / IN09  [{mode}]\n{'=' * 68}")

    if not location:
        print(f"{SKIP} ข้ามทั้งหมด — ต้องระบุ --location")
        return {"skipped": "no location"}

    result = {}
    now = datetime.now()
    start = now - timedelta(hours=2)

    # ── IN01 ──
    try:
        wo = await maximo.create_workorder(
            description="[iMPS CM TEST] integration check — safe to cancel",
            location=location,
            severity="Low",
            sched_start=start.isoformat(timespec="minutes"),
            sched_finish=now.isoformat(timespec="minutes"),
            failure_code=failure_code,
            imps_wonum="CM-TEST",
        )
        wonum = str(wo.get("wonum") or "")
        print(f"{OK} IN01 create WO → wonum={wonum}")
        result["IN01"] = wo
    except MaximoError as e:
        print(f"{BAD} IN01 create WO — {e}\n     body: {e.body}")
        return {"IN01": {"error": str(e), "body": e.body}}

    if not wonum:
        print(f"{BAD} Maximo ไม่ได้คืน wonum กลับมา — หยุดที่ IN01")
        return result

    # ── IN02 ──
    try:
        result["IN02"] = await maximo.update_wo_status(wonum, "APPR", memo="iMPS integration test")
        print(f"{OK} IN02 status → APPR")
    except MaximoError as e:
        print(f"{BAD} IN02 status — {e}\n     body: {e.body}")
        result["IN02"] = {"error": str(e), "body": e.body}

    # ── IN03 ──
    try:
        result["IN03"] = await maximo.attach_wo_link(
            wonum, "https://example.invalid/imps/cm-test",
            name="iMPS CM-TEST", description="iMPS integration test link",
        )
        print(f"{OK} IN03 attach link")
    except MaximoError as e:
        print(f"{BAD} IN03 attach — {e}\n     body: {e.body}")
        result["IN03"] = {"error": str(e), "body": e.body}

    # ── IN05 ──
    try:
        result["IN05"] = await maximo.report_wo_failure(
            wonum,
            failure_code=failure_code,
            problem_code="UN2STCHG", cause_code="DCCTR1FC", remedy_code="REPLACE",
            remarks="iMPS integration test",
        )
        print(f"{OK} IN05 failure report")
    except MaximoError as e:
        print(f"{BAD} IN05 failure report — {e}\n     body: {e.body}")
        result["IN05"] = {"error": str(e), "body": e.body}

    # ── IN09 ──
    if not labor:
        print(f"{SKIP} IN09 — ต้องระบุ --labor (personid จาก IN08)")
        result["IN09"] = {"skipped": "no labor"}
    else:
        try:
            result["IN09"] = await maximo.create_labtrans(
                wonum, labor,
                start=start.isoformat(timespec="minutes"),
                finish=now.isoformat(timespec="minutes"),
                location=location,
                memo="iMPS integration test",
            )
            print(f"{OK} IN09 labtrans ({labor})")
        except MaximoError as e:
            print(f"{BAD} IN09 labtrans — {e}\n     body: {e.body}")
            result["IN09"] = {"error": str(e), "body": e.body}

    if live:
        print(f"\n⚠️  WO {wonum} ถูกสร้างจริงใน Maximo — อย่าลืมยกเลิก/ปิดทิ้งหลังทดสอบ")
    return result


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--live", action="store_true",
                    help="ยิง POST จริงเข้า Maximo (จะเกิดเรคคอร์ดจริง)")
    ap.add_argument("--location", default="",
                    help="Maximo location ที่ใช้ทดสอบ เช่น EGT0327-EV")
    ap.add_argument("--labor", default="",
                    help="laborcode ของช่างสำหรับ IN09 (คนละอย่างกับ personid ของ IN08 — "
                         "ต้องเป็นรหัสที่มีเรคคอร์ด LABOR จริง เช่น 597082 / EVCONTRACTOR)")
    ap.add_argument("--failure-code", default="DCCHARGER",
                    help="failure class ของ Maximo (default DCCHARGER)")
    ap.add_argument("--location-filter", default="%-EV%",
                    help="ตัวกรองตอนทดสอบ IN07")
    ap.add_argument("--skip-reads", action="store_true", help="ข้าม GET")
    ap.add_argument("--no-autodrop", action="store_true",
                    help="live: อย่าตัดฟิลด์ที่ Maximo ปฏิเสธออกแล้วลองใหม่ (ให้ล้มทันที)")
    args = ap.parse_args()

    print(f"Maximo base : {maximo.MAXIMO_BASE_URL}")
    print(f"API key     : {maximo.MAXIMO_API_KEY[:6]}…{maximo.MAXIMO_API_KEY[-4:]}")
    print(f"Site / Org  : {maximo.MAXIMO_SITE_ID} / {maximo.MAXIMO_ORG_ID}")
    print(f"Enabled     : {maximo.MAXIMO_ENABLED}")

    if not maximo.MAXIMO_ENABLED:
        print(f"\n{BAD} MAXIMO_ENABLED=false — ตั้งเป็น true ก่อนถึงจะทดสอบได้")
        return 1

    if args.live:
        if not args.no_autodrop:
            maximo._post = _post_with_autodrop(maximo._post)  # type: ignore[assignment]
    else:
        maximo._post = _fake_post  # type: ignore[assignment]

    out = {}
    if not args.skip_reads:
        out["reads"] = await check_reads(args.location_filter)
    out["writes"] = await check_writes(
        args.location, args.labor, args.failure_code, args.live
    )

    print(f"\n{'=' * 68}\nสรุป\n{'=' * 68}")
    for group, items in out.items():
        for name, val in (items or {}).items():
            state = BAD if isinstance(val, dict) and val.get("error") else OK
            print(f"  {state} {group:6s} {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
