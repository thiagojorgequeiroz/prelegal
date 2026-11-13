"""Pydantic mirror of the frontend `NdaData` model and the chat API payloads."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field


class Party(BaseModel):
    name: str
    title: str
    company: str
    noticeAddress: str


class Years(BaseModel):
    kind: Literal["years"]
    years: int = Field(ge=1, le=10)


class UntilTerminated(BaseModel):
    kind: Literal["untilTerminated"]


class Perpetual(BaseModel):
    kind: Literal["perpetual"]


class Nda(BaseModel):
    purpose: str
    effectiveDate: str = Field(description="ISO date, YYYY-MM-DD")
    mndaTerm: Annotated[Years | UntilTerminated, Field(discriminator="kind")]
    confidentialityTerm: Annotated[Years | Perpetual, Field(discriminator="kind")]
    governingLaw: str
    jurisdiction: str
    modifications: str
    parties: list[Party] = Field(min_length=2, max_length=2)


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1)
    nda: Nda


class ChatTurn(BaseModel):
    """One assistant turn: the reply text and the complete updated NDA."""

    reply: str
    nda: Nda
