"""AI chat that drafts the Mutual NDA by talking to Claude."""

import os
from collections.abc import Callable
from datetime import date

import anthropic
from pydantic import ValidationError

from app.nda import ChatTurn, Message, Nda

MODEL = "claude-haiku-5-5"

SYSTEM = """You help a user draft a Mutual NDA (Common Paper Mutual NDA v1.0) through a friendly conversation.
The user has already been greeted and asked what the NDA is for.

Learn these fields by asking short questions, one or two at a time:
- purpose: how Confidential Information may be used
- effectiveDate: ISO date YYYY-MM-DD (defaults to today)
- mndaTerm: a number of years (1-10) from the effective date, or until terminated
- confidentialityTerm: a number of years (1-10) from the effective date, or perpetual
- governingLaw: the US state whose laws govern the agreement
- jurisdiction: city or county and state of the courts
- modifications: optional changes to the Standard Terms (empty if none)
- parties: exactly two, each with company, signer name, title and notice address (email or postal)

Rules:
- Every turn, return the COMPLETE updated NDA in `nda` and your message to the user in `reply`.
- Start from the current NDA below; keep every value the user has not asked to change exactly as it is.
- Never invent names, companies, titles or addresses. Leave unknown text fields as "".
- Resolve relative dates ("next Monday") from today's date.
- Only the Mutual NDA is supported for now; say so if the user asks for another document.
- When every field is filled, summarize briefly and tell the user they can click Download PDF.
- You are not a lawyer; do not give legal advice.

Today's date is {today}.

Current NDA:
{nda}"""

LLM = Callable[[list[Message], Nda], ChatTurn]


class ChatError(Exception):
    """A chat failure with a message that is safe to show the user."""

    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.message = message
        self.status = status


def build_system(nda: Nda, today: date) -> str:
    """System prompt carrying today's date and the current NDA state."""
    return SYSTEM.format(today=today.isoformat(), nda=nda.model_dump_json(indent=2))


def ask_claude(client: anthropic.Anthropic, messages: list[Message], nda: Nda) -> ChatTurn:
    """Send the conversation to Claude and return its structured turn."""
    try:
        response = client.messages.parse(
            model=MODEL,
            max_tokens=16000,
            output_config={"effort": "low"},
            system=build_system(nda, date.today()),
            messages=[m.model_dump() for m in messages],
            output_format=ChatTurn,
        )
    except anthropic.APIError as err:
        raise ChatError("The AI assistant is unavailable right now. Please try again.") from err
    except ValidationError as err:
        # Structured outputs only hint at ranges and lengths; the SDK validates locally.
        raise ChatError("The AI assistant could not answer. Please try again.") from err
    if response.stop_reason == "refusal":
        raise ChatError("I can't help with that. Please rephrase and try again.", 422)
    if response.parsed_output is None:
        raise ChatError("The AI assistant could not answer. Please try again.")
    return response.parsed_output


def claude_llm(messages: list[Message], nda: Nda) -> ChatTurn:
    """Default LLM; the client is created per call so the app starts without a key."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise ChatError("The AI assistant is not configured: set ANTHROPIC_API_KEY in .env.", 503)
    return ask_claude(anthropic.Anthropic(), messages, nda)
