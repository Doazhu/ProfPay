"""
ProfPay - Trade Union Payment Tracking System
FastAPI Application Entry Point
"""
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.config import settings
from backend.core.database import init_db
from backend.presentation.auth_api import router as auth_router
from backend.presentation.payer_api import router as payer_router
from backend.presentation.stats_api import router as stats_router


# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.
    Implements recommendations from OWASP.
    """
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self'; "
            "frame-ancestors 'none'; "
            "form-action 'self'; "
            "upgrade-insecure-requests;"
        )

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # XSS Protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Referrer Policy - prevent data leakage
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy - disable unnecessary features
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )

        # HSTS - force HTTPS (uncomment in production)
        # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API для учёта плательщиков профсоюзных взносов",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
)

# Add Security Headers Middleware
app.add_middleware(SecurityHeadersMiddleware)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
    expose_headers=["X-CSRF-Token"],
)

# Include API routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(payer_router, prefix="/api/v1")
app.include_router(stats_router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()


@app.get("/")
async def root():
    """Root endpoint - health check."""
    return {
        "message": "ProfPay API",
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy"}


@app.get("/api/v1/health")
async def api_health_check():
    """Health check endpoint for API monitoring."""
    return {"status": "healthy", "version": settings.APP_VERSION}


if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
