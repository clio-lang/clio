# Equivalent source algorithm comparison

Same binary recursive traversal and leaf computation; all actual inputs fit int64 and dyadic results are exact float64. No tensor/reduction/matrix built-ins or numerical libraries. Kalandra includes checked arithmetic, invocation admission/cancellation and call-depth checks; other runtimes retain their default semantics. C++/Rust/Go may optimize recursion normally. No GPU general recursion support; GPU entries are unsupported, not replaced by built-ins.

Three fresh processes per cell, two warmups and seven measured batches; median of process medians. Setup and process startup excluded; function execution and normal runtime overhead included. All warmup/measured checksums match independent integer/Fraction or standard GCD references exactly.

| Algorithm | Depth / leaves | Kalandra µs | C++ µs | Go µs | Rust µs | Python µs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| polynomial | 10 / 1,024 | 7.858 | 2.432 | 2.184 | 2.595 | 130.714 |
| polynomial | 14 / 16,384 | 126.829 | 40.059 | 34.942 | 41.460 | 2108.165 |
| branches | 10 / 1,024 | 7.741 | 3.108 | 3.297 | 3.191 | 148.432 |
| branches | 14 / 16,384 | 122.824 | 49.869 | 53.020 | 50.596 | 2443.274 |
| euclid | 10 / 1,024 | 30.261 | 7.672 | 10.109 | 9.480 | 452.501 |
| euclid | 14 / 16,384 | 522.011 | 126.534 | 164.442 | 168.338 | 7129.386 |

This is a narrow source/runtime benchmark, not a language-wide ranking. Safety checks, tail-call optimization, interpreter overhead and runtime invocation costs are intrinsic differences and are disclosed rather than artificially disabled. GPU is unsupported for these recursive source algorithms. Raw samples, commands, versions and hashes are in the adjacent JSON.
