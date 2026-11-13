// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildNda } from "@/lib/nda/build";
import { defaultNdaData, type Block } from "@/lib/nda/model";
import { standardTerms } from "@/lib/nda/terms";
import { completedNda } from "@/test/fixtures";
import { NdaPreview } from "./NdaPreview";

const renderBlocks = (blocks: Block[]) => render(<NdaPreview blocks={blocks} />);

describe("NdaPreview: block rendering", () => {
  it("renders headings at the right level", () => {
    renderBlocks([
      { kind: "heading", level: 1, text: "Title" },
      { kind: "heading", level: 2, text: "Section" },
      { kind: "heading", level: 3, text: "Sub" },
    ]);
    expect(screen.getByRole("heading", { level: 1, name: "Title" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Section" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Sub" })).toBeInTheDocument();
  });

  it("prefixes numbered clauses with their number", () => {
    renderBlocks([{ kind: "numbered", number: "7", runs: [{ text: "Seven." }] }]);
    expect(screen.getByText("7. Seven.")).toBeInTheDocument();
  });

  it("renders bold runs as strong text", () => {
    renderBlocks([{ kind: "paragraph", runs: [{ text: "Term", bold: true }] }]);
    expect(screen.getByText("Term").tagName).toBe("STRONG");
  });

  it("opens links in a new tab without leaking the referrer", () => {
    renderBlocks([{ kind: "paragraph", runs: [{ text: "site", href: "https://example.test" }] }]);
    const link = screen.getByRole("link", { name: "site" });
    expect(link).toHaveAttribute("href", "https://example.test");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("distinguishes filled values from missing placeholders", () => {
    renderBlocks([{ kind: "paragraph", runs: [{ text: "Delaware", filled: true }, { text: "[Jurisdiction]", missing: true }] }]);
    expect(screen.getByText("Delaware")).toHaveClass("bg-sky-50");
    expect(screen.getByText("[Jurisdiction]")).toHaveClass("bg-amber-100");
  });

  it("keeps line breaks in filled values", () => {
    renderBlocks([{ kind: "paragraph", runs: [{ text: "line one\nline two", filled: true }] }]);
    expect(screen.getByText(/line one/)).toHaveClass("whitespace-pre-line");
  });

  it("renders a page break as a separator", () => {
    renderBlocks([{ kind: "pageBreak" }]);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("renders user text literally, never as HTML", () => {
    const { container } = renderBlocks([
      { kind: "paragraph", runs: [{ text: '<img src=x onerror="alert(1)"><b>bold</b>', filled: true }] },
    ]);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText('<img src=x onerror="alert(1)"><b>bold</b>')).toBeInTheDocument();
  });
});

describe("NdaPreview: full agreement", () => {
  it("renders the cover page and all 11 clauses", () => {
    const { container } = renderBlocks(buildNda(completedNda(), standardTerms));
    expect(screen.getByRole("heading", { level: 1, name: "Mutual Non-Disclosure Agreement" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Standard Terms" })).toBeInTheDocument();
    for (let n = 1; n <= 11; n++) {
      expect(container.textContent).toContain(`${n}. `);
    }
    expect(container.textContent).toContain("Governing Law: Delaware");
  });

  it("renders the signature table with row and column headers", () => {
    renderBlocks(buildNda(completedNda(), standardTerms));
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["", "Party 1", "Party 2"]);
    const rowHeaders = within(table).getAllByRole("rowheader").map((h) => h.textContent);
    expect(rowHeaders).toEqual([
      "Signature",
      "Print Name",
      "Title",
      "Company",
      "Notice AddressEmail or postal address",
      "Date",
    ]);
    const nameRow = within(table).getByRole("row", { name: /Print Name/ });
    expect(within(nameRow).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Ada Lovelace", "Alan Turing"]);
  });

  it("shows placeholders for an untouched form", () => {
    renderBlocks(buildNda(defaultNdaData("2026-11-12"), standardTerms));
    expect(screen.getByText("[Governing Law]")).toBeInTheDocument();
    expect(screen.getByText("[Jurisdiction]")).toBeInTheDocument();
    expect(screen.getAllByText("[Company]")).toHaveLength(2);
  });
});
