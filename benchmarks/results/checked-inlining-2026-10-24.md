# Bounded checked-call inlining

One compiler-controlled inlining level reduces the polynomial/branch recursive workloads by about 20–22% in the interleaved before/after control. GCD changes by roughly 1–2%, which is too small to treat as a substantial gain. The Rust/C++ 10% target remains unmet. All source algorithms, checked arithmetic and cancellation rules remain enabled.

## Matched before/after control

The baseline executable was frozen from the source committed as `23c30fcb`; its hash matches the earlier tail-versioned benchmark. Both versions compile the same source and link the same byte-identical optimized runtime archive with the same Clang flags. At depth 14 (16,384 leaves), twelve cells interleave baseline/current and unbound/bound cancellation tokens over three fresh processes: five measured and two warmup batches per process. Every checksum matches an independent integer/Fraction/GCD reference. Token binding and normal invocation lifecycle are included.

| Algorithm | Token | Before µs | After µs | Time reduction | Speedup |
| --- | --- | ---: | ---: | ---: | ---: |
| polynomial | unbound | 121.759 | 97.299 | 20.1% | 1.251× |
| polynomial | bound | 123.085 | 96.718 | 21.4% | 1.273× |
| branches | unbound | 123.558 | 98.316 | 20.4% | 1.257× |
| branches | bound | 125.023 | 97.906 | 21.7% | 1.277× |
| euclid | unbound | 522.266 | 515.157 | 1.4% | 1.014× |
| euclid | bound | 825.732 | 814.114 | 1.4% | 1.014× |

[Raw matched samples, commands and hashes](checked-inlining-controls-2026-10-24.json). These controls qualify this compiler change; they do not compare different languages. Thermal/frequency behavior is not pinned, and small differences remain measurement noise.

## Equivalent source comparison

Fresh five-language results retain the same recursive algorithms. No tensor built-ins or numerical libraries substitute for source-level computation. Kalandra retains its safety/cancellation checks; other languages retain their normal runtime semantics. All 180 edge/reference workloads and all measured/warmup checksums pass.

| Algorithm / 16,384 leaves | Kalandra µs | C++ µs | Rust µs | Go µs | Python µs |
| --- | ---: | ---: | ---: | ---: | ---: |
| polynomial | 97.765 | 38.444 | 41.585 | 35.248 | 2116.400 |
| branches | 97.728 | 49.465 | 50.042 | 53.082 | 2384.176 |
| euclid | 518.949 | 122.163 | 159.292 | 160.944 | 6997.943 |

[Full depth-10/depth-14 report](fair-source-inlined-2026-10-24.md) and [raw evidence](fair-source-inlined-2026-10-24.json). The [initial inlining trial](fair-source-inline-trial-2026-10-24.md) is retained separately; it preceded the static-shape fix and final qualification. No GPU speedup is attributed to this source-call change; these recursive programs have no supported general GPU lowering.

## Semantics and stack boundary

The compiler snapshots eligible scalar bodies, tries at most four original direct call sites and one recursive expansion level, then adopts a private candidate only if it fits the unchanged 16 KiB conservative stack budget. Bodies with loops, frame allocations, aggregate signatures or more than 250 instructions do not qualify. Every inlined logical entry, leave and post-call poll remains checked. Logical depth stays 128; physical stack reserve stays 128 KiB. Existing source function identity/linkage and downstream noinline boundaries remain. Oversized candidates fall back to the accepted original body. Module order cannot repeatedly amplify candidates.

The inlining test explicitly checks retained admission/poll calls, bounded recursive expansion, reversed module order and an oversized candidate that must preserve the original calls. The broader execution tests compare observed values/status/location/poll counts/depth against the frozen baseline.

## Verification

- **93 regression groups passed** on the final compiler: invocation, source/worker recursion, continuations, callable/record/string/collection ownership, parallel maps, conversions, stack guards, arithmetic policies, CPU matrix cells and physical Metal optimization controls.
- **389,904 current-side differential/reference cases passed**, paired with the pushed baseline, across hardware/software arithmetic and debug, optimized, ASan/UBSan and TSan builds. Coverage includes floating recursive sums, signed zero, subnormals, infinities/NaNs, checked conversion/division faults, fault priority, settled contexts, observed poll counts, logical depth limits, host admissions, immediate/asynchronous cancellation, migration and low native stacks.
- **160 generated function/build/policy frame records audited**, with a conservative maximum of **832 bytes**. This audit sums static negative SP adjustments, including mutually exclusive ones; its broader function scope differs from the earlier GCD-only audit.
- **40 static-shape controls passed**: float32/float64 small/rectangular and packed matrices, fused vector reductions and empty vectors, in all four build modes.
- **All runnable documentation examples passed**, including 32 CPU programs, two physical Metal programs, companion modules and the expected diagnostic across 20 pages/63 rendered code blocks.
- The independent numerical source references and arithmetic tree contracts remain unchanged. No new floating arithmetic reassociation, FMA, type demotion or software fallback was introduced.

[Qualification records, logs and source/compiler hashes](checked-inlining-validation-2026-10-24.json), [machine frame audit](checked-inlining-stack-audit-2026-10-24.json), and [design and invariants](../../docs/design/checked-call-optimization.md#budgeted-checked-call-inlining).

## Static tensor correction and hosted status

The first pushed snapshot passed hosted Windows qualification and website checks, but Linux documentation execution caught a real mismatch: optimized tensor-to-buffer extraction used dynamic buffer dimensions for statically shaped tensor values. The docs’ 1×2 by 2×1 matrix product reproduced the failure locally. Buffer extraction now preserves the actual tensor shape and retains dynamic stride metadata. Matrix packing/reinterpretation still follows the checked layout path. The same static matrix/fused-reduction cases are added to downloaded Linux/Windows package acceptance.

The packed static fixture constructs its values at runtime; an initial giant literal correctly exceeded the unchanged source stack budget and was replaced without weakening admission. New hosted Linux/Windows/macOS qualification will run after this follow-up is pushed; local macOS results do not claim fresh remote platform or notarization success.

## Remaining bottleneck

The final five-language source cases remain about 2–4× slower than C++ and about 2–3.3× slower than Rust. Inlining removes some physical call overhead, while logical admission, recursive bookkeeping and checked scalar arithmetic still execute. GCD remains dominated by remainder work and checked execution. Further optimization needs profiling and proofs that retain the observable checks; increasing the inlining budget or removing admission is not a parity result.
