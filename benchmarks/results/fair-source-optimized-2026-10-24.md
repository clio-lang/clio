# Equivalent source algorithm comparison

Same binary recursive traversal and leaf computation; all actual inputs fit int64 and dyadic results are exact float64. No tensor/reduction/matrix built-ins or numerical libraries. Kalandra includes checked arithmetic, invocation admission/cancellation and call-depth checks; other runtimes retain their default semantics. C++/Rust/Go may optimize recursion normally. No GPU general recursion support; GPU entries are unsupported, not replaced by built-ins.

Three fresh processes per cell, two warmups and seven measured batches; median of process medians. Setup and process startup excluded; function execution and normal runtime overhead included. All warmup/measured checksums match independent integer/Fraction or standard GCD references exactly.

| Algorithm | Depth / leaves | Kalandra µs | C++ µs | Go µs | Rust µs | Python µs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| polynomial | 10 / 1,024 | 7.664 | 2.401 | 2.136 | 2.541 | 126.663 |
| polynomial | 14 / 16,384 | 121.598 | 38.241 | 34.217 | 40.800 | 2055.505 |
| branches | 10 / 1,024 | 7.620 | 3.045 | 3.231 | 3.024 | 143.021 |
| branches | 14 / 16,384 | 120.591 | 48.739 | 51.757 | 48.867 | 2358.321 |
| euclid | 10 / 1,024 | 55.793 | 7.192 | 9.501 | 8.703 | 430.959 |
| euclid | 14 / 16,384 | 900.626 | 118.606 | 157.436 | 155.040 | 6921.656 |

This is a narrow source/runtime benchmark, not a language-wide ranking. Safety checks, tail-call optimization, interpreter overhead and runtime invocation costs are intrinsic differences and are disclosed rather than artificially disabled. GPU is unsupported for these recursive source algorithms. Raw samples, commands, versions and hashes are in the adjacent JSON.
