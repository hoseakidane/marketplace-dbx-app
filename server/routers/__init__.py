# Generic router module for the Databricks app template
# Add your FastAPI routes here

from fastapi import APIRouter

from .user import router as user_router
from .analytics import router as analytics_router

router = APIRouter()
router.include_router(user_router, prefix='/user', tags=['user'])
router.include_router(analytics_router, prefix='/analytics', tags=['analytics'])
