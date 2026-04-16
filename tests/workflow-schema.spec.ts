import { describe, expect, it } from "vitest";
import {
  WORKFLOW_NODE_TYPES,
  createStarterWorkflow,
  validateWorkflowDefinition,
} from "../src/workflow/index.js";

describe("workflow schema", () => {
  it("matches the supported node vocabulary", () => {
    expect(WORKFLOW_NODE_TYPES).toEqual([
      "start",
      "end",
      "prompt",
      "subAgent",
      "askUserQuestion",
      "ifElse",
      "switch",
      "skill",
      "mcp",
      "subAgentFlow",
      "codex",
      "group",
    ]);
  });

  it("creates a valid starter workflow with one start and one end", () => {
    const workflow = createStarterWorkflow({
      companyId: "company-1",
      name: "Launch Review",
      slug: "launch-review",
      description: "Review launch readiness",
    });

    const result = validateWorkflowDefinition(workflow);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(workflow.publishState.status).toBe("unpublished");
    expect("sourceSchemaVersion" in workflow).toBe(false);
    expect(workflow.nodes.map((node) => node.type)).toEqual(["start", "prompt", "end"]);
  });

  it("rejects unknown node types and dangling edges", () => {
    const workflow = createStarterWorkflow({
      companyId: "company-1",
      name: "Broken",
      slug: "broken",
      description: null,
    });
    workflow.nodes.push({
      id: "bad-node",
      type: "not-real",
      position: { x: 0, y: 0 },
      data: {},
    } as never);
    workflow.edges.push({
      id: "dangling",
      source: "missing",
      target: "end",
    });

    const result = validateWorkflowDefinition(workflow);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Unsupported node type: not-real");
    expect(result.errors).toContain("Edge dangling has unknown source: missing");
  });
});
