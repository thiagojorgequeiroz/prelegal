# prelegal

A platform for drafting common legal agreements.

> **Work in progress:** This project is under active development. The first complete version is expected by **November 19, 2026**.

## Run

Requires Docker. The app is served at http://localhost:8000.

The AI chat needs an Anthropic API key: copy `.env.example` to `.env` and set
`ANTHROPIC_API_KEY`. Without it the app runs, but the chat reports it is not configured.

| OS      | Start                       | Stop                       |
|---------|-----------------------------|----------------------------|
| Mac     | `scripts/start-mac.sh`      | `scripts/stop-mac.sh`      |
| Linux   | `scripts/start-linux.sh`    | `scripts/stop-linux.sh`    |
| Windows | `scripts/start-windows.ps1` | `scripts/stop-windows.ps1` |

The SQLite database is temporary: it is recreated every time the app starts.
Sign-in is a placeholder for now; any email and password lets you in.
After signing in, chat with the AI assistant to fill in a Mutual NDA, then download it as a PDF.

## Layout

- `frontend/` - Next.js app, exported as static HTML (see `frontend/README.md`)
- `backend/` - FastAPI app serving `/api` and the exported frontend
- `templates/` - Common Paper agreement templates, listed in `catalog.json`

## Develop

```bash
cd backend && uv run pytest                # backend tests
cd frontend && npm test && npm run test:e2e  # frontend tests
```
