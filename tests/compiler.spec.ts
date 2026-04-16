import { describe, expect, it } from "vitest";
import { compileWorkflowToSkill, createStarterWorkflow } from "../src/workflow/index.js";

describe("workflow compiler", () => {
  it("compiles every supported node family into SKILL.md and workflow-map reference", () => {
    const workflow = createStarterWorkflow({
      companyId: "company-1",
      name: "Deal Desk",
      slug: "deal-desk",
      description: "Coordinate deal review",
    });
    workflow.structuredOverrides = {
      introOverride: "Use this workflow when a deal needs multi-agent review.",
      constraintsOverride: "Do not approve discounts without explicit approval.",
      notesOverride: "Prefer concise status updates.",
    };
    workflow.nodes.push(
      {
        id: "agent",
        type: "subAgent",
        position: { x: 520, y: 0 },
        data: {
          description: "Pricing reviewer",
          agentDefinition: "Reviews pricing and discount risk.",
          prompt: "Evaluate the proposed deal economics.",
          model: "sonnet",
          tools: "Read, Grep",
        },
      },
      {
        id: "question",
        type: "askUserQuestion",
        position: { x: 780, y: 0 },
        data: {
          questionText: "Is legal review required?",
          options: [{ label: "Yes", description: "Route to legal" }],
        },
      },
      {
        id: "if-else",
        type: "ifElse",
        position: { x: 910, y: 120 },
        data: {
          branches: [
            { label: "Needs approval", condition: "Discount exceeds policy" },
            { label: "Auto approve", condition: "Within policy" },
          ],
        },
      },
      {
        id: "switch",
        type: "switch",
        position: { x: 1040, y: 0 },
        data: {
          branches: [{ label: "High risk", condition: "Discount above threshold" }],
        },
      },
      {
        id: "skill",
        type: "skill",
        position: { x: 1300, y: 0 },
        data: {
          skillName: "portfolio-review",
          instructions: "Use the portfolio review rubric.",
        },
      },
      {
        id: "mcp",
        type: "mcp",
        position: { x: 1560, y: 0 },
        data: {
          serverName: "crm",
          toolName: "search_deals",
          arguments: { stage: "proposal" },
        },
      },
      {
        id: "sub-flow",
        type: "subAgentFlow",
        position: { x: 1690, y: 120 },
        data: {
          flowName: "Legal escalation",
          instructions: "Run the legal escalation flow if the deal is high risk.",
        },
      },
      {
        id: "codex",
        type: "codex",
        position: { x: 1820, y: 0 },
        data: {
          prompt: "Update the deal memo.",
          model: "gpt-5.4",
        },
      },
      {
        id: "group",
        type: "group",
        position: { x: 2080, y: 0 },
        data: {
          label: "Decision package",
          description: "Collect memo, pricing, and legal notes.",
        },
      },
    );

    const artifact = compileWorkflowToSkill(workflow);

    expect(artifact.skillMarkdown).toContain("name: deal-desk");
    expect(artifact.skillMarkdown).toContain("Use this workflow when a deal needs multi-agent review.");
    expect(artifact.skillMarkdown).toContain("Pricing reviewer");
    expect(artifact.skillMarkdown).toContain("Needs approval");
    expect(artifact.skillMarkdown).toContain("Is legal review required?");
    expect(artifact.skillMarkdown).toContain("crm.search_deals");
    expect(artifact.skillMarkdown).toContain("Legal escalation");
    expect(artifact.skillMarkdown).toContain("Codex");
    expect(artifact.skillMarkdown).toContain("Decision package");
    expect(artifact.referenceMarkdown).toContain("# Workflow Map: Deal Desk");
    expect(artifact.skillMarkdown).not.toContain("sourceSchemaVersion");
    expect(artifact.skillMarkdown).not.toContain("sourceSchemaCommit");
    expect(artifact.referenceMarkdown).not.toContain("Source schema");
    expect(artifact.generatedHash).toMatch(/^[a-f0-9]{64}$/);
    expect("sourceSchemaVersion" in artifact.metadata).toBe(false);
    expect("sourceSchemaCommit" in artifact.metadata).toBe(false);
  });

  it("is deterministic for preview and publish parity", () => {
    const workflow = createStarterWorkflow({
      companyId: "company-1",
      name: "Research Brief",
      slug: "research-brief",
      description: "Create research briefs",
    });

    const first = compileWorkflowToSkill(workflow);
    const second = compileWorkflowToSkill(workflow);

    expect(second).toEqual(first);
  });
});
