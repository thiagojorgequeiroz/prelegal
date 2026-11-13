"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { NdaData } from "@/lib/nda/model";
import { inputClass } from "./styles";

type ChatMessage = { role: "user" | "assistant"; content: string };

/** Shown first without calling the API; the conversation sent to the AI starts with the user. */
export const GREETING =
  "Hi! I'll help you draft a Mutual NDA. To start, who are the two parties, and what will you be sharing confidential information for?";

const FALLBACK_ERROR = "The AI assistant could not answer. Please try again.";

type ChatTurn = { reply: string; nda: NdaData };

async function postChat(messages: ChatMessage[], nda: NdaData): Promise<ChatTurn> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, nda }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof body?.detail === "string" ? body.detail : FALLBACK_ERROR);
  }
  return body;
}

function Bubble({ role, children }: { role: ChatMessage["role"]; children: string }) {
  const style = role === "user" ? "ml-8 self-end bg-navy text-white" : "mr-8 self-start bg-stone-100 text-stone-900";
  return (
    <li className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${style}`}>
      <span className="sr-only">{role === "user" ? "You: " : "Assistant: "}</span>
      {children}
    </li>
  );
}

type Props = { data: NdaData; onChange: (data: NdaData) => void };

/** Freeform chat with the AI, which fills in the NDA as the conversation goes. */
export function ChatPanel({ data, onChange }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pending]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!content || pending) return;

    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");
    setPending(true);
    setError(null);
    try {
      const turn = await postChat(history, data);
      setMessages([...history, { role: "assistant", content: turn.reply }]);
      onChange(turn.nda);
    } catch (err) {
      // Roll back so the user can edit and resend the same message.
      setMessages(messages);
      setInput(content);
      setError(err instanceof TypeError ? "Could not reach the server. Please try again." : (err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        ref={logRef}
        role="log"
        aria-label="Conversation"
        className="max-h-96 min-h-48 flex-1 overflow-y-auto lg:max-h-none"
      >
        <ol className="flex flex-col gap-2">
          <Bubble role="assistant">{GREETING}</Bubble>
          {messages.map((message, i) => (
            <Bubble key={i} role={message.role}>
              {message.content}
            </Bubble>
          ))}
        </ol>
      </div>

      {pending && (
        <p role="status" className="text-sm text-stone-600">
          Thinking…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="chat-message" className="sr-only">
          Message
        </label>
        <input
          id="chat-message"
          className={inputClass}
          placeholder="Type your answer…"
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}
