# Verification record

Date: 2026-10-15

Runtime: Node.js 24.15.0, SQLite 3.51.3, Windows.

## Completed

- `npm run check` — JavaScript syntax checks passed.
- `npm test` — **33 tests passed**, no failures or skipped tests.
- Node HTTP service launched and reported its local listening URL.
- Persistent state was reopened from a real temporary SQLite database and reviewed knowledge survived the restart.
- All nine screen templates rendered in a JavaScript VM harness; review/editor/source/detail templates and escaping were exercised.
- The actual HTTP handler was exercised through the server request event, including the full create → submit → separate-manager approval flow, authenticated identity, invalid/oversized requests, Host/Origin checks, and MCP initialization and tool invocation.
- Live-discovery adapter behavior was tested against an injected mock response, including per-user credential routing and host allowlisting.

## Test coverage

Personal Jira defaults; explicit team/company intent; private data exclusion for managers; personal guidance constrained by a mandate; unresolved mandate conflicts; broader focus without broader access; consent and one-level promotion; no self-approval; exact-scope review authority; three-level promotion; source and target version gates; repeated review rejection; cascading recertification; expiry/retirement; changes-requested resubmission; two-party topic tethers; tether revocation; tethered standards treated as guidance; delegate expiry/revocation; mandatory token-budget overflow; app dependency availability; idempotent private imports; import atomicity; MCP identity spoof rejection; bounded connector routing; persistence; restricted review audit details; app dependency invalidation; UI escaping and rendering; HTTP authorization and request validation.

## Not completed in this environment

The browser-control runtime failed to initialize with a missing Windows platform directory. The app's panel-opening tool also failed, and loopback HTTP requests from the command sandbox were blocked by socket permissions. Therefore **visual browser QA, real browser interactions, and a successful browser preview were not verified**. Template/HTTP-handler tests are not a substitute for those checks.

No enterprise Confluence, Jira, GitLab, Manufacturo, NX, BigQuery, SSO, or Bifrost instance was connected. There were no credentials or confirmed tenant endpoints. Adapter and protocol tests do not constitute live enterprise integration certification.

## Browser acceptance on the work computer

1. Start with `npm start` and open http://127.0.0.1:8788.
2. Test desktop and narrow mobile widths; ensure navigation, tables, dialogs, and review diff are readable.
3. Run the README walkthrough, including a manager identity switch and approval.
4. Reload and confirm the decision persists. Revise a source and confirm recertification.
5. Configure one real authorized source and a per-user Bifrost connection in the approved environment, then test two users with disjoint private knowledge.
