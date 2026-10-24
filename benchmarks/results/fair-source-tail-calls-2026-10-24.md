# Equivalent source algorithm comparison

Same binary recursive traversal and leaf computation; all actual inputs fit int64 and dyadic results are exact float64. No tensor/reduction/matrix built-ins or numerical libraries. Kalandra includes checked arithmetic, invocation admission/cancellation and call-depth checks; other runtimes retain their default semantics. C++/Rust/Go may optimize recursion normally. No GPU general recursion support; GPU entries are unsupported, not replaced by built-ins.

Three fresh processes per cell, two warmups and seven measured batches; median of process medians. Setup and process startup excluded; function execution and normal runtime overhead included. All warmup/measured checksums match independent integer/Fraction or standard GCD references exactly.

| Algorithm | Depth / leaves | Kalandra µs | C++ µs | Go µs | Rust µs | Python µs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| polynomial | 10 / 1,024 | 7.837 | 2.447 | 2.185 | 2.619 | 129.232 |
| polynomial | 14 / 16,384 | 124.220 | 39.239 | 35.021 | 41.837 | 2114.508 |
| branches | 10 / 1,024 | 7.796 | 3.123 | 3.311 | 3.122 | 147.354 |
| branches | 14 / 16,384 | 123.230 | 50.143 | 53.128 | 50.021 | 2415.142 |
| euclid | 10 / 1,024 | 33.770 | 7.589 | 9.630 | 9.001 | 440.282 |
| euclid | 14 / 16,384 | 562.352 | 124.590 | 163.642 | 161.056 | 7093.595 |

This is a narrow source/runtime benchmark, not a language-wide ranking. Safety checks, tail-call optimization, interpreter overhead and runtime invocation costs are intrinsic differences and are disclosed rather than artificially disabled. GPU is unsupported for these recursive source algorithms. Raw samples, commands, versions and hashes are in the adjacent JSON.
