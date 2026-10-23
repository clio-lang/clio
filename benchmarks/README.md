# Kalandra native benchmarks

Use the [native benchmark guide](../native/benchmarks/README.md) for CPU kernels, scheduler overhead, tensor shapes and Apple Metal measurements. The harnesses live in `native/benchmarks`; raw samples, commands, source hashes and reports live in `benchmarks/results`.

Measurements describe their recorded hardware, toolchain and workloads. Read each report’s numerical, ownership and timing boundaries before comparing results. Generated benchmark artifacts belong in the ignored `benchmarks/.build` directory.

`benchmarks/.build` is disposable: it contains binaries, compiler/module caches and temporary outputs, and the harnesses recreate it. Keep `benchmarks/results` with the reports they support. Its raw JSON contains samples and artifact hashes used by the qualification evidence; deleting those files would leave unsupported reports and broken references. The current recorded results total about 31 MB uncompressed (about 2.4 MB with gzip). If storage becomes a concern, move them to a versioned compressed evidence archive and update the readers and references together.
