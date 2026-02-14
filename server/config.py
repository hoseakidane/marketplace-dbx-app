"""Application settings using Pydantic Settings.

Centralizes all configuration with validation and type safety.
Automatically loads from environment variables and .env files.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # Lakebase Configuration
    lakebase_instance_name: str = "marketplace-intel-db"
    lakebase_schema: str = "gold"

    # Connection Pool Settings
    pool_min_connections: int = 2
    pool_max_connections: int = 10

    # Token refresh interval in seconds (15 min default, tokens expire in ~1 hour)
    token_refresh_interval: int = 900

    # API Settings
    api_title: str = "Databricks App API"
    api_description: str = "Modern FastAPI application template for Databricks Apps with React frontend"
    api_version: str = "0.1.0"

    # CORS Settings (comma-separated origins)
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Ignore extra env vars
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance.

    Using lru_cache ensures we only create one Settings instance,
    which only reads env files once at startup.
    """
    return Settings()
