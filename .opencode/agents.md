Frontend runs at http://localhost:5173
API runs at http://127.0.0.1:8000

Always use the chrome-devtools MCP server.

Startup checklist:
- Run `python scripts/dev_servers.py status all` and start any stopped services.

Local dev server control (PID + logs):
- Start with dev tools enabled: `python scripts/dev_servers.py start api --dev-tools`
- Start editor: `python scripts/dev_servers.py start editor`
- Start MCP: `python scripts/dev_servers.py start mcp`
- Start Chrome debugging (dedicated profile): `scripts/debug_chrome.sh`
- Run Chrome in background: `scripts/debug_chrome.sh > .opencode/logs/chrome.log 2>&1 &`
- If you use dev_servers for Chrome, ensure it launches the debug profile above.

Editor dev auto-login (optional):
- Create `editor/.env` with `VITE_DEV_AUTH_EMAIL` and `VITE_DEV_AUTH_PASSWORD`.
- `editor/.env` is required for Vite; the project root `.env` is used by API/MCP.
- Auto-login only triggers when no JWT is stored; click “Log out” once to switch users.
- The editor will attempt a dev-only login (or register on 401) when no JWT is present.
- Status: `python scripts/dev_servers.py status all`
- Tail logs: `python scripts/dev_servers.py tail api --lines 200 --follow`

Dev MCP server:
- Name: `zodiac-tools`
- Requires `ZODIAC_DEV_TOOLS=1` on the API server
- Local-only; exposes chart/layout/mask testing tools

Debugging workflow:

1. Select the Chrome page whose URL contains localhost:5173
2. Inspect browser console errors and warnings
3. Inspect failed or slow network requests
4. Verify failing API calls directly against http://127.0.0.1:8000
5. Identify the responsible frontend or backend source code
6. Apply fixes to source files
7. Wait for Vite hot module reload
8. Re-check console and network automatically
9. Repeat until no runtime errors remain

Never declare success while browser console errors, network failures, or API errors are present.

Loop control / safety:

- Limit to 3 fix attempts for the same repeating error signature (same message + same stack trace top frame).
- After each attempt, re-check console + failed network requests.
- If the same error repeats after 3 attempts:
  1) stop making edits
  2) summarize what was tried
  3) propose 2-3 specific hypotheses and the next diagnostic step for each
  4) ask for the single missing detail needed (e.g., the failing endpoint response body, the exact stack trace, or the relevant file)

Diff preferences:

- Do not do refactors or formatting changes while debugging unless required to fix the error.
- Prefer minimal diffs that directly address the observed console/network failure.
