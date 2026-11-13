// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { standardTerms } from "@/lib/nda/terms";
import { toIsoDate } from "@/lib/nda/utils";
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
const party = (n: 1 | 2) => within(screen.getByRole("group", { name: `Party ${n}` }));

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
});

describe("NdaBuilder: live preview", () => {
  it("defaults the effective date to today", () => {
    render(<NdaBuilder terms={standardTerms} />);
    expect(screen.getByLabelText("Effective date")).toHaveValue(toIsoDate(new Date()));
  });

  it("updates the preview as the user types", async () => {
    const user = userEvent.setup();
    render(<NdaBuilder terms={standardTerms} />);

    expect(preview().getByText("[Governing Law]")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Governing law"), "Delaware");
    expect(preview().queryByText("[Governing Law]")).not.toBeInTheDocument();
    expect(preview().getByText("Delaware")).toBeInTheDocument();

    await user.type(party(1).getByLabelText("Company"), "Acme Inc.");
    expect(preview().getByRole("row", { name: /Company/ })).toHaveTextContent("Acme Inc.");
  });

  it("reflects term choices in the preview", async () => {
    const user = userEvent.setup();
    render(<NdaBuilder terms={standardTerms} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "MNDA term length" }), "2");
    expect(screen.getByRole("article")).toHaveTextContent("Expires 2 years from Effective Date.");

    await user.click(screen.getByRole("radio", { name: "Continues until terminated" }));
    expect(screen.getByRole("article")).toHaveTextContent("Continues until terminated in accordance with the terms of the MNDA.");

    await user.click(screen.getByRole("radio", { name: "In perpetuity" }));
    expect(screen.getByRole("article")).toHaveTextContent("In perpetuity.");
  });

  it("formats the chosen effective date in words", async () => {
    render(<NdaBuilder terms={standardTerms} />);
    const input = screen.getByLabelText("Effective date");
    await act(async () => {
      // Date inputs can't be typed into in jsdom; set the value like a picker would.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "2027-03-04");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(preview().getByText("March 4, 2027")).toBeInTheDocument();
  });
});

describe("NdaBuilder: PDF download", () => {
  it("downloads a PDF named after the parties", async () => {
    const user = userEvent.setup();
    render(<NdaBuilder terms={standardTerms} />);
    await user.type(party(1).getByLabelText("Company"), "Acme Inc.");
    await user.type(party(2).getByLabelText("Company"), "Globex");

    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(clicked[0].download).toBe("Mutual-NDA-Acme-Inc-Globex.pdf");
    expect(clicked[0].href).toBe("blob:nda");
    expect(clicked[0].isConnected).toBe(false); // removed after clicking
    expect(pdfMocks.registerPdfFonts).toHaveBeenCalledWith(`${window.location.origin}/fonts`);
  });

  it("renders the PDF from the current document", async () => {
    const user = userEvent.setup();
    render(<NdaBuilder terms={standardTerms} />);
    await user.type(screen.getByLabelText("Governing law"), "Delaware");
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
