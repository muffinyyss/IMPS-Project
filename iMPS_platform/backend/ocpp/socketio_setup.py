"""
ocpp/socketio_setup.py — Socket.IO server สำหรับ FastAPI

Rooms:
  user:{userId}       → รับ event ส่วนตัว (chargingStarted, chargingStopped)
  session:{sessionId} → รับ event ของ session นั้น (meterUpdate)
"""
import socketio

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",  # Production: เปลี่ยนเป็น domain จริง
    logger=False,
    engineio_logger=False,
)


def create_socketio_app(fastapi_app):
    """ห่อ FastAPI ด้วย Socket.IO → return combined ASGI app"""
    return socketio.ASGIApp(sio, other_app=fastapi_app)


@sio.event
async def connect(sid, environ, auth):
    user_id = (auth or {}).get("userId")
    if user_id:
        await sio.enter_room(sid, f"user:{user_id}")
        print(f"🔌 Socket connected: {sid} → user:{user_id}")
    else:
        print(f"🔌 Socket connected: {sid} (no userId)")


@sio.event
async def joinSession(sid, data):
    session_id = (data or {}).get("sessionId")
    if session_id:
        await sio.enter_room(sid, f"session:{session_id}")
        print(f"   {sid} → joined session:{session_id}")


@sio.event
async def leaveSession(sid, data):
    session_id = (data or {}).get("sessionId")
    if session_id:
        await sio.leave_room(sid, f"session:{session_id}")
        print(f"   {sid} → left session:{session_id}")


@sio.event
async def disconnect(sid):
    print(f"🔌 Socket disconnected: {sid}")