# Workflow Studio

Visual workflow editor that publishes Paperclip Company Skills

## Requirements

- Node.js 20+
- pnpm 9+
- Paperclip `v2026.416.0` or newer

## Scaffold a New Plugin Repo

If you want to generate a fresh standalone Paperclip plugin from the official scaffolder:

```bash
npx @paperclipai/create-paperclip-plugin@2026.416.0 my-plugin
```

## Publish to npm

The package name for Plugin Manager install is:

```bash
@vlbog/paperclip-plugin-workflow-studio
```

Publish flow:

```bash
npm login
pnpm install
pnpm test
pnpm typecheck
pnpm pack:check
pnpm publish --access public --no-git-checks
```

## Install Dependencies

```bash
pnpm install
```

## Test

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Local UI Dev Server

```bash
pnpm build
pnpm dev:ui
```

The plugin dev server listens on `http://127.0.0.1:4177`.

## Install Into Paperclip

Build the plugin first:

```bash
pnpm build
```

Then install it into a running local Paperclip instance:

```bash
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName":"/Users/vladislavbogdan/Documents/Вайб-проекты/NoHum/paperclip-plugin-workflow-studio","isLocalPath":true}'
```

After installation, open the active company in Paperclip and launch `Workflow Studio` from the plugin launcher.

## Install From Plugin Manager

In Paperclip `Plugin Manager -> Install Plugin`, enter:

```text
@vlbog/paperclip-plugin-workflow-studio
```

You can also install a specific published version through the API:

```bash
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName":"@vlbog/paperclip-plugin-workflow-studio","version":"0.1.1"}'
```

## Manual Smoke Test

1. Create a workflow.
2. Add or edit a node in the inspector.
3. Save the workflow.
4. Verify the preview updates.
5. Publish to Company Skills.
6. Open the created skill from the publish panel.

## Update an Installed Plugin

1. Bump the package version.
2. Publish the new npm version.
3. Upgrade the installed plugin:

```bash
curl -X POST http://127.0.0.1:3100/api/plugins/<plugin-id>/upgrade \
  -H "Content-Type: application/json" \
  -d '{"version":"0.1.1"}'
```

Paperclip resolves the new npm version, validates the manifest, and updates the existing installed plugin record. If the new version requests additional capabilities, the upgrade is blocked until that escalation is approved.

## Build Options

- `pnpm build` uses esbuild presets from `@paperclipai/plugin-sdk/bundlers`.
- `pnpm build:rollup` uses rollup presets from the same SDK.
