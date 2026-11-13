import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def static_dir(tmp_path):
    root = tmp_path / "static"
    (root / "nda").mkdir(parents=True)
    (root / "index.html").write_text("login page")
    (root / "nda" / "index.html").write_text("nda page")
    (root / "404.html").write_text("not found page")
    return root


@pytest.fixture
def db_path(tmp_path):
    return tmp_path / "data" / "test.db"


@pytest.fixture
def client(db_path, static_dir):
    with TestClient(create_app(db_path, static_dir)) as client:
        yield client
