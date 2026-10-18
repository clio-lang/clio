# Kalandra

A functional language and framework for parallel and distributed computing. The next chapter of [Clio](https://clio-lang.org).

Kalandra's native implementation uses C++23 and MLIR/LLVM. It combines immutable values, automatic memory management, structured parallel tasks and explicit GPU execution. Current development targets Apple Silicon with Metal.

```kalandra
fn double(value: int) -> int:
  value * 2

fn main() -> int ! TaskError:
  try parallel:
    try await spawn double(21)
```

Native source files use `.k`. The compiler is under development; the [native implementation guide](native/README.md), [language design](docs/design/core.md) and [roadmap](docs/roadmap.md) describe supported features and remaining work.

## Build from source

Install the matching LLVM/MLIR 22.1.8 toolchain, CMake and Ninja described in the [build guide](native/README.md#build-and-test), then run:

```sh
cmake --preset native
cmake --build --preset native
ctest --preset native
```

Compile and run a native program:

```sh
build/native/native/kalandrac main.k -o program
./program
```

The native toolchain does not require Bun or Node. The earlier JavaScript prototype, its npm release and its website documentation describe a different implementation and are not the native development target.

## Contributors and supporters

Thank you to everyone who contributed code, feedback, documentation, and financial support to Clio and helped keep these ideas alive. That work is part of Kalandra's history.

[See all contributors](https://github.com/kalandra-lang/kalandra/graphs/contributors) · [Contributing guide](CONTRIBUTING.md)

Support ongoing development through [Kalandra on Open Collective](https://opencollective.com/kalandra). Historical acknowledgements, including Ivo Balbaert, are preserved in [backers.md](backers.md).

[![Kalandra backers](https://opencollective.com/kalandra/backers.svg?width=890)](https://opencollective.com/kalandra)

## Origins and license

Kalandra continues the ideas of [Clio](https://clio-lang.org). Its implementation starts fresh here. The website scaffold comes from [Tiramisu Docs](https://github.com/pouya-eghbali/tiramisu-docs).

Apache-2.0. See `LICENSE` and `NOTICE`.
