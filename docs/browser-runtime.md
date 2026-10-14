# Browser parallel runtime

The browser adapter runs compiled parallel tasks in dedicated module Web Workers. It shares the scheduler, Sia frames, schema validation, record reconstruction, and task execution code with the Bun adapter. Language semantics and compiler boundary checks are unchanged.

## Serving a compiled program

Build the runtime artifacts and a project:

```sh
bun run build:packages
bun run cli build examples/parallel-records/main.kalandra -o dist/browser-example --strict
```

Serve the resulting `dist` directory over HTTP(S), preserving generated filenames and directories, including `.kalandra`. Serve JavaScript with a JavaScript MIME type. From a page served at the root of that directory:

```html
<script type="module">
  import { runBrowserProgram } from "./runtime/browser/index.js";

  const result = await runBrowserProgram(
    new URL("./browser-example/.kalandra/program.mjs", location.href).href,
    { maxWorkers: 2, maxQueuedTasks: 32, taskTimeoutMs: 10_000 },
  );
  console.log(result); // 8
</script>
```

The API is also exported as `@kalandra/runtime/browser` for bundler consumers. When bundling the adapter into another location, pass `workerUrl` pointing to the separately bundled `dist/runtime/browser/worker.js`. Without that option, it loads `worker.js` beside the adapter's own module URL. The worker entry is a separate module and must not be concatenated into the page entry. Opaque-origin hosts can supply a self-contained classic worker bundle with `workerType: "classic"`; ordinary hosts default to module workers. An optional `moduleUrls` map resolves virtual task URLs to generated blob URLs. The adapter snapshots that map at pool creation and resolves both root and nested task dispatches. The [playground](playground.md) uses these hooks without changing the wire protocol.

The runner accepts `exportName` (default `main`), `args` (default empty), `signal`, `taskTimeoutMs` (default 30 seconds per root), and the shared worker/queue/data/nesting limits. It drains work through the generated runner and always closes its pool on success or failure. Repeated runs reuse the browser's application module cache but create fresh workers. Overlapping invocations of the same generated graph remain prohibited.

Use browser-loadable ESM dependencies; Bun and Node builtins and CommonJS modules are not made browser-compatible by this adapter. The CLI still runs programs through Bun. Browser hosting and deployment are explicit operations, not part of `build`.

## Pool and serialization

`createBrowserWorkerPool({ maxWorkers, maxQueuedTasks, workerUrl? })` exposes the shared `run`, `stats`, and `close` API. Browser tasks require concrete Sia schemas and matching worker manifests, including through this lower-level API. There is no untyped structured-data fallback. Passing a task without a schema fails the worker dispatch.

Messages contain copied Sia byte frames. Number remains float64, strings preserve UTF-16 code units, and generated record helpers restore nominal types. Typed captures and nested calls use the same per-invocation scopes and central admission as Bun. Nested calls can complete with one worker and no waiting queue when one root is admitted. Frames are validated at both ends, including child ancestry, request IDs and inherited limits. This protocol validates compatibility; it does not authenticate modules.

## Cancellation and limits

Queued cancellation removes the task. Running cancellation, deadlines and worker failures retire the affected root tree and call `Worker.terminate()` on its workers. Replacement workers allow independent queued work to continue. Closing the pool rejects unfinished tasks, removes event listeners and terminates its workers. Ordinary task exceptions and invalid results reject the call; malformed messages, startup errors and uncaught worker errors reject affected work as worker failures.

Unlike Bun subprocesses, the browser exposes no OS exit acknowledgment. `close()` resolves after termination has been requested through the synchronous [Web Worker termination API](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate) and scheduler cleanup finishes. Worker counts describe managed Worker instances, not independently observed OS threads. Background-tab timer throttling may delay deadline handling.

The signal and deadline cover worker task trees, not application initialization or arbitrary main-program code running on the page. A main program that loops synchronously can still freeze the page. Workers execute trusted application modules and retain their normal browser capabilities; this is not an isolated playground for untrusted programs. Cancellation does not undo network requests or other completed side effects.

Absolute HTTP(S) and blob module URLs are accepted; ordinary browser origin, module loading and Content Security Policy rules apply. Generated relative imports need a meaningful URL hierarchy, so serve generated project graphs over HTTP(S). Blob task modules are useful only when their imports are already resolvable. Worker entries must be served as module scripts.

## Verification

Run `bun run test:browser` and open the printed loopback URL. To verify the packaged adapter instead of fresh source bundles, run `bun run build:packages`, then `bun run test:browser --built`.

The browser harness checks two-worker execution, float64 and Unicode serialization, generated multi-module record/capture programs, nested scheduling with one worker, strict dynamic-boundary rejection, schema/result mismatches, exceptions, CPU-loop cancellation, queue limits, timeouts, worker replacement, malformed messages, startup failures and runner cleanup. It runs the three compiled example graphs repeatedly through HTTP module imports. The no-queue nested probe adds a small exported entry to the test copy of the example.

On 2026-10-12, the source and packaged adapter passed in the desktop app's Chromium browser (Chrome 154, macOS). Safari and Firefox remain unverified. This is a trusted test harness, not the future public playground.
