# Integration guide

## Authenticated mode

The shipped default is a loopback-only synthetic demo. For a controlled shared environment, replace sample identities in `config/identity.example.json`. Give each person one unit, specify each unit's parent and manager, and ensure the graph is acyclic.

Generate a strong per-user token using `node scripts/make-token.js USER_ID`. Give the token to that user through the company's approved secret-distribution channel. Store only the generated SHA-256 mapping in `CONTEXT_TOKEN_HASHES`. Restart to rotate or revoke tokens. The token generator is an administrative utility; it is not exposed to browsers or MCP.

Configure these environment variables through your deployment's secret/configuration system:

| Variable | Meaning |
|---|---|
| `CONTEXT_MODE` | `authenticated`. Unset means the loopback demo; any other value refuses to start. |
| `HOST` | Private bind address, or `0.0.0.0` behind an approved TLS reverse proxy |
| `PORT` | Default `8788` |
| `CONTEXT_PUBLIC_ORIGIN` | Exact external HTTPS origin, e.g. `https://context.internal.example` |
| `CONTEXT_IDENTITY_FILE` | Absolute path to the identity JSON. Applied on **every** start: units and people are upserted, people missing from the file are deactivated (their tokens stop working), and changes are audited. User IDs and unit IDs must be distinct. |
| `CONTEXT_DB` | Absolute SQLite path on persistent storage for a single-instance pilot. A database remembers the mode it was created in and refuses to open in the other mode. |
| `CONTEXT_TOKEN_HASHES` | JSON object mapping SHA-256 token hashes to existing user IDs |

The proxy must preserve the configured Host and serve TLS. Do not expose the demo to a shared network. Do not deploy SQLite on ephemeral instance storage or run multiple independent replicas. An enterprise rollout should replace static tokens with company SSO/JWT verification and replace the Store with the selected shared transactional database.

This release does not manage hires, departures or organizational changes through the UI. Edit the identity file and restart: transfers move access, removed people are deactivated, and a delegation lapses when its holder leaves the scope or its granting manager is replaced. This is a pilot mechanism. Implement SSO and directory synchronization at the identity boundary before broad rollout.

## Bifrost

Verified locally against Bifrost transport **v2.3.0** (launcher `@maximhq/bifrost` 1.6.3) with two synthetic users. Confirm the deployed version; the configuration surface changes between releases.

**How identity flows.** The AI client authenticates to **Bifrost** with a Bifrost identity (SSO, or a personal virtual key sent as `x-bf-vk`). Bifrost reads `Authorization: Bearer …` from the client as *its own* virtual key, so a caller must **not** send their context token that way. With `auth_type: per_user_headers`, Bifrost stores one context credential per Bifrost identity. It asks for that credential on first tool use and forwards it upstream as the `authorization` header.

1. Register `https://YOUR_CONTEXT_HOST/mcp` using `config/bifrost.example.json`. Keep `per_user_header_keys` **lowercase** (`["authorization"]`): Bifrost v2.3.0 lowercases submitted keys, so a config-file key written as `"Authorization"` can never be satisfied.
2. The client starts `pending_verification`. An admin verifies it once with `POST /api/mcp/client/{id}/verify-headers` and `{"user_headers":{"authorization":"Bearer <verifier token>"}}`. Use a dedicated low-privilege verifier identity, not a person's token.
3. Give **each person their own Bifrost identity** and grant it the `dreamcatcher_context` client. **Never share a virtual key for this client.** In testing, a second person on a shared key received the first person's private context; Bifrost resolves identity as user > virtual key > session, and the context service cannot detect the substitution.
4. On first tool use, Bifrost returns "Authentication required … submit the required headers" with a link. The person submits `Bearer <their own context token>`. Bifrost checks it against the context service before saving it. End users need Bifrost dashboard authentication (for example SSO) to reach that page. In local testing the value was submitted with the admin setup token instead.
5. Tools appear as `dreamcatcher_context-resolve_context`, `-search_knowledge`, `-get_knowledge` and `-list_apps`. The service's MCP `instructions` are passed through.

The endpoint exposes:

- `resolve_context({prompt, scope?, appId?, budget?})`
- `search_knowledge({query})`, `get_knowledge({id})`, `list_apps({})`. Every item carries `governance {usable, binding, audience, note}` for the caller, so an expired item or a tethered mandate is never presented as a binding requirement.

No promotion or approval tools are exposed to models. The HTTP service supports initialize, ping, tools/list and tools/call with JSON-RPC, and stateless JSON responses over Streamable HTTP. It was exercised with the official MCP Python SDK, which negotiated `2025-11-25`. GET /mcp returns 405 because no SSE stream is offered. A 401 has no `WWW-Authenticate` header and there is no OAuth metadata, so connect through a gateway that supplies per-user credentials.

### Guaranteed injection boundary

MCP tool availability does not guarantee a client calls the tool, reads the result, or stops on `needs_clarification`. To make context resolution mandatory, call the REST endpoint from a trusted pre-answer hook in Bifrost or in the AI client, and add the returned packet as delimited evidence. `scripts/context-client.js` implements this call and rejects non-ready packets. The hook must forward a validated per-user credential; never let the model choose a user ID. No hook has been installed in any external AI tool by this package.

Example client contract:

```js
import { prepareContext } from './scripts/context-client.js';
const packet = await prepareContext({
  origin: process.env.CONTEXT_ORIGIN,
  token: userContextToken,
  prompt: userMessage,
  appId: selectedDreamcatcherAppId,
});
// Send packet.instructions as trusted integration rules.
// Supply packet.mandatory and packet.context as quoted, cited evidence.
// packet.clarifications explains any needs_clarification status; ask the user instead of guessing.
// Keep all actual tool execution authorized independently.
```

## Source discovery

As the organization standards owner, save the instance host in Source connections. On the server, add allowed hosts (including an explicit port if used) to `DC_CONNECTOR_HOSTS`, comma separated. The allowlist is deployment controlled. Supply credentials per source and user; a user ID is uppercased with nonalphanumeric characters replaced by `_`. If two people map to the same name (for example `pat-lee` and `pat_lee`), discovery is refused for both until their IDs are made distinct.

| Source | Credential environment variables for user `paul` | Behavior |
|---|---|---|
| Jira Cloud | `DC_JIRA_PAUL_EMAIL`, `DC_JIRA_PAUL_TOKEN` | GET `/rest/api/3/search/jql`, current user's assigned issues, updated descending, max 25 |
| Confluence Cloud | `DC_CONFLUENCE_PAUL_EMAIL`, `DC_CONFLUENCE_PAUL_TOKEN` | GET `/wiki/api/v2/pages`, up to 25 accessible page metadata records |
| GitLab | `DC_GITLAB_PAUL_TOKEN` | GET `/api/v4/projects`, membership only, up to 25 accessible project metadata records |

For Atlassian, configure a host URL such as `https://company.atlassian.net` without adding `/wiki`; the adapter adds that path. These are Cloud adapters, not Data Center implementations. OAuth/scoped API tokens with different API base URLs need a corresponding adapter configuration change. Discovery does not read full page/repository contents, certify QMS status, or populate a live search index. The status “URL configured” is deliberately distinct from verified connectivity.

Manufacturo, NX/PLM, and BigQuery use normalized metadata export imports now. Determine actual API contracts, design revision/effectivity fields, and permissions before implementing their direct adapters. No assumed Teamcenter deployment is required.

## Normalized imports

```json
{
  "records": [{
    "externalId": "REFERENCE-001",
    "revision": "3",
    "title": "An authorized excerpt",
    "content": "The actual knowledge text.",
    "tags": ["quality", "manufacturing"],
    "kind": "knowledge",
    "uri": "https://approved-source.example/reference/001"
  }]
}
```

Imports require 1–100 records and a body below 1 MB. UI file uploads are capped at 900 KB. Imports always become private reference material owned by the caller. The key is `(owner, source, externalId)`. The same revision with the same content is idempotent. A new revision, or the same revision label with different content (flagged `revisionReused`), replaces the snapshot and invalidates certified descendants. The review screen shows import provenance and warns that upstream access restrictions are unknown. A failed record validates before any writes. Publishing still requires separate review and explicit consent.

## API routes

All routes except `/health`, `/api/mode`, and static UI assets require an authenticated identity in authenticated mode. Knowledge is always filtered before return.

| Method | Route | Operation |
|---|---|---|
| GET | `/api/bootstrap` | Authorized workspace |
| POST | `/api/knowledge` | Create private knowledge |
| GET / PUT | `/api/knowledge/:id` | Read (with `effectiveStatus` and caller `governance`) / revise, with version on PUT |
| POST | `/api/knowledge/:id/retire` | Retire and invalidate descendants |
| POST | `/api/promotions` | Submit snapshot and evidence with consent |
| POST | `/api/promotions/:id/review` | Approve, reject, request changes; revision required |
| POST | `/api/promotions/:id/withdraw` | Submitter withdraws pending proposal |
| POST | `/api/context/resolve` | Context packet; identity is server-derived |
| POST | `/api/delegations` | Manager appoints scoped delegate |
| POST | `/api/delegations/:id/revoke` | Manager revokes delegate |
| POST | `/api/tethers` | Source manager proposes topic agreement |
| POST | `/api/tethers/:id` | Destination acceptance / either side revocation |
| PUT | `/api/connectors/:id` | Organization owner configures host |
| POST | `/api/connectors/:id/discover` | Per-user live metadata discovery |
| POST | `/api/connectors/:id/import` | Private normalized import |
| GET | `/api/events` | Authorized audit history |
| GET | `/api/bifrost-config` | Environment-specific gateway configuration |
| POST | `/mcp` | Stateless MCP tools |

## Primary references checked during implementation

- [Bifrost per-user headers](https://docs.getbifrost.ai/mcp/auth/per-user-headers)
- [Bifrost connecting MCP servers](https://docs.getbifrost.ai/mcp/connecting-to-servers)
- [MCP Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [Jira Cloud issue search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/)
- [Confluence Cloud pages](https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/)
- [GitLab project discovery](https://docs.gitlab.com/api/projects/)

Bifrost was exercised locally (transport v2.3.0) as described above. No company Bifrost deployment or enterprise source was available.
