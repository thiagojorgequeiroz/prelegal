import sqlite3
from contextlib import closing

from fastapi.testclient import TestClient

from app.main import create_app


def query(db_path, sql):
    with closing(sqlite3.connect(db_path)) as conn, conn:
        return conn.execute(sql).fetchall()


def columns(db_path, table):
    return [row[1] for row in query(db_path, f"PRAGMA table_info({table})")]


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_creates_users_table(client, db_path):
    assert columns(db_path, "users") == ["id", "email", "password_hash", "created_at"]


def test_resets_database_on_startup(db_path, static_dir):
    with TestClient(create_app(db_path, static_dir)):
        query(db_path, "INSERT INTO users (email, password_hash) VALUES ('a@b.c', 'x')")
        assert query(db_path, "SELECT COUNT(*) FROM users") == [(1,)]

    with TestClient(create_app(db_path, static_dir)):
        assert query(db_path, "SELECT COUNT(*) FROM users") == [(0,)]


def test_serves_login_page_at_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.text == "login page"


def test_serves_nda_page(client):
    assert client.get("/nda/").text == "nda page"


def test_redirects_bare_nda_path(client):
    response = client.get("/nda", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"].endswith("/nda/")


def test_unknown_path_returns_404_page(client):
    response = client.get("/nope")
    assert response.status_code == 404
    assert response.text == "not found page"


def test_runs_without_frontend_build(db_path, tmp_path):
    with TestClient(create_app(db_path, tmp_path / "missing")) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/").status_code == 404
