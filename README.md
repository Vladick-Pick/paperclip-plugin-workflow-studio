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

## Manual Smoke Test

1. Create a workflow.
2. Add or edit a node in the inspector.
3. Save the workflow.
4. Verify the preview updates.
5. Publish to Company Skills.
6. Open the created skill from the publish panel.

## Build Options

- `pnpm build` uses esbuild presets from `@paperclipai/plugin-sdk/bundlers`.
- `pnpm build:rollup` uses rollup presets from the same SDK.
