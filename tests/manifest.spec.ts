import { describe, expect, it } from "vitest";
import manifest from "../src/manifest.js";

describe("plugin manifest", () => {
  it("uses a semver minimumPaperclipVersion without a v prefix", () => {
    expect(manifest.minimumPaperclipVersion).toMatch(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/);
  });
});
