# Local parallel runtime

Kalandra can execute exported functions from compiled modules concurrently through a bounded Bun worker pool. The Bun adapter uses subprocesses; the [browser adapter](browser-runtime.md) uses dedicated module Web Workers. The scheduler and task-data contracts are host-independent; they import no Bun, Node, or browser APIs.

```sh
bun run cli build examples/worker-tasks.kalandra -o dist/examples/workers
bun examples/workers.ts dist/examples/workers/worker-tasks.kalandra.mjs
```

The example runs four Fibonacci tasks through two workers and prints `[6765, 10946, 17711, 28657]`. It always closes the pool.

## Compiled parallel programs

```sh
bun run cli run examples/parallel.kalandra --strict
# [ 6765, 10946, 17711, 28657 ]
```

Project builds support `|fn|` and `fn.parallel` for named module-level functions defined locally or imported from other local Kalandra modules, including private functions, recursion, builtin decorators, eligible function dependencies, ordinary calls, array maps, `await`, and `[await]`. A function may create and use local closures inside a task. Transferring a closure is still unsupported.

```kalandra
fn twice n: n * 2
export fn main argv:
  [10 20 30] -> * [await] |twice|
```

`run` builds the project in a temporary directory and invokes exported `main` with an array of strings from `-- arguments...`. It prints a non-undefined result, drains submitted work on successful return, and closes the pool before removing the temporary output. Defaults are up to four workers, 1,024 waiting tasks, and a 30-second deadline per root task tree. Large eager maps can exceed queue capacity; they are not automatically batched. The deadline covers queueing, worker startup, and all descendants of a root task; it does not cover the main program itself.

The compiler emits companion task modules containing only selected function declarations and their eligible function dependencies. Workers load those modules rather than the application entry, so unrelated top-level expressions, imports, and initializers are not replayed. Decorators in the task module initialize independently. Source maps retain the original Clio text, and generated task exports do not appear in the application's public namespace.

`KAL4201` rejects unannotated captures and non-function imported values inside task bodies, unresolved host values, parallel targets defined inside functions. Pass supported data explicitly. Parallel tasks operate on isolated definitions and data snapshots; mutations to function properties or helper state in the parent are not transferred. Direct range maps are rejected because Clio forwards the range object as a callback argument; convert it to an array first. Array maps preserve the item, index, and collection arguments, including Clio's extra-argument behavior for checked functions. Parallel calls require concrete static types for all parameters, actual arguments (including map metadata), and resolved results. `Any`, dynamic JavaScript values, arbitrary objects, and unsupported types cause a compile-time `KAL4202` error at the call, even without `--strict`. Scalars, recursively typed arrays, module-level records with fully supported fields, and finite unions of supported types are eligible. Annotate parameters with `@params`; results may be inferred. A return annotation cannot conceal an unknown body result. Escaping parallel handles are rejected because their later arguments cannot be checked. Ordinary dynamic calls remain available.

### Imported targets

```sh
bun run cli run examples/parallel-modules/main.kalandra --strict
```

```kalandra
from "./tasks" import fib as calculate
export fn main argv:
  [20 21 22 23] -> * [await] |calculate|
```

Named imports and their aliases support both `|calculate|` and `calculate.parallel`. Re-export chains resolve to the original definition. Immutable namespace imports (`import "./tasks" as tasks` or `from "./tasks" import * as tasks`) support `tasks.fib.parallel`, including namespaces re-exported through another module.

The builder analyzes the graph before selecting tasks, and emits one task companion per defining source file that needs it. Importing a function does not require its module to contain a parallel call. Only selected functions and their transitive function dependencies across local Kalandra modules are validated and extracted; unused exports may retain module captures. Worker imports never load the application module or its re-export modules, so their top-level effects still execute only in the parent.

Selected functions can call imported Clio helpers through named imports, aliases, re-exports, or immutable namespace members. The compiler links their task companions directly, preserving ordinary calls and async helpers without adding another scheduled task. Arbitrary decorators cannot establish a serialized signature and are rejected on parallel targets. Builtin `params`, `returns`, `check`, and `describe` decorators remain supported. Local record declarations and list descriptors are extracted in dependency order. Type imports, aliases, re-exports, and immutable namespace members are supported. A helper that captures unannotated module data, or references external JavaScript values rejects the whole build, with a diagnostic at its defining source. Whole namespace objects are not captured; only statically resolved function members are supported. External JavaScript imports, variable aliases such as `alias = fib`, and mixed rest imports (`from "./tasks" import selected * as rest`) cannot serve as statically identified parallel targets. Mixed rest imports produce mutable objects; the compiler must not assume their members retain the original functions. Ordinary synchronous use of these imports is unchanged. Imported bindings cannot be replaced inside a task. Capture errors point to the defining source and prevent output for the entire build.

Single-file `compile` still rejects parallel syntax. Use `build` to save the project artifacts and run them through the managed API:

```ts
import { runBunProgram } from "@kalandra/runtime/bun";

const result = await runBunProgram(
  new URL("./out/.kalandra/program.mjs", import.meta.url).href,
  {
    maxWorkers: 2,
    maxQueuedTasks: 32,
    taskTimeoutMs: 10_000,
    exportName: "main",
    args: [[]],
  },
);
```

`compileProject().output.runner` identifies this generated portable runner. It exposes `run(dispatch, exportName, args)` for host integration; `runBunProgram` supplies and owns the Bun pool. A rejected main closes its pool immediately. Unawaited task failures also fail the invocation, and successful main returns wait for all submitted tasks. An optional `signal` applies to each worker task. Overlapping invocations of the same generated graph are rejected; separate graphs can run independently. Calls outside a managed invocation report a missing-runner error.

Native ESM caching still applies: repeated managed invocations reuse application module state in the parent, while each `runBunProgram` call owns fresh workers. Failed top-level imports remain failed in that host's module cache. Build/run again in a fresh process for a fresh application instance. This runner does not implement process-wide cancellation, watch mode, or retries.

## Explicit pool API

```ts
import { createBunWorkerPool } from "@kalandra/runtime/bun";

const pool = createBunWorkerPool({ maxWorkers: 2, maxQueuedTasks: 32 });
try {
  const value = await pool.run(
    {
      module: new URL("./tasks.kalandra.mjs", import.meta.url).href,
      exportName: "fib",
      args: [20],
    },
    { timeoutMs: 10_000 },
  );
  console.log(value);
} finally {
  await pool.close();
}
```

The module must be a file URL with a callable named export. Arguments are snapshotted when submitted, so later caller mutations cannot change queued work. Independent root tasks never overlap on one worker. A worker may retain awaiting ancestors while executing centrally admitted descendants. Workers start lazily and remain available until closed; root work is dispatched in submission order when capacity is free. Children may bypass waiting roots to make progress on an occupied worker. Results may complete in any order. `Promise.all` preserves the caller's requested result order.

`maxWorkers` limits managed processes, including processes still terminating. `maxQueuedTasks` limits waiting tasks separately; zero permits immediate work but no waiting queue. A full queue rejects with `QUEUE_FULL`. Changing the original options object cannot change an active pool's limits. `pool.stats` reports workers, occupied workers (`running`), queued tasks, stopping workers, and whether the pool is closed.

## Cancellation and failures

Pass `{ signal: controller.signal }` to cancel a task, or `timeoutMs` to set its total deadline, including queue wait and worker startup. Omitting a timeout sets no deadline.

- A queued cancellation removes the task without executing it.
- A running cancellation or timeout stops the entire root task tree and kills every process still executing that tree. New capacity is created only after exit is confirmed.
- Worker crashes reject the active root task tree. Waiting tasks can continue in a replacement worker; dispatched tasks are never retried automatically.
- A thrown error, rejected promise, missing export, import failure, or unsupported return value rejects with `TASK_FAILED`. Failures in a nested task tree cancel its unfinished descendants and retire affected workers. An ordinary task failure with no unfinished children leaves the worker reusable.
- `close()` rejects unfinished tasks, terminates every managed worker, and waits for termination. Repeated calls return the same promise. New tasks reject with `POOL_CLOSED`.
- A host termination failure closes the pool and rejects remaining work. `close()` reports an aggregate cleanup error; capacity is not replenished while a process may still be alive.

Errors use `RuntimeError.code`: `INVALID_TASK`, `NESTING_LIMIT`, `QUEUE_FULL`, `TASK_CANCELLED`, `TASK_TIMEOUT`, `TASK_FAILED`, `WORKER_FAILED`, and `POOL_CLOSED`. Remote error names and stacks are retained separately, with bounded lengths. Error values themselves are not transported as live objects.

Cancellation ends the managed process; it does not roll back file writes or other side effects already performed by a task. This is local execution of trusted application modules, not a sandbox.

## Task data

Accepted values are `undefined`, `null`, booleans, numbers (including fractional values, non-finite numbers and negative zero), strings, bigints, dense arrays, plain objects, and `Uint8Array` byte contents. Bytes are copied, not transferred; byte-array custom metadata is outside the data contract. Shared buffers are rejected. Repeated references become independent snapshots; object identity across a message boundary is not preserved.

Functions, symbols, cycles, getters, hidden object properties, sparse arrays, class instances, dates, maps, sets, ranges, and closures are rejected explicitly. The caller can convert ranges to arrays or records to plain data when that matches the task's intended behavior. No class reconstruction or implicit prototype loss is promised.

Default limits are an 8 MiB data accounting budget, depth 64, and 100,000 visited values. These apply to both arguments and results. `valueLimits` can override them with positive integers. The byte accounting is a logical size budget, not a published wire-frame size or a total process-memory bound.

Compiled parallel calls now send versioned Sia byte frames over Bun IPC. The compiler emits concrete argument/result schemas and a worker manifest; workers check schema identity before execution, and the parent checks reply identity. Number uses float64, strings retain all UTF-16 code units, and arrays, records, and unions are recursively typed. Declared records retain their prototype and inherited type identity on both sides of the boundary. Runtime schema mismatches fail without a dynamic fallback. Old generated programs must be rebuilt. See [Sia protocol v3](sia-protocol.md) for framing, limits, and compatibility.

The explicit JavaScript pool API without a schema retains the broader runtime value contract above and its existing structured-data IPC path. It does not run compiler boundary checks. Compiled calls always require a schema and never fall back to that path. The [browser adapter](browser-runtime.md) supports compiled typed tasks with the same Sia protocol, without the untyped fallback. Network transports remain pending.

## Typed record example

```sh
bun run cli run examples/parallel-records/main.kalandra --strict
# 8
```

This imports a declared Point, sends an instance to a checked worker function, and checks the returned instance again in the parent. The worker doubles its coordinates; the parent sums them. Arbitrary JavaScript objects, even with matching fields, are rejected. Unknown record fields are compile-time errors at parallel calls; wrong live prototypes or field values fail before serialization.

## Explicitly typed data captures

Module-level tasks may capture data declared with an explicit type, such as `Number offset = 2` or `Settings settings = Settings 2 1`. The same supported scalar, array, record, and union types apply as for task arguments. Inferred variables remain ineligible: `offset = 2` must be annotated or passed as an argument. An annotation cannot hide an `Any` initializer or a dynamic write through a local alias; these produce `KAL4202` at the parallel call.

```kalandra
Number offset = 2

@params Number
@returns Number
fn addOffset n: n + offset

export fn main: await |addOffset| 40
```

The parent reads captures when each parallel call is dispatched, snapshots them alongside the arguments, and includes their concrete types in its Sia schema. A task receives a fresh closure containing those snapshots and its extracted functions. Task mutations cannot change the parent or subsequent tasks, even when a worker is reused. Recursive functions and transitive imported helpers share the appropriate captured binding within that invocation. Distinct captured bindings or arguments do not preserve shared object identity across serialization.

Private data in the defining modules of imported helpers is supported through aliases, re-exports, and immutable namespace functions. Only captures reachable from the selected target are transferred. Generated capture readers stay in the parent; worker closures contain extracted code and data, with no application initialization. Hidden capture inputs are removed before calling the user function, preserving checked parameters and map callback arguments. Their bytes and schema entries count toward existing task limits.

Directly capturing imported data, arbitrary functions, unresolved host values, and function-local task definitions remain unsupported. Use a typed argument or a helper defined alongside its typed data. This feature transfers data snapshots; it does not serialize JavaScript closures.

Try `bun run cli run examples/parallel-captures/main.kalandra --strict`. It captures a private typed `Settings` record and returns `[4, 6, 8]`.

## Nested parallel scheduling

A worker task can launch other module-level parallel functions, recursively or through imported helpers. Every child goes to the same central scheduler, retains compiler-generated Sia schemas, and gets its own data snapshot and dispatch scope. Children capture the calling task's current copies of module data, including changes made by that task. They never read the application's live parent-process variables. Unawaited parallel children are drained before a successful parent result is delivered; their failures fail the tree.

```sh
bun run cli run examples/nested-parallel.kalandra --strict
# [ [ 2, 4 ], [ 6, 8 ] ]
```

The scheduler uses idle workers when possible. When the process limit is reached, a child can execute on the submitting worker while its ancestors await. This is cooperative execution on that process's event loop, not extra CPU parallelism. Children bypass blocked root tasks in the waiting queue, so a single-worker pool can finish nested work even with `maxQueuedTasks: 0`. The implementation creates no extra worker pool and never bypasses serialization. Synchronous code that never yields still needs a deadline or cancellation.

`RuntimeOptions.maxTaskDepth` defaults to 32 child levels below a root; `maxNestedTasks` defaults to 256 outstanding descendants across the pool. Workers also cap their own outstanding child submissions to this value before encoding. Either limit may be zero to disable nested admission. Exceeding a central limit fails with `NESTING_LIMIT`; a worker-side submission limit is reported as a task failure with a nesting-limit message. Large eager nested maps can hit these limits; automatic batching is not implemented.

The root's deadline includes all descendants and is not reset by a child call. A child error, invalid schema, or worker crash fails the root tree; unfinished siblings and descendants are stopped. Independent roots are unaffected unless the host cannot terminate a worker safely. No dispatched task is retried. These semantics deliberately do not provide child-error recovery or independent child cancellation yet.

Generated task scopes retain extracted functions in a fresh lexical environment per invocation. This avoids process-global dispatcher state when several ancestors and children coexist. It supports nested scheduling of module-level definitions, not parallel execution of arbitrary function-local closures.

## Remote Bun adapter

The separate [authenticated remote runtime](network-execution.md) dispatches registered compiled tasks through HTTP to server-owned Bun worker pools. It requires explicit deployment/route configuration and a token, and provides acknowledged cancellation. Contract-backed remote imports, CLI service hosting and endpoint bindings are available; see the remote execution guide.

## Remote children

A pool may provide dispatchRemote(task, signal) to route checked remote child tasks in its host process. This callback is never passed to workers. The CLI wires it to the contract-bound remote dispatcher automatically when --bindings is supplied. Remote descendants share task depth and outstanding-child limits, including calls still cancelling. Root cancellation and deadlines reach remote descendants; failed roots wait for their cleanup, and close waits for both remote calls and local processes. Unconfirmed remote cancellation closes the pool and reports an unknown execution outcome. See [remote worker calls](network-execution.md#remote-calls-from-local-workers).

## Imported remote record annotations

Worker params and returns annotations can use constructors imported from remote client contracts, through named aliases, immutable namespaces and local re-exports. Task extraction looks up the already-generated constructor by its deployment-scoped record identity; it does not evaluate the importing application's initialization. Constructors can also be used in worker bodies, typed lists, containing records and local typed captures.

Generated local Sia schemas keep deployment-scoped IDs. The remote dispatcher converts records to the service's wire IDs for network calls and restores local identity on return. Both boundaries still reject unsupported data and nominal mismatches. Local records can extend imported remote records, including through aliases and immutable namespaces. The shared constructor module loads remote parents before local children. Subclass instances retain inherited fields and prototypes across local worker calls, nested scheduling, containing records and typed captures. Constructors take their own fields first, then the parent arguments. A subclass has its own nominal ID: it cannot be passed to a service or worker expecting the parent type. The retained async check-decorator behavior is unchanged; see LC-005 in the [design backlog](language-design-backlog.md).
