# Apple GPU reduction parameter packing — 2026-10-16

The managed reduction runtime now packs all immutable tree-level count words into one shared Metal buffer on Apple-family GPUs. Each dispatch binds a distinct offset; the buffer remains retained until command acknowledgement. There is no rewrite of a word that an earlier dispatch may still read. Other GPU families keep the previous separate offset-zero count buffers.

## Storage and alignment

[Metal's constant-buffer binding rules](https://developer.apple.com/documentation/metal/mtlcomputecommandencoder/setbuffer%28_%3Aoffset%3Aindex%3A%29) require hardware-dependent offset alignment. [Apple's feature tables](https://developer.apple.com/metal/Metal-Feature-Set-Tables.pdf) specify four-byte alignment for Apple GPU families. The runtime checks `supportsFamily(MTLGPUFamilyApple1)` before packing. Shader reflection still checks its existing four-byte ABI; reflection alone does not establish hardware offset support. Non-Apple packing has not been qualified and remains disabled.

For a 65-element reduction, seven tree levels share 28 bytes of parameter storage. Two private scratch buffers and the four-byte scalar readback remain separate:

| Resource, excluding the retained input          |          Before |          Packed |
| ----------------------------------------------- | --------------: | --------------: |
| Temporary Metal buffers, 65 elements            |              10 |               4 |
| Shared parameter/readback buffers, 65 elements  |               8 |               2 |
| Temporary requested payload, 65 elements        |       232 bytes |       232 bytes |
| Temporary Metal buffers, 1,048,576 elements     |              23 |               4 |
| Temporary requested payload, 1,048,576 elements | 3,145,812 bytes | 3,145,812 bytes |

These are runtime wrapper counts and requested payload bytes, not driver allocation counts, physical GPU memory or RSS. Empty input submits no command. Singleton input allocates no count buffer and preserves exact scalar bits. The existing one-encoder serial tree, two alternating outputs, strict binary32 arithmetic, odd-element carry, row-major order and scalar-only readback are unchanged. All fallible storage preparation still completes before opening the compute encoder.

## Matched warm comparison

[Raw observations](native-gpu-2026-10-16-reduction-parameters.json) compare `0240ec8` with the packed runtime on Apple M2 Max, macOS 26.5. The earlier Metal runtime is rebuilt against the same harness, task core, CPU LLVM and shader bundle. Both sides retain the same adaptive matmul profile (`--baseline-adaptive-matmul`). Compilation, runtime/pipeline setup, input generation and reference calculation are excluded.

Three fresh process pairs alternate baseline/current, current/baseline and baseline/current. Workloads and modes use matched shuffled orders, five excluded warmups and twenty-one timed samples per process: **4,536 timed calls and 1,080 warmups** across both runtimes. Every call validates results, immutable inputs and resource retirement. This is native AOT execution, with no JIT, sanitizer, Metal validation or profiling injection in performance builds. Timing runs do not overlap conformance tests.

The million-element resident call improves from **0.4739 to 0.4195 ms** (1.13×); its transfer-inclusive call improves from **1.1420 to 1.0795 ms** (1.06×). All four measured resident reduction sizes show speedups of 1.08–1.13×. Transfer-inclusive speedups range from 1.01–1.08×. These are local warm observations, not a universal speedup, cold-start claim or automatic CPU/GPU placement threshold.

All results, including unchanged controls and regressions, follow. Times are milliseconds, median of the three process medians:

| Workload         | Mode      | Before | Packed |
| ---------------- | --------- | -----: | -----: |
| matmul-256       | cpu       | 2.0742 | 2.0704 |
| matmul-256       | device    | 2.4457 | 2.4465 |
| matmul-256       | resident  | 2.4789 | 2.4720 |
| matmul-256       | transfers | 2.9316 | 2.9273 |
| matmul-32        | cpu       | 0.0058 | 0.0060 |
| matmul-32        | device    | 0.2431 | 0.2390 |
| matmul-32        | resident  | 0.2483 | 0.2461 |
| matmul-32        | transfers | 0.6281 | 0.6269 |
| matmul-8         | cpu       | 0.0008 | 0.0009 |
| matmul-8         | device    | 0.2100 | 0.2042 |
| matmul-8         | resident  | 0.2195 | 0.2178 |
| matmul-8         | transfers | 0.6015 | 0.6004 |
| matmul-96        | cpu       | 0.1119 | 0.1137 |
| matmul-96        | device    | 0.3905 | 0.3930 |
| matmul-96        | resident  | 0.3964 | 0.3979 |
| matmul-96        | transfers | 0.8148 | 0.8134 |
| matmul-deep-tail | cpu       | 0.3398 | 0.3375 |
| matmul-deep-tail | device    | 1.4107 | 1.3956 |
| matmul-deep-tail | resident  | 1.3962 | 1.3902 |
| matmul-deep-tail | transfers | 1.7954 | 1.8066 |
| sum-1048576      | cpu       | 1.5082 | 1.5340 |
| sum-1048576      | device    | 0.3202 | 0.3098 |
| sum-1048576      | resident  | 0.4739 | 0.4195 |
| sum-1048576      | transfers | 1.1420 | 1.0795 |
| sum-4097         | cpu       | 0.0078 | 0.0077 |
| sum-4097         | device    | 0.2085 | 0.2097 |
| sum-4097         | resident  | 0.2616 | 0.2320 |
| sum-4097         | transfers | 0.4456 | 0.4134 |
| sum-64           | cpu       | 0.0004 | 0.0004 |
| sum-64           | device    | 0.1990 | 0.1975 |
| sum-64           | resident  | 0.2378 | 0.2195 |
| sum-64           | transfers | 0.4268 | 0.3967 |
| sum-65536        | cpu       | 0.0995 | 0.0990 |
| sum-65536        | device    | 0.2214 | 0.2327 |
| sum-65536        | resident  | 0.3002 | 0.2732 |
| sum-65536        | transfers | 0.5000 | 0.4940 |

`resident` includes managed preparation/allocation, task/command execution, scalar observation and group retirement, with inputs already uploaded. `transfers` also uploads the existing host tensor. Returned-result deallocation and numerical checking follow timing. CPU calls, matmul paths and direct Metal reduction commands are unchanged controls. Their variation is retained; for example direct sum-65536 wall time increases from 0.2214 to 0.2327 ms. The direct reduction harness uses preallocated distinct outputs and separate encoders; it does **not** measure managed parameter packing. Raw GPU command timestamps are retained separately. No arithmetic shader speedup is claimed.

## Qualification

The four reduction variants (debug, optimized, host ASan/UBSan and host TSan) each pass **653 CPU/GPU/APFloat cases over 4,070,261 input elements**, with zero mismatches. Coverage includes rank-one and rank-two shapes, row-crossing pairs, odd tails, subnormals, signed zeros, nonfinite values and exact singleton payloads. Metal API validation exercises the nonzero count offsets.

Both ranks sweep every explicit allocation/encoder preparation checkpoint: **13 per rank**, down from 25 before packing. Held commands assert all 232 temporary payload bytes and four temporary buffers remain live until acknowledgement. Cancellation, deadlines, failed completion, pending-core destruction, concurrent independently owned vector/matrix invocations, byte/in-flight budgets and the exact 1,024-byte admission boundary remain checked. Host sanitizers do not establish GPU race detection or driver allocation coverage.

Full-suite results and source/artifact hashes are recorded in [qualification evidence](../../native/metal-proof/evidence/gpu-reduction-parameters-2026-10-16.json). Reproduce the timing protocol using [the benchmark instructions](../../native/benchmarks/README.md). The two-tensor/eight-scalar entry limit (GPU-ABI-001), general source composition and wider arithmetic remain separate work.
