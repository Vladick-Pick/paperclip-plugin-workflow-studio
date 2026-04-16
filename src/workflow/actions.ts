import type { PluginContext } from "@paperclipai/plugin-sdk";
import { compileWorkflowToSkill } from "./compiler.js";
import { createStarterWorkflow, validateWorkflowDefinition } from "./schema.js";
import { loadCompanyWorkflows, saveCompanyWorkflows } from "./store.js";
import type {
  WorkflowCreateInput,
  WorkflowDefinition,
  WorkflowDeleteInput,
  WorkflowListResult,
  WorkflowPreviewResult,
  WorkflowPublishInput,
  WorkflowUpdateInput,
  WorkflowUpdateResult,
} from "./types.js";

export function registerWorkflowStudioHandlers(ctx: PluginContext) {
  ctx.data.register("workflow.list", async (params) => {
    const companyId = requireString(params.companyId, "companyId");
    const workflows = await loadCompanyWorkflows(ctx, companyId);
    return { workflows: sortWorkflows(workflows) } satisfies WorkflowListResult;
  });

  ctx.data.register("workflow.detail", async (params) => {
    const companyId = requireString(params.companyId, "companyId");
    const workflowId = requireString(params.workflowId, "workflowId");
    const workflows = await loadCompanyWorkflows(ctx, companyId);
    return { workflow: workflows.find((workflow) => workflow.id === workflowId) ?? null };
  });

  ctx.data.register("workflow.preview", async (params) => {
    const workflow = await resolveWorkflow(ctx, params);
    return {
      workflow,
      artifact: compileWorkflowToSkill(workflow),
    } satisfies WorkflowPreviewResult;
  });

  ctx.actions.register("workflow.create", async (params) => {
    const input = params as unknown as WorkflowCreateInput;
    const companyId = requireString(input.companyId, "companyId");
    const workflow = createStarterWorkflow(input);
    const workflows = await loadCompanyWorkflows(ctx, companyId);
    await saveCompanyWorkflows(ctx, companyId, sortWorkflows([...workflows, workflow]));
    return { workflow };
  });

  ctx.actions.register("workflow.update", async (params) => {
    const input = params as unknown as WorkflowUpdateInput;
    const companyId = requireString(input.companyId, "companyId");
    const workflow = normalizeUpdatedWorkflow(input.workflow, companyId);
    const validation = validateWorkflowDefinition(workflow);
    if (!validation.valid) throw new Error(validation.errors.join("; "));

    const workflows = await loadCompanyWorkflows(ctx, companyId);
    const index = workflows.findIndex((candidate) => candidate.id === workflow.id);
    if (index < 0) throw new Error("Workflow not found");
    workflows[index] = workflow;
    await saveCompanyWorkflows(ctx, companyId, sortWorkflows(workflows));
    return {
      workflow,
      artifact: compileWorkflowToSkill(workflow),
    } satisfies WorkflowUpdateResult;
  });

  ctx.actions.register("workflow.delete", async (params) => {
    const input = params as unknown as WorkflowDeleteInput;
    const companyId = requireString(input.companyId, "companyId");
    const workflowId = requireString(input.workflowId, "workflowId");
    const workflows = await loadCompanyWorkflows(ctx, companyId);
    await saveCompanyWorkflows(ctx, companyId, workflows.filter((workflow) => workflow.id !== workflowId));
    return { ok: true };
  });

  ctx.actions.register("workflow.publish", async (params) => {
    const input = params as unknown as WorkflowPublishInput;
    const companyId = requireString(input.companyId, "companyId");
    const workflowId = requireString(input.workflowId, "workflowId");
    const companySkillId = requireString(input.companySkillId, "companySkillId");
    const generatedHash = requireString(input.generatedHash, "generatedHash");
    const workflows = await loadCompanyWorkflows(ctx, companyId);
    const workflow = workflows.find((candidate) => candidate.id === workflowId);
    if (!workflow) throw new Error("Workflow not found");

    if (
      workflow.publishState.status === "published"
      && workflow.publishState.generatedHash
      && input.currentPublishedHash
      && input.currentPublishedHash !== workflow.publishState.generatedHash
      && !input.force
    ) {
      workflow.publishState = {
        ...workflow.publishState,
        status: "external_drift",
        error: "Published CompanySkill changed outside Workflow Studio.",
      };
      workflow.updatedAt = new Date().toISOString();
      await saveCompanyWorkflows(ctx, companyId, sortWorkflows(workflows));
      return { status: "external_drift", workflow };
    }

    workflow.publishState = {
      status: "published",
      companySkillId,
      generatedHash,
      compilerVersion: compileWorkflowToSkill(workflow).compilerVersion,
      publishedAt: new Date().toISOString(),
      error: null,
    };
    workflow.updatedAt = new Date().toISOString();
    await saveCompanyWorkflows(ctx, companyId, sortWorkflows(workflows));
    return { status: "published", workflow };
  });
}

async function resolveWorkflow(ctx: PluginContext, params: Record<string, unknown>) {
  if (params.workflow && typeof params.workflow === "object") {
    const workflow = params.workflow as WorkflowDefinition;
    const validation = validateWorkflowDefinition(workflow);
    if (!validation.valid) throw new Error(validation.errors.join("; "));
    return workflow;
  }

  const companyId = requireString(params.companyId, "companyId");
  const workflowId = requireString(params.workflowId, "workflowId");
  const workflows = await loadCompanyWorkflows(ctx, companyId);
  const workflow = workflows.find((candidate) => candidate.id === workflowId);
  if (!workflow) throw new Error("Workflow not found");
  return workflow;
}

function normalizeUpdatedWorkflow(workflow: WorkflowDefinition, companyId: string): WorkflowDefinition {
  if (!workflow || typeof workflow !== "object") throw new Error("workflow is required");
  if (workflow.companyId !== companyId) throw new Error("Workflow companyId mismatch");
  const nextStatus = workflow.publishState.status === "published" ? "dirty" : workflow.publishState.status;
  return {
    ...workflow,
    publishState: { ...workflow.publishState, status: nextStatus },
    updatedAt: new Date().toISOString(),
  };
}

function sortWorkflows(workflows: WorkflowDefinition[]) {
  return [...workflows].sort((left, right) => left.name.localeCompare(right.name));
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}
