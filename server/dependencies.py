"""FastAPI dependencies for dependency injection.

Dependencies are functions that FastAPI calls before your endpoint handlers.
They enable:
- Shared instances (don't recreate services per request)
- Easy testing (swap real services for mocks)
- Clean separation of concerns
"""

from functools import lru_cache

from server.services.lakebase_service import LakebaseService


@lru_cache
def get_lakebase_service() -> LakebaseService:
    """Get a cached LakebaseService instance.

    Using lru_cache ensures we only create one LakebaseService instance
    for the lifetime of the application. This is important because:
    - LakebaseService manages a connection pool
    - Creating multiple instances would create multiple pools
    - Single instance = shared pool = efficient resource usage

    Usage in endpoints:
        @router.get("/cities")
        async def get_cities(service: LakebaseService = Depends(get_lakebase_service)):
            return service.get_cities()
    """
    return LakebaseService()
