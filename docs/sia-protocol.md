# Sia task protocol v3

Compiled parallel calls use Sia 2.3 byte frames over Bun IPC or browser Worker messages. Both transports carry only the byte array for each request or reply; application values are encoded and decoded against compiler-generated schemas. The scheduler still handles queueing, deadlines, cancellation, and process shutdown independently of the wire format.

## Schema generation

The compiler derives a schema from every parallel call's actual argument types and the target's resolved result type. Arrays recursively carry their element type. Finite unions carry a bounded list of concrete alternatives. Module-level record declarations carry a nominal ID and recursively supported field types; inherited fields are included. Imported aliases retain the defining type ID. Explicitly typed module data captures precede user arguments in the generated schema and payload. Their order is fixed per target, including captures in transitive helpers; generated task wrappers bind them in a fresh invocation scope and remove them before the user function runs. Captures use the same concrete codecs and limits as arguments. Rebuild generated callers and task companions together when capture layouts change. Mapped calls include the element, explicit arguments, index, and original collection. Functions returning promises describe the resolved result.

Each task companion exports a `__kalandraSchemas` manifest mapping task exports to accepted schema identities. The caller embeds its schema in the generated parallel handle. Identities are canonical JSON descriptors: deterministic ordering, duplicate union alternatives removed, and no hash collisions. A worker checks the received identity against its generated manifest before invoking the function. The parent requires the reply's task ID and schema to match the active request. An incompatible schema requires rebuilding the program; there is no dynamic codec fallback or cross-version negotiation.

`KAL4202` rejects unsupported or unknown boundary types before emission. Runtime argument validation also rejects values supplied by JavaScript that violate the statically declared type. Results are checked before encoding. A result mismatch settles the task with a failure reply.

The protocol package interprets these concrete descriptors using Sia primitives. It does not infer schemas from values or use Sia's integer codecs for language Numbers.

## Values

| Type        | Encoding                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| Number      | Eight little-endian IEEE-754 binary64 bytes via Sia raw bytes                                                      |
| String      | UInt32 code-unit count, followed by UInt16 little-endian UTF-16 units                                              |
| Boolean     | One byte: exactly 0 or 1                                                                                           |
| Null / Void | No payload bytes; the schema distinguishes null from undefined                                                     |
| Array       | UInt32 element count followed by values using its element schema                                                   |
| Record      | Fields in canonical name order, each using its declared codec; identity and field names are supplied by the schema |
| Union       | UInt16 canonical variant index followed by that variant's value                                                    |

Numbers preserve fractions, signed zero, infinities, and NaN semantics. NaN payload bit patterns are not part of the language contract. Strings preserve every JavaScript code unit, including lone surrogates; no UTF-8 replacement or normalization occurs. Arrays must be dense, have no accessors or extra properties, and remain within node/depth limits. Empty arrays belonging to several union alternatives use the first canonical matching alternative.

Arbitrary objects and JavaScript classes, functions, ranges, sets, function-local record declarations, recursive records, and unknown field/element types have no compiled task schema. Future integer types will have explicit codecs; the current value of a Number never determines a narrower encoding.

## Record identity and reconstruction

A record must be an instance of its exact compiler-declared type. Matching field names alone are insufficient. Every declared field must be present as an enumerable data property, with no accessors, symbols, hidden properties, or extra fields. Field values must match their schemas recursively. An `Any` field, including one inside a nested record or list, prevents a parallel call from compiling. Unsupported types remain usable outside parallel boundaries.

Generated handles snapshot live instances into internal tagged field envelopes before dispatch. Sia encodes only the declared field payloads. A receiver reconstructs the instance using its registered prototype and defines its own fields without invoking a constructor. It does not evaluate getters, serialize executable code, or silently flatten an arbitrary class. Repeated references become separate snapshots, as with other task data.

A generated `.kalandra/records.mjs` contains pure constructors for module-level records, with parent constructors emitted first. It shares a per-program constructor registry with application modules and task companions. This preserves type checks and inheritance while avoiding application initialization in workers. Type declarations and list descriptors used by extracted functions can be imported through local aliases and re-exports. Same-shaped records from different declarations keep distinct identities. Constructor field names such as `__proto__` are defined as own data properties.

Protocol record envelopes have the internal shape `{ $record: typeId, fields: { ... } }`. These are codec data, not a way for application code to bypass nominal checks: generated handles require the declared live prototype before producing an envelope. Field lookup is by name, so canonical schema ordering cannot swap same-typed field values.

## Envelopes and validation

All integers are little-endian. Each frame begins with four ASCII bytes `KALS`, a UInt16 version (3), a UInt8 kind (1 call, 2 result, 3 failure), and an eight-byte Number task ID restricted to positive safe integers.

A call then carries an eight-byte parent task ID (zero for admitted execution requests, a positive safe integer for worker-originated child submissions), module URL, export name, canonical schema text, three UInt32 limits (data bytes, depth, nodes), and the argument payload. Strings use the encoding above. There is no argument count in the payload: the schema supplies it. A reply carries the canonical schema text and either a typed result or bounded error name/message, a one-byte optional-stack marker, and an optional stack string.

Decoders reject unknown versions, wrong kinds, truncated or trailing bytes, invalid lengths, invalid boolean/union markers, and mismatched reply identities. Node and depth limits are enforced during decoding, including arrays of zero-byte values. Limits cannot exceed 64 MiB of payload, depth 256, or one million nodes. Defaults remain 8 MiB, depth 64, and 100,000 nodes. The existing runtime snapshot budget still applies separately.

Envelopes allow at most 128 KiB of additional frame bytes. Module URLs, export names, schema text, and error strings have individual bounds. Schemas are limited to 256 arguments, 1,024 type nodes, depth 32, 64 alternatives per union, 256 fields per record, and 16,384 text code units. Each encoded frame owns an exact-sized buffer; the Sia shared unsafe buffer is never used. Malformed requests terminate the worker, and malformed replies retire it through the existing worker-failure path. Neither case silently retries an already dispatched task.

These are local trusted-module compatibility checks, not authentication or a remote-execution sandbox. A schema identity does not identify a source revision whose signature stayed the same.

## Child routing

Workers assign monotonically increasing local IDs to child submissions and attach the active parent execution ID. The central adapter validates the parent, inherited limits, frame version, complete schema, and request ID before admission. The scheduler assigns a separate execution ID and routes the task to an idle worker or cooperatively back to its submitting worker. Results are validated against the execution schema, then re-encoded under the submitting worker's child request ID. Worker-side decoding checks that ID and schema again. Even same-process child execution takes this full Sia path through the scheduler.

Multiple execution frames may coexist in one process. Adapters route by a validated frame header and always decode the entire frame before using its payload; reading a header alone is not validation. Unknown parents, repeated child IDs, altered limits, unexpected replies, and malformed frames fail the affected tree. Root deadlines and cancellation remain scheduler concerns and cover every descendant.

## Compatibility and remaining work

`runBunProgram` requires schemas and rejects older generated artifacts (including v1 and v2 frames): rebuild them. The explicit JavaScript worker-pool API without a schema retains its existing structured-data IPC path for compatibility. It is separate from compiled parallel calls and is never selected after a schema or codec failure. A schema-bearing low-level task uses the Sia path and must target a module with a matching manifest.

Negotiation across wire versions, function-local task closures, and recursive record schemas remain future work. The current generated code and codec are verified under Bun, including execution of built artifacts outside the workspace, and through the [browser adapter](browser-runtime.md) in Chromium.

## Authenticated network envelope

The [Bun remote runtime](network-execution.md) carries v3 Sia frames inside HTTP control protocol v2. It requires bearer authentication, validates deployment revisions and schemas, and maps service IDs to server-owned modules. Reservation and cancellation control messages stay outside the Sia application payload. Cancellation acknowledgement waits for the owned worker pool to close. Source and bundled loopback acceptance pass; TLS/proxy and broader remote workload coverage remain pending.
