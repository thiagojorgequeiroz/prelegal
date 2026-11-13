from datetime import date
from types import SimpleNamespace

import anthropic
import httpx2
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.chat import MODEL, ChatError, ask_claude, build_system
from app.main import create_app
from app.nda import ChatTurn, Nda

PARTY = {"name": "", "title": "", "company": "", "noticeAddress": ""}
NDA = {
    "purpose": "Evaluating a partnership.",
    "effectiveDate": "2026-11-13",
    "mndaTerm": {"kind": "years", "years": 1},
    "confidentialityTerm": {"kind": "perpetual"},
    "governingLaw": "",
    "jurisdiction": "",
    "modifications": "",
    "parties": [PARTY, PARTY],
}
UPDATED = {**NDA, "governingLaw": "Delaware"}
NDA_MODEL = Nda.model_validate(NDA)
MESSAGES = [{"role": "user", "content": "Delaware law please."}]


@pytest.fixture
def calls():
    return []


@pytest.fixture
def chat_client(db_path, static_dir, calls):
    def fake_llm(messages, nda):
        calls.append((messages, nda))
        return ChatTurn(reply="Got it.", nda=Nda.model_validate(UPDATED))

    with TestClient(create_app(db_path, static_dir, llm=fake_llm)) as client:
        yield client


def failing_client(db_path, static_dir, error):
    def llm(messages, nda):
        raise error

    return TestClient(create_app(db_path, static_dir, llm=llm))


def test_chat_returns_reply_and_updated_nda(chat_client, calls):
    response = chat_client.post("/api/chat", json={"messages": MESSAGES, "nda": NDA})
    assert response.status_code == 200
    assert response.json() == {"reply": "Got it.", "nda": UPDATED}
    messages, nda = calls[0]
    assert [m.model_dump() for m in messages] == MESSAGES
    assert nda.model_dump() == NDA


@pytest.mark.parametrize(
    "body",
    [
        {"messages": MESSAGES},
        {"messages": [], "nda": NDA},
        {"messages": [{"role": "system", "content": "x"}], "nda": NDA},
        {"messages": MESSAGES, "nda": {**NDA, "mndaTerm": {"kind": "years", "years": 11}}},
        {"messages": MESSAGES, "nda": {**NDA, "confidentialityTerm": {"kind": "untilTerminated"}}},
        {"messages": MESSAGES, "nda": {**NDA, "parties": [PARTY]}},
    ],
)
def test_chat_rejects_invalid_requests(chat_client, calls, body):
    assert chat_client.post("/api/chat", json=body).status_code == 422
    assert calls == []


def test_chat_error_becomes_http_error(db_path, static_dir):
    with failing_client(db_path, static_dir, ChatError("Try again.", 502)) as client:
        response = client.post("/api/chat", json={"messages": MESSAGES, "nda": NDA})
    assert response.status_code == 502
    assert response.json() == {"detail": "Try again."}


def test_chat_without_api_key_returns_503(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    response = client.post("/api/chat", json={"messages": MESSAGES, "nda": NDA})
    assert response.status_code == 503
    assert "ANTHROPIC_API_KEY" in response.json()["detail"]
    assert client.get("/api/health").status_code == 200


def test_build_system_includes_today_and_nda():
    prompt = build_system(Nda.model_validate(UPDATED), date(2026, 11, 13))
    assert "Today's date is 2026-11-13." in prompt
    assert '"governingLaw": "Delaware"' in prompt


class FakeMessages:
    def __init__(self, response=None, error=None):
        self.response, self.error, self.kwargs = response, error, None

    def parse(self, **kwargs):
        self.kwargs = kwargs
        if self.error:
            raise self.error
        return self.response


def ask(response=None, error=None):
    messages = FakeMessages(response, error)
    client = SimpleNamespace(messages=messages)
    return messages, lambda: ask_claude(client, [], NDA_MODEL)


def test_ask_claude_returns_parsed_turn():
    turn = ChatTurn(reply="Hi", nda=NDA_MODEL)
    messages, call = ask(SimpleNamespace(stop_reason="end_turn", parsed_output=turn))
    assert call() is turn
    assert messages.kwargs["model"] == MODEL == "claude-haiku-5-5"
    assert messages.kwargs["output_config"] == {"effort": "low"}
    assert messages.kwargs["output_format"] is ChatTurn
    assert "temperature" not in messages.kwargs


def test_ask_claude_maps_refusal_to_422():
    _, call = ask(SimpleNamespace(stop_reason="refusal", parsed_output=None))
    with pytest.raises(ChatError) as err:
        call()
    assert err.value.status == 422


def test_ask_claude_maps_missing_output_to_502():
    _, call = ask(SimpleNamespace(stop_reason="max_tokens", parsed_output=None))
    with pytest.raises(ChatError) as err:
        call()
    assert err.value.status == 502


def test_ask_claude_maps_api_errors_to_502():
    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    _, call = ask(error=anthropic.APIConnectionError(request=request))
    with pytest.raises(ChatError) as err:
        call()
    assert err.value.status == 502


def test_ask_claude_maps_out_of_range_output_to_502():
    # The SDK validates the model's JSON locally, so constraint violations raise here.
    with pytest.raises(ValidationError) as invalid:
        ChatTurn.model_validate({"reply": "x", "nda": {**NDA, "parties": [PARTY] * 3}})
    _, call = ask(error=invalid.value)
    with pytest.raises(ChatError) as err:
        call()
    assert err.value.status == 502
