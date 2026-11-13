// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultNdaData } from "@/lib/nda/model";
import { completedNda, requestBody, stubChat } from "@/test/fixtures";
import { ChatPanel, GREETING } from "./ChatPanel";

const start = defaultNdaData("2026-11-13");
const log = () => within(screen.getByRole("log", { name: "Conversation" }));

function setup() {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<ChatPanel data={start} onChange={onChange} />);
  const say = async (text: string) => {
    await user.type(screen.getByLabelText("Message"), text);
    await user.click(screen.getByRole("button", { name: "Send" }));
  };
  return { onChange, user, say };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChatPanel", () => {
  it("greets the user without calling the API", () => {
    const fetchMock = stubChat();
    setup();
    expect(log().getByText(GREETING)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the conversation and current NDA, then applies the reply", async () => {
    const nda = completedNda();
    const fetchMock = stubChat(nda);
    const { onChange, say } = setup();

    await say("Acme and Globex");

    expect(fetchMock).toHaveBeenCalledWith("/api/chat", expect.objectContaining({ method: "POST" }));
    expect(requestBody(fetchMock)).toEqual({
      messages: [{ role: "user", content: "Acme and Globex" }],
      nda: start,
    });
    expect(await log().findByText("Updated.")).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(nda);
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("sends the full history on later turns", async () => {
    const fetchMock = stubChat(start, start);
    const { say } = setup();

    await say("First");
    await log().findByText("Updated.");
    await say("Second");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(requestBody(fetchMock, 1).messages).toEqual([
      { role: "user", content: "First" },
      { role: "assistant", content: "Updated." },
      { role: "user", content: "Second" },
    ]);
  });

  it("shows a thinking state and blocks sending while waiting", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (resolve = r))));
    const { user, say } = setup();

    await say("Hello");
    expect(screen.getByRole("status")).toHaveTextContent("Thinking…");
    await user.type(screen.getByLabelText("Message"), "More");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    resolve(Response.json({ reply: "Hi there.", nda: start }));
    expect(await log().findByText("Hi there.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("submits with Enter and ignores blank messages", async () => {
    const fetchMock = stubChat(start);
    const { user } = setup();

    await user.type(screen.getByLabelText("Message"), "   {Enter}");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Message"), "Hello{Enter}");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the server's error and keeps the message for a retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ detail: "Not configured." }, { status: 503 })));
    const { onChange, say } = setup();

    await say("Hello");

    expect(await screen.findByRole("alert")).toHaveTextContent("Not configured.");
    expect(screen.getByLabelText("Message")).toHaveValue("Hello");
    expect(log().queryByText("Hello")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows a generic error when the server is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { say } = setup();

    await say("Hello");

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the server. Please try again.");
  });
});
