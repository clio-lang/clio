import assert from "node:assert/strict";
import { startWatch } from "./watch-cli.js";
import { mkdir, readdir, symlink } from "node:fs/promises";
import { join } from "node:path";

export async function verifyNewCli(cli: string, directory: string) {
  const project = join(directory, "new project λ");
  const run = (args: string[], cwd = directory) =>
    Bun.spawnSync([process.execPath, cli, ...args], {
      cwd,
      env: { ...process.env, PATH: "" },
    });
  const created = run(["new", project]);
  assert.equal(created.exitCode, 0, created.stderr.toString());
  assert.match(created.stdout.toString(), /Expected main result/);
  assert.deepEqual((await readdir(project)).sort(), [
    ".bun-version",
    ".gitignore",
    "README.md",
    "kalandra.toml",
    "src",
  ]);
  assert.deepEqual((await readdir(join(project, "src"))).sort(), [
    "main.kalandra",
    "math.kalandra",
  ]);
  const main = await Bun.file(join(project, "src/main.kalandra")).text();
  const readme = await Bun.file(join(project, "README.md")).text();
  assert.match(readme, /not yet a published npm installation/);
  // Commands from the generated README, with the CLI path supplied directly.
  for (const args of [
    ["run", "src/main.kalandra", "--strict"],
    ["build", "src/main.kalandra", "-o", "build", "--strict"],
    ["docs", "src/math.kalandra", "double"],
    ["highlight", "src/main.kalandra"],
    ["fmt", "src/main.kalandra", "--check"],
    ["fmt", "src/math.kalandra", "--check"],
  ]) {
    const result = run(args, project);
    assert.equal(
      result.exitCode,
      0,
      `${args.join(" ")}: ${result.stderr.toString()}`,
    );
    if (args[0] === "run")
      assert.deepEqual(JSON.parse(result.stdout.toString()), [2, 4, 6]);
  }
  assert.equal(
    await Bun.file(join(project, "build/main.kalandra.mjs")).exists(),
    true,
  );
  const watch = startWatch(
    cli,
    join(project, "src/main.kalandra"),
    join(project, "build"),
  );
  try {
    await watch.until(() => watch.count("Watch: build succeeded") === 1);
    await watch.stop();
  } finally {
    if (watch.child.exitCode === null) {
      watch.child.kill("SIGKILL");
      await watch.child.exited;
    }
  }
  const second = run(["new", project]);
  assert.equal(second.exitCode, 1);
  assert.match(second.stderr.toString(), /already exists/);
  assert.equal(await Bun.file(join(project, "src/main.kalandra")).text(), main);
  const empty = join(directory, "existing-empty");
  await mkdir(empty);
  const link = join(directory, "linked-project");
  await symlink(project, link);
  const occupied = join(directory, "occupied-file");
  await Bun.write(occupied, "keep");
  for (const target of [
    empty,
    link,
    occupied,
    join(directory, "missing-parent/project"),
  ]) {
    const result = run(["new", target]);
    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout.toString(), "");
  }
  assert.deepEqual(await readdir(empty), []);
  assert.equal(await Bun.file(occupied).text(), "keep");
  for (const args of [
    ["new"],
    ["new", ""],
    ["new", "--force"],
    ["new", "uncreated", "extra"],
  ])
    assert.equal(run(args).exitCode, 1);
}
