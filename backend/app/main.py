import logging
from contextvars import ContextVar
from typing import Callable

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import auth, comments, issues, issues_global, profile, projects, users
from app.core.config import get_settings
from app.core.logging import new_request_id, setup_logging


settings = get_settings()
_request_id_context: ContextVar[str | None] = ContextVar("request_id", default=None)


def _get_request_id() -> str | None:
    return _request_id_context.get()


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        _request_id_context.set(new_request_id())
        response = await call_next(request)
        response.headers["X-Request-ID"] = _get_request_id() or "-"
        return response


def create_app() -> FastAPI:
    setup_logging(settings.log_dir, settings.log_level, _get_request_id)
    app = FastAPI(title=settings.app_name)

    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logging.getLogger(__name__).warning("Validation error: %s", exc.errors())
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Invalid request",
                    "details": exc.errors(),
                }
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        logging.getLogger(__name__).warning("HTTP error: %s", exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": "http_error",
                    "message": exc.detail,
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logging.getLogger(__name__).exception("Unhandled error")
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "server_error",
                    "message": "Unexpected server error",
                }
            },
        )

    app.include_router(auth.router, prefix=settings.api_prefix)
    app.include_router(profile.router, prefix=settings.api_prefix)
    app.include_router(projects.router, prefix=settings.api_prefix)
    app.include_router(users.router, prefix=settings.api_prefix)
    app.include_router(issues.router, prefix=settings.api_prefix)
    app.include_router(issues_global.router, prefix=settings.api_prefix)
    app.include_router(comments.router, prefix=settings.api_prefix)

    return app


app = create_app()
