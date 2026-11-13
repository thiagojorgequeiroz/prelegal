import { readFileSync } from "node:fs";
import path from "node:path";
import { parseTerms } from "./parse-terms";

/**
 * The Standard Terms live in the repository-level `templates/` directory.
 * They are read once at module scope, so the result is baked into the static
 * page at build time. Server-only: never import this from a client component.
 */
const TERMS_PATH = path.join(process.cwd(), "..", "templates", "Mutual-NDA.md");

export const standardTerms = parseTerms(readFileSync(TERMS_PATH, "utf-8"));
