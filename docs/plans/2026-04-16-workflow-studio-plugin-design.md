# Paperclip Workflow Studio Plugin Design

## Summary

`paperclip-plugin-workflow-studio` is a standalone Paperclip plugin repository.
It adds a company-scoped visual workflow authoring page inside Paperclip and
publishes workflows as Paperclip `CompanySkill` entries.

Workflow graph data is the source of truth. Generated `SKILL.md` and
`references/workflow-map.md` are publish artifacts.

## Source Provenance

- Paperclip official source: `paperclipai/paperclip`
- Paperclip target baseline: `v2026.416.0`
- Paperclip target master commit at design time:
  `1afb6be961550694ca9d537cc97a27306950edab`
- Paperclip stable commit at design time:
  `b8725c52eff66cdea8cb223f1ca885475a254468`
- Workflow node source: upstream visual workflow schema snapshot
- Workflow node source commit:
  `a9cdf0d24d062d7cf4b4958fc0b9e6e093da4018`
- Workflow schema source:
  `resources/workflow-schema.json`

## V1 Behavior

- The plugin declares `workspace` and `ui` categories.
- The plugin provides a company page and launcher called `Workflow Studio`.
- Workflow definitions are stored in plugin state scoped by company.
- V1 supports all node types listed by the upstream visual workflow schema.
- V1 compiles workflows into skill markdown and a generated reference document.
- V1 does not run workflows as an execution engine.
- V1 does not export to external `.claude`, `.codex`, `.cursor`, or VS Code
  workflow folders.
- V1 does not implement dual sync between markdown and graph data.

## Publish Model

The plugin UI publishes the compiler output through official Paperclip
`CompanySkill` HTTP APIs:

- `POST /api/companies/:companyId/skills`
- `PATCH /api/companies/:companyId/skills/:skillId/files`

The worker stores the resulting `companySkillId`, `generatedHash`, and compiler
version in the workflow publish state.

If a previously published `CompanySkill` no longer matches the stored generated
hash, the workflow is marked `external_drift` and requires explicit republish.
