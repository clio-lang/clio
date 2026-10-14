# Browser verification

Run `bun run test:browser`, then open the printed localhost URL in a browser. The command bundles the compiler and test harness, serves them from an ephemeral loopback port, and exits with status 0 only after a successful browser report. A failing report or no report within three minutes exits with status 1. The page lists each result; the terminal records the browser user agent and results as JSON. Run the command again for another browser.

This is separate from `bun run check`, because it requires a real browser to open the URL. The existing browser-target bundle test under Bun remains useful but cannot establish browser compatibility: Bun supplies globals that browsers lack.

## Verified baseline

On 2026-10-12, the initial nine compiler cases passed in the desktop app's Chromium browser, reporting Chrome 154 on macOS:

- Semantic errors prevent emission.
- Generated native ESM imports and lexical closures execute.
- A 100,000-step tail-recursive sum completes.
- Async call-target bindings preserve evaluation order.
- Range compatibility helpers execute.
- Indexed writes and method receivers work.
- Source maps retain Unicode source text.
- In-memory project compilation resolves local imports without a filesystem.
- The compiler and generated ESM execute inside a browser module worker.

The first run exposed Babel 7's `process.env.BABEL_TYPES_8_BREAKING` reference during bundle initialization. Shared build definitions now replace that optional flag with `false`, preserving Babel 7 behavior without adding a global `process` shim. The package build, Bun browser-bundle smoke test, and real-browser harness share this definition in `scripts/browser-build-options.ts`. Consumers bundling compiler source themselves need the same definition.

## Limits

The harness now also verifies the [browser parallel runtime](browser-runtime.md), including HTTP-loaded generated module graphs, typed records and captures, nested work, cancellation, failures, and cleanup. Use `bun run test:browser --built` after `bun run build:packages` to test the packaged browser adapter and worker.

This verifies one Chromium version, not a browser support matrix. Safari and Firefox remain unverified. The original compiler-only project probe checks graph compilation; the parallel runtime probes additionally execute generated multi-file graphs over HTTP. The original compiler-in-worker probe remains separate from managed parallel execution.

The harness executes fixed trusted test programs using Blob module URLs. It is not an isolated playground for untrusted source and does not establish compatibility with restrictive Content Security Policies. No external service receives the report. The server serves only the in-memory test assets and shuts down after the report or timeout.

## Final port sweep

On 2026-10-13, all 21 current checks passed with source and packaged browser adapters in the desktop app’s Chromium browser (Chrome 155). The same sweep passed all 16 playground checks. See [the acceptance record](port-acceptance.md) for reports, exact scope and environment limits. Safari and Firefox remain unverified.
