# Equivalent source algorithm comparison

Same binary recursive traversal and leaf computation; all actual inputs fit int64 and dyadic results are exact float64. No tensor/reduction/matrix built-ins or numerical libraries. Kalandra includes checked arithmetic, invocation admission/cancellation and call-depth checks; other runtimes retain their default semantics. C++/Rust/Go may optimize recursion normally. No GPU general recursion support; GPU entries are unsupported, not replaced by built-ins.

Three fresh processes per cell, two warmups and seven measured batches; median of process medians. Setup and process startup excluded; function execution and normal runtime overhead included. All warmup/measured checksums match independent integer/Fraction or standard GCD references exactly.

| Algorithm | Depth / leaves | Kalandra µs | C++ µs | Go µs | Rust µs | Python µs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| polynomial | 10 / 1,024 | 7.912 | 2.453 | 2.219 | 2.641 | 129.388 |
| polynomial | 14 / 16,384 | 126.879 | 38.623 | 34.924 | 41.804 | 2086.266 |
| branches | 10 / 1,024 | 7.781 | 3.087 | 3.308 | 3.090 | 146.718 |
| branches | 14 / 16,384 | 125.092 | 49.135 | 53.104 | 49.509 | 2420.692 |
| euclid | 10 / 1,024 | 31.395 | 7.452 | 9.767 | 8.898 | 438.238 |
| euclid | 14 / 16,384 | 538.946 | 124.446 | 166.362 | 167.341 | 7002.500 |

This is a narrow source/runtime benchmark, not a language-wide ranking. Safety checks, tail-call optimization, interpreter overhead and runtime invocation costs are intrinsic differences and are disclosed rather than artificially disabled. GPU is unsupported for these recursive source algorithms. Raw samples, commands, versions and hashes are in the adjacent JSON.
