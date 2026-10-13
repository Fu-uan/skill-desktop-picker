# Skill Desktop Picker implementation plan

Goal: ship a Windows floating skill picker with local discovery and portable prompt copying.

Architecture: Electron provides a frameless always-on-top window and isolated preload API. A Node catalog parses SKILL.md metadata without executing skills. The main process copies an agent-specific prompt after an explicit click. User data stays in Electron's userData directory, outside Git.

Tech stack: Electron, Node.js, vanilla HTML/CSS/JS, YAML, Windows PowerShell.

- [x] Build and test catalog discovery, path-cycle deduplication, metadata parsing and target-specific invocation text.
- [x] Implement main process, settings persistence, folder selection, guarded IPC and clipboard copying.
- [x] Implement graphite-first themed capsule, search, categories, Agent/status filters, source manager and skill details.
- [x] Install dependencies; run unit and startup smoke checks; build a Windows portable executable in GitHub Actions and an unpacked local build.
- [x] Create Fu-uan/skill-desktop-picker, commit only distributable source/docs, push and verify remote.

Scope: importing means adding a local source folder, not executing or silently copying skills across agents. Discovery never asserts runtime compatibility. All found skills show installation location and pending validation. The app copies prompts for the user to paste into the target agent.

Acceptance: search matches names/descriptions, categories and target availability can filter; themes share geometry and persist; original skill files remain unchanged; source folders can be added/removed; no local paths/skill contents are committed; auto-send is absent.
