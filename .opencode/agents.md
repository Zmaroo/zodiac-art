Frontend runs at http://localhost:5173
API runs at http://127.0.0.1:8000

Always use the chrome-devtools MCP server.

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