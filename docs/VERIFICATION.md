# Verification record

The original record (2026-10-15, Windows, Node 24.15.0) reported `npm test` 33/33 and noted that browser QA, real browser interactions and any live integration were **not** verified. This record replaces it with the adversarial review's before/after results. Findings and context are in [REVIEW.md](REVIEW.md).

## Environment

Linux container. Node.js 24.22.0 (built-in SQLite 3.53.4). Chromium via Playwright 1.56.1. MCP Python SDK 2.2.0. Bifrost transport v2.3.0, started locally through `@maximhq/bifrost` 1.6.3. All identities, tokens, keys and records were synthetic, and every service bound to loopback.

## Before / after

| Check | Original `95a3c2f` | This branch | How to rerun |
|---|---|---|---|
| `npm run check` | pass | pass | `npm run check` |
| `npm test` | 33/33 | **53/53** (33 original, 1 assertion replaced; 20 new) | `npm test` |
| New regression tests run against `95a3c2f` | 19 of 20 fail | 20/20 pass | Copy `test/redteam.test.js` into a checkout of `95a3c2f` (shim `parseMode`) |
| Adversarial probes (`docs/review/scripts/probe.mjs`) | **21/21 reproduce a defect** | 1/21 (P18b, inherent) | `node docs/review/scripts/probe.mjs <repo-root> <label>` |
| Real browser, demo workflow, desktop + 390 px phone | 38/44 | **44/44** | `node docs/review/scripts/browser-qa.mjs <repo-root> <out> <port>` |
| Real browser, authenticated deployment | 8/8 | 8/8 | `docs/review/scripts/auth-qa.mjs` |
| Official MCP SDK, Streamable HTTP, two users with disjoint private notes | 8/9 (no governance labels) | 9/9 | `docs/review/scripts/mcp-harness.sh <repo-root> <out> <port>` |
| Real Bifrost v2.3.0 gateway, shipped config | — | **fails** (401 `virtual key required`; client can never accept a per-user `Authorization` value) | see REVIEW.md, "Real Bifrost results" |
| Real Bifrost v2.3.0 gateway, corrected config, two users | — | **isolated end to end** | as above |
| Real Bifrost, two people sharing one virtual key | — | **second person receives the first person's private context** (deployment control required) | as above |
| `bootstrap` at 2k items / 20k events | 2,859 ms | 60–93 ms (two runs) | `node docs/review/scripts/scale.mjs <repo-root> 2000 20000` |
| `bootstrap` at 10k items / 100k events | 9,770 ms | 349–607 ms (two runs) | `… 10000 100000` |
| Delivered packet at 10k items (claimed tokens) | 358,585 chars (claimed 3,991) | 3,363 chars (claimed 843, ≥ actual) | `scale.mjs` |

Raw results: `docs/review/results/`. Screenshots: `docs/review/evidence/`. Timings come from a shared container and vary by run; they measure the local process only, not network, Bifrost or model latency.

## Browser checks exercised (44)

Overview; personal, team, named-person and reconciliation context requests; summarized exclusion trace. Create and edit knowledge; promotion with required consent; manager review that shows only the submitted text; approve without a rationale (refused); request changes; resubmit; double-click approve (exactly one decision); certified copy alongside the preserved private original. Recertification diff against the last certified version. A dependent app refused while its endorsement is suspended, then re-endorsed. Stale proposal blocked with a reason, and Escape closes the dialog. JSON import through the real file input, with provenance shown. Tether proposed, accepted and revoked; delegate appointed and revoked. App context; keyboard Enter on a registry row; reload persistence. No horizontal overflow on any of nine screens at 390 px; the review dialog fits a phone. No JavaScript console errors; only the expected 400 (missing rationale) and 409 (suspended app) responses.

Authenticated browser: token login, wrong-token message, no identity switcher, header spoof rejected (401), body/header spoof ignored, reload clears the in-memory token, cross-origin request rejected (403).

## What was still not verified

- Any company Bifrost deployment, Bifrost SSO or dashboard login for end users, or the end-user per-user header page. Per-user values were submitted with the admin setup token.
- A trusted pre-answer hook in a real AI client.
- Any real Confluence, Jira, GitLab, Manufacturo, NX, BigQuery, OpenMetadata or SSO instance. Live discovery adapters are tested only against mocked HTTP responses.
- Multi-instance operation. The transaction fix was shown with two database handles in one process, simulating an interleaved second process.
- Screen-reader behavior and full WCAG conformance. Keyboard and dialog basics were checked.
