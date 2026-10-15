# Architecture and decisions

## Scope model

Each person has one home scope. The scope hierarchy is team → department → organization. Managers may have a department or organization as their home scope. Authority comes from the exact target scope's named manager or a delegated reviewer whose delegation is unexpired, still granted by the current manager, and held by an active member of that scope. Seniority does not implicitly confer approval permission for every child scope.

Four independent properties matter:

1. **Audience** — which people can read an item.
2. **Certification** — which exact version has been reviewed, by whom, and until when.
3. **Authority** — reference, guidance, or mandatory within an applicable certified scope/topic.
4. **Relevance** — how well it helps with the current request.

The hierarchy is not a fixed priority stack. A personal preference wins a suitable personal work request. Certified mandatory standards constrain relevant answers, including answers that begin with personal context. Tethered standards are informational guidance outside their governing scope.

## Promotion and revision

Personal knowledge stays private. Explicit submission grants target reviewers access to the submitted text, its provenance and the evidence. It does not grant access to the submitter's private original: for a private source the review's diff base is empty ("nothing published at this scope yet"). Approval creates a separate certified derivative for the target audience. The original is preserved. Promotion cannot skip levels. An already published derivative can be revised by proposing a new version against its baseline, and existing scope can be recertified. In both cases the reviewer's diff is against the **last certified revision** of the target, so edits made after certification are always visible.

Approval verifies the source version, target baseline version, that the target was not retired and that no version for the audience appeared after submission, current source certification, reviewer scope, separation of submitter and reviewer, dependency visibility, and certification duration. The same `proposalBlocker` check drives the review screen, so a reviewer sees why a proposal cannot be approved; reject and request-changes remain available. Validation, publication, review decision, immutable content revision and audit event run inside one `BEGIN IMMEDIATE` transaction, so a second process cannot act on a state that changed underneath it. A repeated decision returns a conflict. Changes requested/rejected proposals remain historical records; resubmission is a new proposal.

Changing or retiring an original suspends derived certifications recursively, and changing required knowledge suspends dependent certified apps. Each suspension is audited for the affected audience without naming a private source. **[POLICY]** This is a conservative default, not an approved rule: it lets an individual's private edit suspend an organization-wide standard. The alternative, keeping the reviewed derivative and flagging a newer source revision, needs a business owner's decision (see REVIEW.md). An expired, retired, stale, or unreviewed shared item is not retrieved as approved evidence. Existing source snapshots and review decisions remain available to authorized users.

## Tethers

A tether is directional: source scope → destination scope, for explicit topics. A source manager/delegate proposes it; a distinct destination manager/delegate accepts. Either scope may revoke. Only currently certified items with `tetherable=true` and a matching topic become readable through it. It does not expose private knowledge, implicitly recurse across other tethers, or create a second team membership.

## Request path

1. Authenticate the user from a validated bearer credential; ignore body-supplied identity.
2. Determine personal, team, department or organization focus from request wording or explicit focus selection. Source-query intent is deterministic. Another person, a relation ("my manager"), an unsupported negation or time window, an unmapped team or org scope, or a unit name that could be a topic produces a **blocked** plan and a clarification. It never produces a substituted `currentUser()` or widened query.
3. Filter knowledge by access, certification, retirement, and expiry before ranking or generating an exclusion trace.
4. Verify selected app dependencies are accessible and usable.
5. Score authorized candidates by lexical match (deterministic word forms; function words ignored), specific focus, certification, app dependency and personal applicability. A mandatory standard becomes a binding constraint only when the request matches its **declared** topics (tags) or an app requires it. Incidental title or body words, with at least two distinct terms required, surface evidence only.
6. Keep applicable mandatory standards. Identify explicit assertion conflicts. Do not truncate required standards silently to fit a context budget.
7. Return a structured packet with sources, revisions, reasons, conflicts, clarifications and a source query plan. The token estimate covers the **entire serialized packet**. Visible items with no topic match are counted, not listed, so unrelated titles never reach the model.
8. Record a metadata-only context audit event. Do not put request text or retrieved content in that event.

Token estimates are character-based approximations (4 characters per token) of the full packet, not model-tokenizer counts. Timings shown in the UI measure this local resolver only, not source ingestion, network calls, Bifrost, or model latency.

## Persistence

The Node 24 service uses built-in SQLite. Logical tables: units, users, assets, immutable content revisions, promotion proposals, tethers, delegations, connector settings, events. Tables store typed application records as JSON payloads; IDs are indexed and writes are parameterized. This keeps the zero-dependency v1 easy to run. It is not a warehouse schema or a horizontally scalable data service.

For production, replace the Store boundary with an approved transactional database such as the company's selected PostgreSQL/AlloyDB service. Preserve transactions and compare-and-swap version gates at the database layer. Put analytics and lineage projections in BigQuery according to the existing platform decision. No graph database product or vector platform selection is silently made by this application.

## Security and limits

Local demo binds only to loopback and uses synthetic identities. Shared deployments require authenticated mode. `CONTEXT_MODE` accepts only `demo` or `authenticated`, and a database is pinned to the mode it was created in, so demo header identities cannot be used against an authenticated database. Each bearer token maps to one person; Bifrost must forward distinct user credentials. An arbitrary user-ID header is not an authentication scheme in authenticated mode. Production identity bootstrap validates references and cycles; ongoing HR/SSO lifecycle management is a deployment integration.

No CORS is enabled. Origin/Host validation and a restrictive content security policy protect the local surface. Connector URLs require HTTPS and a deployment-controlled host allowlist; redirects are disabled and responses are bounded. Credentials are per-user environment references and never returned to the UI. Only known adapter routes can be requested.

Audit records are append-only through the API, but not a tamper-resistant external ledger. Local database administration can change them. Retrieved content is evidence, never executable agent instructions. Text escaping protects the UI; the consuming AI still needs its own tool authorization and injection handling.

Knowledge imported as an export is a user-controlled snapshot. Revocation/deletion reconciliation with source systems, source ACL mappings, QMS effective revisions, retention, and approved model boundaries must be implemented before connecting sensitive production content.
