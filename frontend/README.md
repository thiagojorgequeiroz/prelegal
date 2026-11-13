# Prelegal frontend

Next.js app for drafting a Common Paper **Mutual Non-Disclosure Agreement**.
Fill in the form, watch the agreement update live, and download it as a PDF.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
npm run build    # production build
```

The Standard Terms are read from `../templates/Mutual-NDA.md`, so run these
commands from inside a full checkout of the repository.

## How it works

```
templates/Mutual-NDA.md ──parseTerms──▶ TermsTemplate ─┐
                                                       ├─buildNda─▶ Block[] ─┬─▶ NdaPreview (HTML)
                     form state (NdaData) ─────────────┘                    └─▶ NdaPdf (@react-pdf)
```

- `src/lib/nda/model.ts`: the document model (`Block`, `Run`) and form data types.
- `src/lib/nda/parse-terms.ts`: parses the Standard Terms markdown, including
  `coverpage_link` references to Cover Page fields.
- `src/lib/nda/build.ts`: builds the Cover Page from the form and resolves the
  references in the Standard Terms.
- `src/components/`: the form, the HTML preview, the PDF renderer and the
  `NdaBuilder` that ties them together.

User input is only ever placed in plain-text runs, never in markdown or HTML.
The PDF engine is loaded only when **Download PDF** is clicked.
