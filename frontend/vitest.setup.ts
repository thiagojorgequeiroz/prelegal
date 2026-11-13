import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  // Only meaningful in jsdom tests, harmless in node ones.
  if (typeof document !== "undefined") cleanup();
});
