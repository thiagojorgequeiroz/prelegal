# Stage 1: build the Next.js frontend as static HTML.
FROM node:24-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY templates /app/templates
COPY frontend ./
RUN npm run build

# Stage 2: FastAPI backend serving the API and the exported frontend.
FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /bin/uv
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/app ./app
COPY --from=frontend /app/frontend/out ./static
ENV STATIC_DIR=/app/static DB_PATH=/app/data/prelegal.db
EXPOSE 8000
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
