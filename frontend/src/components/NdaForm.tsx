"use client";

import { useId, type ReactNode } from "react";
import { pluralizeYears } from "@/lib/nda/build";
import type { NdaData, Party } from "@/lib/nda/model";

const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

const inputClass =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20 focus:outline-none";

type ControlProps = { id: string; "aria-describedby"?: string };

/** Labelled form control; the hint is linked as a description, not the name. */
function Field({ label, hint, children }: { label: string; hint?: string; children: (props: ControlProps) => ReactNode }) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-stone-800">
        {label}
      </label>
      {children({ id, "aria-describedby": hint ? hintId : undefined })}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-stone-500">
          {hint}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-stone-200 pt-5 first:border-t-0 first:pt-0">
      <legend className="mb-3 text-xs font-semibold tracking-wider text-stone-500 uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

function RadioGroup({ legend, hint, children }: { legend: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium text-stone-800">{legend}</legend>
      {children}
      {hint && <p className="text-xs text-stone-500">{hint}</p>}
    </fieldset>
  );
}

function Radio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm text-stone-800">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="accent-sky-700" />
      {children}
    </label>
  );
}

function YearsSelect({ value, onChange, label }: { value: number; onChange: (years: number) => void; label: string }) {
  return (
    <select
      aria-label={label}
      className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {YEAR_OPTIONS.map((n) => (
        <option key={n} value={n}>
          {pluralizeYears(n)}
        </option>
      ))}
    </select>
  );
}

type Props = { data: NdaData; onChange: (data: NdaData) => void };

/** Form collecting every value the Mutual NDA Cover Page needs. */
export function NdaForm({ data, onChange }: Props) {
  const set = (patch: Partial<NdaData>) => onChange({ ...data, ...patch });

  const setParty = (index: 0 | 1, patch: Partial<Party>) => {
    const parties = [...data.parties] as NdaData["parties"];
    parties[index] = { ...parties[index], ...patch };
    set({ parties });
  };

  const mndaYears = data.mndaTerm.kind === "years" ? data.mndaTerm.years : 1;
  const confidentialityYears = data.confidentialityTerm.kind === "years" ? data.confidentialityTerm.years : 1;

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <Section title="Agreement terms">
        <Field label="Purpose" hint="How Confidential Information may be used.">
          {(a11y) => (
            <textarea
              {...a11y}
              className={inputClass}
              rows={3}
              value={data.purpose}
              onChange={(e) => set({ purpose: e.target.value })}
            />
          )}
        </Field>

        <Field label="Effective date">
          {(a11y) => (
            <input
              {...a11y}
              type="date"
              className={inputClass}
              value={data.effectiveDate}
              onChange={(e) => set({ effectiveDate: e.target.value })}
            />
          )}
        </Field>

        <RadioGroup legend="MNDA term">
          <div className="flex flex-wrap items-center gap-2 text-sm text-stone-800">
            <Radio
              name="mndaTerm"
              checked={data.mndaTerm.kind === "years"}
              onChange={() => set({ mndaTerm: { kind: "years", years: mndaYears } })}
            >
              Expires
            </Radio>
            <YearsSelect
              label="MNDA term length"
              value={mndaYears}
              onChange={(years) => set({ mndaTerm: { kind: "years", years } })}
            />
            <span>from the effective date</span>
          </div>
          <Radio
            name="mndaTerm"
            checked={data.mndaTerm.kind === "untilTerminated"}
            onChange={() => set({ mndaTerm: { kind: "untilTerminated" } })}
          >
            Continues until terminated
          </Radio>
        </RadioGroup>

        <RadioGroup
          legend="Term of confidentiality"
          hint="Trade secrets stay protected for as long as they remain trade secrets."
        >
          <div className="flex flex-wrap items-center gap-2 text-sm text-stone-800">
            <Radio
              name="confidentialityTerm"
              checked={data.confidentialityTerm.kind === "years"}
              onChange={() => set({ confidentialityTerm: { kind: "years", years: confidentialityYears } })}
            >
              For
            </Radio>
            <YearsSelect
              label="Confidentiality term length"
              value={confidentialityYears}
              onChange={(years) => set({ confidentialityTerm: { kind: "years", years } })}
            />
            <span>from the effective date</span>
          </div>
          <Radio
            name="confidentialityTerm"
            checked={data.confidentialityTerm.kind === "perpetual"}
            onChange={() => set({ confidentialityTerm: { kind: "perpetual" } })}
          >
            In perpetuity
          </Radio>
        </RadioGroup>

        <Field label="Governing law" hint="The US state whose laws govern the agreement, e.g. Delaware.">
          {(a11y) => (
            <input
              {...a11y}
              className={inputClass}
              value={data.governingLaw}
              onChange={(e) => set({ governingLaw: e.target.value })}
            />
          )}
        </Field>

        <Field label="Jurisdiction" hint="City or county and state of the courts, e.g. New Castle, DE.">
          {(a11y) => (
            <input
              {...a11y}
              className={inputClass}
              value={data.jurisdiction}
              onChange={(e) => set({ jurisdiction: e.target.value })}
            />
          )}
        </Field>

        <Field label="Modifications" hint="Optional changes to the Standard Terms.">
          {(a11y) => (
            <textarea
              {...a11y}
              className={inputClass}
              rows={2}
              value={data.modifications}
              onChange={(e) => set({ modifications: e.target.value })}
            />
          )}
        </Field>
      </Section>

      {([0, 1] as const).map((index) => {
        const party = data.parties[index];
        return (
          <Section key={index} title={`Party ${index + 1}`}>
            <Field label="Company">
              {(a11y) => (
                <input
                  {...a11y}
                  autoComplete="organization"
                  className={inputClass}
                  value={party.company}
                  onChange={(e) => setParty(index, { company: e.target.value })}
                />
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Signer name">
                {(a11y) => (
                  <input
                    {...a11y}
                    autoComplete="name"
                    className={inputClass}
                    value={party.name}
                    onChange={(e) => setParty(index, { name: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Title">
                {(a11y) => (
                  <input
                    {...a11y}
                    autoComplete="organization-title"
                    className={inputClass}
                    value={party.title}
                    onChange={(e) => setParty(index, { title: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <Field label="Notice address" hint="Email or postal address for legal notices.">
              {(a11y) => (
                <input
                  {...a11y}
                  className={inputClass}
                  value={party.noticeAddress}
                  onChange={(e) => setParty(index, { noticeAddress: e.target.value })}
                />
              )}
            </Field>
          </Section>
        );
      })}
    </form>
  );
}
