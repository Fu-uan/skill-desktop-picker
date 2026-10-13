# Skill Desktop Picker

A small Windows desktop capsule for finding and selecting local agent skills, then inserting a draft into your AI conversation.

中文：常驻桌面的技能选择器，支持 Codex、Claude Code、Hermes、OpenClaw 的本地技能目录，以及自定义共享技能库。

## Features

- Frameless draggable capsule, always-on-top toggle, collapse, minimize.
- Search names/descriptions; category, selected, favorites and agent discovery filters.
- Four interchangeable themes: graphite (default), paper, mist blue, amber.
- Theme-colored usage bars and frequent-first sorting. Copy/insertion requests count locally; selection and AI execution do not. Hover for counts. Stable buckets: 0, 1–3, 4–10, 11–30, 31+.
- Add/remove local source folders without modifying original skills.
- Agent-specific invocation drafts; copy or insert without sending.
- `Ctrl+Alt+K`: remember the active window and bring up the picker.
- Settings and local paths stay under the OS app-data directory, not in this repository.

## Run

Requires Node.js 22+ and Windows for direct insertion.

```sh
npm install
npm test
npm start
```

Build a portable Windows executable:

```sh
npm run dist
```

## Usage

1. Open the picker. Default local agent directories are scanned.
2. Add project or custom folders through **技能来源**. Choose **共享技能库** unless the folder is actually an agent's configured installation directory.
3. Select the destination agent, search and select skills.
4. Put the cursor in the AI input box, then press `Ctrl+Alt+K`.
5. Check the displayed target window; click **插入草稿**. Review the result and send yourself.

The clipboard is replaced with the invocation text. Insertion uses Windows focus activation and Ctrl+V, never Enter. Some terminals use a different paste shortcut, and elevated/protected windows may block insertion; use **复制调用文字** in those cases. A wrong focus can put text in another control: verify the target and draft. Do not use insertion into an ordinary shell prompt.

## Honest availability labels

“此 Agent 已发现 · 待验证” means a `SKILL.md` was found under a source associated with that agent. It does **not** prove that the current agent session loaded it, dependencies are installed, permissions are granted, or its instructions are compatible. Duplicate physical directories are deduplicated while preserving agent associations. Equal names from different folders remain separate.

This release does not install/synchronize skills, read other apps' conversation text, recommend from hidden drafts, or verify skill execution. Remote agents, WSL profiles, custom workspace paths and plugin caches must be added explicitly when accessible. Classification is a local name-based heuristic. Refresh rescans sources; continuous file watching is not yet implemented.

## Security and privacy

Skills are parsed as text and never executed during discovery. The renderer has no Node access; a narrow isolated preload exposes local actions. No telemetry, accounts or cloud requests are used by the running app. The Windows helper reads only foreground window title/process/handle for insertion, not conversation content. No skill contents are shipped in this repository.

## Project structure

`src/catalog.cjs` handles metadata/indexing, `src/main.cjs` owns desktop integration, `src/window-bridge.ps1` handles Windows window activation, and `src/renderer.js` implements the picker. `tests/` covers catalog and invocation behavior.

Status: initial implementation; see the task handoff for which checks have actually run. No license is granted beyond GitHub's platform terms until the owner chooses a license.
