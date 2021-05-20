# Performance

Our goal is to make Clio fast and we've been successful so far. Current Clio implementation compiles to optimized JavaScript and runs on top of V8. Google's V8 is [very fast](https://www.youtube.com/watch?v=aC_QLLilwso), which in turn makes Clio fast.

Clio uses network based parallelism, this introduces a small overhead in parallel function calls because of serialization, data transfer and network or memory latency, depending on the protocol of choice. The latency is small and can be ignored in most but not all cases: a 1ms latency on a parallel function call for a function call that takes less than 1ms is not justified.

Thanks to the network based parallelism, Clio lets you use network resources and take advantage of the machines available on your network, or are available to you over the internet. One downside of this is the latency. A network delay of under 10ms is achievable, however it is not always available. It's up to the developers to decide which functions are justified to be called over network.

## Links

* [Node js versus C++ g++ fastest programs](https://benchmarksgame-team.pages.debian.net/benchmarksgame/fastest/node-gpp.html)
* [Speed, Speed, Speed: JavaScript vs C++ vs WebAssembly - Franziska Hinkelmann, Google](https://www.youtube.com/watch?v=aC_QLLilwso)
* [Clio benchmarks \(repo\)](https://github.com/clio-lang/examples/tree/master/benchmarks)

