"""Custom exceptions and error handling for the API.

Provides structured error responses with error codes for better debugging
and client-side error handling.
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel


# =============================================================================
# Error Response Models
# =============================================================================

class ErrorDetail(BaseModel):
    """Structured error detail."""
    error: str
    code: str
    detail: str | None = None


class ErrorResponse(BaseModel):
    """Standard error response format."""
    error: ErrorDetail


# =============================================================================
# Custom Exceptions
# =============================================================================

class AppException(Exception):
    """Base exception for application errors."""

    def __init__(
        self,
        message: str,
        code: str,
        status_code: int = 500,
        detail: str | None = None
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.detail = detail
        super().__init__(self.message)


class DatabaseConnectionError(AppException):
    """Raised when database connection fails."""

    def __init__(self, detail: str | None = None):
        super().__init__(
            message="Database connection failed",
            code="DB_CONNECTION_ERROR",
            status_code=503,
            detail=detail
        )


class DatabaseQueryError(AppException):
    """Raised when a database query fails."""

    def __init__(self, detail: str | None = None):
        super().__init__(
            message="Database query failed",
            code="DB_QUERY_ERROR",
            status_code=500,
            detail=detail
        )


class AuthenticationError(AppException):
    """Raised when authentication fails (e.g., token expired)."""

    def __init__(self, detail: str | None = None):
        super().__init__(
            message="Authentication failed",
            code="AUTH_ERROR",
            status_code=401,
            detail=detail
        )


class ResourceNotFoundError(AppException):
    """Raised when a requested resource is not found."""

    def __init__(self, resource: str, detail: str | None = None):
        super().__init__(
            message=f"{resource} not found",
            code="NOT_FOUND",
            status_code=404,
            detail=detail
        )


class ValidationError(AppException):
    """Raised when input validation fails."""

    def __init__(self, detail: str | None = None):
        super().__init__(
            message="Validation error",
            code="VALIDATION_ERROR",
            status_code=422,
            detail=detail
        )


# =============================================================================
# Exception Handlers
# =============================================================================

async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle AppException and return structured error response."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "error": exc.message,
                "code": exc.code,
                "detail": exc.detail
            }
        }
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions with a generic error response."""
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "error": "Internal server error",
                "code": "INTERNAL_ERROR",
                "detail": str(exc) if exc.args else None
            }
        }
    )
