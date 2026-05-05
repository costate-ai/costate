# @costate-ai/conformance

Conformance test suite for the [Costate](../../docs/Costate-RFC-v0.1.md).

Run this against any Costate-compliant host to verify it implements the spec. The
output is a structured report indicating which sections of the RFC the host
satisfies. A host that passes the **base profile** (sections marked REQUIRED
in §1.9 of the RFC) is conformant with Costate v0.1.0-draft.

## Quick start

```bash
npx @costate-ai/conformance \
  --host https://api.example.com \
  --aat cst_aat_YourTokenHere \
  --workspace ws_test_conformance
```

The suite needs:

- A reachable HTTPS endpoint serving Costate at `/v1/...`
- A valid AAT (§1.8) with `files:write tasks:write activity:read grants:admin` scopes
- An empty workspace dedicated to conformance testing (the suite mutates it)

## Output

```
Costate Conformance Test Suite (v0.1.0-draft)
Target:    https://api.example.com
Workspace: ws_test_conformance

§3.2 File Operations          ........... 8/8 passed
§3.3 Task Operations          ........... 12/12 passed
§3.4 Activity Operations      ........... 4/4 passed
§3.5 Scope Model              ........... 6/6 passed
§3.6 Error Model              ........... 5/5 passed
§4   Authentication           ........... 9/9 passed (1 skipped: cross-host)
§5   Compliance               ........... advisory only (host: "basic")
§6   Subscription             ........... 7/8 passed (1 failure: §6.6 retry timing)
§7.1 Capability Discovery     ........... 2/2 passed

OVERALL: CONFORMANT (base profile)
        — 53/55 required tests passed, 2 skipped, 0 base-profile failures.
        — Advisory failures (§6.6) do not affect conformance status.
```

Exit code: `0` if conformant with the base profile, `1` otherwise.

## What the suite tests

| RFC Section | Coverage |
|---|---|
| §3.2 File Operations | CRUD, `If-Match` versioning, `409 VERSION_MISMATCH` on stale write, list pagination |
| §3.3 Task Operations | Full state machine, atomic claim race, routing semantics (specific / `*` / `null` / assign) |
| §3.4 Activity Operations | Event emission for all event types in §3.4.1, ordering, filtering |
| §3.5 Scope Model | Insufficient scope returns `403 SCOPE_DENIED`; admin scopes gate approve/reject |
| §3.6 Error Model | All required error codes returned with correct HTTP statuses |
| §4 Authentication | AAT issue/revoke/rotate, workspace scope enforcement, grant create/fulfill/revoke |
| §5 Compliance | If host advertises a profile, suite verifies the implementation matches §5 requirements |
| §6 Subscription | Event emission, A2A push delivery, retry behavior, subscription management |
| §7.1 Capability Discovery | `/v1/capabilities` endpoint shape and contents |
| §8 Security | Where automatable: rate limit detection, cross-tenant scope filtering, payload size limits |

## Running individual sections

```bash
costate-conformance --host https://... --aat ... --section 3.2
costate-conformance --host https://... --aat ... --section 4,6
```

## Cross-host tests

Some §4 tests require two hosts to verify cross-host grant flows:

```bash
costate-conformance \
  --host https://hostA.example.com \
  --aat cst_aat_A_xxx \
  --grantor-host https://hostB.example.com \
  --grantor-aat cst_aat_B_xxx
```

Without `--grantor-host`, cross-host tests are skipped (not failed).

## Status

This suite is **non-normative**. It is published alongside the Costate spec as a
practical verification tool. The RFC text is authoritative; if a test
disagrees with the RFC, file an issue and the test will be corrected.

Coverage is incomplete in v0.1.0-draft — see `src/tests/` for the current
test set. Contributions welcome.

## License

Apache-2.0.
