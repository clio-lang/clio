const projects = [
  "tsconfig.json",
  "packages/runtime/tsconfig.bun.json",
  "packages/runtime/tsconfig.browser.json",
  ...["compiler", "protocol", "runtime", "language-server", "cli"].map(
    (name) => `packages/${name}/tsconfig.json`,
  ),
];
for (const project of projects) {
  const process = Bun.spawn(
    ["bun", "--bun", "tsc", "--noEmit", "-p", project],
    { stdout: "inherit", stderr: "inherit" },
  );
  const code = await process.exited;
  if (code !== 0) throw new Error(`Type checking failed: ${project}`);
}
