import { describe, expect, it } from "vitest";
import manifest from "../src/manifest.js";

describe("plugin manifest", () => {
  it("does not declare a host version gate in the manifest", () => {
    expect(manifest.minimumPaperclipVersion).toBeUndefined();
    expect(manifest.minimumHostVersion).toBeUndefined();
  });

  it("registers a native sidebar entry for the workflow studio page", () => {
    expect(manifest.capabilities).toContain("ui.sidebar.register");
    expect(manifest.ui?.slots?.some((slot) => slot.type === "sidebar" && slot.exportName === "WorkflowStudioSidebarLink")).toBe(true);
  });
});
