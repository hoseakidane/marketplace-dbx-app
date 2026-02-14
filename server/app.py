"""FastAPI application for Databricks App Template."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from server.config import get_settings
from server.routers import router
from server.exceptions import AppException, app_exception_handler


# Load settings once at module level
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan."""
    yield


app = FastAPI(
    title=settings.api_title,
    description=settings.api_description,
    version=settings.api_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register custom exception handlers
app.add_exception_handler(AppException, app_exception_handler)

app.include_router(router, prefix='/api', tags=['api'])


@app.get('/health')
async def health():
  """Health check endpoint."""
  return {'status': 'healthy'}


# ============================================================================
# SERVE STATIC FILES FROM CLIENT BUILD DIRECTORY (MUST BE LAST!)
# ============================================================================
# This static file mount MUST be the last route registered!
# It catches all unmatched requests and serves the React app.
# Any routes added after this will be unreachable!
if os.path.exists('client/build'):
  app.mount('/', StaticFiles(directory='client/build', html=True), name='static')
