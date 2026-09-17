from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[str(BACKEND_DIR / ".env"), ".env"],
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = "postgresql+psycopg2://medikiosk:medikiosk@127.0.0.1:5433/medikiosk"
    jwt_secret: str = "medikiosk-dev-secret-change-later"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    cors_origins: str = "http://localhost:3000"

    storage_root: str = "/app/storage"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    max_upload_size_bytes: int = 10 * 1024 * 1024

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()