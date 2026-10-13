# Validation

Window collapse fix: Windows ignored setSize on a non-resizable frameless window (requested 76 DIP, observed 741 DIP). Temporarily enabling resizing for the synchronous size change reduced the native bounds to 77 DIP (DPI rounding). Native regression check passed 20 transitions across 90/100/110/125/150% UI scales and confirmed the resize lock is restored. Run using Electron with tests/window-bounds.cjs. Existing 7 unit checks also passed.

2026-10-13 initial development:

- Node syntax checks: passed for main, renderer and catalog.
- Unit tests: 3 passed (YAML metadata, discovery/deduplication, agent invocation).
- Local Codex directory discovery: 70 skills, 0 metadata errors. No personal skill contents or paths are committed.
- Production npm dependency audit: 0 findings. Electron was separately upgraded to 44.7.0 after auditing its binary package.
- Build dependency audit: 8 moderate transitive findings remain in electron-builder 26.15.3's download/logging dependency chain. The suggested builder downgrade introduces other higher-severity findings, so it is not applied.
- Runtime downloaded through npmmirror and verified against the official GitHub release asset SHA-256: eee30dc8fa1f5ea95490e59f44e46ea68dd24c6e93d22facf70fe5c2d4c2665c.
- Desktop smoke test: passed, main window loaded and renderer acknowledged readiness with 119 discovered skills across default sources. GPU shutdown warnings occurred after successful readiness/exit; visual native rendering still merits user confirmation.
- Local unpacked Windows build: passed. GitHub Windows portable build: passed, run 38360934078.
- Native insertion into external agent windows has not been end-to-end tested; user must verify the target draft. Usage counts mean successful copy/insertion request, not actual agent execution.

GitHub Actions runs tests and produces a Windows portable artifact. A green build verifies packaging, not input integration with every Agent.
