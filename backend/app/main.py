"""FastAPI app: the JSON API under /api plus the statically exported frontend."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from app.chat import LLM, ChatError, claude_llm
from app.db import init_db
from app.nda import ChatRequest, ChatTurn


def create_app(db_path: Path, static_dir: Path, llm: LLM = claude_llm) -> FastAPI:
    """Build the app; the database is reset on startup, the frontend served if built."""

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        init_db(db_path)
        yield

    app = FastAPI(title="Prelegal", lifespan=lifespan)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/chat")
    def chat(request: ChatRequest) -> ChatTurn:
        """One chat turn; sync so the blocking SDK call runs in the threadpool."""
        try:
            return llm(request.messages, request.nda)
        except ChatError as err:
            raise HTTPException(status_code=err.status, detail=err.message) from err

    # Mounted last so it never shadows the API routes.
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

    return app


BACKEND_DIR = Path(__file__).resolve().parent.parent

app = create_app(
    db_path=Path(os.getenv("DB_PATH", BACKEND_DIR / "data" / "prelegal.db")),
    static_dir=Path(os.getenv("STATIC_DIR", BACKEND_DIR.parent / "frontend" / "out")),
)
