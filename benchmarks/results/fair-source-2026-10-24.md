# Equivalent source algorithm comparison

Same binary recursive traversal and leaf computation; all actual inputs fit int64 and dyadic results are exact float64. No tensor/reduction/matrix built-ins or numerical libraries. Kalandra includes checked arithmetic, invocation admission/cancellation and call-depth checks; other runtimes retain their default semantics. C++/Rust/Go may optimize recursion normally. No GPU general recursion support; GPU entries are unsupported, not replaced by built-ins.

Three fresh processes per cell, two warmups and seven measured batches; median of process medians. Setup and process startup excluded; function execution and normal runtime overhead included. All warmup/measured checksums match independent integer/Fraction or standard GCD references exactly.

| Algorithm | Depth / leaves | Kalandra µs | C++ µs | Go µs | Rust µs | Python µs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| polynomial | 10 / 1,024 | 25.563 | 2.422 | 2.193 | 2.595 | 133.309 |
| polynomial | 14 / 16,384 | 398.228 | 39.558 | 34.253 | 42.084 | 2080.207 |
| branches | 10 / 1,024 | 27.091 | 3.071 | 3.302 | 3.064 | 145.332 |
| branches | 14 / 16,384 | 437.097 | 49.133 | 53.530 | 49.249 | 2384.135 |
| euclid | 10 / 1,024 | 140.692 | 7.466 | 9.410 | 8.811 | 445.828 |
| euclid | 14 / 16,384 | 2251.964 | 122.387 | 163.057 | 159.448 | 6978.298 |

This is a narrow source/runtime benchmark, not a language-wide ranking. Safety checks, tail-call optimization, interpreter overhead and runtime invocation costs are intrinsic differences and are disclosed rather than artificially disabled. GPU is unsupported for these recursive source algorithms. Raw samples, commands, versions and hashes are in the adjacent JSON.
