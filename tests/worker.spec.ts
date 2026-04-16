import { describe, expect, it } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import type { WorkflowDefinition, WorkflowListResult, WorkflowPreviewResult } from "../src/workflow/index.js";

describe("workflow studio worker", () => {
  async function setupHarness() {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);
    return harness;
  }

  it("stores workflows in company-scoped plugin state", async () => {
    const harness = await setupHarness();

    await harness.performAction("workflow.create", {
      companyId: "company-a",
      name: "A Workflow",
      slug: "a-workflow",
      description: "A",
    });
    await harness.performAction("workflow.create", {
      companyId: "company-b",
      name: "B Workflow",
      slug: "b-workflow",
      description: "B",
    });

    const companyA = await harness.getData<WorkflowListResult>("workflow.list", { companyId: "company-a" });
    const companyB = await harness.getData<WorkflowListResult>("workflow.list", { companyId: "company-b" });

    expect(companyA.workflows.map((workflow) => workflow.slug)).toEqual(["a-workflow"]);
    expect(companyB.workflows.map((workflow) => workflow.slug)).toEqual(["b-workflow"]);
  });

  it("previews and records a published CompanySkill", async () => {
    const harness = await setupHarness();
    const created = await harness.performAction<{ workflow: WorkflowDefinition }>("workflow.create", {
      companyId: "company-a",
      name: "Launch Gate",
      slug: "launch-gate",
      description: "Launch readiness checks",
    });

    const preview = await harness.getData<WorkflowPreviewResult>("workflow.preview", {
      companyId: "company-a",
      workflowId: created.workflow.id,
    });

    const published = await harness.performAction<{ workflow: WorkflowDefinition }>("workflow.publish", {
      companyId: "company-a",
      workflowId: created.workflow.id,
      companySkillId: "skill-1",
      generatedHash: preview.artifact.generatedHash,
    });

    expect(published.workflow.publishState.status).toBe("published");
    expect(published.workflow.publishState.companySkillId).toBe("skill-1");
    expect(published.workflow.publishState.generatedHash).toBe(preview.artifact.generatedHash);
  });

  it("returns a fresh artifact when updating a workflow", async () => {
    const harness = await setupHarness();
    const created = await harness.performAction<{ workflow: WorkflowDefinition }>("workflow.create", {
      companyId: "company-a",
      name: "Update Preview",
      slug: "update-preview",
      description: "Original description",
    });

    const nextWorkflow = {
      ...created.workflow,
      description: "Updated description",
      nodes: created.workflow.nodes.map((node) => node.type === "prompt"
        ? { ...node, data: { ...node.data, prompt: "Use the updated instructions." } }
        : node),
    };

    const updated = await harness.performAction<{
      workflow: WorkflowDefinition;
      artifact: { skillMarkdown: string; generatedHash: string };
    }>("workflow.update", {
      companyId: "company-a",
      workflow: nextWorkflow,
    });

    expect(updated.artifact.skillMarkdown).toContain("Updated description");
    expect(updated.artifact.skillMarkdown).toContain("Use the updated instructions.");
    expect(updated.artifact.generatedHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("marks external drift instead of silently overwriting", async () => {
    const harness = await setupHarness();
    const created = await harness.performAction<{ workflow: WorkflowDefinition }>("workflow.create", {
      companyId: "company-a",
      name: "Drift Check",
      slug: "drift-check",
      description: "Detect edited skills",
    });
    const preview = await harness.getData<WorkflowPreviewResult>("workflow.preview", {
      companyId: "company-a",
      workflowId: created.workflow.id,
    });
    await harness.performAction("workflow.publish", {
      companyId: "company-a",
      workflowId: created.workflow.id,
      companySkillId: "skill-1",
      generatedHash: preview.artifact.generatedHash,
    });

    const drift = await harness.performAction<{ workflow: WorkflowDefinition; status: string }>("workflow.publish", {
      companyId: "company-a",
      workflowId: created.workflow.id,
      companySkillId: "skill-1",
      generatedHash: preview.artifact.generatedHash,
      currentPublishedHash: "different",
    });

    expect(drift.status).toBe("external_drift");
    expect(drift.workflow.publishState.status).toBe("external_drift");
  });
});
