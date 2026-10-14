# Authenticated Bun remote runtime

Status: experimental runtime API, exported as `@kalandra/runtime/bun/remote` and built into `dist/runtime/bun/remote.js`. It executes explicitly registered compiled task companions using Sia. The listener binds numeric loopback; clients require HTTPS for non-loopback endpoints. Project builds generate deployment and client manifests for explicitly selected exported functions. Project builds also check `remote:./contract.json` imports against those contracts. The Bun CLI hosts deployments and binds clients to endpoints. Discovery and published deployment tooling remain pending.

## Host and run through the CLI

Build a service with an explicit public export:

```sh
bun run cli build server/main.kalandra -o out --strict --service calculate=calculate
bun run cli serve out/kalandra.deployment.json --port 3000
```

Set `KALANDRA_REMOTE_TOKEN` in the host environment first (32–256 ASCII letters, digits, underscores or hyphens). Use `--token-env NAME` for another variable. Tokens are never accepted as command arguments or embedded in generated artifacts. Serve imports trusted compiled service code. It binds only 127.0.0.1; omitted `--port` selects an available port and prints its URL. Optional `--task-timeout-ms` (default 30000), `--body-timeout-ms` (5000) and `--max-concurrent` (8) configure host limits. Timeouts accept 1–300000 ms; concurrency accepts 1–64.

Copy the generated `kalandra.client.json` to the client source tree as `math.client.json`, then import `remote:./math.client.json`. Create a separate endpoint file:

```json
{
  "version": 1,
  "endpoints": {
    "math.client.json": {
      "url": "http://127.0.0.1:3000",
      "tokenEnv": "MATH_TOKEN"
    }
  }
}
```

Set `MATH_TOKEN` in the client's environment to the service token, then run:

```sh
bun run cli run client/main.kalandra --strict --bindings endpoints.json -- argument
```

The bindings file path is relative to the working directory. Its keys are normalized paths to contracts relative to the compiler's source root, including subdirectories. Every imported contract needs a binding; unused bindings are rejected. Revisions remain pinned by the compiled contracts. The CLI builds temporarily, supports local and remote tasks together, and removes temporary output after cleanup.

SIGINT/SIGTERM stop client submissions and cancel outstanding calls, waiting for remote acknowledgements and local worker exit. Client signal exits are 130/143; unconfirmed remote cancellation reports an unknown execution outcome and exits 1. Program failures also cancel and drain outstanding calls. These signals do not forcibly interrupt synchronous main-thread JavaScript. The service drains/cancels active work before a successful shutdown exit. Production TLS/proxy deployment remains unverified.

## Generate a service build

Select entry-module exports explicitly:

```sh
bun run cli build tests/fixtures/network/main.kalandra -o out --strict \
  --service calculate=calculate --service broken=broken --service slow=slow
```

Each `--service id=export` assigns a public service ID to an exported module-level Kalandra function. Named re-exports and aliases resolve to the defining function. Unselected exports and private helpers are not exposed. A service needs no existing parallel caller: the compiler generates its task companion and validates its declared parameters and fulfilled result with the same strict boundary checks used for parallel calls. Any/dynamic types, dynamic return expressions hidden by annotations, arbitrary decorators and unsupported task dependencies fail the build. Explicitly typed module-data captures, including transitive helper captures, now use a server-startup baseline and fresh per-request snapshots. Pure initializer graphs are supported; effectful setup and later module-level writes remain rejected. See [capture binding](remote-service-captures.md). Each function can have only one service ID.

The build writes two additional files at the output root:

- `kalandra.deployment.json`: version, revision and selected service registrations (relative task module, generated export and canonical Sia schemas).
- `kalandra.client.json`: the same identity and registrations, plus the public source export, declared `signature` (`args` and fulfilled `result` wire types), and whether the source function is async. Record signatures retain nominal IDs and field types; arrays and finite unions retain their structure. Number remains float64.

The declared signature is always registered. Builds also register bounded array-map schemas: declared arguments followed by a Number index and an array of the first parameter type; when the last declared parameter is Number, it may receive the index and only the collection is appended. A signature already declaring item, index and collection uses its ordinary schema. Additional schemas from checked parallel call sites in the same graph are also registered. Service task exports remain generated details; service IDs supply the public names. Generation reads semantic models and emitted code without importing or evaluating the application, even when it has top-level effects.

Service generation is opt-in. Ordinary builds continue accepting unused dynamic functions and emit no remote manifests. `--service` currently cannot be combined with `--watch`. Use a fresh output directory when packaging a deployment: ordinary builds do not delete artifacts left by earlier service builds. Compilation errors produce no new output; IO failures during writing are not an atomic directory transaction.

The compiler API accepts `{ strictNames: true, remoteServices: { calculate: "calculate" } }` as `compileProject` options. `output.remote` identifies both manifest paths and their shared revision. Manifest generation uses standard Web Crypto SHA-256 (Bun or a browser context with Web Crypto); it does not require Node APIs or filesystem access inside the compiler.

## Deployment configuration

`loadRemoteDeployment(path)` reads a trusted local JSON manifest with this shape:

```json
{
  "version": 1,
  "revision": "deployment-revision",
  "services": {
    "calculate": {
      "module": "tasks.kalandra.mjs.tasks.mjs",
      "exportName": "task0",
      "schemas": ["{\"args\":[\"number\"],\"result\":\"number\"}"]
    }
  }
}
```

This is a format example; prefer the compiler-generated `kalandra.deployment.json` rather than constructing registrations manually. Export numbers are build artifacts, not stable public function names. An explicit service ID supplies the deployment-facing name. The loader requires 1–256 services and checks identifiers, schema structure, real module paths and the generated module's schema declarations. Paths must be relative to the manifest and stay inside its directory after resolving symlinks. Invalid paths are rejected before any registered module is imported. Loading valid configuration imports trusted generated task modules; this is not a sandbox for untrusted packages.

The deployment revision is mandatory and must match the client. The loader validates its format but does not attest file contents or require a particular hashing scheme. The compiler computes SHA-256 over a versioned payload of sorted emitted paths/code and selected service contracts. Changes to implementation, generated helpers, schemas or service exposure therefore change the revision; service-option order does not. Absolute output directories, source maps, tokens and endpoints are excluded. This is a build identity, not a signed attestation or a hash of installed external package contents. Do not edit generated artifacts after building; hand-maintained deployments must update revisions themselves. Client and server maps are copied at creation so later map edits do not alter active registrations.

The token is supplied separately, never stored in the manifest. Generate a high-entropy secret using cryptographically random bytes such as `crypto.getRandomValues(new Uint8Array(32))` encoded as hex. The API accepts 32–256 ASCII letters, digits, underscores or hyphens. Possession of the single deployment token authorizes all registered services and their control requests; per-user identities, service ACLs and token rotation are not implemented.

```ts
import {
  loadRemoteDeployment,
  serveRemoteTasks,
} from "@kalandra/runtime/bun/remote";

const deployment = await loadRemoteDeployment("./out/kalandra.deployment.json");
const server = serveRemoteTasks({
  deployment,
  token: process.env.KALANDRA_REMOTE_TOKEN!,
  port: 0,
  taskTimeoutMs: 30_000,
  maxConcurrent: 8,
});
console.log(server.url); // Never log the token.
// On application shutdown:
// await server.close();
```

`serveRemoteTasks` binds only `127.0.0.1`. For cross-host use, terminate TLS at a trusted endpoint in front of this listener and preserve authorization/control headers. Native TLS listener configuration and reverse-proxy deployment are not tested here. The client refuses plaintext HTTP except numeric loopback, URL credentials, queries, fragments and redirects. This feature has authenticated loopback acceptance, not a production internet-hosting certification.

## Client integration

`createRemoteDispatcher({ url, revision, token, routes, signal?, timeoutMs? })` returns the dispatch function accepted by a generated `.kalandra/program.mjs` runner. `routes` maps each local generated task-module URL plus `#exportName` to an explicitly registered service ID. The server replaces that service ID with its own configured local module URL. Clients cannot request arbitrary module imports.

```ts
import {
  createRemoteDispatcher,
  loadRemoteClient,
} from "@kalandra/runtime/bun/remote";

const client = await loadRemoteClient("./client-out/kalandra.client.json");
const controller = new AbortController();
const dispatch = createRemoteDispatcher({
  url: endpoint,
  revision: client.revision,
  token: process.env.KALANDRA_REMOTE_TOKEN!,
  routes: client.routes,
  signal: controller.signal,
});
const result = await program.run(dispatch, "main", []);
// controller.abort() cancels outstanding calls made by this dispatcher.
```

The caller must provide concrete compiler-generated schemas. Arguments and results use existing Sia task-protocol-v3 codecs, including float64 Numbers. There is no JSON application-value payload or dynamic codec fallback. `loadRemoteClient` validates the client contract and resolves its relative task routes inside the local build directory, including symlink containment checks, without evaluating task modules. The portable `parseRemoteClientManifest` API validates contract JSON without filesystem access. Neither loader treats a contract as authentication. This API remains available for copies of one compiled graph. Independently compiled clients use remote imports and host bindings as described below.

## Independently compiled remote imports

Copy the server build's `kalandra.client.json` into the client source tree, for example as `math.client.json`. The client compiler reads this trusted contract as data; it needs no server source, generated task modules or live endpoint.

```kalandra
from "remote:./math.client.json" import calculate

export fn main:
  await calculate 1.5
```

Build normally with `bun run cli build main.kalandra -o client-out --strict`. Remote contract paths must start with `./` or `../`, end in `.json`, resolve relative to the importing source and stay lexically within the project source root. Builds do not fetch contracts or endpoints. As with source resolution, this is not a filesystem symlink sandbox. Keep contracts under your project's control; signatures establish types, not authenticity.

Named imports, import aliases and statically named namespace calls work. Remote calls always return promises, including when the service implementation is synchronous. Both ordinary calls and explicit parallel forms are checked: `await calculate 1.5`, `1.5 -> await calculate`, and `await |calculate| 1.5`. The generated runner owns pending remote calls through the same managed dispatch lifetime as local parallel calls.

Concrete argument types are mandatory, even without `--strict`. Missing arguments, unsupported types, unawaited promise arguments, dynamic return expressions hidden by local annotations and unregistered call shapes fail compilation. The declared contract parameter schema is used for assignable narrower values, such as a Number passed to a Number-or-String union. Extra arguments are allowed only when their exact schema is registered in the contract. Map callbacks include index and collection arguments: a unary declaration alone does not register that larger shape. Standalone checked identity aliases are supported. Private local helper parameters and synchronous returns are supported when their remote identity is statically fixed. Remote handle re-exports and dynamic namespace use remain unsupported. Local workers can make checked remote calls through a configured parent host. Import aliases and standalone immutable local aliases preserve the checked contract.

A client build writes `kalandra.remotes.json`, pinning each normalized source-root-relative contract path and revision. Virtual task identities contain the contract path and service ID, never an endpoint or token. The generated JSON carries contract metadata but no server implementation. `output.remoteImports` identifies this artifact in the compiler API. Project analysis loads the same signatures; editor caches and build watchers track contract reads as inputs. A changed contract refreshes type diagnostics.

Supply endpoint credentials only at runtime:

```ts
import { loadRemoteImportDispatcher } from "@kalandra/runtime/bun/remote";
import { run } from "./client-out/.kalandra/program.mjs";

const controller = new AbortController();
const dispatch = await loadRemoteImportDispatcher(
  "./client-out/kalandra.remotes.json",
  new Map([
    [
      "math.client.json",
      {
        url: endpoint,
        token: process.env.KALANDRA_REMOTE_TOKEN!,
      },
    ],
  ]),
  { signal: controller.signal },
);
const result = await run(dispatch, "main", []);
```

Binding keys are the normalized paths recorded in `kalandra.remotes.json`. The loader validates the manifest and requires a binding for every contract. It never imports server code. Dispatch checks the generated schema, selects the service and pinned revision, then uses the authenticated transport. Revisions cannot be silently replaced by endpoint configuration. Unsupported or stale contracts fail; there is no dynamic discovery or retry fallback.

For a client that also submits local parallel tasks, pass an explicit `local: task => pool.run(task)` dispatcher option and close that host-owned pool after execution. Unknown remote identities never fall through to the local dispatcher. The CLI accepts `run main.kalandra --bindings endpoints.json` and manages both local workers and remote cancellation. The browser playground remains network-disabled. The old `ws:` transport syntax is still unsupported; this is not a compatibility bridge.

## Remote calls from local workers

A local worker can call a service through the same checked imports:

```kalandra
from "remote:./math.client.json" import calculate

@params Number
fn work n: await calculate n

export fn main: await |work| 2
```

Run with the usual `--bindings endpoints.json`. The worker submits a typed child request to its parent; the parent validates the pinned contract and performs the HTTP call. Named imports, import aliases, namespaces and calls through extracted local helpers work. Endpoint URLs and tokens are not sent in task messages. The CLI also removes token environment variables named in the bindings file from local worker environments.

Remote children share local nesting-depth and outstanding-task limits. A parent deadline, failure, worker crash, pool shutdown or cancellation aborts its remote descendants. Failed roots wait for their remote calls to settle; `pool.close()` waits for both local worker termination and remote cleanup. Unconfirmed cancellation reports an unknown outcome and closes the pool to further work.

Custom Bun hosts wire the same dispatcher into the pool:

```ts
let dispatch;
const pool = createBunWorkerPool({
  maxWorkers: 2,
  maxQueuedTasks: 64,
  dispatchRemote: (task, signal) => dispatch(task, { signal }),
  workerEnv: {}, // Choose the environment made available to trusted worker code.
});
dispatch = await loadRemoteImportDispatcher(manifestPath, endpoints, {
  local: (task) => pool.run(task, { timeoutMs: 30_000 }),
});
try {
  await program.run(dispatch, "main", []);
} finally {
  await pool.close();
}
```

Initialize the dispatcher before invoking the program. Hosts supplying `dispatchRemote` must honor its cancellation signal and settle only after cleanup; the built-in dispatcher does so. Unknown remote routes never fall back to local execution. Ordinary pool tasks still require local module URLs. Remote service hosts accept outbound endpoint bindings through `serve --bindings` or `loadRemoteDeployment(path, { endpoints })`. Local worker signatures may use imported remote record constructors, including aliases and immutable namespaces.

## Records across remote calls

Service contracts now include `records` declarations for every record reachable from registered schemas, including private nested records and base types. Declarations carry the record name, own fields in constructor order and optional parent identity. `types` exposes reachable record types exported by the service build entry, including named re-exports. Unused or private types are not exposed as public constructors. Private declarations still provide the identity needed to decode returned values. Service IDs and type export names must not collide.

For the repository's record example, build the service with `bun run cli build tests/fixtures/network/main.kalandra -o out --strict --service echoPoint=echoPoint`, then copy `out/kalandra.client.json` to the client source tree as `math.client.json`.

A client can import those constructors alongside services:

```kalandra
from "remote:./math.client.json" import Point echoPoint

export fn main:
  point = await echoPoint (Point 1.5 2.5)
  point.z + point.x
```

The compiler generates local data-only constructors from validated metadata. It preserves field order and inheritance, including Kalandra's own-fields-before-inherited-fields constructor arguments. It does not load or copy the server's implementation. Returned values have the same local prototypes as client-constructed values, pass local `@check` calls, and can be sent back to services in the same deployment. Arrays, nested records and finite unions retain each record's identity. Public constructor import aliases and constructor re-exports are supported.

Client record identities are scoped by deployment revision. Two paths to the same contract share constructors; different revisions and local records remain distinct even when their names and fields match. The Sia wire schema retains the server's original IDs; the generated boundary selects the matching local constructor registry when packing and unpacking. This changes neither task protocol v3 nor the float64 Number codec.

Declaration validation checks inheritance cycles/depth, missing declarations, field/schema disagreements, constructor export collisions and conflicting nominal definitions across services. A project also rejects conflicting constructor metadata for the same deployment across multiple contracts. Record contracts without declaration metadata are rejected. Limits include 256 declarations and 32 inheritance levels, subject to the existing schema/manifest bounds.

Plain objects, another nominal record type, extra/missing fields and accessor properties cannot impersonate records at runtime. Accessors are rejected without evaluating them. Construction alone does not guarantee field values are valid: compile-time checks and the Sia boundary still validate values. Local worker parameter and return annotations support remote record constructors. Constructor aliases, local re-exports, immutable namespaces, typed lists, nested records and typed captures preserve the same deployment-scoped identity. Local records can extend imported remote record types and cross local worker boundaries with inherited fields and prototypes intact. Their constructors take own fields before parent arguments. A local subclass is a distinct nominal type, so a remote call expecting the imported parent requires explicit construction of that parent; fields are never silently dropped. Exporting services whose schemas depend on record constructors imported from another remote contract remains unsupported. Typed service captures with pure initializers are supported; effectful service setup remains separate work; service-to-service calls use explicit host bindings.

## Remote array mapping

Independent clients can use `[1 2] -> * [await] calculate` without a matching map call in the server project. Explicit arguments go between the item and callback metadata, as in `[1 2] -> * [await] scale 3`. Results preserve input order. Aliases, namespaces, remote records and calls from local workers use the same checked path. Collections must have a supported static type; direct Range mapping and Any/dynamic inputs remain rejected.

Map collection schemas use the service's first parameter type, including its original record IDs. Local deployment-scoped IDs never leak into server schemas. Only registered forms are accepted; optional map forms exceeding public or private schema bounds are omitted. Services with typed captures register matching private worker schemas, and each mapped request gets a fresh server-owned capture snapshot.

The retained `@check` decorator validates all supplied arguments. A checked callback needs annotations for item, index and collection; annotating only the item fails on map metadata (LC-006 in the language-design backlog). This work preserves that behavior and the existing async-check limitation.

## HTTP control protocol v2

Every request requires `Authorization: Bearer <token>`, `X-Kalandra-Network: 2`, `X-Kalandra-Revision`, and `X-Kalandra-Request` containing a fresh UUID. Authentication uses constant-time comparison for equal-length credentials and runs before admission, frame decoding or service lookup.

1. `POST /v2/reserve` creates a bounded reservation and returns 201. Duplicate active/recent IDs return 409; exhausted capacity returns 503.
2. `POST /v2/call` consumes that reservation once. Its content type is `application/vnd.kalandra.task`, with a Sia call frame as the body. The module field names the registered service; export and schema must match it. Parent task IDs must be absent/zero.
3. `POST /v2/cancel` aborts a reservation and waits for its execution and cleanup to settle before returning 204. It also acknowledges recently completed requests. Unknown IDs return 404, not a success claim.

Reserving first closes the cancellation-before-admission race. A cancelled reservation cannot accept a late call. The server retains up to 256 terminal IDs for 30 seconds, allowing cancellation to race safely with completion. After eviction/expiry, an unknown outcome is reported rather than claiming cancellation succeeded. This bounded ledger is not durable deduplication or exactly-once execution.

A call response is HTTP 200 with matching content type, network version and revision, containing a correlated Sia result or failure frame. The client checks frame completeness, request ID, schema and typed value. Task errors are bounded to 2,000 code units and omit server stacks. HTTP rejection statuses distinguish authentication (401), invalid frames/profile/IDs (400), unknown services (404), revision/schema/state mismatches (409), content type (415), and capacity/shutdown (503). Bun may reject oversized bodies with 413 before the handler. The client reports status codes without reading unbounded error bodies.

## Cancellation and resource ownership

Each admitted root owns a fresh single-worker Bun pool. Nested local child tasks share that pool and retain the existing scheduler bounds. `maxConcurrent` defaults to eight, so there are at most eight active root pools; each has one worker. Keeping the pool per root makes cleanup ownership explicit. Pool reuse and performance tuning are future work.

Both normal completion and failure wait for `pool.close()`. Explicit cancellation aborts the root tree and waits for worker termination before acknowledgement. `server.workers` and `server.activeRequests` expose current resource counts; `server.close()` stops admission, cancels pending work, waits for cleanup, then closes the listener. Acceptance checks cancellation during execution, zero resources at acknowledgement, a subsequent successful call and clean process shutdown.

The client uses an independent five-second control-request deadline. Cancellation does not merely close the call socket: it sends the authenticated control request first, then aborts the local fetch after acknowledgement. If that exchange fails or returns an unknown ID, it reports `Remote cancellation unconfirmed; execution outcome is unknown`. Acknowledgement means the task is terminal and resources are reaped; it cannot roll back effects that happened before cancellation. A task may already have completed.

Execution defaults to 30 seconds, client calls to 35 seconds, and body reads to five seconds. Reservation lifetime is body plus execution allowance, starting at reservation admission. Execution deadlines separately include worker queue time. The client call timer starts after reservation; control requests use their own deadline. The HTTP disconnect signal is also propagated, but explicit cancellation is the verified cleanup protocol. There are no automatic retries, crash recovery or persistent job records.

`createRemoteHandler` is available for host integration. Its supplied `run` callback must settle only after owned worker resources are reaped; otherwise the host cannot offer the cancellation-acknowledgement guarantee. `serveRemoteTasks` implements that contract with the Bun pool. Hosts must throw `RemoteCleanupError` when reaping fails. Such failures stop admission and prevent successful cancellation acknowledgement; retained pools remain visible in the server worker count and close reports the failure.

## Bounds and limits

The fixed Sia profile allows 1 MiB application data, depth 64, 10,000 nodes and 128 KiB frame overhead. Bodies are counted while streaming even without Content-Length. Slow request bodies have a deadline. The existing decoder applies its absolute structural caps before the handler compares the requested profile, so this is not a hard per-request memory quota. Node/array shape hardening before full decode, caller quotas and hostile-load testing remain work before broad exposure.

Remote acceptance exercises Number arguments/results, errors, record construction and round trips, inheritance, nested arrays, unions of nominal records and rejection of invalid record inputs. Capture/nested remote workloads still need their own end-to-end acceptance even though those features have local codec/runtime tests. Browser clients, cross-machine/WAN behavior, proxy/TLS operation and service discovery remain unverified.

## Verification

```sh
bun test tests/network-contract.test.ts tests/remote-manifests.test.ts tests/remote-imports.test.ts tests/remote-records.test.ts
bun run test:network
bun run build:packages
bun run test:network --built
```

The contract tests are part of `bun run check` and open no sockets. They verify float64 edge values, routing, schema/profile/frame rejection, streaming bounds, authentication, TLS endpoint constraints, reservation races, cancellation acknowledgement ordering, unconfirmed cancellation, body deadlines and deployment path/schema validation.

Manifest tests cover explicit exposure without parallel callers, re-exports, stable/content-sensitive revisions, concrete signatures, strict rejection, malformed contracts, path containment, non-executing client loads and CLI output preservation. The built CLI is also tested outside the workspace.

Remote-import tests additionally cover independently compiled calls, named/namespace/parallel forms, strict dynamic rejection, contract path bounds and editor-cache refresh. Record tests cover constructor order, inheritance, same-contract alias identity, separation from other deployments/local records, malformed metadata and conflicting declarations.

The socket test uses compiler-generated deployment/client manifests, compiles an independent client using only its own source and a contract, and starts a separate server process and verifies compiled calls, application failure, deadlines/recovery, revision and credential rejection, explicit cancellation after a worker starts, zero resources after acknowledgement and shutdown. The `--built` run copies bundled compiler and runtime artifacts outside the workspace and uses the built compiler for manifest generation and the built runtime for both client and server. CI runs both socket modes after `check`.

Next: broaden remote workload coverage and consider explicit effectful startup hooks separately. TLS deployment and public-host hardening remain separate work.

## Service-to-service calls

A service may import a pinned remote contract and call it from an exported function, including through a nested local parallel function. Build it with the usual `--service name=export` flags, then provide its outbound bindings when hosting:

```sh
bun run cli serve relay-out/kalandra.deployment.json --bindings downstream-endpoints.json
```

The bindings format is the same as for clients; keys refer to contract paths in the relay's source root. The relay's inbound token and downstream tokens are separate host settings. Missing or unused bindings fail before listening. Generated deployments reference `kalandra.remotes.json`; its path must remain within the deployment directory, including after resolving symlinks. For the API, call `loadRemoteDeployment(path, { endpoints })` and pass the returned deployment to `serveRemoteTasks`.

Outbound calls preserve pinned revisions, strict Sia schemas and authentication. The host forwards cancellation and waits for downstream cleanup. Every outbound service hop increments `x-kalandra-depth`, starting at 0 for a client call and capped at 32; local worker depth and concurrency limits also apply. Each host retains its configured task deadline, and an upstream timeout cancels its descendants. The CLI removes the configured inbound and outbound token variables from worker environments. API hosts can supply `workerEnv` to both deployment loading and serving for their own environment policy.

The network acceptance suite tests an independent client, relay and downstream service, nested calls, failure recovery, cancellation after downstream work starts, worker cleanup and listener shutdown using both source and isolated bundled CLI.

## Local aliases of remote services

A standalone binding can give a checked remote service another local name:

```kalandra
from "remote:./math.client.json" import calculate
export fn main:
  chosen = calculate
  await chosen 1.5
```

Aliases preserve the pinned service identity and its parameter/result types. Alias chains, namespace members, explicit parallel references and array-map pipelines also work, including inside managed workers and hosted services. These are compile-time identity bindings; their calls use the normal checked dispatcher. They do not create serializable function values.

Private, directly called local helpers may receive and synchronously return a checked remote function when all call sites agree on its identity. Exporting handles, putting them into collections, or sending them through a worker/remote boundary remains rejected. Alias declarations must be standalone statements with a simple identity initializer, rather than an expression producing a function result.

For example, declare handle-producing helpers before their consumers:

```kalandra
from "remote:./math.client.json" import calculate
fn choose: calculate
@params Function Number
fn invoke service n: await service n
export fn main:
  chosen = choose ()
  await invoke chosen 1.5
```

Only the remote handle parameter is specialized; `n` remains explicitly typed. The helper body executes normally, including side effects before returning a handle. Helpers must remain private and directly called; exporting or aliasing the helper itself, passing conflicting service identities, asynchronous/conditional handle production, and serializing function arguments or results remain rejected. Existing forward-return inference can require defining a handle-producing helper before use. These restrictions preserve checked routing without adding general function transfer.
