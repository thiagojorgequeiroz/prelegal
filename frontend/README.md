# Prelegal frontend

Next.js app for drafting a Common Paper **Mutual Non-Disclosure Agreement**.
Sign in (a placeholder: any email and password works), fill in the form at
`/nda/`, watch the agreement update live, and download it as a PDF.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static export into out/, served by the backend
npm start        # serve out/ locally
```

## Testing

```bash
npm test           # unit + component tests (Vitest, ~10 s)
npm run test:watch # the same, re-running on change
npm run test:e2e   # end-to-end tests (Playwright, ~1.5 min)
npm run test:all   # lint + types + unit + e2e
```

| Layer | Where | What it covers |
|---|---|---|
| Unit | `src/lib/**/*.test.ts` | Template parsing (incl. the real `templates/Mutual-NDA.md`), building the agreement, dates, file names, input treated as plain text |
| Component | `src/components/*.test.tsx` (jsdom) | Form behaviour and accessible names, preview rendering, live updates, download flow with the PDF engine mocked: progress, errors, retry |
| PDF | `src/components/NdaPdf.test.tsx` | The real PDF engine renders the full agreement with non-Latin names |
| End-to-end | `e2e/*.spec.ts` (desktop + mobile) | The production build in Chrome: live preview, real PDF downloads, fonts, timezones, axe accessibility scan, keyboard use, layout, no console errors |

The e2e tests export into `.next-e2e/` and serve it on port 3100, so they can run
while `npm run dev` is up. Locally they use your installed Google Chrome; set
`PLAYWRIGHT_CHANNEL` to use another browser, or run `npx playwright install chromium`
and set it to `chromium`. CI (`.github/workflows/frontend.yml`) runs everything
on each pull request that touches `frontend/` or `templates/`.

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
