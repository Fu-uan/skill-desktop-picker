# Skill Desktop Picker implementation plan

Goal: ship a Windows floating skill picker with local discovery and portable draft insertion.

Architecture: Electron provides a frameless always-on-top window and isolated preload API. A Node catalog parses SKILL.md metadata without executing skills. A Windows helper remembers the foreground window and inserts a draft only on an explicit click. User data stays in Electron's userData directory, outside Git.

Tech stack: Electron, Node.js, vanilla HTML/CSS/JS, YAML, Windows PowerShell.

- [ ] Build and test catalog discovery, path-cycle deduplication, metadata parsing and target-specific invocation text.
- [ ] Implement main process, settings persistence, folder selection, guarded IPC and native window tracking/insertion.
- [ ] Implement graphite-first themed capsule, search, categories, Agent/status filters, source manager and skill details.
- [ ] Install dependencies; run unit and startup smoke checks; build a Windows portable executable.
- [ ] Create Fu-uan/skill-desktop-picker, commit only distributable source/docs, push and verify remote.

Scope: importing means adding a local source folder, not executing or silently copying skills across agents. Discovery never asserts runtime compatibility. All found skills show installation location and pending validation. Native insertion requires an explicitly selected/remembered foreground window and never presses Enter. Browser preview cannot provide desktop insertion.

Acceptance: search matches names/descriptions, categories and target availability can filter; themes share geometry and persist; original skill files remain unchanged; source folders can be added/removed; no local paths/skill contents are committed; auto-send is absent.
