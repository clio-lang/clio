# Tested Tiramisu language guide

The public guide starts at /docs/guide and covers first programs, functions and closures, pipes, array mapping and indexed writes, type annotations and records, local modules, and typed parallel execution. A separate limits page distinguishes implemented behavior from the remaining port and language-design work.

## One example catalog

Canonical programs, expected results, browser eligibility and stable IDs live in `apps/website/src/lib/guide/examples.ts`. The prose templates in `apps/website/guide/*.tiramisu` use explicit example placeholders. `scripts/build-guide.ts` expands those into Tiramisu code blocks and playground links before site checking, development or production builds.

The generated `apps/website/src/docs/guide` directory is ignored by Git. Edit the templates or catalog, not generated pages. Generated code blocks are part of the Tiramisu document itself, so static rendering, search and Markdown/LLM exports receive the examples too.

Browser-compatible catalog entries also populate the playground selector. A link such as `/docs/playground?example=guide-functions` selects the example by ID; it never evaluates source from the URL or automatically runs the program. Missing or unknown IDs fall back to the default parallel example. Query navigation resets the editor only when the requested ID changes. The multi-file modules lesson provides local CLI instructions instead of a misleading playground link.

## Verification

`tests/guide-examples.test.ts` compiles all six catalog programs with strict names, emits each graph into a temporary directory and executes its generated runner under Bun. It checks the actual return values, including the worker-backed parallel result. It also checks template coverage, canonical snippet inclusion, unique IDs, link/source agreement and the documented type/strict-boundary failures.

The real-browser playground harness additionally executes every browser-compatible guide program against its expected result. Run `bun run test:playground` and open the printed loopback URL. Website production builds verify Tiramisu generation and prerendering; the guide-to-playground navigation is also checked through the browser UI.

These tests cover the included lessons, not every possible language feature. The existing compiler conformance and compatibility suites remain the source of broader port coverage.
