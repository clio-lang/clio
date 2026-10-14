# Remote service capture binding

Status: the pure-initializer subset is implemented in the compiler and Bun remote host. Unsupported setup produces KAL4301; unsafe boundary types produce KAL4202. This decision covers the managed remote execution model; it does not change ordinary function closures or local worker captures.

## Ownership and lifetime

A remote service owns its captured data on the server. The compiler emits initializer code and a private capture schema; it never evaluates initializers during a build. Hosting initializes the selected service dependencies once per deployment instance, before announcing readiness or accepting requests.

The host validates and serializes the initialized values through Sia into a baseline snapshot. Each root request receives a fresh copy of its reachable captures. Task mutations affect that request only. Concurrent requests, reused workers, subsequent calls and other deployment instances cannot observe them. Restarting the service initializes a new baseline. Nested local tasks snapshot their parent's current request-local values, preserving the existing local worker rule.

Clients send only public arguments, including map callback metadata for registered map forms. They cannot select, replace or supply hidden captures. Capture values and private capture metadata do not appear in the public client contract. Values can still be disclosed by service code that explicitly returns them; capture ownership is not a confidentiality mechanism.

For example, the intended supported form is:

```kalandra
Number multiplier = 3

@params Number
export fn multiply n:
  n * multiplier
```

Hosting initializes multiplier to 3. A client calling multiply with 4 receives 12. The type annotation is required: the earlier shorthand multiplier = 3 remains ineligible, matching local capture rules.

## Strict typing

Use the existing capture eligibility and Sia rules: explicit module-level declarations; supported scalars, typed arrays, nominal records and finite supported unions; Number encoded as float64. Any, dynamic JavaScript data, functions as data and arbitrary objects fail compilation. A declared type cannot conceal a dynamic initializer or unsafe write.

The capture closure includes data used by transitive helpers, including private data in their defining modules. Each binding has one identity, even when reached through several helpers or import aliases. Direct imported data captures remain unsupported until implemented consistently for local and remote tasks.

Keep public call schemas separate from private worker schemas. The host augments validated public arguments with captures using a compiler-generated binding plan. Capture inputs must not become extra user parameters or change checked-function arity. Preserve record constructor identity and constructor argument order in bootstrap and worker graphs. Serialization does not promise shared object identity across distinct arguments or captures.

## First implementation boundary

The supported initializer subset is: scalar literals, supported pure scalar expressions, typed arrays, record construction and references to other eligible typed module-level declarations. Dependencies must be acyclic, with deterministic ordering. Record constructors are compiler-defined constructors, not arbitrary JavaScript calls.

Reject arbitrary function calls, asynchronous work, remote or parallel calls, external JavaScript values, host globals and property access that could execute user code in initializers. Unsupported initializers receive a source diagnostic; the compiler must not silently substitute a default or fall back to executing the application module.

In modules supplying captured initializers, reject top-level setup statements other than declarations, imports and exports. All top-level data initializers in those modules must satisfy the pure subset, including unused declarations. Subsequent writes and top-level calls are rejected conservatively, preventing setup mutations through aliases or helper calls from being silently omitted. Record property mutations inside request functions are supported.

Generate a dedicated bootstrap factory for the eligible dependency graph. Do not import the normal application entry, call main, execute unrelated top-level statements, or rely on ESM evaluation caching for per-instance initialization. Sharing a binding across services shares its initialization within the deployment, while each request still receives independent data.

These restrictions are the first supported subset, not new semantics for arbitrary existing programs. Stateful services, effectful startup hooks and host-supplied capture configuration remain later decisions.

## Host lifecycle and bounds

Load and validate all deployment paths, binding plans and schema references before evaluating bootstrap code. Fail startup without opening a listener if initialization or Sia validation fails. Close bootstrap resources on success, failure or cancellation.

Initialization runs in a managed, cancellable process with a 30-second startup deadline. The loadRemoteDeployment API accepts signal and timeoutMs options; the CLI uses the default deadline and forwards shutdown signals. Synchronous initializer loops or oversized data must not hang the hosting process. Apply existing serialization size, depth and node limits to snapshots; apply task limits to the combined explicit arguments and hidden captures. Startup cancellation must await confirmed process exit.

Store the baseline as host-owned serialized data, inaccessible to task mutations. Each registered public call shape maps to a validated private worker schema with the same capture prefix. On each dispatch, select that schema, build the internal task using a fresh decoded snapshot and validate it. Public request limits still apply before augmentation. Cleanup and remote cancellation acknowledgements retain their existing guarantees.

The build revision covers initializer code, private schemas and binding plans along with task code. It is not an attestation of runtime data or a promise that independent hosts share mutable state. Public clients remain pinned to the build revision. If future startup hooks depend on external configuration, configuration identity will need its own explicit policy.

## Implemented pipeline and acceptance

1. Compiler capture validation checks initializer dependency graphs and rejects unsafe writes. It emits a bootstrap factory, private binding metadata and internal worker schemas while retaining the public function signature.
2. Deployment validation and revision generation include private metadata. They keep bootstrap paths, capture identities and values out of public client manifests. All references are checked before executing bootstrap code.
3. The host initializes the baseline in a subprocess and augments each request. It preserves current capture-free deployments, schema checks, worker cleanup and CLI shutdown behavior.
4. Source and isolated bundled network acceptance exercise captured records, arrays, inheritance, NaN, nested local calls, request isolation and CLI hosting. The Tiramisu guide documents the executable subset.

The acceptance target includes typed scalars and float64 edge cases; arrays, records, inheritance and unions; imported/transitive helper captures; one-time shared initialization; concurrent request isolation; request mutation and nested local scheduling; and restarts. Verify that builds execute no code, unrelated application initialization is absent, public contracts reveal no capture data, and forged hidden arguments cannot override the baseline.

Negative cases include untyped or dynamic captures, unsafe alias writes, initializer cycles, unsupported effects, malformed binding metadata, escaping bootstrap paths, schema/record mismatch, oversized snapshots, startup deadlines and cancellation during initialization. Every failure must leave no listener or worker behind. Preserve existing authentication, pinned-revision, task deadline and acknowledged cancellation tests.

## Relationship to Clio and current Kalandra

Source inspection of the old runtime shows that packages/run/src/index.js invokes a compiled module factory and registers live functions; packages/rpc/worker.js retains registered functions in a map. That is evidence of the old registration mechanism, not an executable compatibility proof for capture lifetime or mutation behavior.

Current Kalandra already uses extracted task definitions and typed per-call snapshots for local workers; see [local captures](local-runtime.md#explicitly-typed-data-captures). This specification extends that managed model with an explicit server-owned baseline. It does not claim to reproduce arbitrary historical worker-local mutable state.

CLI commands remain in [remote execution](network-execution.md); outstanding language redesigns remain in the [design backlog](language-design-backlog.md).

## Usage

Use the normal service build and hosting commands; capture binding requires no client flags or client data. The deployment manifest has private captures.bootstrap and captures.bindings entries. The bootstrap result uses a private typed record, and its values remain in host memory. Public client schemas contain explicit function arguments only.

Initializer record constructors must be local Kalandra declarations (including locally imported declarations). Remote contract constructors and arbitrary calls are not supported. Pure numeric arithmetic, literals, boolean negation, arrays, record construction and typed declaration references are accepted. Conditional initializers and additional expression forms remain diagnostic.

The host checks combined arguments and captures against existing task limits when submitting each request. A request exceeding those limits fails without running task code. It never falls back to dynamic serialization. Local calls to the same function keep their existing application-owned capture behavior.

## Startup-created function-local targets

A service can call a function-local target created by a single module-level factory invocation. The supported factory has only a nested function declaration and a return of that function, with concrete `@params` types. The compiler separates its argument values from its function code. Bootstrap validates and initializes those values, and tasks receive typed capture snapshots; it never serializes the closure or runs the factory. Other uses of the factory, multiple instances and effectful factory bodies remain unsupported parallel targets. Effectful argument initializers still fail service startup validation. See [port completion](port-completion.md) and `examples/startup-closure.kalandra`.
