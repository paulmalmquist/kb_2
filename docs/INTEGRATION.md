# Integration guide

## Authenticated mode

The shipped default is a loopback-only synthetic demo. For a controlled shared environment, replace sample identities in `config/identity.example.json`. Give each person one unit, specify each unit's parent and manager, and ensure the graph is acyclic.

Generate a strong per-user token using `node scripts/make-token.js USER_ID`. Give the token to that user through the company's approved secret-distribution channel. Store only the generated SHA-256 mapping in `CONTEXT_TOKEN_HASHES`. Restart to rotate or revoke tokens. The token generator is an administrative utility; it is not exposed to browsers or MCP.

Configure these environment variables through your deployment's secret/configuration system:

| Variable | Meaning |
|---|---|
| `CONTEXT_MODE` | `authenticated` |
| `HOST` | Private bind address, or `0.0.0.0` behind an approved TLS reverse proxy |
| `PORT` | Default `8788` |
| `CONTEXT_PUBLIC_ORIGIN` | Exact external HTTPS origin, e.g. `https://context.internal.example` |
| `CONTEXT_IDENTITY_FILE` | Absolute path to the configured identity JSON, used for first database initialization |
| `CONTEXT_DB` | Absolute SQLite path on persistent storage for a single-instance pilot |
| `CONTEXT_TOKEN_HASHES` | JSON object mapping SHA-256 token hashes to existing user IDs |

The proxy must preserve the configured Host and serve TLS. Do not expose the demo to a shared network. Do not deploy SQLite on ephemeral instance storage or run multiple independent replicas. An enterprise rollout should replace static tokens with company SSO/JWT verification and replace the Store with the selected shared transactional database.

This release does not manage hires, departures, or organizational changes through the UI. Identity bootstrap is explicit. Implement directory synchronization and revocation at the authentication/identity boundary before broad rollout.

## Bifrost

Assumption: “Bifrost” refers to Maxim's LLM/MCP gateway. The application also speaks standard MCP independently of that product.

Register `https://YOUR_CONTEXT_HOST/mcp` as an HTTP MCP server. `config/bifrost.example.json` uses `auth_type: per_user_headers` and requires `Authorization`. Each caller provides `Bearer THEIR_CONTEXT_TOKEN`; the context service derives their identity from it. Do not configure one shared privileged user token for everyone. The per-user headers flow is documented as available in Bifrost 1.5.4 and later; confirm your deployed gateway's configuration schema.

Configure your AI client to use Bifrost's MCP gateway and call `resolve_context` before work questions. The endpoint exposes:

- `resolve_context({prompt, scope?, appId?, budget?})`
- `search_knowledge({query})`
- `get_knowledge({id})`
- `list_apps({})`

No promotion/approval tools are exposed to models. The HTTP service supports initialize, ping, tools/list and tools/call with JSON-RPC, and stateless JSON responses over Streamable HTTP. GET /mcp returns 405 because this server does not offer an SSE stream. Initialization notifications return 202. Protocol negotiation supports the published version identifiers listed in `src/mcp.js`.

### Guaranteed injection boundary

MCP tool availability does not guarantee a client calls the tool. To make context resolution mandatory, invoke the REST endpoint in a trusted pre-answer hook and add the returned packet as delimited evidence. `scripts/context-client.js` implements this call and rejects non-ready packets. The hook must forward a validated per-user credential; never let the model choose a user ID. No hook has been installed in your external AI tools by this package.

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
// Keep all actual tool execution authorized independently.
```

## Source discovery

As the organization standards owner, save the instance host in Source connections. On the server, add allowed hosts (including an explicit port if used) to `DC_CONNECTOR_HOSTS`, comma separated. The allowlist is deployment controlled. Supply credentials per source and user; a user ID is uppercased with nonalphanumeric characters replaced by `_`.

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

Imports require 1–100 records and a body below 1 MB. UI file uploads are capped at 900 KB. Imports always become private reference material owned by the caller. The key is `(owner, source, externalId)`. Same revision is idempotent; a new revision changes the snapshot and invalidates certified descendants. A failed record validates before any writes. Publishing still requires separate review and explicit consent.

## API routes

All routes except `/health`, `/api/mode`, and static UI assets require an authenticated identity in authenticated mode. Knowledge is always filtered before return.

| Method | Route | Operation |
|---|---|---|
| GET | `/api/bootstrap` | Authorized workspace |
| POST | `/api/knowledge` | Create private knowledge |
| GET / PUT | `/api/knowledge/:id` | Read / revise, with version on PUT |
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

Documentation compatibility was checked; a real Bifrost or enterprise source was not available for integration testing.
