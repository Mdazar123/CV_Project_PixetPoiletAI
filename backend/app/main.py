from app.core.native_libs import prepare_graphics_libraries

prepare_graphics_libraries()

import logging
import re
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.routes import ai, cv, health, images
from app.core.config import settings
from app.core.errors import PixelPilotError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("pixelpilot")

SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9_-]{8,80}")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get("x-request-id", "")
        request_id = incoming if SAFE_REQUEST_ID.fullmatch(incoming) else str(uuid.uuid4())
        request.state.request_id = request_id
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("request %s failed outside a handler", request_id)
            response = JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "The operation failed. No result was produced.",
                        "request_id": request_id,
                    }
                },
            )
        response.headers["X-Request-ID"] = request_id
        return response


def _error_body(request: Request, code: str, message: str, status_code: int) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None) or str(uuid.uuid4())
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "request_id": request_id}},
    )


def create_app() -> FastAPI:
    app = FastAPI(title="PixelPilot AI", version=settings.version)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    @app.exception_handler(PixelPilotError)
    async def handle_pixelpilot_error(request: Request, exc: PixelPilotError):
        logger.info("request %s %s", getattr(request.state, "request_id", "-"), exc.code)
        return _error_body(request, exc.code, exc.message, exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError):
        parts = []
        for error in exc.errors():
            loc = [str(item) for item in error.get("loc", []) if item not in {"body", "query", "form"}]
            place = ".".join(loc)
            message = error.get("msg", "Invalid value")
            parts.append(f"{place}: {message}" if place else message)
        return _error_body(request, "INVALID_REQUEST", "; ".join(parts) or "The request is invalid.", 422)

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception):
        logger.exception("request %s failed", getattr(request.state, "request_id", "-"))
        return _error_body(request, "INTERNAL_ERROR", "The operation failed. No result was produced.", 500)

    @app.get("/")
    def root() -> dict:
        return {
            "service": settings.app_name,
            "health": "/api/v1/health",
            "docs": "/docs",
        }

    app.include_router(health.router, prefix="/api/v1", tags=["health"])
    app.include_router(images.router, prefix="/api/v1/images", tags=["images"])
    app.include_router(cv.router, prefix="/api/v1/cv", tags=["vision"])
    app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
    return app


app = create_app()
