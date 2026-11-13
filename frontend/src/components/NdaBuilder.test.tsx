// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultNdaData } from "@/lib/nda/model";
import { standardTerms } from "@/lib/nda/terms";
import { toIsoDate } from "@/lib/nda/utils";
import { completedNda, requestBody, stubChat } from "@/test/fixtures";
import { NdaBuilder } from "./NdaBuilder";

// The real PDF engine is covered by NdaPdf.test.tsx; here we only check the
// download flow around it.
const pdfMocks = vi.hoisted(() => ({
  toBlob: vi.fn<() => Promise<Blob>>(),
  pdf: vi.fn(),
  registerPdfFonts: vi.fn(),
}));

vi.mock("@react-pdf/renderer", () => ({
  pdf: pdfMocks.pdf.mockImplementation(() => ({ toBlob: pdfMocks.toBlob })),
}));

vi.mock("./NdaPdf", () => ({
  NdaPdf: () => null,
  registerPdfFonts: pdfMocks.registerPdfFonts,
}));

const preview = () => within(screen.getByRole("article"));

/** Renders the builder and sends one chat message. */
async function renderAndSay(text = "Fill it in") {
  const user = userEvent.setup();
  render(<NdaBuilder terms={standardTerms} />);
  await user.type(screen.getByLabelText("Message"), `${text}{Enter}`);
  await screen.findByText("Updated.");
  return user;
}

let clicked: HTMLAnchorElement[];

beforeEach(() => {
  clicked = [];
  pdfMocks.pdf.mockImplementation(() => ({ toBlob: pdfMocks.toBlob }));
  pdfMocks.toBlob.mockResolvedValue(new Blob(["%PDF-"], { type: "application/pdf" }));
  URL.createObjectURL = vi.fn(() => "blob:nda");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("NdaBuilder: live preview", () => {
  it("sends today's date as the default effective date", async () => {
    const fetchMock = stubChat(defaultNdaData(toIsoDate(new Date())));
    await renderAndSay();
    expect(requestBody(fetchMock).nda.effectiveDate).toBe(toIsoDate(new Date()));
  });

  it("updates the preview from the AI's answer", async () => {
    stubChat(completedNda({ effectiveDate: "2027-03-04" }));
    render(<NdaBuilder terms={standardTerms} />);
    expect(preview().getByText("[Governing Law]")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Message"), "Fill it in{Enter}");

    expect(await preview().findByText("Delaware")).toBeInTheDocument();
    expect(preview().queryByText("[Governing Law]")).not.toBeInTheDocument();
    expect(preview().getByRole("row", { name: /Company/ })).toHaveTextContent("Acme Inc.");
    expect(preview().getByText("March 4, 2027")).toBeInTheDocument();
  });

  it("reflects term choices in the preview", async () => {
    stubChat(
      completedNda({ mndaTerm: { kind: "years", years: 2 } }),
      completedNda({ mndaTerm: { kind: "untilTerminated" }, confidentialityTerm: { kind: "perpetual" } }),
    );
    const user = await renderAndSay("Two years");
    expect(screen.getByRole("article")).toHaveTextContent("Expires 2 years from Effective Date.");

    await user.type(screen.getByLabelText("Message"), "Until terminated, confidential forever{Enter}");
    await waitFor(() => expect(screen.getByRole("article")).toHaveTextContent("In perpetuity."));
    expect(screen.getByRole("article")).toHaveTextContent("Continues until terminated in accordance with the terms of the MNDA.");
  });

  it("sends the updated NDA back on the next turn", async () => {
    const nda = completedNda();
    const fetchMock = stubChat(nda, nda);
    const user = await renderAndSay();
    await user.type(screen.getByLabelText("Message"), "Thanks{Enter}");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(requestBody(fetchMock, 1).nda).toEqual(nda);
  });
});

describe("NdaBuilder: PDF download", () => {
  it("downloads a PDF named after the parties", async () => {
    stubChat(completedNda());
    const user = await renderAndSay();

    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(clicked[0].download).toBe("Mutual-NDA-Acme-Inc-Globex-LLC.pdf");
    expect(clicked[0].href).toBe("blob:nda");
    expect(clicked[0].isConnected).toBe(false); // removed after clicking
    expect(pdfMocks.registerPdfFonts).toHaveBeenCalledWith(`${window.location.origin}/fonts`);
  });

  it("renders the PDF from the current document", async () => {
    stubChat(completedNda());
    const user = await renderAndSay();
    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() => expect(pdfMocks.pdf).toHaveBeenCalledTimes(1));
    const blocks = pdfMocks.pdf.mock.calls[0][0].props.blocks;
    expect(JSON.stringify(blocks)).toContain('"text":"Delaware"');
  });

  it("shows progress and prevents double clicks while generating", async () => {
    let resolve!: (blob: Blob) => void;
    pdfMocks.toBlob.mockReturnValue(new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<NdaBuilder terms={standardTerms} />);

    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    const busy = await screen.findByRole("button", { name: "Preparing…" });
    expect(busy).toBeDisabled();

    await act(async () => resolve(new Blob(["%PDF-"])));
    expect(await screen.findByRole("button", { name: "Download PDF" })).toBeEnabled();
    expect(pdfMocks.pdf).toHaveBeenCalledTimes(1);
  });

  it("releases the object URL after a delay, not immediately", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    render(<NdaBuilder terms={standardTerms} />);

    await act(async () => screen.getByRole("button", { name: "Download PDF" }).click());
    await vi.waitFor(() => expect(clicked).toHaveLength(1));
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:nda");
  });

  it("shows an error and recovers when PDF generation fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    pdfMocks.toBlob.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    render(<NdaBuilder terms={standardTerms} />);

    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not generate the PDF. Please try again.");
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
    expect(consoleError).toHaveBeenCalled();
    expect(clicked).toHaveLength(0);

    // A successful retry clears the error.
    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
