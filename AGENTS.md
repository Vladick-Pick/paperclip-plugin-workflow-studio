# Paperclip Workflow Studio

## Project Summary

- Standalone Paperclip plugin repo, not part of the Paperclip monorepo.
- Purpose: provide a visual workflow editor inside Paperclip and publish workflows as company skills.
- npm package name: `@vlbog/paperclip-plugin-workflow-studio`
- Plugin id: `paperclip-plugin-workflow-studio`
- Current published package line: `0.1.x`
- Recommended Paperclip baseline: `2026.416.0`
- Do not declare `minimumPaperclipVersion` or `minimumHostVersion` in the
  manifest right now. Current Paperclip server builds can report host version
  `0.0.0` during plugin install validation and reject valid plugins.

## Product Rules

- V1 source of truth is the workflow graph.
- `SKILL.md` and `references/workflow-map.md` are generated from the workflow graph.
- Do not treat markdown as a second editable source of truth.
- Store workflow data in plugin state scoped by company.
- Do not add Paperclip core DB migrations for this plugin in V1.
- Publish target is Paperclip `CompanySkill`, not a separate skill library.
- V1 does not execute workflows inside Paperclip.
- V1 does not export to external `.claude`, `.codex`, `.cursor`, or VS Code workflow folders.
- V1 does not implement dual sync between markdown and canvas.

## Permissions and UX Rules

- Create, edit, and publish are intended for board/admin users in V1.
- Other users should be read-only or should not see the launcher.
- UI surface includes:
  - workflow library
  - graph/canvas editor
  - node inspector
  - preview panel
  - publish panel
  - link to the created Paperclip Company Skill

## Workflow Model Invariants

- Supported node types:
  - `start`
  - `end`
  - `prompt`
  - `subAgent`
  - `askUserQuestion`
  - `ifElse`
  - `switch`
  - `skill`
  - `mcp`
  - `subAgentFlow`
  - `codex`
  - `group`
- Keep the node vocabulary stable unless the user explicitly changes the schema contract.
- Compiler metadata should include:
  - `workflowId`
  - `workflowSchemaVersion`
  - `generatedHash`
  - `compilerVersion`
  - `publishedByPlugin`
- Do not reintroduce removed provenance fields like `sourceSchemaVersion` or `sourceSchemaCommit`.

## Publishing Rules

- Publish flow creates or updates a Paperclip `CompanySkill`.
- Detect external edits and mark workflow state as `external_drift`; do not overwrite silently.
- Keep preview output and publish output identical for generated artifacts.
- Before publishing a new npm version:
  1. bump `package.json` version
  2. keep `src/manifest.ts` version in sync
  3. run tests and build
  4. publish to npm
- Official install path for users is Paperclip Plugin Manager with the npm package name.
- Do not default to local-path install or direct API install when the user asks for the official install path.

## Critical Gotchas

- Keep the recommended minimum host version documented as `2026.416.0`, but do
  not enforce it in the manifest until Paperclip host version reporting is
  fixed upstream.
- Paperclip Plugin Manager installs server-side into `~/.paperclip/plugins`.
- Server-side npm cache can become stale; if UI install keeps surfacing old manifest data, inspect:
  - `~/.paperclip/plugins/package.json`
  - `~/.paperclip/plugins/package-lock.json`
  - `~/.paperclip/plugins/node_modules/@vlbog/paperclip-plugin-workflow-studio/dist/manifest.js`
- On the deployed server, `paperclip.service` runs with `Restart=always`. If plugin cache is correct but the running process is stale, restarting the service is a valid operational fix.

## Repository Rules

- Do not mention the forbidden upstream workflow project name in code, docs, tests, plans, or generated content.
- Prefer official Paperclip sources and current repo conventions.
- Keep changes scoped; avoid unrelated refactors.
- Use `apply_patch` for manual file edits.
- Add tests for regressions before fixing behavior when practical.

## Verification

- Standard checks:
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm build`
- Packaging check:
  - `pnpm pack:check`
- For install regressions, verify the published tarball manifest:
  - `npm pack @vlbog/paperclip-plugin-workflow-studio@<version>`
  - inspect `package/dist/manifest.js`

## Important Files

- Manifest: `src/manifest.ts`
- Worker entry: `src/worker.ts`
- Workflow model and compiler: `src/workflow/*`
- UI entry: `src/ui/index.tsx`
- Design doc: `docs/plans/2026-04-16-workflow-studio-plugin-design.md`
- Regression test for manifest semver: `tests/manifest.spec.ts`
