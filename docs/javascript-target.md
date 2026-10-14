# JavaScript target

Kalandra can now compile a useful subset of Clio to native JavaScript ESM with source maps. Collection operations, formatted strings, and record/list declarations, and decorators are now executable. The complete language and distributed runtime are still in progress.

## Try it

```sh
bun run cli compile examples/fibonacci.kalandra -o dist/examples/fibonacci.mjs
bun dist/examples/fibonacci.mjs
```

The generated module prints `89`. The compiler reports a warning for `console`, which is a host global rather than a declared language binding. Compilation does not execute the source. The second command executes the JavaScript under Bun.

Without `-o`, the command writes JavaScript with an inline source map to stdout. With `-o`, it writes the requested module plus a `.map` sidecar and a source-map URL. Diagnostics go to stderr. Syntax, semantic, or unsupported-feature errors produce no JavaScript and leave existing output files untouched. File-writing failures are reported separately; writing the JavaScript and sidecar is not an atomic two-file transaction.

`--strict` makes unresolved names errors, matching the analysis API. This flag checks lexical resolution; it does not make gradual analysis a proof of runtime safety.

## API and architecture

```ts
import { compile } from "@kalandra/compiler";

const result = compile({
  path: "double.kalandra",
  text: "export fn double x: x * 2",
});

if (result.output) {
  const { code, sourceMap } = result.output;
  // The host chooses where to save, load, or display them.
}
```

The pipeline is now source → Chevrotain CST → independent AST → semantic model → typed intermediate representation → Babel AST → ESM and source maps.

The IR normalizes calls, pipe argument insertion, quick functions, implicit returns, and statement-level bindings. Its nodes retain source spans and semantic types, including `Any` where inference is partial. It contains neither Chevrotain nor Babel nodes. `lower(program, model)` is also available to tooling; pass it a semantic model from an analysis with no errors. The compiler entry point enforces that boundary automatically.

Only the emitter depends on Babel. Local bindings receive generated identifiers that avoid source-name collisions and JavaScript reserved words; original names remain in source maps and export names. Maps embed the original source and use UTF-16 columns, including CRLF input. Comments remain in source content but are not reproduced in generated code.

## Supported subset

| Area         | Executable behavior                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Values       | Finite numeric, string, Boolean, and null literals; arrays, sets, hashmaps, member access                          |
| Expressions  | Arithmetic and powers, strict equality, comparison chains, logical operators, negation, grouping                   |
| Bindings     | Ordinary and typed local assignments; property and indexed writes; statement-level flow bindings and chained pipes |
| Functions    | Named and nested functions, lexical closures, recursion, grouped quick functions, implicit returns                 |
| Control flow | Conditionals and implicit returns from their final branches; JavaScript short-circuit evaluation                   |
| Calls        | Whitespace calls, empty call groups, member calls, receiver-style method calls, ordinary pipes                     |
| Async        | Ordinary `await`, `[await]`, awaited pipes, async functions/quick functions, top-level await                       |
| Collections  | Ranges, lazy range maps, array maps, bracket indexing, and the explicit `slice` helper                             |
| Formatting   | Default `f` formatting and custom tags, interpolations, and ordinary escapes                                       |
| Types        | Record constructors, inheritance, list descriptors, and exports of declared types                                  |
| Modules      | Native ESM exports; local imports through project builds; explicit ESM/CommonJS package imports                    |

Function calls retain JavaScript's permissive arity. Comparison chains retain the old emitter's repeated evaluation of middle operands and short-circuiting. Property assignments in return/flow position read the stored property, matching Clio's setter/getter behavior. Negative literals on the left of exponentiation receive the parentheses required by JavaScript.

### Explicitly deferred

The target reports `KAL4001` and emits no module for unresolved local single-file imports, parallel execution/handles in single-file compilation (project builds support module-level targets, typed captures, and nested scheduling), collection membership, unavailable runtime builtins, standalone method references, empty bracket indexing, bindings in unsupported expression contexts (such as logical operands), formatted Unicode/hex/numeric escapes that the old emitter cannot reliably generate, and duplicate `__proto__` hashmap entries (which JavaScript rejects). Some of these need only further lowering work; others require the runtime or module system. None is silently replaced with a stub.

`KAL4002` rejects unresolved external names that cannot be emitted as valid JavaScript identifiers. Local names can use JavaScript reserved words because they are renamed during emission.

## Collection and type compatibility

```kalandra
fn double x: x * 2
values = 0..5 -> * double
console.log (values.toArray ())
```

Array maps are eager; range maps are lazy. With no explicit arguments, an ordinary map passes the callback directly. With explicit arguments, the callback receives the item, explicit arguments, index, and collection; explicit arguments are evaluated for each item. Receiver-style methods receive only explicit arguments. `await` waits for the map result; `[await]` collects its promises into an array, including for range inputs.

The committed Clio emitter implements brackets as JavaScript property lookup: `arr[0..3]` looks up the range's string key, and multiple indices evaluate left to right and use the final one. Use `slice arr (0..3)` for the old runtime's collection slicing. The analyzer reflects bracket lookup rather than inferring a sliced array.

Indexed assignments such as `items[index] = value`, `matrix[0][1] = value`, and `value => items[index] -> consume` use the same property-lookup rules. Multiple indices evaluate left to right and the last is the key; range indices are string keys, not bulk updates. Typed array element mismatches fail analysis. An ordinary assignment statement writes without reading back. An implicit return or continued pipe re-evaluates the target and reads its stored value, preserving the old emitter's accessor behavior and repeated evaluation of index expressions. Empty brackets and bindings inside index expressions remain unsupported.

Try `bun run cli run examples/indexed-assignment.kalandra --strict`: the worker updates its array snapshot and returns `[2, 42]`, showing that the parent's original element is unchanged. Dynamic writes through aliases remain rejected when the affected array crosses a Sia boundary.

Historical range/slice behavior remains deliberate at this stage: descending ranges iterate empty; range length uses floor; `get` allows the end value; map callbacks also run at the iterator's stopping point; negative slice indices use the old `length - index` calculation; range slicing can include an out-of-bounds `undefined`. Open ranges must be bounded before fully collecting them. Tests preserve these behaviors so improvements can later be intentional changes.

Formatted strings call their tag with individual text, escape, and interpolation arguments. Empty interpolation supplies `null`; an empty format has no arguments. The default `f` converts each argument to text, including `null` and `undefined`. Custom tags may return any value.

Records take their own fields before inherited fields. Derived classes retain the old inherited `members` getter behavior. Lists are runtime arrays containing their member-type descriptor, not callable constructors. Decorators apply from the bottom upward; each receives its explicit arguments followed by the function. Member decorators retain their receiver. `describe`, `params`, `returns`, `check`, `help`, and the `Any` marker are available.

The original compiler emits `includes(value, collection)` for membership, but the pinned runtime does not supply that helper. Membership stays a diagnostic until its intended behavior is settled.

Standalone output embeds a small compatibility helper bundle only when a supported runtime helper needs it. Its trusted JavaScript is parsed into Babel nodes; the compiler never evaluates source code. Helper mappings point to `kalandra:compatibility-helpers.js`, separately from the user's source. Single-file compilation has per-module helper identity. [Project builds](project-build.md) use one shared helper module so ranges and `Any` interoperate across the graph.

Decorator helpers retain their original behavior: `@check` checks the immediate return value rather than awaiting a promise; supplied arguments without matching parameter descriptors can throw; the old runtime does not special-case the `Any` symbol. To map a checked single-argument function, use a quick wrapper such as `items -> * (double @item)` so map metadata is not passed to the checked function. These are compatibility constraints, not newly designed type rules. Custom decorators may change runtime values beyond what gradual analysis can infer.

Bindings inside array/set elements, call arguments, arithmetic operands, and property-access bases are lifted ahead of the containing statement. Lifted bindings run left to right before ordinary operand effects: `(read 1) + (read 2 => value)` calls `read 2` first. Bound names remain available afterward in the enclosing scope. Arithmetic supports bindings on either or both sides; this also fixes the old emitter’s failure when it spread a missing one-sided declaration list. In mapped arguments, a binding runs once before mapping, even for an empty array, while ordinary argument expressions still run per item. Bindings in logical/comparison operands, negation, conditional tests, and index expressions still produce diagnostics. So do bindings in mapped call targets when extra arguments are supplied. Their evaluation and declaration propagation are tracked in the [language design backlog](language-design-backlog.md). Call-target bindings are supported for direct calls, ordinary pipes, and mapped pipes without extra arguments. Target bindings run before argument bindings (including a pipe input); property targets retain their method receiver. See `examples/expression-bindings.kalandra` for supported arithmetic, property-access, and call-target bindings.

## Module boundary and compatibility

Output uses native ESM exports. Unlike Clio's saved output, it is not an async factory accepting a runtime object, and ordinary functions are not registered for remote calls. Consumers import the generated module normally. A function named `main` is exported only if the source says so and is not automatically invoked. Top-level statements execute on module import.

This is a new compiler-host boundary, not a claim of compatibility with old generated `.clio.js` modules. Runtime-dependent forms are gated until that integration is implemented. Direct self-calls in return position now use a loop for synchronous and async named functions, including decorated declarations, conditional branches and pipes. Arguments evaluate left to right before the next iteration; each iteration gets fresh lexical parameter and local bindings so escaped closures retain their values. Missing arguments become undefined and extra arguments still evaluate. Explicitly awaited self-calls (`await self ...`), mutual, indirect, and non-tail recursion retain ordinary calls. Async loops preserve source-level suspension points and return a Promise; they do not insert a yield between iterations that contain no await. The emitter does not yet preserve all old function registration/metadata or corner cases involving binding evaluation inside expressions.

Run `bun run cli run examples/tail-recursion.kalandra --strict` for a 100,000-step sum without stack growth. The async counterpart, `examples/async-tail-recursion.kalandra`, returns the same `5000050000` through a Promise. This follows the pinned Clio emitter: `checkRecursive`/`recursiveReturn` recognize direct tail calls independently of the function emitter's `needsAsync` flag. Tests exercise deep recursion, explicit suspension points, concurrent invocations, retained closures, argument effects and rejection identity.

## Evidence

- Of the 177 positive reference fixtures, 146 currently emit JavaScript accepted by Bun's JavaScript parser. The remaining 31 receive explicit unsupported-feature diagnostics in single-file mode. The [project-context audit](compatibility-audit.md) classifies all of them: 18 execute with documented context/migration, three are strict-boundary rejections, two preserve historical runtime failures, four need membership semantics and four need remote transports.
- Saved-output differential tests execute trusted JavaScript saved from the old emitter and compare its results with freshly compiled Kalandra programs. This tests behavior rather than generated formatting; it does not run the old compiler.
- Additional execution tests cover closures, recursion, quick functions, evaluation order, method receivers, assignments, async forms, exports, identifier hygiene, and range/slice helpers captured from the same upstream commit.
- Source-map tests decode actual mappings and verify original locations, names, source text, and CRLF/Unicode handling. CLI tests load generated files and check sidecar links and error behavior.
- The [real-browser harness](browser-verification.md) passes nine checks in Chromium, including compilation and generated ESM execution in a module worker. The [browser runtime adapter](browser-runtime.md) also has real Chromium checks; other browser engines remain unverified.

## Next

Follow the [verified implementation queue](port-completion.md). Decorated direct self-tail calls now match executed pinned Clio output, including a single custom-wrapper invocation around a deep loop. Local emitter behavior is now implemented and tested against the pinned runtime. The next task is the historical distributed-runtime probe. Expression-binding, membership and await semantics remain deferred; browser workers and explicit JavaScript declarations are already implemented.

## Local events

`emitter ()` creates a local event emitter with `on`, `off`, `emit` and `emitUnless`. Each method returns the emitter. Exact listeners receive the emitted arguments; regex listeners receive the event name first, followed by those arguments. Exact listeners run before regex listeners. Dispatch is synchronous and does not await returned promises; thrown listener errors stop dispatch and propagate. Duplicate registrations are retained, and `off` removes every matching callback for that event or regex text. `emitUnless` excludes that callback for one dispatch.

`examples/local-events.kalandra` runs independent emitters inside managed workers and returns `[6, 14]`. Emitters are live local objects, not declared records, so passing or returning one across a worker or remote boundary still fails strict type checking. This does not implement distributed event subscription.

The portable helper retains the old 64-character base-36 ID shape and listener tables. Regex text is reconstructed with `RegExp` instead of evaluated as JavaScript; manually injecting executable text into internal tables is not supported. The old runtime's unused Node `AsyncResource` allocation is replaced by `resource = null`, keeping the helper usable without Node imports. These host details do not change listener dispatch. Prototype-key failures in the historical plain-object listener tables are retained and tracked as LC-007 for the later design phase.
