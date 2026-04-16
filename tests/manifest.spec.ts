import { describe, expect, it } from "vitest";
import manifest from "../src/manifest.js";

describe("plugin manifest", () => {
  it("does not declare a host version gate in the manifest", () => {
    expect(manifest.minimumPaperclipVersion).toBeUndefined();
    expect(manifest.minimumHostVersion).toBeUndefined();
  });
});
