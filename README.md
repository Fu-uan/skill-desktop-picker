# Skill Desktop Picker

A small Windows desktop capsule for finding local agent skills and copying an invocation prompt into your AI conversation.

中文：常驻桌面的技能选择器，支持 Codex、Claude Code、Hermes、OpenClaw 的本地技能目录，以及自定义共享技能库。

## Features

- Frameless draggable capsule, always-on-top toggle, collapse, minimize.
- Search names/descriptions; category, selected, favorites and agent discovery filters.
- Four interchangeable themes: graphite (default), paper, mist blue, amber.
- Chinese display-only glosses, original descriptions in details, editable Chinese titles/descriptions/tags, and bilingual search. No skill files are changed or sent to a translation service. Unrecognized English skills require a manual gloss; built-in glosses are summaries, not authoritative translations.
- Font presets (12/13/15/17px) and UI zoom (90–150%) persist independently. Helper and disabled text use theme-specific colors tested for at least 4.5:1 contrast.
- Theme-colored usage bars and frequent-first sorting. Copies count locally; earlier versions also counted insertion requests. Selection and AI execution do not count. Hover for counts. Stable buckets: 0, 1–3, 4–10, 11–30, 31+.
- Add/remove local source folders without modifying original skills.
- Agent-specific invocation text copied to the clipboard.
- `Ctrl+Alt+K`: bring up the picker.
- Settings and local paths stay under the OS app-data directory, not in this repository.

## Run

Requires Node.js 22+ and Windows for the desktop build.

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
2. Use **添加 Skill** to install from a public GitHub link or an existing local Skill folder. **管理来源** opens a separate page for scanning skills already installed in other folders.
3. Select the destination agent, search and select skills.
4. Click **复制指令**, then paste it into the AI conversation and send it yourself. `Ctrl+Alt+K` opens the picker from another window.

For Codex, the copied text uses the `$skill-name` form, for example `请使用 $anysearch 完成本次任务。如果技能不可用，请先说明。` The `$` is Codex's explicit skill reference, not part of the skill name. The skill must still be available in the target agent's current environment. Other agents receive their own invocation wording.

## Honest availability labels

The list now displays **Agent compatibility** separately from directory discovery. Target-specific filters spell out the chosen agent, e.g. **支持 Codex**. Compatibility starts unknown; explicit manual marks record their basis and become unknown again when the skill instructions change. Directory presence and copy counts never establish compatibility. Use the skill details to maintain per-agent support labels. DeepSeek Harness is a selectable target with generic natural-language drafts, not a verified native integration.

## Install a Skill

Open **添加 Skill**, paste a public GitHub repository, skill directory or SKILL.md link, and click **读取链接**. A single skill is previewed automatically; repositories with several skills let you choose one. Alternatively choose **选择本地 Skill 文件夹** for a downloaded folder directly containing SKILL.md. Select the target Agent and click **安装到 …**. The app downloads or copies the full skill folder, reads files back to verify them, checks metadata, and rescans the installed directory. It does not execute scripts or replace an existing same-name folder.

Built-in destinations are the current user's .codex/skills, .claude/skills, HERMES_HOME/skills (or .hermes/skills), and .openclaw/skills. Missing folders are created when installation is confirmed. **高级设置 · 安装目录** lets you override and remember a destination for each Agent. DeepSeek Harness and other custom agents require this one-time configuration. **共享技能库** saves under the picker's app-data folder.

The completion page shows file checks and the installation location. The catalog retains a **本应用已安装** receipt. These checks establish that the files were installed and can be scanned; they do not establish that a running Agent session loaded the skill or that external dependencies are ready. Reopen the target Agent session and invoke the skill to confirm runtime availability.

Only public GitHub repositories are supported. Private repositories, ZIP import, branch names containing `/`, symlinks/submodules, huge/truncated trees, and packages over 200 files / 20 MB (3 MB per file) are not supported. Unauthenticated GitHub API limits apply; errors are shown on the installation page. No GitHub credentials are read by this importer. Already-installed skills can be indexed through **管理来源 → 添加扫描目录**.

“此 Agent 已发现 · 待验证” means a `SKILL.md` was found under a source associated with that agent. It does **not** prove that the current agent session loaded it, dependencies are installed, permissions are granted, or its instructions are compatible. Duplicate physical directories are deduplicated while preserving agent associations. Equal names from different folders remain separate.

This release does not synchronize updates across agents, read other apps' conversation text, recommend from hidden drafts, or verify skill execution. Remote agents, WSL profiles, custom workspace paths and plugin caches must be added explicitly when accessible. Classification is a local name-based heuristic. Refresh rescans sources; continuous file watching is not yet implemented.

## Security and privacy

The desktop importer downloads the repository snapshot directly from GitHub's official codeload service, avoiding API rate limits and Git subprocess retries. It shows download stages, byte counts and elapsed time, with cancellation and a 20-second download deadline. Previews are cached for ten minutes and files are reused during installation. Archives are read in memory with size limits, and their commit identifier pins the previewed version. No Git installation is needed for this flow.

Skills are parsed as text and never executed during discovery or import. The renderer has no Node access; a narrow isolated preload exposes local actions. No telemetry or accounts are used. Explicit GitHub import sends the repository/path to GitHub's public API; local skills and conversations are not uploaded. No personal skill contents are shipped in this repository.

## Project structure

`src/catalog.cjs` handles metadata/indexing, `src/main.cjs` owns desktop integration and clipboard copying, and `src/renderer.js` implements the picker. `tests/` covers catalog and invocation behavior.

Status: initial implementation; see the task handoff for which checks have actually run. No license is granted beyond GitHub's platform terms until the owner chooses a license.
