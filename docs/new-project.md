# Create a new project

From the Kalandra development repository:

```sh
bun run cli new ../my-kalandra-app
bun run cli run ../my-kalandra-app/src/main.kalandra --strict
bun run cli build ../my-kalandra-app/src/main.kalandra -o ../my-kalandra-app/build --strict
```

The program returns `[2, 4, 6]`. `src/main.kalandra` imports `double` from `src/math.kalandra` and maps a typed parallel call over three numbers. The starter uses no external dependencies. Bun 1.3.12 is pinned in `.bun-version`.

Creation is offline: the template is embedded in the CLI. There is no template download, package installation, Git initialization or initial commit. The parent directory must already exist, and the destination must not exist—even an empty directory, existing file or symlink is refused. There is no force/overwrite option. A write failure after creation leaves a clearly reported partial project for inspection.

The generated files are:

- `kalandra.toml`, setting `build.source` to `src`.
- `src/main.kalandra` and `src/math.kalandra`.
- `.bun-version`, `.gitignore` and `README.md`.

There is no package.json or invented npm dependency on an unpublished CLI version. The project needs only the existing Kalandra CLI and Bun. The `@kalandra` npm organization is secured; publishing and installation verification are still release preparation.

## Work from the new directory

The generated README uses `kalandra` for a CLI on PATH. Until packages are published, use the source entry directly from your new project directory:

```sh
bun /absolute/path/to/kalandra.dev/packages/cli/src/index.ts run src/main.kalandra --strict
bun /absolute/path/to/kalandra.dev/packages/cli/src/index.ts build src/main.kalandra -o build --strict --watch
```

After building the toolchain, `bun /absolute/path/to/kalandra.dev/dist/cli/index.js` is also supported. Keep its sibling dist packages together. Do not run the development repository's `bun run cli` from a newly generated project; it is a workspace script, not part of the starter.

Watch rebuilds without running the program; Ctrl-C stops it. You can inspect `src/math.kalandra` with `docs`, display `src/main.kalandra` with `highlight`, and verify formatting with `fmt --check` using the same CLI prefix.

The ignore rules exclude build output, node_modules, installed Kalandra Git modules and local environment files. If you later declare Git dependencies, run `kalandra install` and commit `kalandra.lock`. Manage any JavaScript dependencies with Bun separately.
