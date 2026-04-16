import type { PluginContext } from "@paperclipai/plugin-sdk";
import type { WorkflowDefinition } from "./types.js";

const WORKFLOW_STATE_NAMESPACE = "workflow-studio";
const WORKFLOW_STATE_KEY = "workflows";

export async function loadCompanyWorkflows(ctx: PluginContext, companyId: string): Promise<WorkflowDefinition[]> {
  const value = await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: WORKFLOW_STATE_NAMESPACE,
    stateKey: WORKFLOW_STATE_KEY,
  });

  if (!Array.isArray(value)) return [];
  return value.filter(isWorkflowLike) as WorkflowDefinition[];
}

export async function saveCompanyWorkflows(
  ctx: PluginContext,
  companyId: string,
  workflows: WorkflowDefinition[],
): Promise<void> {
  await ctx.state.set(
    {
      scopeKind: "company",
      scopeId: companyId,
      namespace: WORKFLOW_STATE_NAMESPACE,
      stateKey: WORKFLOW_STATE_KEY,
    },
    workflows,
  );
}

function isWorkflowLike(value: unknown): value is WorkflowDefinition {
  return Boolean(
    value
      && typeof value === "object"
      && "id" in value
      && "companyId" in value
      && "nodes" in value
      && "edges" in value,
  );
}

