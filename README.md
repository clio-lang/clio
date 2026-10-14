# Kalandra

A functional programming language and framework for parallel and distributed applications. The next chapter of Clio.

[Website](https://kalandra.dev) · [Documentation](https://kalandra.dev/docs) · [Playground](https://kalandra.dev/docs/playground) · [Support Kalandra](https://opencollective.com/kalandra)

Kalandra compiles to JavaScript. Run independent functions in workers, import typed remote services, and compose their results. The language, runtime, and tools work together to reduce the machinery you write to distribute work.

```kalandra
@params Number
fn double value: value * 2

export fn main:
  [1 2 3] -> * [await] |double|
```

This returns `[2, 4, 6]` through typed parallel calls. The browser playground uses Web Workers; local projects use Bun subprocess workers. Remote services are experimental.

## Clio, continued

Kalandra 0.13.0 continues from Clio 0.12.0 with a rebuilt compiler, runtime, tooling, and Tiramisu documentation. Clio's commits, tags, and contributor history remain in this repository. The new language uses `.kalandra` files and does not provide a legacy migration layer.

The npm release and new website deployment are being prepared. Until those steps are complete, public links may still show the previous project; the new site can be previewed locally with the development commands below.

**Status: development preview; verified port milestone complete within its [recorded scope](docs/port-acceptance.md).** Kalandra compiles to JavaScript ESM with source maps. Typed parallel tasks run in bounded Bun subprocess pools and browser workers, with nested scheduling, cancellation and compiler-generated Sia schemas. Experimental authenticated services support checked remote imports and service chaining. The CLI provides offline project creation, build/run/watch, formatting, source documentation and terminal highlighting; the language server provides diagnostics and editing support.

Explore the Tiramisu language guide and browser playground through `bun run dev`, or [create a local project](docs/new-project.md). The first revival release is being prepared. npm packages are not published yet; production remote deployment and the deferred language-design work remain ahead. See the [current limits](docs/language-design-backlog.md) and [release queue](docs/port-completion.md).

## Installation (0.13.0 release preparation)

The primary user installation will be from npm. These commands are the release target; packages are **not published yet**. They must pass clean packed-artifact and registry checks before the website launches.

With Bun 1.3.12 or newer installed:

```sh
bun add --global @kalandra/cli@0.13.0
kalandra --version
kalandra new my-app
cd my-app
kalandra run src/main.kalandra --strict
```

The starter returns `[2, 4, 6]`. See the [installation guide](apps/website/src/docs/getting-started.tiramisu). Source setup below is for contributors.

## Development

Use **Bun 1.3.12** (pinned in `.bun-version` and `package.json`). Bun is the package manager, development runtime, bundler for library scaffolds, and test runner. Node is not required for the documented development commands. Browser portability remains a compiler requirement; production runtime support will be established through integration tests.

```sh
bun install --frozen-lockfile
bun run check
bun run dev
```

The website development server prints its local address. `bun run dev` starts the Tiramisu Docs site, not a Kalandra program runner. Use it while editing the website. For production preview, stop any existing preview process, run `bun run build:website`, then start `bun run --filter @kalandra/website preview`. Reload open preview tabs after rebuilding: old pages reference the previous build’s hashed JavaScript chunks. Do not rebuild underneath a running preview server.

| Command                                       | Purpose                                                         |
| --------------------------------------------- | --------------------------------------------------------------- |
| `bun run cli docs <file.kalandra> [function]` | Inspect function declarations and literal descriptions          |
| `bun run cli highlight <file.kalandra>`       | Display source with terminal syntax colors                      |
| `bun run cli new ../my-kalandra-app`          | Create an offline, dependency-free starter                      |
| `bun run cli --help`                          | Inspect the development CLI                                     |
| `bun run cli check <file> [--strict]`         | Check names and known types in one source file                  |
| `bun run cli compile <file> -o output.mjs`    | Compile supported source to ESM and a source-map sidecar        |
| `bun run cli build <entry.kalandra> -o out`   | Build local modules and resolve JavaScript packages             |
| `bun run cli run examples/parallel.kalandra`  | Run a parallel program with managed worker cleanup              |
| `bun run cli parse <file>`                    | Parse source and print its AST; syntax checking only            |
| `bun test`                                    | Clio syntax, semantic analysis, toolchain, and CLI checks       |
| `bun run typecheck`                           | Strict TypeScript and Svelte checks                             |
| `bun run format`                              | Format supported source files                                   |
| `bun run format:check`                        | Verify formatting                                               |
| `bun run build:packages`                      | Build package scaffolds and declarations into `dist/`           |
| `bun run build:website`                       | Generate the static website in `apps/website/build/`            |
| `bun run lsp`                                 | Start the Bun stdio language server                             |
| `bun run test:browser`                        | Real-browser compiler checks; open the printed localhost URL    |
| `bun run check`                               | Formatting, types, tests, builds, and isolated CLI smoke checks |

The separate `bun run test:network` and `bun run test:network --built` commands verify the [authenticated remote runtime](docs/network-execution.md), including explicit cancellation and worker cleanup. Builds can generate deployment and client manifests with `--service id=export`; the runtime exports a Bun hosting API. Separately compiled clients use `remote:./contract.json` imports and runtime endpoint bindings. Use `serve out/kalandra.deployment.json` to host services and `run main.kalandra --bindings endpoints.json` to bind clients. Tokens are read from environment variables. Production TLS deployment remains pending.

## Workspace

| Directory                  | Responsibility                                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/compiler`        | Chevrotain front end and independent AST; single-file and local project analysis, typed IR, and Babel ESM emission for a supported subset |
| `packages/runtime`         | Host-independent scheduler and validated task data; Bun subprocess worker adapter                                                         |
| `packages/protocol`        | Sia 2.3 typed task schemas, versioned frames, and bounded codecs                                                                          |
| `packages/language-server` | Project diagnostics, navigation, completion, and rename with unsaved overlays and workspace source discovery; Bun stdio LSP               |
| `packages/cli`             | Bun CLI entry point                                                                                                                       |
| `apps/website`             | SvelteKit + Tiramisu Docs; content in `src/docs/*.tiramisu`                                                                               |
| `tests`                    | Clio reference corpus, structural AST tests, toolchain and CLI checks                                                                     |
| `docs`                     | Architecture decisions and staged roadmap                                                                                                 |

Workspace packages stay private and export TypeScript sources for development. `bun run release:pack` builds a self-contained `@kalandra/cli` archive in `dist/release/`, including the compiler, runtimes, worker files, and language server. `bun run release:check` verifies a clean archive installation. npm publication and website deployment remain separate release steps. The repository is https://github.com/kalandra-lang/kalandra.

Committed Clio syntax is the initial compatibility baseline. Deferred semantics and preserved quirks are recorded in the [language design backlog](docs/language-design-backlog.md). See the [compiler port inventory](docs/compiler-port.md) for coverage, provenance, and remaining work. Kalandra is a new language with no Clio migration contract: sources use `.kalandra`, projects use `kalandra.toml`, and installed packages live under `.kalandra/modules`. Original Clio fixtures are historical test evidence only.

See [editor diagnostics](docs/language-server.md) for language-server setup. See [browser verification](docs/browser-verification.md) for the tested browser baseline and limitations.

Start with [creating a new project](docs/new-project.md), or try [compiling the Fibonacci example](docs/javascript-target.md) or [building a multi-file project](docs/project-build.md). The [local runtime example](docs/local-runtime.md) executes compiled functions in parallel. See [semantic analysis](docs/semantic-analysis.md), [architecture](docs/architecture.md), [roadmap](docs/roadmap.md), and [contributing](CONTRIBUTING.md).

## Benchmarks

The [local benchmark report](benchmarks/results/2026-10-13.md) compares serial Kalandra output on Bun/Node with handwritten JavaScript, C, C++, Go, Java, Python and Ruby, plus a separate Kalandra worker-scaling experiment. [Sources and methodology](benchmarks/README.md) include correctness checks, raw samples and reproduction commands. These microbenchmarks are not an overall language ranking.

## Contributors and supporters

Thank you to everyone who contributed code, feedback, documentation, and financial support to Clio and helped keep these ideas alive. That work is part of Kalandra's history.

[See all contributors](https://github.com/kalandra-lang/kalandra/graphs/contributors) · [Contributing guide](CONTRIBUTING.md)

Support ongoing development through [Kalandra on Open Collective](https://opencollective.com/kalandra). Historical acknowledgements, including Ivo Balbaert, are preserved in [backers.md](backers.md).

[![Kalandra backers](https://opencollective.com/kalandra/backers.svg?width=890)](https://opencollective.com/kalandra)

## Origins and license

Kalandra continues the ideas of [Clio](https://clio-lang.org). Its implementation starts fresh here. The website scaffold comes from [Tiramisu Docs](https://github.com/pouya-eghbali/tiramisu-docs).

Apache-2.0. See `LICENSE` and `NOTICE`.
