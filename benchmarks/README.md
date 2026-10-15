# Kalandra local benchmark suite

For the fresh native compiler, use the separate [native CPU scaling suite](../native/benchmarks/README.md). The measurements below concern the JavaScript prototype.

This is a reproducible microbenchmark suite, not a general ranking of programming languages. Start with [the measured report](results/2026-10-13.md). Raw samples, commands, toolchain versions and source hashes are saved beside it.

## Reproduce

From the Kalandra repository root, with its Bun dependencies installed:

```sh
python3 benchmarks/run.py
bun benchmarks/parallel.ts
```

Required tools: Bun, Node, Apple Clang/Clang++, Go, Java/Javac, Python 3 and Ruby. The scripts use existing toolchains; they install nothing. Go's build cache and all compiled artifacts live in ignored `benchmarks/.build/`. Runs overwrite the dated JSON files in `benchmarks/results/`; copy those files first if retaining earlier observations. Run the two commands sequentially, with other CPU-heavy work stopped. Expect desktop background activity and thermal conditions to affect results.

`run.py` compiles Kalandra and the native/JVM programs before measuring. It randomizes the order of language/workload pairs deterministically, uses three separate processes for every pair, and records five warm-up batches plus nine timed batches per process. The reported value is the median of the three process medians. Individual samples and every checksum are retained. There is no forced-GC pass, CPU pinning, frequency control, subtraction of timer overhead or minimum-time selection.

The harness checks every timed result against an independent reference: iterative Fibonacci, exact integer modular arithmetic, or a `math.fsum` dot-product reference. Dot-product results allow relative error `1e-10` and absolute error `1e-8`. Native programs consume warm-up results through a volatile sink and print timed results. Inputs come from process arguments; the dot-product's first element varies per batch item, with a nonzero coefficient.

## Workloads

All times are per **batch**, and each batch contains three kernel invocations:

- **Recursive calls:** naive recursive Fibonacci at 28, 29 and 30. No memoization. The return values are added. This measures a deliberately recursion-heavy kernel, not a good algorithm for computing Fibonacci.
- **Numeric loop:** three 250,000-step recurrences, starting at 123, 124 and 125: `value = (value * 17 + 23) % 1000003`. Kalandra writes direct tail recursion, which the compiler lowers to a loop; other implementations write loops.
- **Array processing:** three sequential dot products over 100,000 values. Array setup is outside timing; the first input element changes inside the batch. Kalandra uses a direct tail-recursive reduction, compiled to a loop. Other implementations use indexed loops. No BLAS, NumPy, typed-array specialization or explicit SIMD libraries.

Kernel data uses binary64 (`Number`/`double`/`float64`/Python float/Ruby Float). Native loop indexes use integers. C uses `fmod` and Go uses `math.Mod`; Java and dynamic runtimes use their remainder operators. A separate **C integer control** uses `uint64_t` for the recurrence, whose bounded inputs make this equivalent. It is not included as a separate full-language row. JIT runtimes may specialize Number operations for the observed integer-valued inputs. Do not interpret a floating-remainder result as a language-wide native-code comparison.

The handwritten JavaScript and generated Kalandra exports use the **same JavaScript harness** under both Node and Bun. The Node measurement is for serial emitted ESM kernels; it does not establish support for Kalandra's managed Bun runtime on Node. C and C++ use the same computational kernels; C++ substitutes `std::vector` for storage allocated before timing. Both use `-O3 -ffp-contract=off`, without fast-math or architecture-specific flags. Go, Java, Python and Ruby use default toolchain settings.

Timing excludes compilation, process launch, module loading, input-array allocation and warm-up. It includes kernel dispatch and accumulation of results. Five warm-up batches do not prove a steady-state JIT plateau, especially for the JVM; raw samples permit checking trends. Tiny native array samples remain sensitive to noise. Memory use, allocation counts, GC pauses, cold-start latency, I/O, services, serialization-heavy jobs and real application throughput are not measured.

## Parallel experiment

`parallel.ts` builds one Kalandra program and runs four independent `fib(34)` tasks through a pool of one worker and then four workers, alternating the order over five trials. Each observation includes creation/closure of a fresh pool, worker startup, scheduling, Sia transport, results and shutdown. Compilation is excluded. Parent-process module imports can be cached after the first observation. All four results must equal 5,702,887.

This is a Kalandra scaling experiment, **not** a comparison against C++ threads, Go goroutines or another language's parallel runtime. Never combine these wall times with the warmed serial-kernel table.

## Historical Clio benchmark audit

The existing `/Users/pouya/Projects/clio-benchmark` was inspected but left unchanged. Its reported results were not used as a performance baseline:

- It selects the minimum of 10,000 individually timed calls; it does not provide a distribution or process repetition.
- Its Go Fibonacci uses machine integers, overflows for the chosen input, and returns no computed value.
- Its Python version uses different initial values and does not return the recursive result; its integer arithmetic differs from JavaScript/C floating-point arithmetic.
- Several versions discard their kernel result, while the C version prints it.
- The run script executes only Go, rather than the documented full suite.

The new suite takes inspiration from the recursive/tail-recursive idea, but uses fresh implementations with checked results. There is **no Clio performance score** here and no claim that the old application ran unchanged.
