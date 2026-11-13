# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation supports only the Mutual NDA, filled in through an AI chat, behind a placeholder login.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
Consider statically building the frontend and serving it via FastAPI, if that will work.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

## Implementation Status

### Completed (PL-2, PL-3)
- Common Paper templates in templates/ and catalog.json
- Mutual NDA form with live preview and PDF download (Next.js, @react-pdf/renderer)
- Vitest unit/component tests, Playwright e2e tests (desktop + mobile, axe a11y), frontend CI

### Completed (PL-4)
- Docker multi-stage build (Node 24 frontend build + Python 3.14/uv backend), port 8000
- FastAPI backend (`backend/app/main.py`, `create_app(db_path, static_dir)` factory)
- SQLite with a `users` table, deleted and recreated on every startup (`backend/app/db.py`)
- Next.js static export (`output: "export"`, `trailingSlash: true`) served by FastAPI StaticFiles;
  `cacheComponents`/`partialPrefetching` removed (PPR is incompatible with export)
- Fake login at `/` (any email/password, no auth); NDA builder at `/nda/`; "Sign out" link back to `/`
- Brand colors as Tailwind tokens in `globals.css` (`accent`, `primary`, `secondary`, `navy`, `muted`);
  `muted` (#888) only for placeholders since it fails WCAG AA on text
- Start/stop scripts for Mac, Linux, Windows (stop removes the container)
- Backend pytest suite; e2e serves the export with `serve`; `backend.yml` CI runs pytest + Docker smoke test

### Completed (PL-5)
- AI chat replaces the manual NDA form: `ChatPanel` (left pane) drives the same `NdaData` as the preview/PDF
- Stateless `POST /api/chat`: client sends `{messages, nda}`, backend returns `{reply, nda}` (complete updated NDA)
- `backend/app/chat.py`: Claude `claude-haiku-5-5` via `client.messages.parse` structured output (effort `low`);
  `backend/app/nda.py`: Pydantic mirror of `NdaData`; `create_app(..., llm=...)` injects the LLM (faked in pytest)
- `ANTHROPIC_API_KEY` from a gitignored root `.env` (see `.env.example`), passed by the start scripts via `--env-file`;
  the app starts without it and the chat returns 503
- e2e tests mock `/api/chat` with `mockChat`/`say` in `frontend/e2e/fixtures.ts`

### Not yet implemented
- Document types other than the Mutual NDA, real authentication, document persistence

### Current API Endpoints
- `GET /api/health` - Health check
- `POST /api/chat` - One AI chat turn: `{messages, nda}` -> `{reply, nda}`;
  errors: 422 invalid request or refusal, 502 AI failure, 503 no API key
