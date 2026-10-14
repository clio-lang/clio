# Tiramisu docs playground

The playground lives at `/docs/playground` in the existing Tiramisu Docs site. Its page metadata and introduction are authored in `apps/website/src/docs/playground.tiramisu`. The editor is a Svelte component inside Tiramisu's DocPage and DocsLayout, with the same sidebar, search, theme, footer and static-site build.

Run `bun run dev` from the repository root, then open the playground. No source is executed automatically. Choose an example, edit it, and press Run or Ctrl/⌘ Enter. Programs export a `main` function; its result and main-program console output appear below the editor. Diagnostics retain compiler codes and source positions. Stop interrupts the active run. Navigating away also stops it.

The initial examples cover float64 parallel numbers, console output, nested parallel batches, typed captures, and a deliberately looping main program to try Stop. This version edits one file, `main.kalandra`; package and other-file imports are unavailable. The [language guide](language-guide.md) adds tested examples selected through stable example-ID links. There is no source persistence, arbitrary-source sharing, language-server connection, syntax highlighting, or automatic execution. Source changes remain local to the current page session.

## Execution boundary

Each run creates a hidden iframe with `sandbox="allow-scripts"`, without same-origin privileges. Only the trusted supervisor runs in the frame. A separate classic worker compiles, links, and executes the program; the supervisor owns the bounded browser parallel pool. A source loop therefore does not occupy the docs page's event loop. The client and supervisor communicate through a private MessageChannel established after checking the frame's window identity and a per-run token.

The frame uses a restrictive Content Security Policy: network connections and external scripts, images, forms and base URLs are blocked. Blob scripts/workers are allowed. Sia 2.3 creates an ASCII decoding helper with `new Function`, so `unsafe-eval` is permitted inside this opaque execution frame. That permission does not extend to the docs page. The code runs without the site's origin, DOM, cookies or origin storage. The Chromium checks verify the opaque origin and blocked network access.

The compiler emits its normal ESM graph. A Babel-parser-based linker rewrites only import/export module specifiers, literal dynamic imports, and generated task URL expressions. It creates blob modules and a virtual-to-blob task map. String contents and comments are not rewritten. Virtual task URLs permit recursive task references without creating cyclic blob construction dependencies. External and cyclic module imports fail explicitly. Both main and parallel execution use native ESM imports; classic worker entry bundles are needed for the opaque frame in the tested browser.

Parallel arguments and results still use compiler-generated Sia schemas, nominal record helpers, typed captures and the central nested scheduler. Passing tasks from the main execution worker to the supervisor adds a structured-clone hop; the actual parallel workers receive validated Sia frames, with no untyped fallback.

## Bounds and cleanup

- Source: 65,536 UTF-16 code units.
- Whole run: 10 seconds, including loading and compilation; the page owns this timer.
- Parallel pool: two workers, 32 queued roots, 64 outstanding descendants, nesting depth 16, and a five-second deadline per root.
- Task values: 1 MiB accounting budget, 10,000 nodes and depth 32.
- Output: 100 console calls plus one truncation notice; bounded value inspection, 4,000 characters per message, and 65,536 characters total.
- Submission and message budgets also stop excessive runs.

Stop and completion terminate the main worker, close the owned parallel pool, revoke blob URLs and remove the execution frame. Late results from a stopped or superseded run cannot update the editor. The next run starts with fresh modules and workers. The frame is removed if its cleanup acknowledgment does not arrive promptly.

These are responsiveness and data-accounting limits, not a hard browser memory quota or a claim of protection against every hostile program. Very large allocations or message cloning can still exhaust browser resources; background-tab throttling can delay timers. This preview should not be presented as a general-purpose hostile-code hosting service. The separate [browser runtime](browser-runtime.md) remains available for trusted applications.

## Build and verification

Website dev/build commands first run `scripts/build-playground.ts` to bundle the supervisor, compiler and runtime worker into `apps/website/static/playground`. Generated assets are ignored by Git and included in the static website build. No backend, service worker, remote package service or deployment is required. Development changes to worker source require rerunning the asset build or restarting the dev command.

`bun run check` includes unit tests for linking, example compilation and bounded output, along with type checks and the production website build. `bun run test:playground` starts a separate loopback harness; open its printed URL in a real browser. It checks the actual client and sandbox bundles: examples, nested parallelism, syntax/type errors, Stop in the main and parallel workers, restart, the whole-run deadline, origin/network isolation, imports, runtime errors and source/output bounds.

On 2026-10-12, all 11 browser harness checks passed in Chromium (Chrome 154, macOS). The production Tiramisu build was also checked through its Run, Stop, example selector, and compiler-diagnostic controls. Chromium is the verified browser. Firefox, Safari, mobile hardware and deployment-specific CSP policies remain unverified. Hosting or publishing the site is a separate step.
