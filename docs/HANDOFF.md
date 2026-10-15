# Work-computer handoff prompt

You are taking over Dreamcatcher Context for Relativity Space. Read README.md, ARCHITECTURE.md, INTEGRATION.md, VERIFICATION.md and REVIEW.md before changing code. REVIEW.md lists the business-policy decisions that are still open; do not treat the implementation defaults it labels **[POLICY]** as approved company rules. Run npm test and npm run check. Start locally with Node 24+ and exercise the synthetic review workflow.

Preserve the user's decisions:

- Each person has one home team in a defined org hierarchy.
- An unqualified “latest Jira tickets” means that person's own assigned issues.
- Explicit team, department, or organization requests can change focus; no error may silently widen the query.
- Promotion broadens applicability and may create enforceable scoped standards. It is not merely a popularity score or arbitrary folder move.
- The individual must explicitly submit before personal knowledge goes to reviewers. A manager or delegate approves publication to the broader audience.
- Managers review a diff and evidence. No self-approval or automatic organization-wide certification.
- Cross-team tethers share specified meaning and knowledge with consent, without multiple team memberships or implicit authority transfer.
- Apps have personal or broader audiences and endorsements. Endorsement is separate from software release certification and underlying data permissions.
- Deliver context into the person's AI tool through Bifrost, preserving real identity.
- Existing systems: Confluence (QMS and general knowledge), Jira, GitLab, Manufacturo, NX; existing data platform includes BigQuery and OpenMetadata.

First inspect the actual approved Dreamcatcher, Bifrost, identity, and source environment. Record what is observed, configured, inferred, and missing. Do not invent endpoints, a Teamcenter deployment, current QMS status fields, org policy, or source access grants.

Implement company integration in this order:

1. Map actual employee identity, the defined hierarchy, managers and delegates. Replace sample identities. Use the approved SSO identity and revocation mechanism.
2. Confirm which Bifrost product/version is deployed, how it forwards per-user identity, and which client hooks can require context retrieval before responses. With Bifrost v2.3.0 the verified pattern is: a lowercase `authorization` per-user header key, admin verification, one Bifrost identity per person, and each person submitting their own context token. Never share a virtual key. Test with two users that cannot see each other's private knowledge (`docs/review/scripts/mcp-harness.sh` is the direct-MCP version).
3. Map Confluence page restrictions and QMS approval, current/effective/superseded revisions, and approved deviations. Decide how those become explicit authority and applicability fields. General Confluence pages must not inherit QMS authority automatically.
4. Connect bounded Jira/GitLab/Confluence discovery under the caller's identity. Define team-to-Jira mappings. Add full ingestion only after ACL propagation, deletion handling, freshness, and source ownership are explicit.
5. Inspect the approved Manufacturo and NX/PLM access routes, then add concrete adapters with lineage and part/work-order/revision keys. Keep export imports clearly labeled snapshots.
6. Move transactional state to the selected approved shared database for multi-instance deployment. Keep BigQuery as the appropriate analytical/metadata projection, not an ephemeral SQLite substitute.
7. Add semantic retrieval only after the scope invariants are locked. Embeddings/rerankers may order authorized candidates; they may not grant access, promote knowledge, suppress mandatory constraints, or approve proposals.
8. Integrate the existing Dreamcatcher gallery/SDK with the app registration and dependency contract. Reuse the constellation aesthetic already present.

Acceptance must cover the shipped cases plus real SSO/source ACL revocation, a changed QMS revision, overlapping source statements, a user transfer, delegate expiry, mandatory standards beyond the token budget, and an AI client attempting to skip retrieval. Report actual test evidence and any remaining boundaries candidly.

Do not publish sensitive company content to an unapproved environment. Do not silently turn source documentation into executable agent instructions. Keep human review, version provenance, and the access/authority/relevance separation intact.
