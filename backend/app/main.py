from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models import User  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    import logging
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logging.getLogger("uvicorn.error").warning(
            f"Database connection could not be established on startup: {exc}. "
            "Please check DATABASE_URL or start Docker Postgres."
        )
    yield



app = FastAPI(
    title="MediKiosk API",
    version="0.2.0",
    description="Privacy-first AI clinical intake and longitudinal health copilot API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


app.include_router(
    api_router,
    prefix="/api/v1",
)


@app.get("/")
def root():
    return {
        "service": "MediKiosk API",
        "status": "running",
        "docs": "/docs",
        "health": "/health",
        "api": "/api/v1",
    }


@app.get("/health")
def health():
    database_ok = True
    pgvector_ok = False
    database_error = None

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

            vector_extension_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM pg_extension
                    WHERE extname = 'vector'
                    LIMIT 1
                    """
                )
            ).scalar()

            pgvector_ok = bool(vector_extension_exists)

    except SQLAlchemyError as exc:
        database_ok = False
        database_error = str(exc)

    healthy = database_ok and pgvector_ok

    payload = {
        "service": "MediKiosk API",
        "healthy": healthy,
        "database": "ok" if database_ok else "error",
        "pgvector": "ok" if pgvector_ok else "missing",
        "database_error": database_error,
    }

    status_code = 200 if healthy else 503

    return JSONResponse(
        content=payload,
        status_code=status_code,
    )