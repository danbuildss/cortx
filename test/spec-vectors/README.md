# x402 Reliability Spec test vectors (vendored)

Copied from [danbuildss/x402-reliability-spec](https://github.com/danbuildss/x402-reliability-spec) **v0.3** (`test-vectors/` and `schema/`). Format and comparison rules: `test-vectors/README.md` in that repo.

`lib/check-runner/spec-conformance.test.ts` runs every vector through CORTX's real check runner and compares the spec record it produces (`lib/check-runner/spec-record.ts`) with `expected.json`. When the spec publishes new vectors, copy them here.
