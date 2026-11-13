// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { defaultNdaData, type NdaData } from "@/lib/nda/model";
import { NdaForm } from "./NdaForm";

/** Renders the controlled form with real state and exposes the latest data. */
function setup(initial: NdaData = defaultNdaData("2026-11-12")) {
  const state = { current: initial };
  function Harness() {
    const [data, setData] = useState(initial);
    state.current = data;
    return <NdaForm data={data} onChange={setData} />;
  }
  const user = userEvent.setup();
  render(<Harness />);
  return { user, state };
}

const party = (n: 1 | 2) => within(screen.getByRole("group", { name: `Party ${n}` }));

describe("NdaForm: rendering", () => {
  it("shows the default values", () => {
    setup();
    expect(screen.getByLabelText("Purpose")).toHaveValue(
      "Evaluating whether to enter into a business relationship with the other party.",
    );
    expect(screen.getByLabelText("Effective date")).toHaveValue("2026-11-12");
    expect(screen.getByRole("combobox", { name: "MNDA term length" })).toHaveValue("1");
    expect(screen.getByRole("combobox", { name: "Confidentiality term length" })).toHaveValue("1");
    expect(screen.getByRole("radio", { name: "Expires" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "For" })).toBeChecked();
  });

  it("labels every text field", () => {
    setup();
    for (const label of ["Purpose", "Effective date", "Governing law", "Jurisdiction", "Modifications"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    for (const n of [1, 2] as const) {
      for (const label of ["Company", "Signer name", "Title", "Notice address"]) {
        expect(party(n).getByLabelText(label)).toBeInTheDocument();
      }
    }
  });

  it("links hints as descriptions, keeping accessible names short", () => {
    setup();
    const law = screen.getByRole("textbox", { name: "Governing law" });
    expect(law).toHaveAccessibleName("Governing law");
    expect(law).toHaveAccessibleDescription("The US state whose laws govern the agreement, e.g. Delaware.");
    expect(party(1).getByRole("textbox", { name: "Notice address" })).toHaveAccessibleDescription(
      "Email or postal address for legal notices.",
    );
  });

  it("groups the options for each term under a named fieldset", () => {
    setup();
    const mnda = screen.getByRole("group", { name: "MNDA term" });
    expect(within(mnda).getAllByRole("radio")).toHaveLength(2);
    const conf = screen.getByRole("group", { name: "Term of confidentiality" });
    expect(within(conf).getAllByRole("radio")).toHaveLength(2);
  });

  it("offers 1 to 10 years", () => {
    setup();
    const options = within(screen.getByRole("combobox", { name: "MNDA term length" })).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "1 year",
      ...Array.from({ length: 9 }, (_, i) => `${i + 2} years`),
    ]);
  });

  it("sets autocomplete hints on party fields", () => {
    setup();
    expect(party(1).getByLabelText("Company")).toHaveAttribute("autocomplete", "organization");
    expect(party(1).getByLabelText("Signer name")).toHaveAttribute("autocomplete", "name");
    expect(party(1).getByLabelText("Title")).toHaveAttribute("autocomplete", "organization-title");
  });

  it("gives every control a unique id", () => {
    const { container } = render(<NdaForm data={defaultNdaData("2026-11-12")} onChange={() => {}} />);
    const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("NdaForm: editing", () => {
  it.each([
    ["Purpose", "purpose", "Exploring a joint venture."],
    ["Governing law", "governingLaw", "California"],
    ["Jurisdiction", "jurisdiction", "San Francisco, CA"],
    ["Modifications", "modifications", "None of clause 6."],
  ] as const)("updates %s", async (label, key, value) => {
    const { user, state } = setup();
    const input = screen.getByLabelText(label);
    await user.clear(input);
    await user.type(input, value);
    expect(state.current[key]).toBe(value);
  });

  it("updates the effective date", () => {
    const { state } = setup();
    fireEvent.change(screen.getByLabelText("Effective date"), { target: { value: "2027-01-31" } });
    expect(state.current.effectiveDate).toBe("2027-01-31");
  });

  it("changes the MNDA term length", async () => {
    const { user, state } = setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "MNDA term length" }), "3");
    expect(state.current.mndaTerm).toEqual({ kind: "years", years: 3 });
  });

  it("switches the MNDA term to 'until terminated' and back, remembering the years", async () => {
    const { user, state } = setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "MNDA term length" }), "4");
    await user.click(screen.getByRole("radio", { name: "Continues until terminated" }));
    expect(state.current.mndaTerm).toEqual({ kind: "untilTerminated" });
    expect(screen.getByRole("radio", { name: "Expires" })).not.toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Expires" }));
    // Falls back to 1 year: the selection is not kept while the term is open-ended.
    expect(state.current.mndaTerm).toEqual({ kind: "years", years: 1 });
  });

  it("selects a length when choosing years while the term is open-ended", async () => {
    const { user, state } = setup();
    await user.click(screen.getByRole("radio", { name: "Continues until terminated" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "MNDA term length" }), "2");
    expect(state.current.mndaTerm).toEqual({ kind: "years", years: 2 });
    expect(screen.getByRole("radio", { name: "Expires" })).toBeChecked();
  });

  it("sets the confidentiality term to perpetual or a number of years", async () => {
    const { user, state } = setup();
    await user.click(screen.getByRole("radio", { name: "In perpetuity" }));
    expect(state.current.confidentialityTerm).toEqual({ kind: "perpetual" });

    await user.selectOptions(screen.getByRole("combobox", { name: "Confidentiality term length" }), "7");
    expect(state.current.confidentialityTerm).toEqual({ kind: "years", years: 7 });
  });

  it("keeps the two term choices independent", async () => {
    const { user, state } = setup();
    await user.click(screen.getByRole("radio", { name: "In perpetuity" }));
    expect(state.current.mndaTerm).toEqual({ kind: "years", years: 1 });
    expect(screen.getByRole("radio", { name: "Expires" })).toBeChecked();
  });

  it("updates only the party being edited", async () => {
    const { user, state } = setup();
    await user.type(party(2).getByLabelText("Company"), "Globex LLC");
    await user.type(party(2).getByLabelText("Signer name"), "Alan Turing");
    await user.type(party(2).getByLabelText("Title"), "CTO");
    await user.type(party(2).getByLabelText("Notice address"), "alan@globex.test");

    expect(state.current.parties[1]).toEqual({
      company: "Globex LLC",
      name: "Alan Turing",
      title: "CTO",
      noticeAddress: "alan@globex.test",
    });
    expect(state.current.parties[0]).toEqual({ name: "", title: "", company: "", noticeAddress: "" });
  });

  it("accepts non-Latin text", async () => {
    const { user, state } = setup();
    await user.type(party(1).getByLabelText("Signer name"), "Łukasz Ołdakowski");
    expect(state.current.parties[0].name).toBe("Łukasz Ołdakowski");
  });

  it("does not submit or reload the page when Enter is pressed", async () => {
    const { user } = setup();
    const form = screen.getByLabelText("Governing law").closest("form")!;
    const submit = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
    await user.type(screen.getByLabelText("Governing law"), "Delaware{Enter}");
    expect(screen.getByLabelText("Governing law")).toHaveValue("Delaware");
  });
});
