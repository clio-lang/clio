# Equivalent source algorithm comparison

Same binary recursive traversal and leaf computation; all actual inputs fit int64 and dyadic results are exact float64. No tensor/reduction/matrix built-ins or numerical libraries. Kalandra includes checked arithmetic, invocation admission/cancellation and call-depth checks; other runtimes retain their default semantics. C++/Rust/Go may optimize recursion normally. No GPU general recursion support; GPU entries are unsupported, not replaced by built-ins.

Three fresh processes per cell, two warmups and seven measured batches; median of process medians. Setup and process startup excluded; function execution and normal runtime overhead included. All warmup/measured checksums match independent integer/Fraction or standard GCD references exactly.

| Algorithm | Depth / leaves | Kalandra µs | C++ µs | Go µs | Rust µs | Python µs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| polynomial | 10 / 1,024 | 6.102 | 2.446 | 2.164 | 2.571 | 129.969 |
| polynomial | 14 / 16,384 | 97.765 | 38.444 | 35.248 | 41.585 | 2116.400 |
| branches | 10 / 1,024 | 6.145 | 3.096 | 3.297 | 3.096 | 145.276 |
| branches | 14 / 16,384 | 97.728 | 49.465 | 53.082 | 50.042 | 2384.176 |
| euclid | 10 / 1,024 | 29.359 | 7.505 | 9.759 | 8.953 | 437.150 |
| euclid | 14 / 16,384 | 518.949 | 122.163 | 160.944 | 159.292 | 6997.943 |

This is a narrow source/runtime benchmark, not a language-wide ranking. Safety checks, tail-call optimization, interpreter overhead and runtime invocation costs are intrinsic differences and are disclosed rather than artificially disabled. GPU is unsupported for these recursive source algorithms. Raw samples, commands, versions and hashes are in the adjacent JSON.
