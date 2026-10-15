# Dreamcatcher Context

A working local application for private knowledge, scoped standards, manager review, topic tethers, and context delivery to AI clients through Bifrost/MCP.

## Run

Requires **Node.js 24 or later**. No package installation, model key, or external service is needed for the synthetic workspace.

```sh
npm start
```

Open **http://127.0.0.1:8788**. On Windows, you can also double-click `start-local.cmd`.

```sh
npm test
npm run check
```

The app stores changes in `data/demo.sqlite`. Stop the server before resetting. `npm run demo:reset -- --confirm` moves the existing demo database to a dated backup and restores the samples on next start.

## Try the complete workflow

1. Start as **Paul Malmquist**. In **Context playground**, ask `Latest Jira tickets`. Inspect the per-user query plan: `assignee = currentUser() ORDER BY updated DESC`.
2. Ask `Latest Jira tickets for my team`, or `Tickets assigned to Sam`. Focus changes, but no team or person-to-Jira mapping is configured, so the plan is **blocked** and the packet asks for clarification. It never substitutes your own tickets or a company-wide query.
3. Ask `How should I prepare reconciliation evidence?`. The sample personal 30-day note appears alongside a certified team 90-day standard. The latter constrains the answer. These retention values are illustrative, not company policy.
4. Open **Promotion reviews**. The pending checklist shows the submitted text as new to #DATA (the submitter's private original is not shown), its metadata, rationale and review evidence. Revisions and recertifications are diffed against the last certified version.
5. Switch to **Sam Chen**, the sample team manager, or **Avery Reed**, the sample delegate. Add a decision rationale and approve, request changes, or reject.
6. Switch back to Paul. The approved derivative is available to the team; the private original remains private. Edit the source to see derived certifications require review again.
7. Explore **Organization & tethers**. The Finance → #DATA agreement shares only approved, tether-enabled knowledge tagged `audit` or `reconciliation`. It shares guidance, not Finance's authority over #DATA.
8. Inspect **App gallery**. App audience, endorsement, and knowledge dependencies are explicit. Endorsement is not a code-release certification.
9. Open **Source connections** for live metadata adapters and normalized export import. Open **Bifrost delivery** to export the MCP client configuration, then follow `docs/INTEGRATION.md`: each person needs their own Bifrost identity.

All seeded names except Paul's display identity, hierarchy, standards, records, and approvals are synthetic examples. No company systems were connected during development.

## Implemented

| Area | Behavior |
|---|---|
| Knowledge registry | Create, edit, tag, import, retire, and inspect source provenance and versions |
| Promotion | Individual → team → department → organization; one level at a time; explicit publication consent |
| Certification | Manager/delegate review; no self-approval; source, target, retirement and newer-version gates checked inside the write transaction; expiry; immutable content snapshots; decision history |
| Review UI | Line diff against the last certified version, metadata changes, source provenance, evidence, rationale, stale-proposal blocking, approve/request changes/reject/withdraw |
| Retrieval | Authorization before ranking; lexical scoring with declared-topic applicability for mandatory standards; personal Jira default; clarification instead of guessing for other people, negations, unmapped scopes; explanation trace; budget measured on the full packet |
| Conflicts | Typed `ruleKey` / `ruleValue` assertions; mandated standard vs personal guidance; conflicting mandates require clarification |
| Tethers | Directed, topic-limited agreement; source proposal + destination acceptance; item-level sharing consent; immediate revocation |
| Apps | Private and scoped app registrations, endorsement workflow, knowledge dependencies, optional launch link |
| Source adapters | Bounded Jira Cloud, Confluence Cloud and GitLab live metadata discovery using per-user credentials; normalized export import for all six source types |
| Bifrost | Stateless Streamable HTTP MCP endpoint; four read-only tools with per-caller governance labels; REST API; per-user credential config verified locally against Bifrost v2.3.0 |
| Persistence | SQLite WAL; transactions; durable content/review/audit records |
| Authentication | Local demo identities, or distinct per-user bearer credentials with server-side hash lookup; identity file applied on every start; database pinned to its mode; browser token kept in page memory |

## Deliberate limits

- This is a complete **local v1 application**, with production connection boundaries, not an already integrated company deployment. SSO, HR directory synchronization, live Bifrost, and company source credentials have not been configured.
- Retrieval is explainable, task-sensitive lexical ranking. It is not an embedding search engine or an LLM semantic judge. `resolve()` is the replacement seam for a future approved semantic reranker; authorization and mandatory-standard selection must remain server-owned.
- Conflict detection uses explicit assertion keys. It does not claim to understand every contradiction in arbitrary prose. Natural-language conflicts can still require human judgment.
- This service prepares context and tool plans. It does not generate final AI answers, execute Jira plans, execute skills, or enforce tool execution permissions in another system.
- MCP makes tools available. Guaranteed context use before every answer requires an integration hook in the AI client or Bifrost middleware. The code includes an integration helper with a fail-closed context contract; it does not claim to install that hook in external clients.
- Through Bifrost, identity is the Bifrost identity that stored the person's context token. A shared virtual key would deliver one person's private context to everyone using it. One Bifrost identity per person is a deployment requirement.
- Team, person and organization ticket scopes need approved Jira mappings, which do not exist yet. Those requests are blocked with a clarification.
- Live source discovery is an on-demand, bounded metadata sample. Export snapshots do not inherit continuous upstream ACL or deletion synchronization. Do not use exports as a production substitute for live source authorization without implementing those controls.
- Manufacturo, NX/PLM, and BigQuery have explicit export adapters. No tenant-specific proprietary API or native CAD parser is invented.
- The local store and static-token identity mode suit evaluation and a controlled pilot. A multi-instance deployment needs a shared transactional database, company SSO, external audit retention, and production operational ownership. SQLite on ephemeral Cloud Run storage is not durable.

## Files

- `src/engine.js` — scoped authorization, promotion state machine, retrieval, certification and tethers.
- `src/server.js` — HTTP API, identity validation, local UI server.
- `src/mcp.js` — MCP discovery and context tools.
- `src/connectors.js` — bounded, read-only source discovery.
- `public/` — responsive interface, all nine screens, no external assets or dependencies.
- `config/` — identity and Bifrost examples.
- `docs/ARCHITECTURE.md` — invariants, scope model, data flow and deployment boundary.
- `docs/INTEGRATION.md` — company source, authenticated mode, and Bifrost setup.
- `docs/HANDOFF.md` — work-computer implementation prompt and acceptance criteria.
- `docs/VERIFICATION.md` — before/after verification record, including real browser, MCP SDK and Bifrost results.
- `docs/REVIEW.md` — adversarial review: findings, fixes, open policy decisions and readiness.
- `docs/review/` — reproducible probe, browser, MCP and scale scripts, raw results and screenshots.
- `test/` — runnable authorization, workflow, adapter, persistence and HTTP contract tests.

Source files are portable and can be mirrored into the approved work GitLab repository.
