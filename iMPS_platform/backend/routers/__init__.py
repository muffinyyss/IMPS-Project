# routers/__init__.py
from .notifications import router as notifications_router

# Export all routers
__all__ = [
    "notifications_router",
]