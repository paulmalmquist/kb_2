# Architecture and decisions

## Scope model

Each person has one home scope. The scope hierarchy is team → department → organization. Managers may have a department or organization as their home scope. Authority comes from the exact target scope's named manager or an unexpired delegated reviewer; seniority does not implicitly confer approval permission for every child scope.

Four independent properties matter:

1. **Audience** — which people can read an item.
2. **Certification** — which exact version has been reviewed, by whom, and until when.
3. **Authority** — reference, guidance, or mandatory within an applicable certified scope/topic.
4. **Relevance** — how well it helps with the current request.

The hierarchy is not a fixed priority stack. A personal preference wins a suitable personal work request. Certified mandatory standards constrain relevant answers, including answers that begin with personal context. Tethered standards are informational guidance outside their governing scope.

## Promotion and revision

Personal knowledge stays private. Explicit submission grants target reviewers access to the submitted snapshot and evidence. Approval creates a separate certified derivative for the target audience. The original is preserved. Promotion cannot skip levels. An already published derivative can be revised by proposing a new version against its current baseline. Existing scope can also be recertified.

Approval verifies the source version, target baseline version, current source certification, reviewer scope, separation of submitter/reviewer, dependency visibility, and certification duration. Publication, review decision, immutable content revision, and audit event commit in one database transaction. A repeated decision returns a conflict. Changes requested/rejected proposals remain historical records; resubmission is a new proposal.

Changing an original invalidates derived certifications recursively. Changing required knowledge invalidates dependent certified apps. An expired, retired, stale, or unreviewed shared item is not retrieved as approved evidence. Existing source snapshots and review decisions remain available to authorized users.

## Tethers

A tether is directional: source scope → destination scope, for explicit topics. A source manager/delegate proposes it; a distinct destination manager/delegate accepts. Either scope may revoke. Only currently certified items with `tetherable=true` and a matching topic become readable through it. It does not expose private knowledge, implicitly recurse across other tethers, or create a second team membership.

## Request path

1. Authenticate the user from a validated bearer credential; ignore body-supplied identity.
2. Determine personal, team, department, or organization focus from request wording or explicit focus selection.
3. Filter knowledge by access, certification, retirement, and expiry before ranking or generating an exclusion trace.
4. Verify selected app dependencies are accessible and usable.
5. Score authorized candidates by lexical topic match, specific focus, certification, app dependency and personal applicability.
6. Keep applicable mandatory standards. Identify explicit assertion conflicts. Do not truncate required standards silently to fit a context budget.
7. Return a structured packet with sources, revisions, reasons, conflicts, estimated token budget, and a source query plan.
8. Record a metadata-only context audit event. Do not put request text or retrieved content in that event.

Token estimates are character-based approximations, not model-tokenizer counts. Timings shown in the UI measure this local resolver only, not source ingestion, network calls, Bifrost, or model latency.

## Persistence

The Node 24 service uses built-in SQLite. Logical tables: units, users, assets, immutable content revisions, promotion proposals, tethers, delegations, connector settings, events. Tables store typed application records as JSON payloads; IDs are indexed and writes are parameterized. This keeps the zero-dependency v1 easy to run. It is not a warehouse schema or a horizontally scalable data service.

For production, replace the Store boundary with an approved transactional database such as the company's selected PostgreSQL/AlloyDB service. Preserve transactions and compare-and-swap version gates at the database layer. Put analytics and lineage projections in BigQuery according to the existing platform decision. No graph database product or vector platform selection is silently made by this application.

## Security and limits

Local demo binds only to loopback and uses synthetic identities. Shared deployments require authenticated mode. Each bearer token maps to one person; Bifrost must forward distinct user credentials. An arbitrary user-ID header is not an authentication scheme in authenticated mode. Production identity bootstrap validates references and cycles; ongoing HR/SSO lifecycle management is a deployment integration.

No CORS is enabled. Origin/Host validation and a restrictive content security policy protect the local surface. Connector URLs require HTTPS and a deployment-controlled host allowlist; redirects are disabled and responses are bounded. Credentials are per-user environment references and never returned to the UI. Only known adapter routes can be requested.

Audit records are append-only through the API, but not a tamper-resistant external ledger. Local database administration can change them. Retrieved content is evidence, never executable agent instructions. Text escaping protects the UI; the consuming AI still needs its own tool authorization and injection handling.

Knowledge imported as an export is a user-controlled snapshot. Revocation/deletion reconciliation with source systems, source ACL mappings, QMS effective revisions, retention, and approved model boundaries must be implemented before connecting sensitive production content.
