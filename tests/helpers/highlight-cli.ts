import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function verifyHighlightCli(cli: string, directory: string) {
  const file = join(directory, "highlight.kalandra");
  const source =
    '-- Unicode: λ 😀\r\n@describe "quoted"\r\nexport fn double x:\r\n  f"value {x * 2}"';
  await Bun.write(file, source);
  const before = await readdir(directory);
  const run = (...args: string[]) =>
    Bun.spawnSync([process.execPath, cli, "highlight", file, ...args], {
      env: { ...process.env, NO_COLOR: "1", TERM: "dumb" },
    });
  const colored = run("--color", "always");
  assert.equal(colored.exitCode, 0, colored.stderr.toString());
  assert.match(colored.stdout.toString(), /\x1b\[/);
  assert.equal(
    colored.stdout.toString().replace(/\x1b\[[0-9;]*m/g, ""),
    source,
  );
  for (const args of [[], ["--color", "auto"], ["--color", "never"]]) {
    const plain = run(...args);
    assert.equal(plain.exitCode, 0, plain.stderr.toString());
    assert.equal(plain.stdout.toString(), source);
  }
  for (const args of [
    ["--color"],
    ["--color", "yes"],
    ["--json"],
    ["--color", "always", "extra"],
  ]) {
    const failed = run(...args);
    assert.equal(failed.exitCode, 1);
    assert.equal(failed.stdout.toString(), "");
  }
  assert.deepEqual(await readdir(directory), before);
  assert.equal(await Bun.file(file).text(), source);
  await Bun.write(file, "!");
  const invalid = run("--color", "always");
  assert.equal(invalid.exitCode, 1);
  assert.equal(invalid.stdout.toString(), "");
  assert.match(invalid.stderr.toString(), /KAL1001/);
  await Bun.write(file, new Uint8Array([45, 45, 32, 255]));
  const invalidEncoding = run();
  assert.equal(invalidEncoding.exitCode, 1);
  assert.equal(invalidEncoding.stdout.toString(), "");
  assert.match(invalidEncoding.stderr.toString(), /UTF-8/);
  const missing = Bun.spawnSync([
    process.execPath,
    cli,
    "highlight",
    join(directory, "missing.kalandra"),
  ]);
  assert.equal(missing.exitCode, 1);
  assert.match(missing.stderr.toString(), /Cannot read source/);
}
