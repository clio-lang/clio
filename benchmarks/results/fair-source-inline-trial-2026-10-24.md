# Equivalent source algorithm comparison

Same binary recursive traversal and leaf computation; all actual inputs fit int64 and dyadic results are exact float64. No tensor/reduction/matrix built-ins or numerical libraries. Kalandra includes checked arithmetic, invocation admission/cancellation and call-depth checks; other runtimes retain their default semantics. C++/Rust/Go may optimize recursion normally. No GPU general recursion support; GPU entries are unsupported, not replaced by built-ins.

Three fresh processes per cell, two warmups and seven measured batches; median of process medians. Setup and process startup excluded; function execution and normal runtime overhead included. All warmup/measured checksums match independent integer/Fraction or standard GCD references exactly.

| Algorithm | Depth / leaves | Kalandra µs | C++ µs | Go µs | Rust µs | Python µs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| polynomial | 10 / 1,024 | 6.215 | 2.446 | 2.158 | 2.560 | 128.715 |
| polynomial | 14 / 16,384 | 96.829 | 38.719 | 34.603 | 41.612 | 2096.335 |
| branches | 10 / 1,024 | 6.079 | 3.070 | 3.310 | 3.082 | 145.947 |
| branches | 14 / 16,384 | 97.612 | 49.819 | 53.083 | 49.752 | 2389.312 |
| euclid | 10 / 1,024 | 29.727 | 7.517 | 9.710 | 8.934 | 434.681 |
| euclid | 14 / 16,384 | 518.680 | 120.679 | 160.285 | 162.156 | 6974.531 |

This is a narrow source/runtime benchmark, not a language-wide ranking. Safety checks, tail-call optimization, interpreter overhead and runtime invocation costs are intrinsic differences and are disclosed rather than artificially disabled. GPU is unsupported for these recursive source algorithms. Raw samples, commands, versions and hashes are in the adjacent JSON.
