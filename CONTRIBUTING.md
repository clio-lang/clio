# Contributing

Install the pinned Bun version and run `bun install --frozen-lockfile`. Before submitting changes, run `bun run check`.

Keep compiler, protocol, and shared runtime code independent from filesystem and host APIs. Add language behavior only with an example, diagnostics, and execution tests. Use architecture notes for semantic decisions that affect multiple packages.

Run `bun run format` for TypeScript, Svelte, JSON, and Markdown. Tiramisu source is excluded from Prettier because there is no configured formatter for that syntax.

Use Bun workspaces and the root `bun.lock`; do not introduce package-local lockfiles or local absolute-path dependencies. Keep packages private until a release layout and package names have been verified.

Documentation is in `apps/website/src/docs/`. Do not present planned commands or language features as working features.
